declare const postMessage: (param: any) => void; // function called from inside the worker

/**
 * A wrapper class for a web worker. Makes the whole thing much simpler.
 */
export class Processor<IN, OUT> {
	private worker: Worker | null = null;
	private handlers: Map<number, ((output: OUT) => void)> = new Map();
	private handlerId = 0;
	private ready = false;
	private pendingWork: WorkerInput<IN>[] = [];
	
	constructor(func: (input: IN) => OUT, libs: string[] = []) {
		// generate the JavaScript code to be executed by the worker
		let funcString = func.toString();
		let workerCodeFuncString = this.workerCode.toString();
		let workerCode = `(${workerCodeFuncString})(${funcString});`;
		
		let result = Processor.workerFromCode(workerCode);
		this.worker = result.worker;
		
		// hook into the worker's events
		this.worker.addEventListener("message", (e: { data: WorkerOutput<OUT> | "init" | "ready" }) => {
			if (this.worker == null) return;
			
			if (e.data == "init") {
				URL.revokeObjectURL(result.blobUrl);
				
				// send the libs to the worker
				this.worker.postMessage({
					libs: libs
				});
				
				return;
			} else if (e.data == "ready") {
				this.ready = true;
				for (let work of this.pendingWork) {
					this.worker.postMessage(work);
				}
				return;
			}
			
			// get the handler function
			let key = e.data.id;
			let fn = this.handlers.get(key);
			if (fn == undefined) {
				throw new Error("Cannot send worker result to handler because handler doesn't exist for key: " + key)
			} else {
				// send the worker result to the handler
				fn(e.data.output);
				
				// remove the response handler
				this.handlers.delete(key);
			}
		});
	}
	
	private static workerFromCode(code: string): { worker: Worker, blobUrl: string } {
		// convert it into a URL because workers only accept URLs
		let workerUrl = URL.createObjectURL(new Blob([code], {type: "text/javascript"}));
		
		// create the worker
		let worker = new Worker(workerUrl);
		
		return {worker: worker, blobUrl: workerUrl};
	}
	
	/**
	 * This function is what is called from inside the worker. Do not call this directly!
	 * @param {(IN) => OUT} func - the function to execute
	 */
	private workerCode(func: (output: IN) => OUT): void {
		// listen to the messages sent to the worker
		let libsNeedLoading = 0;
		self.addEventListener("message", (e: { data: WorkerInput<IN> }) => {
			if (e.data.libs != null) {
				// load libs specified
				for (let lib of e.data.libs) {
					libsNeedLoading++;
					let request = new XMLHttpRequest();
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
				}
				if (libsNeedLoading == 0) {
					postMessage("ready");
				}
			} else {
				// call the work function
				let output = func(e.data.input);
				
				// send the response
				let workerOutput: WorkerOutput<OUT> = {
					id: e.data.id,
					output: output
				};
				postMessage(workerOutput);
			}
		});
		
		postMessage("init");
	}
	
	/**
	 * Sends the given input to the worker function to execute.
	 * @param {IN} input - the data to be processed
	 * @param {(OUT) => void} response - the handler function for when the data is finished processing
	 * @param libs
	 */
	public process(input: IN, response: (output: OUT) => void): Subscription {
		if (this.worker == null) {
			throw new Error("worker already terminated");
		}
		
		let subscribed = true;
		let subscription = new Subscription(() => {
			subscribed = false;
		});
		
		// get a new handler ID
		let handlerId = this.handlerId;
		this.handlerId++;
		
		// store a handler for this job
		this.handlers.set(handlerId, item => {
			if (subscribed) {
				response(item);
			}
		});
		
		// send the data to the worker for processing
		let workerInput: WorkerInput<IN> = {
			id: handlerId,
			input: input,
			libs: null
		};
		
		if (this.ready) {
			this.worker.postMessage(workerInput);
		} else {
			this.pendingWork.push(workerInput);
		}
		
		return subscription;
	}
	
	/**
	 * Stops the worker thread.
	 */
	public terminate(): void {
		if (this.worker != null) {
			this.worker.terminate();
			this.worker = null;
		}
	}
	
	/**
	 * Performs a one-time job through the given function.
	 * @param {(IN) => OUT} func
	 * @param {IN} input
	 * @param {(OUT) => void} response
	 * @param libs
	 */
	public static process<IN, OUT>(
			func: (input: IN) => OUT,
			input: IN,
			response: (output: OUT) => void,
			libs: string[] = []
	): void {
		let processor = new Processor(func, libs);
		processor.process(input, out => {
			processor.terminate();
			response(out);
		});
	}
}

/**
 * A structure that describes the input to a worker.
 */
class WorkerInput<IN> {
	id: number;
	input: IN;
	libs: string[] | null;
}

/**
 * A structure that describes the output of a worker.
 */
class WorkerOutput<OUT> {
	id: number;
	output: OUT;
}