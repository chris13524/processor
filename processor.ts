declare const postMessage: (any) => void; // function called from inside the worker

/**
 * A wrapper class for a web worker. Makes the whole thing much simpler.
 */
export class Processor<IN, OUT> {
	private worker: Worker;
	private handlers: ((OUT) => void)[] = [];
	
	constructor(func: (IN) => OUT) {
		// generate the Javascript code to be executed by the worker
		let funcString = func.toString();
		let workerCodeFuncString = this.workerCode.toString();
		let workerCode = `(${workerCodeFuncString})(${funcString});`;
		
		// convert it into a URL because workers only accept URLs
		let url = URL.createObjectURL(new Blob([workerCode], {type: "text/javascript"}));
		
		// create the worker
		this.worker = new Worker(url);
		
		// hook into the worker's events
		this.worker.addEventListener("message", (e: { data: WorkerOutput<OUT> }) => {
			// send the worker result to the handler
			this.handlers[e.data.id](e.data.output);
			
			// remove the response handler 
			this.handlers.splice(e.data.id);
		});
	}
	
	/**
	 * This function is what is called from inside the worker.
	 * @param {(IN) => OUT} func - the function to execute
	 */
	private workerCode(func: (IN) => OUT): void {
		// listen to the messages sent to the worker
		self.addEventListener("message", (e: { data: WorkerInput<IN> }) => {
			// call the work function
			let output = func(e.data.input);
			
			// send the response
			let workerOutput: WorkerOutput<OUT> = {
				id: e.data.id,
				output: output
			};
			postMessage(workerOutput);
		});
	}
	
	/**
	 * Sends the given input to the worker function to execute.
	 * @param {IN} input - the data to be processed
	 * @param {(OUT) => void} response - the handler function for when the data is finished processing
	 */
	public process(input: IN, response: (OUT) => void): void {
		if (this.worker == null) {
			throw new Error("worker already terminated");
		}
		
		// store a handler for this job
		this.handlers.push(response);
		
		// send the data to the worker for processing
		let workerInput: WorkerInput<IN> = {
			id: this.handlers.length - 1,
			input: input
		};
		this.worker.postMessage(workerInput);
	}
	
	/**
	 * Stops the worker thread.
	 */
	public terminate(): void {
		this.worker.terminate();
		this.worker = null;
	}
	
	/**
	 * Performs a one-time job through the given function.
	 * @param {(IN) => OUT} func
	 * @param {IN} input
	 * @param {(OUT) => void} response
	 */
	public static process<IN, OUT>(func: (IN) => OUT, input: IN, response: (OUT) => void): void {
		let processor = new Processor(func);
		processor.process(input, out => {
			processor.terminate();
			response(out);
		});
	}
}

class WorkerInput<IN> {
	id: number;
	input: IN;
}

class WorkerOutput<OUT> {
	id: number;
	output: OUT;
}