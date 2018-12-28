
const parse = require("papaparse");
const fs = require("fs");

/**
 * @param {Array} a items An array containing the items.
 */
function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

fs.readFile("../all/train.csv",(err, fileCSV) =>  {

	console.log();
	const {data, errors, meta} = parse.parse(fileCSV.toString(), {delimiter: ",",});
	


// console.log(errors);
// console.log(data);
// console.log(meta);


// counts the number of each label: 

const {total, uniq} = data
.slice(1,data.length-1)
// .slice(1,3)
.reduce((result, [id, classString]) => {
	const classNumbers = classString
	.split(" ");

	classNumbers.forEach(classNumber => {
		const totalIndex =result.total.findIndex((element) => 
			element.classNumber === classNumber);
		
		if(totalIndex < 0){
			result.total.push({classNumber, values: 1});
		}else{
			result.total[totalIndex].values = result.total[totalIndex].values+1;
		}
		
		if(classNumbers.length > 1) return;
		
		const uniqIndex =result.uniq.findIndex((element) => element.classNumber === classNumber);
		if(uniqIndex < 0){
			result.uniq.push({classNumber, values: 1, ids: [id]});
		}else{
			result.uniq[uniqIndex].values = result.uniq[uniqIndex].values+1;
			result.uniq[uniqIndex].ids.push(id);
		}
	});
	return result;
}, {total: [], uniq: []});


const nonUniq = total.reduce((nonUniq, {classNumber} )=> {
	if(!uniq.find(element => element.classNumber === classNumber)){
		nonUniq.push(classNumber);
	}
	return nonUniq;
}, [])

// console.log("uniq", uniq);
// console.log("nonUniq", nonUniq);

// build train and test data: take a third to train and 2 third to test
const MAX_PER_CAT = 6;
const MAX_CAT = 2;


const {train, test} = uniq
.filter(({ids}) => ids.length > 2)
.slice(0, MAX_CAT)
.reduce(({train, test}, {classNumber, ids}) => {
	const shuffled = shuffle(ids).slice(0, 3* MAX_PER_CAT);
	train.push({
		classNumber,
		ids: shuffled.slice(0,Math.floor(shuffled.length/3))
	})
	test.push({
		classNumber,
		ids: shuffled.slice(Math.floor(shuffled.length/3), shuffled.length)
	})
	return {train, test};

}, {train: [], test: []}) 

fs.writeFile("./train.json", JSON.stringify(train), () => {});	
fs.writeFile("./test.json", JSON.stringify(test), () => {});	

});
