const {Image} = require("image-js"); 
const svm = require("node-svm");
const fs = require("fs");


const maxLoad = 1;
const loadStack = []
const train = {

	reading: 0,
	clf:null,

	_readImage(){

		if(this.reading >= maxLoad){
			return;
		}

		const {id, callback, callbackQueueEnd} = loadStack.shift();
		this.reading+=1;
		return Promise
		.all([
			Image.load("../all/train/"+id+"_red.png"),
			Image.load("../all/train/"+id+"_green.png"),
			Image.load("../all/train/"+id+"_blue.png"),
		])
		.then(images => {
			callback(images);
			this.reading-=1;
			if(loadStack.length ===0){
				return callbackQueueEnd();
			}
			return this._readImage();
		})
	},

	readImage(id, callback, callbackQueueEnd){
		loadStack.push({id, callback, callbackQueueEnd});
		this._readImage();
	},

	getPixel(rgb, x, y){
		return [
			rgb[0].getPixelXY(x, y)[0],
			rgb[1].getPixelXY(x, y)[0],
			rgb[2].getPixelXY(x, y)[0],
		];
	},

	getDistance(imageRGB, x, y){
		const pixelA = this.getPixel(imageRGB, x, y);
		const pixelB = this.getPixel(imageRGB, x+1, y+1);
		const [dR, dG, dB] = [
			pixelA[0] - pixelB[0],
			pixelA[1] - pixelB[1],
			pixelA[2] - pixelB[2],
		]
		return [
			dR * dR,
			dR * dG,
			dR * dB,
			dG * dG,
			dG * dB,
			dB * dB
		];
	},

	extractDescriptor(imageRGB){
		const image = imageRGB[0];
		// choose random points and extract descriptor for each:
		const nbPoints = 300;
		const descWidth = 16;
		const step = 4;
		const boundaries ={x:descWidth, y:descWidth};



		const points = new Array(nbPoints).fill(0).map(elt => ({
			x: Math.floor(boundaries.x + Math.random() * (image.width - 2* boundaries.x)),
			y: Math.floor(boundaries.y + Math.random() * (image.height- 2* boundaries.y)),
		}))
		// compute the descriptor
		return  points.map(({x,y}) => {
			// gets points around the central point and compute the feature for each:
			const feature = [];

			for(let i = -descWidth/2; i <= descWidth/2; i+=step){
				for(let j = -descWidth/2; j <= descWidth/2; j+=step){
					feature.push(...this.getDistance(imageRGB, Math.round(x +i), Math.round(y+j) ))
				}
			}
			return feature;
		});

	},

	trainSVM(paths, classes, doneCallback){
		this.clf = new svm.CSVC();
		console.log("start descript", classes.length)

		const descriptors = [];
		const images = [];
		paths
		.forEach((id, i) => 
			this.readImage(id, (image) => {
				images.push(image);
				descriptors.push(...this.extractDescriptor(image)
				.map(feature => [feature, classes[i]]));			
		}, () => {
			console.log("start train", descriptors.length)
			this.clf.train(descriptors).done(doneCallback);
		}));
	},

	readAndTrain(trainFilePath, doneCallback){
		fs.readFile(trainFilePath, (error, data) => {
			const {paths, classes} = JSON.parse(data.toString())
				.reduce(({paths, classes}, {ids, classNumber}, i) => {
					return {
						paths: paths.concat(ids),
						classes: classes.concat(ids.map(p => i)), 
					};			
				}, {paths: [], classes: []});
			this.trainSVM(paths, classes, doneCallback)
		});
	},


	readTrainAndTest(trainFilePath, testFilePath){
		//train SVM	
		this.readAndTrain(trainFilePath, () => {
			// read test file
			console.log("start predict");
			fs.readFile(testFilePath, (error, data) => {
				const {paths, classes} = JSON.parse(data.toString())
					.reduce(({paths, classes}, {ids, classNumber}, i) => {
						return {
							paths: paths.concat(ids),
							classes: classes.concat(ids.map(p => i)), 
						};			
					}, {paths: [], classes: []});
			// predict things:
			const predictionResults = [];
			const clusters = [];

			paths
			.forEach((id, i) => {
				this.readImage(id, (image) => {
					console.log("predict for ", id);

					const descriptor = this.extractDescriptor(image);
					const predictions = descriptor.map(feature =>  this.clf.predictSync(feature));
					// get the most likelly class:
					const classCluster = predictions.reduce((classCluster, prediction) => {
						const index = classCluster.findIndex(({classNumber}) => classNumber === prediction);
						if(index < 0){
							return classCluster.concat({
								classNumber: prediction,
								nb: 1
							});
						}
						classCluster[index].nb =classCluster[index].nb +1;
						return classCluster; 
					}, []);

					// sort classCluster: 
					classCluster.sort((a,b) => b.nb - a.nb);
					clusters.push(classCluster)
					predictions.push(classCluster[0].classNumber=== classes[i]);
				}, () => {
					console.log("Results");
					console.log(clusters)
					console.log(predictionResults.reduce((somme, result) => somme+result, 0)/ predictionResults.length)

				});
			});
			});
		});
	}
}

train.readTrainAndTest("./train.json", "./test.json");
