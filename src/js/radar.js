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
		  "DATA_LENGTH": packedBitmap.length,
		  "FRAME_AGE": Math.floor(context.frameAge)
		},
		function () {
			sendRadarChunkToPebble(packedBitmap, width, height, 0); 
		}, appMessageNakCallback
	);
}

/* Produce a bitmap that shows the radar density. */
function resizeRadarBitmap(pngObject, newWidth, newHeight, onFailure, context) {
	if (!isBomRadarImage(pngObject)) {
		onFailure("Radar format has changed");
		return;
	}
	// Radar comes in 15 levels, from drizzle to diluvian.
	// Anything that is not in range 1 to 15 is either transparent (31)
	// or superimposed header/footer text (0 and 16).  Make those white.
	var isColour = false;
	var isPng = false;
	if(Pebble.getActiveWatchInfo) {
		isPng = !(Pebble.getActiveWatchInfo().platform === "aplite");
		isColour = !(Pebble.getActiveWatchInfo().platform === "aplite");
	}
	var bitmap;
	if (isColour) {
		var indexed = new Uint8Array(pngObject.IHDR.width *
			(pngObject.IHDR.height - IMAGE_HEADER_PIXELS - IMAGE_FOOTER_PIXELS));
		for (var i = 0; i < (pngObject.IHDR.height - IMAGE_HEADER_PIXELS - IMAGE_FOOTER_PIXELS) * pngObject.IHDR.width; ++i) {
			indexed[i] = pngObject.IDAT.unpacked[i + pngObject.IHDR.width * IMAGE_HEADER_PIXELS];
			if (indexed[i] == 31) { indexed[i] = 0; };
		}
		// Scale image to Pebble size.
		bitmap = resizeBitmap(indexed, pngObject.IHDR.width,
			pngObject.IHDR.height - IMAGE_HEADER_PIXELS - IMAGE_FOOTER_PIXELS,
			newWidth, newHeight);
	} else {
		var greyScale = new Uint8Array(pngObject.IHDR.width *
			(pngObject.IHDR.height - IMAGE_HEADER_PIXELS - IMAGE_FOOTER_PIXELS));
		for (var i = 0; i < (pngObject.IHDR.height - IMAGE_HEADER_PIXELS - IMAGE_FOOTER_PIXELS) * pngObject.IHDR.width; ++i) {
			var val = pngObject.IDAT.unpacked[i + pngObject.IHDR.width * IMAGE_HEADER_PIXELS];
			greyScale[i] =
				val >= 1 && val <= 15 ?
				greyLevels[val-1] :
				255;
		}
		// Scale image to Pebble size.
		var resized = resizeBitmap(greyScale, pngObject.IHDR.width,
			pngObject.IHDR.height - IMAGE_HEADER_PIXELS - IMAGE_FOOTER_PIXELS,
			newWidth, newHeight);
		// Turn greyscale into monochrome bitmap using dithering.
		bitmap = floydSteinberg(resized, newWidth, newHeight);
	}	
	console.log("Resized radar bitmap, " + bitmap.length + " pixels");
	/*
	for (var y = 0; y < newHeight; ++y ) {
		var row = "";
		for (var x = 0; x < newWidth; ++x) {
			row += bitmap[y * newWidth + x] + " ";
		}
		console.log("row " + y + ": " + row);
	}
	*/
	if (isPng) {
		console.log("Packing PNG");
		var pngData = {
    		"width": newWidth,
			"height": newHeight,
			"bitDepth": 4,
			"palette": [
				{ "red": 0xFF, "green": 0xFF, "blue": 0xFF, "alpha": 0 },
				{ "red": 0xFF, "green": 0xFF, "blue": 0xFF, "alpha": 0xFF },
				{ "red": 0xAA, "green": 0xFF, "blue": 0xAA, "alpha": 0xFF },
				{ "red": 0xAA, "green": 0xFF, "blue": 0xAA, "alpha": 0xFF },
				{ "red": 0x55, "green": 0xFF, "blue": 0x55, "alpha": 0xFF },
				{ "red": 0x55, "green": 0xFF, "blue": 0x55, "alpha": 0xFF },
				{ "red": 0x00, "green": 0xFF, "blue": 0x00, "alpha": 0xFF },
				{ "red": 0x00, "green": 0xFF, "blue": 0x00, "alpha": 0xFF },
				{ "red": 0x00, "green": 0xAA, "blue": 0x00, "alpha": 0xFF },
				{ "red": 0x00, "green": 0xAA, "blue": 0x00, "alpha": 0xFF },
				{ "red": 0x00, "green": 0x55, "blue": 0x00, "alpha": 0xFF },
				{ "red": 0x00, "green": 0x55, "blue": 0x00, "alpha": 0xFF },
				{ "red": 0x00, "green": 0x00, "blue": 0x00, "alpha": 0xFF },
				{ "red": 0x55, "green": 0x00, "blue": 0x00, "alpha": 0xFF },
				{ "red": 0xAA, "green": 0x00, "blue": 0x00, "alpha": 0xFF },
				{ "red": 0xFF, "green": 0x00, "blue": 0x00, "alpha": 0xFF }
		    ],
		    "data": bitmap
  		};
		encodePng(pngData, newWidth, newHeight, context,
			function(pngStream, width, height, context, onFailure) {
     			sendRadarToPebble(pngStream, width, height, context);
    		},
    		onFailure);
	} else {
		var packedBitmap = packBitmap(bitmap, newWidth, newHeight);
		sendRadarToPebble(packedBitmap, newWidth, newHeight, context);
	}
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