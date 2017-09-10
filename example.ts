import {Processor} from "./processor";


/* == using a processor instance == */

let processor = new Processor<[number, number], number>(([first, second]) => { // this uses a tuple as a parameter, but feel free to use whatever type you like
	return first * second;
});

let first1 = 3;
let second1 = 5;
processor.process([first1, second1], result => {
	console.log(result); // prints 15
});

processor.terminate();


/* == one-off job == */

let first2 = 3;
let second2 = 5;
Processor.process<[number, number], number>(([first, second]) => {
	return first * second;
}, [first2, second2], result => {
	console.log(result); // prints 15
});