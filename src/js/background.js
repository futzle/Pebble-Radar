function sendBackgroundChunkToPebble(packedBitmap, width, height, offset) {
	if (offset >= packedBitmap.length) {
		console.log("Completing background image");
		queueMessage(
			{ "END_BACKGROUND": 1
			}, appMessageAckCallback, appMessageNakCallback
		);
	} else {
		var endChunkOffset = Math.min(offset+maxChunkLength, packedBitmap.length);
		console.log("Sending background image to Pebble, from " + offset + " to " + endChunkOffset);
		queueMessage(
			{ "BACKGROUND_DATA": Uint8ArrayToPebble(packedBitmap.subarray(offset, endChunkOffset)),
			  "DATA_OFFSET": offset,
			  "DATA_LENGTH": endChunkOffset - offset
			},
			function () {
				sendBackgroundChunkToPebble(packedBitmap, width, height, endChunkOffset); 
			}, appMessageNakCallback
		);	
	}
}

function byteArrayToString(a) {
	var result = "";
	for (var i = 0; i < a.length; ++i) result += String.fromCharCode(a[i]);
	return result;
}

function stringToByteArray(s) {
	var result = new Uint8Array(s.length);
	for (var i = 0; i < s.length; ++i) result[i] = s.charCodeAt(i);
	return result;
}

function sendBackgroundToPebble(packedBitmap, width, height) {
	console.log("Ready to send background image to Pebble");
	console.log("Packed length: " + packedBitmap.length);
	queueMessage(
		{ "START_BACKGROUND": 1,
		  "DATA_LENGTH": packedBitmap.length
		},
		function () {
			sendBackgroundChunkToPebble(packedBitmap, width, height, 0); 
		}, appMessageNakCallback
	);
	// Save in local storage.
	console.log("Saving bitmap in local storage.");
	localStorage.setItem(1, byteArrayToString(packedBitmap));
}

/* Produce a bitmap that shows just the coastline of the radar station. */
function partitionAndResizeBackgroundBitmap(pngObject, newWidth, newHeight, onFailure) {
	if (!isBomBackgroundImage(pngObject)) {
		onFailure("Background format has changed");
		return;
	}
	var isColour = false;
	var isPng = false;
	if(Pebble.getActiveWatchInfo) {
		isPng = !(Pebble.getActiveWatchInfo().platform === "aplite");
		isColour = !(Pebble.getActiveWatchInfo().platform === "aplite");
	}
	var resized;
	if (isColour) {
		// Coastline might not be present, which will return -1 here.
		var coastline1 = pngObject.PLTE.palette.indexOf(BACKGROUND_COASTLINE_COLOR1);
		var coastline2 = pngObject.PLTE.palette.indexOf(BACKGROUND_COASTLINE_COLOR2);
		var land1 = pngObject.PLTE.palette.indexOf(BACKGROUND_LAND_COLOR1);
		var land2 = pngObject.PLTE.palette.indexOf(BACKGROUND_LAND_COLOR2);
		var ocean1 = pngObject.PLTE.palette.indexOf(BACKGROUND_OCEAN_COLOR1);
		var partitioned = new Uint8Array(pngObject.IHDR.width *
			(pngObject.IHDR.height - IMAGE_HEADER_PIXELS - IMAGE_FOOTER_PIXELS));
		for (var i = 0; i < (pngObject.IHDR.height - IMAGE_HEADER_PIXELS - IMAGE_FOOTER_PIXELS) * pngObject.IHDR.width; ++i) {
			var pixelColor = pngObject.IDAT.unpacked[i + pngObject.IHDR.width * IMAGE_HEADER_PIXELS];
			partitioned[i] =
				pixelColor == land1 || pixelColor == land2 ? 0 :
				pixelColor == coastline1 || pixelColor == coastline2 ? 128 :
				255;
		}
		// Scale image to Pebble size.
		resized = resizeBitmap(partitioned, pngObject.IHDR.width,
			pngObject.IHDR.height - IMAGE_HEADER_PIXELS - IMAGE_FOOTER_PIXELS,
			newWidth, newHeight);
		for (var i = 0; i < newWidth * newHeight; ++i) {
			resized[i] = resized[i] < 16 ? 0 :  // Land
				resized[i] > 136 ? 1 :  // Water
				2;   // Coastline
		}
	} else {
		// Coastline might not be present, which will return -1 here.
		var coastline1 = pngObject.PLTE.palette.indexOf(BACKGROUND_COASTLINE_COLOR1);
		var coastline2 = pngObject.PLTE.palette.indexOf(BACKGROUND_COASTLINE_COLOR2);
		var partitioned = new Uint8Array(pngObject.IHDR.width *
			(pngObject.IHDR.height - IMAGE_HEADER_PIXELS - IMAGE_FOOTER_PIXELS));
		for (var i = 0; i < (pngObject.IHDR.height - IMAGE_HEADER_PIXELS - IMAGE_FOOTER_PIXELS) * pngObject.IHDR.width; ++i) {
			var pixelColor = pngObject.IDAT.unpacked[i + pngObject.IHDR.width * IMAGE_HEADER_PIXELS];
			partitioned[i] = pixelColor == coastline1 || pixelColor == coastline2 ? 0 : 255;
		}
		// Scale image to Pebble size.
		resized = resizeBitmap(partitioned, pngObject.IHDR.width,
			pngObject.IHDR.height - IMAGE_HEADER_PIXELS - IMAGE_FOOTER_PIXELS,
			newWidth, newHeight);
		// Make pixels black or white.
		for (var i = 0; i < newWidth * newHeight; ++i) {
			// 224 is from experimentation.  Higher = blacker coastlines.
			resized[i] = resized[i] >= 224 ? 255 : 0;
		}
	}
	console.log("Resized background bitmap, " + resized.length + " pixels");
	if (isPng) {
		console.log("Packing PNG");
		var pngData = {
			"width": newWidth,
			"height": newHeight,
			"bitDepth": 2,
			"palette": [
					{ "red": 0xAA, "green": 0xAA, "blue": 0x55, "alpha": 0xFF },
					{ "red": 0x55, "green": 0x55, "blue": 0xAA, "alpha": 0xFF },
					{ "red": 0x55, "green": 0x55, "blue": 0x0, "alpha": 0xFF }
			],
			"data": resized
		};
		encodePng(pngData, newWidth, newHeight, undefined,
			function(pngStream, width, height, context, onFailure) {
				sendBackgroundToPebble(pngStream, width, height);
			},
			onFailure);
	} else {
		var packedBitmap = packBitmap(resized, newWidth, newHeight);
		sendBackgroundToPebble(packedBitmap, newWidth, newHeight);
  	}
}

