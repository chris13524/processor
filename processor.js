"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * A wrapper class for a web worker. Makes the whole thing much simpler.
 */
var Processor = (function () {
    function Processor(func) {
        var _this = this;
        this.handlers = [];
        // generate the Javascript code to be executed by the worker
        var funcString = func.toString();
        var workerCodeFuncString = this.workerCode.toString();
        var workerCode = "(" + workerCodeFuncString + ")(" + funcString + ");";
        // convert it into a URL because workers only accept URLs
        var url = URL.createObjectURL(new Blob([workerCode], { type: "text/javascript" }));
        // create the worker
        this.worker = new Worker(url);
        // hook into the worker's events
        this.worker.addEventListener("message", function (e) {
            // send the worker result to the handler
            _this.handlers[e.data.id](e.data.output);
            // remove the response handler 
            _this.handlers.splice(e.data.id);
        });
    }
    /**
     * This function is what is called from inside the worker.
     * @param {(IN) => OUT} func - the function to execute
     */
    Processor.prototype.workerCode = function (func) {
        // listen to the messages sent to the worker
        self.addEventListener("message", function (e) {
            // call the work function
            var output = func(e.data.input);
            // send the response
            var workerOutput = {
                id: e.data.id,
                output: output
            };
            postMessage(workerOutput);
        });
    };
    /**
     * Sends the given input to the worker function to execute.
     * @param {IN} input - the data to be processed
     * @param {(OUT) => void} response - the handler function for when the data is finished processing
     */
    Processor.prototype.process = function (input, response) {
        if (this.worker == null) {
            throw new Error("worker already terminated");
        }
        // store a handler for this job
        this.handlers.push(response);
        // send the data to the worker for processing
        var workerInput = {
            id: this.handlers.length - 1,
            input: input
        };
        this.worker.postMessage(workerInput);
    };
    /**
     * Stops the worker thread.
     */
    Processor.prototype.terminate = function () {
        this.worker.terminate();
        this.worker = null;
    };
    /**
     * Performs a one-time job through the given function.
     * @param {(IN) => OUT} func
     * @param {IN} input
     * @param {(OUT) => void} response
     */
    Processor.process = function (func, input, response) {
        var processor = new Processor(func);
        processor.process(input, function (out) {
            processor.terminate();
            response(out);
        });
    };
    return Processor;
}());
exports.Processor = Processor;
var WorkerInput = (function () {
    function WorkerInput() {
    }
    return WorkerInput;
}());
var WorkerOutput = (function () {
    function WorkerOutput() {
    }
    return WorkerOutput;
}());
