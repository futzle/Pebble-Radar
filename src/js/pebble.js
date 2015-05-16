// Pebble AppMessages use array-of-numbers for byte arrays,
// not TypedArray arrays.
function Uint8ArrayToPebble(a) {
	var result = new Array(a.length);
	for (var i = 0; i < a.length; ++i) result[i] = a[i];
	return result;
}

var maxChunkLength = 1024;

var messageQueue = [ ];
var messageInProgress = false;

function messageIsImportant(message) {
	if (message.JAVASCRIPT_READY) return true;
	return false;
}

function queueMessage(message, ackHandler, nakHandler) {
	console.log("Queueing message: " + JSON.stringify(message).substring(0,50));
	messageQueue.push( {
		"message": message,
		"ackHandler": function() {
			console.log("Message acknowledged: " + JSON.stringify(message).substring(0,50));
			messageInProgress = false;
			if (ackHandler !== undefined) {
				ackHandler();
			}
			processQueue();
		},
		"nakHandler": function() {
			console.log("Message not acknowledged: " +  JSON.stringify(message).substring(0,50));
			messageInProgress = false;
			if (nakHandler !== undefined) {
				nakHandler();
			}
			if (messageIsImportant(message)) {
				setTimeout(function () {
						console.log("Retrying...");
						queueMessage(message, ackHandler, nakHandler);
					}, 1000);
			} 			
		}
	});
	if (!messageInProgress) {
		processQueue();
	}
}

function processQueue() {
	if (messageQueue.length > 0) {
		var message = messageQueue.shift();
		console.log("Sending queued message " + JSON.stringify(message.message).substring(0,200));
		messageInProgress = true;
		Pebble.sendAppMessage(
			message.message,
			message.ackHandler,
			message.nakHandler
		);	
	}
}

function appMessageAckCallback () {
}

function appMessageNakCallback () {
}

function distanceAndBearing(aLat, aLon, bLat, bLon) {
	// Assumes perfectly spherical earth, close enough.
	var dist = Math.acos(
		Math.sin(aLat) * Math.sin(bLat) +
		Math.cos(aLat) * Math.cos(bLat) * Math.cos(bLon-aLon)
	);
	var bearing = Math.atan2(
		Math.sin(bLon-aLon)*Math.cos(bLat),
		Math.cos(aLat)*Math.sin(bLat)-Math.sin(aLat)*Math.cos(bLat)*Math.cos(bLon-aLon)
	);
	console.log("Distance in km: " + dist * 6378);
	return {
		"x": Math.tan(dist) * Math.sin(bearing),
		"y": - Math.tan(dist) * Math.cos(bearing)
	}
}

function getRadarName(payload, nearLocation) {
	var radarId = payload.RADAR_ID;
	var radarScale = payload.RADAR_SCALE;
	if (nearLocation) {
		console.log("Nearest Radar requested, fallback Id: " + radarId + " Scale: " + radarScale);
	} else {
		console.log("Specific Radar requested, Id: " + radarId + " Scale: " + radarScale);
	}	
	navigator.geolocation.getCurrentPosition(
		function (pos) {
			console.log("Location: " + pos.coords.latitude + "/" + pos.coords.longitude);
			var radar;
			if (nearLocation) {
				radar = getBomRadarInfoNear(pos.coords.latitude, pos.coords.longitude, radarId, radarScale);
			} else {
				radar = getBomRadarInfo(radarId, radarScale);
			}
			var crosshairs = distanceAndBearing(
				radar.latitude/180*Math.PI, radar.longitude/180*Math.PI,
				pos.coords.latitude/180*Math.PI, pos.coords.longitude/180*Math.PI
			);
			queueMessage(
				{ "SET_RADAR_NAME": radar.name,
				  "RADAR_ID": radar.id,
				  "SET_RADAR_SCALE": radar.scale,
				  "FRAME_SUPERSEDE_AGE": radar.supersede,
				  "CROSSHAIRS_X": Math.round(crosshairs.x * (6228 << radar.scale)),
				  "CROSSHAIRS_Y": Math.round(crosshairs.y * (6228 << radar.scale))
				},
				appMessageAckCallback, appMessageNakCallback
			);
		},
		function (err) {
			console.log('location error (' + err.code + '): ' + err.message);
			var radar = getBomRadarInfo(radarId, radarScale);
			if (radar === undefined) {
				queueMessage(
					{ "RADAR_PICK_LOCATION": 1 },
					  appMessageAckCallback, appMessageNakCallback
				);	   	
			}
			queueMessage(
				{ "SET_RADAR_NAME": radar.name,
				  "SET_RADAR_SCALE": radar.scale,
				  "FRAME_SUPERSEDE_AGE": radar.supersede },
				  appMessageAckCallback, appMessageNakCallback
			);	   	
		},
		{
			enableHighAccuracy: false, 
			maximumAge: 600000, 
  			timeout: 5000
		});
}

// Called when JS is ready
Pebble.addEventListener("ready",
	function(e) {
		queueMessage({ "JAVASCRIPT_READY": 1 });
	});

// Called when incoming message from the Pebble is received
Pebble.addEventListener("appmessage",
	function(e) {
		console.log("Message received.");
		if (e.payload.GET_NEAREST_RADAR_NAME) {
			getRadarName(e.payload, true);
		} else if (e.payload.GET_RADAR_NAME) {
			getRadarName(e.payload, false);
		} else if (e.payload.GET_BACKGROUND) {
			getBackground(e.payload);
		} else if (e.payload.GET_RADAR) {
			getRadar(e.payload);
		} else if (e.payload.GET_STATE_RADAR_INFO) {
			getStateRadarInfo(e.payload);
		} else {
			console.log("Unknown message received.");
		}
	});

console.log("JavaScript top level");