function getBackground(payload) {
	maxChunkLength = payload.GET_BACKGROUND;
	var imageWidth = payload.IMAGE_WIDTH;
	var imageHeight = payload.IMAGE_HEIGHT;
	var radarId = payload.RADAR_ID;
	var radarScale = payload.RADAR_SCALE;
	console.log("Background requested, chunk size " + maxChunkLength);
	var url = getBomBackgroundUrl(radarId, radarScale);	
	// Local storage might have this image.
	var savedUrl = localStorage.getItem(0);
	if (savedUrl === url) {
		var savedBitmap = localStorage.getItem(1);
		if (savedBitmap !== "") {
		console.log("Using saved bitmap for URL " + savedUrl);
		var packedBitmap = stringToByteArray(savedBitmap);
		localStorage.setItem(1, "");
		sendBackgroundToPebble(packedBitmap, imageWidth, imageHeight);
		return;
		}
	}
	// No, local storage doesn't have the bitmap for this image.
	console.log("Downloading background from " + url);
	localStorage.setItem(0, url);
	localStorage.setItem(1, "");
	var xhr = new XMLHttpRequest();
	var myTimeout;
	xhr.responseType = "arraybuffer";
	xhr.onreadystatechange = function () {
		console.log("Background download readyState " + this.readyState);
		if (this.readyState == 2) {
			clearTimeout(myTimeout);
				queueMessage({ "BACKGROUND_CONNECTED": 1 });
		} else if (this.readyState == 4) {
			clearTimeout(myTimeout);
			console.log("Background download status " + this.statusText);
			if (this.status == "200") {
				var pngStream = new Uint8Array(this.response);
				console.log("Background downloaded, " + pngStream.length + " bytes")
				decodePng(pngStream,
					function (pngObject, onFailure) {
						partitionAndResizeBackgroundBitmap(
							pngObject, imageWidth, imageHeight, onFailure);
					  	}, console.log);
			} else {
				console.log("Background status: " + this.statusText);
				queueMessage({ "BACKGROUND_ERROR": this.statusText });
			}
		}
	};
	xhr.open("GET", url, true);
	xhr.send();
	myTimeout = setTimeout(
		function () {
			xhr.abort();
			console.log("timed out");
			queueMessage({ "BACKGROUND_TIMEOUT": 1 });
		}, 4000); 
}
