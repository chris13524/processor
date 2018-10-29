# Processor
This is a simple wrapper for Javascript [web workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers).

Why use a processor? Well if you have an algorithm that takes a lot of time to compute, you don't want that hogging up your UI thread. So you'll want to use a web worker.

Why use this library over a regular web worker? Web workers don't accept functions, they accept a URL to a Javascript file. They also use this odd event messaging system. And if you're like me, I don't like this. This library makes it simple to just drop it into your code.

## Usage
Copy processor.ts into your project (you could maybe do something with processor.js too, but I haven't tried it).

First, create the processor like so:
```
let processor = new Processor<InputType, OutputType>((input: InputType) => {
	let output: OutputType = /* process input */;
	return output;
});
```

Then you can send jobs to it like so:
```
let input: InputType = /* something to process */;
processor.process(input, (output: OutputType) => {
	/* do something with output */
});
```

And finally, be sure to clean up the processor when you're done using `processor.terminate()`. Not doing this could cause memory leaks. If you're storing the processor reference somewhere safe where it will never be lost (such as a global variable), then you don't need to worry about terminating it.

For those only wanting to process stuff once, use the convenience method `Processor.process()`. The `terminate()` method will automatically be called upon completion.
```
let input: InputType = /* something to process */;
Processor.process((input: InputType) => {
	let output: OutputType = /* process input */;
	return output;
}, input, (output: OutputType) => {
	/* do something with output */
});
```

You can also provide an array of URLs for JS libraries. These libraries will be loaded before any of your work starts processing:
```
let processor = new Processor<InputType, OutputType>((input: InputType) => {
	let output: OutputType = /* process input */;
	return output;
}, ["https://example.com/path/to/date.js"]);
```

## Restrictions
You cannot capture any scope in the function you pass to the processor. Web workers run in their own little environment in the browser, so if you're trying to use `this`, you'll get runtime errors. Any data you want to process must be explicitally passed through the `input` parameter.

Also, any data passed to the processor will be **copied**. So don't try and be smart and pass `this`, while it will probally allow you to "capture" the data, it will be wasteful.

## Example
See example.ts.

## Unlicense
This code is put in the public domain. Feel free to use it however you please ;)