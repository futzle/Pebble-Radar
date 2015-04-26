function getStateRadarInfoIndex(stateName, stateIndex, stateRadarCount, stateRadarIndex) {
	if (stateRadarIndex === stateRadarCount) {
	
	} else {
		console.log("Getting radar details for " + stateRadarIndex + " in " + stateName);
		var radar = getBomStateRadarInfo(stateName, stateRadarIndex);
		queueMessage(
			{ "SET_STATE_RADAR_INFO": stateName,
			  "STATE_INDEX": stateIndex,
			  "STATE_RADAR_INDEX": stateRadarIndex,
			  "RADAR_ID": radar.id,
			  "RADAR_NAME": radar.name,
			  "RADAR_DETAIL": radar.detail
			},
			function () {
				getStateRadarInfoIndex(stateName, stateIndex, stateRadarCount, stateRadarIndex + 1); 
			}		
		);
	}
}

function getStateRadarInfo(payload) {
	var stateName = payload.GET_STATE_RADAR_INFO;
	var stateIndex = payload.STATE_INDEX;
	console.log("Counting radars in " + stateName);
	var count = getBomStateRadarCount(stateName);
	queueMessage(
		{ "SET_STATE_RADAR_COUNT": count,
		  "STATE_INDEX": stateIndex
		},
		function () {
			getStateRadarInfoIndex(stateName, stateIndex, count, 0); 
		}
	);	   	
}
