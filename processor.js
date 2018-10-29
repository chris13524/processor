"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * A wrapper class for a web worker. Makes the whole thing much simpler.
 */
var Processor = /** @class */ (function () {
    function Processor(func, libs) {
        if (libs === void 0) { libs = []; }
        var _this = this;
        this.worker = null;
        this.handlers = new Map();
        this.handlerId = 0;
        this.ready = false;
        this.pendingWork = [];
        // generate the JavaScript code to be executed by the worker
        var funcString = func.toString();
        var workerCodeFuncString = this.workerCode.toString();
        var workerCode = "(" + workerCodeFuncString + ")(" + funcString + ");";
        var result = Processor.workerFromCode(workerCode);
        this.worker = result.worker;
        // hook into the worker's events
        this.worker.addEventListener("message", function (e) {
            if (_this.worker == null)
                return;
            if (e.data == "init") {
                URL.revokeObjectURL(result.blobUrl);
                // send the libs to the worker
                _this.worker.postMessage({
                    libs: libs
                });
                return;
            }
            else if (e.data == "ready") {
                _this.ready = true;
                for (var _i = 0, _a = _this.pendingWork; _i < _a.length; _i++) {
                    var work = _a[_i];
                    _this.worker.postMessage(work);
                }
                return;
            }
            // get the handler function
            var key = e.data.id;
            var fn = _this.handlers.get(key);
            if (fn == undefined) {
                throw new Error("Cannot send worker result to handler because handler doesn't exist for key: " + key);
            }
            else {
                // send the worker result to the handler
                fn(e.data.output);
                // remove the response handler
                _this.handlers.delete(key);
            }
        });
    }
    Processor.workerFromCode = function (code) {
        // convert it into a URL because workers only accept URLs
        var workerUrl = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
        // create the worker
        var worker = new Worker(workerUrl);
        return { worker: worker, blobUrl: workerUrl };
    };
    /**
     * This function is what is called from inside the worker. Do not call this directly!
     * @param {(IN) => OUT} func - the function to execute
     */
    Processor.prototype.workerCode = function (func) {
        // listen to the messages sent to the worker
        var libsNeedLoading = 0;
        self.addEventListener("message", function (e) {
            if (e.data.libs != null) {
                var _loop_1 = function (lib) {
                    libsNeedLoading++;
                    var request = new XMLHttpRequest();
                    request.onreadystatechange = function () {
                        if (request.readyState == 4) {
                            eval(request.responseText);
                            libsNeedLoading--;
                            if (libsNeedLoading == 0) {
                                postMessage("ready");
                            }
                        }
                    };
                    request.open("GET", lib);
                    request.send();
                };
                // load libs specified
                for (var _i = 0, _a = e.data.libs; _i < _a.length; _i++) {
                    var lib = _a[_i];
                    _loop_1(lib);
                }
                if (libsNeedLoading == 0) {
                    postMessage("ready");
                }
            }
            else {
                // call the work function
                var output = func(e.data.input);
                // send the response
                var workerOutput = {
                    id: e.data.id,
                    output: output
                };
                postMessage(workerOutput);
            }
        });
        postMessage("init");
    };
    /**
     * Sends the given input to the worker function to execute.
     * @param {IN} input - the data to be processed
     * @param {(OUT) => void} response - the handler function for when the data is finished processing
     * @param libs
     */
    Processor.prototype.process = function (input, response) {
        if (this.worker == null) {
            throw new Error("worker already terminated");
        }
        var subscribed = true;
        var subscription = new Subscription(function () {
            subscribed = false;
        });
        // get a new handler ID
        var handlerId = this.handlerId;
        this.handlerId++;
        // store a handler for this job
        this.handlers.set(handlerId, function (item) {
            if (subscribed) {
                response(item);
            }
        });
        // send the data to the worker for processing
        var workerInput = {
            id: handlerId,
            input: input,
            libs: null
        };
        if (this.ready) {
            this.worker.postMessage(workerInput);
        }
        else {
            this.pendingWork.push(workerInput);
        }
        return subscription;
    };
    /**
     * Stops the worker thread.
     */
    Processor.prototype.terminate = function () {
        if (this.worker != null) {
            this.worker.terminate();
            this.worker = null;
        }
    };
    /**
     * Performs a one-time job through the given function.
     * @param {(IN) => OUT} func
     * @param {IN} input
     * @param {(OUT) => void} response
     * @param libs
     */
    Processor.process = function (func, input, response, libs) {
        if (libs === void 0) { libs = []; }
        var processor = new Processor(func, libs);
        processor.process(input, function (out) {
            processor.terminate();
            response(out);
        });
    };
    return Processor;
}());
exports.Processor = Processor;
/**
 * A structure that describes the input to a worker.
 */
var WorkerInput = /** @class */ (function () {
    function WorkerInput() {
    }
    return WorkerInput;
}());
/**
 * A structure that describes the output of a worker.
 */
var WorkerOutput = /** @class */ (function () {
    function WorkerOutput() {
    }
    return WorkerOutput;
}());
