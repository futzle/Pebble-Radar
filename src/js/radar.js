function sendRadarChunkToPebble(packedBitmap, width, height, offset) {
	if (offset >= packedBitmap.length) {
		console.log("Completing radar image");
		queueMessage({ "END_RADAR": 1});	
	} else {
		var endChunkOffset = Math.min(offset+maxChunkLength, packedBitmap.length);
		console.log("Sending radar image to Pebble, from " + offset + " to " + endChunkOffset);
		queueMessage(
			{ "RADAR_DATA": Uint8ArrayToPebble(packedBitmap.subarray(offset, endChunkOffset)),
			  "DATA_OFFSET": offset,
			  "DATA_LENGTH": endChunkOffset - offset
			},
			function () {
				sendRadarChunkToPebble(packedBitmap, width, height, endChunkOffset); 
			}, appMessageNakCallback
		);	
	}
}

function sendRadarToPebble(packedBitmap, width, height, context) {
	console.log("Ready to send radar image to Pebble");
	console.log("Packed length: " + packedBitmap.length);
	queueMessage(
		{ "START_RADAR": 1,
		"FRAME_AGE": Math.floor(context.frameAge)
		},
		function () {
			sendRadarChunkToPebble(packedBitmap, width, height, 0); 
		}, appMessageNakCallback
	);
}

function getRadar(payload) {
	console.log("Radar requested.");
	maxChunkLength = payload.GET_RADAR;
	console.log("Radar requested, chunk size " + maxChunkLength);
	var imageWidth = payload.IMAGE_WIDTH;
	var imageHeight = payload.IMAGE_HEIGHT;
	var radarId = payload.RADAR_ID;
	var radarScale = payload.RADAR_SCALE;
	var misses = payload.RADAR_MISSES;
	// What is the most recent image we will find on the site?
	var candidate = guessBomRadarUrl(
		radarId, radarScale, Date.now()/1000, misses
	);
	if (candidate === undefined) {
		queueMessage({ "RADAR_MISSING": 1 });
	}
	console.log("Downloading radar from " + candidate.url);
	var xhr = new XMLHttpRequest();
	var myTimeout;
	xhr.responseType = "arraybuffer";
	xhr.onreadystatechange = function () {
		console.log("Radar download readyState " + this.readyState);
		if (this.readyState == 2) {
			clearTimeout(myTimeout);
			queueMessage({ "RADAR_CONNECTED": 1 });
		} else if (this.readyState == 4) {
			clearTimeout(myTimeout);
			console.log("Radar download status " + this.statusText);					  
			if (this.status == "200") {
				var pngStream = new Uint8Array(this.response);
				console.log("Radar downloaded, " + pngStream.length + " bytes")
				decodePng(pngStream,
					function (pngObject, onFailure) {
						resizeRadarBitmap(
							pngObject, imageWidth, imageHeight, onFailure, {
								"frameAge": (Date.now() - candidate.time) / 1000
							})
						}, console.log);
			} else if (this.status == "0" || this.status == "404") {
				console.log("Radar file not found. " + this.status);
				queueMessage({ "RADAR_HUNTING": misses + 1 });
			} else {
				console.log("Radar status: " + this.status);
				queueMessage({ "RADAR_ERROR": this.status });
			}
		}
	};
	xhr.open("GET", candidate.url, true);
	xhr.send();
	myTimeout = setTimeout(
		function () {
			xhr.abort();
			console.log("timed out");
			queueMessage({ "RADAR_TIMEOUT": 1 });
		}, 4000); 
}