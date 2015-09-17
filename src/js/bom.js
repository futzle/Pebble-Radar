// Backgrounds can be had from the main BOM web site, from which
// the Pebble app can more reliably fetch than the FTP server.
var BACKGROUND_BASE = "http://www.bom.gov.au/products/radar_transparencies/";
//var BACKGROUND_BASE = "ftp://ftp2.bom.gov.au/anon/gen/radar_transparencies/";

// Radar seems to be available only from the FTP server.
// But the content distribution network URL seems to be stable-ish.
//var RADAR_BASE = "ftp://ftp2.bom.gov.au/anon/gen/radar/";
var RADAR_BASE = "http://wac.72dd.edgecastcdn.net/8072DD/radimg/radar/" 

// Scraped off the BOM's web site.
var RADAR_SITES = {
  "02": {
    "location": "Melbourne",
    "detail": "Laverton",
    "state": "Victoria",
    "latitude": -37.86, "longitude": 144.75,
    "scale": [ 1, 2, 3, 4 ],
    "updatePeriod": 360, "updateOffset": 0, "updateLatency": 240
  },
  "03": {
    "location": "Wollongong",
    "detail": "Appin",
    "state": "New South Wales",
    "latitude": -34.26, "longitude": 150.88,
    "scale": [ 1, 2, 3, 4 ],
    "updatePeriod": 360, "updateOffset": 0, "updateLatency": 240
  },
  "04": {
    "location": "Newcastle",
    "detail": "Lemon Tree Passage",
    "state": "New South Wales",
    "latitude": -32.73, "longitude": 152.03,
    "scale": [ 1, 2, 3, 4 ],
    "updatePeriod": 360, "updateOffset": 0, "updateLatency": 240
  },
  "05": {
    "location": "Carnarvon",
    "state": "Western Australia",
    "latitude": -24.89, "longitude": 113.67,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "06": {
    "location": "Geraldton",
    "state": "Western Australia",
    "latitude": -28.80, "longitude": 114.70,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "07": {
    "location": "Wyndham",
    "detail": "Five Rivers Bastion",
    "state": "Western Australia",
    "latitude": -15.45, "longitude": 128.12,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "08": {
    "location": "Gympie",
    "detail": "Mt Kanigan",
    "state": "Queensland",
    "latitude": -25.96, "longitude": 152.58,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "09": {
    "location": "Gove",
    "state": "Northern Territory",
    "latitude": -12.28, "longitude": 136.82,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "14": {
    "location": "Mt Gambier",
    "state": "South Australia",
    "latitude": -37.75, "longitude": 140.77,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "15": {
    "location": "Dampier",
    "detail": "Queens Lookout",
    "state": "Western Australia",
    "latitude": -20.65, "longitude": 116.69,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "16": {
    "location": "Port Hedland",
    "state": "Western Australia",
    "latitude": -20.37, "longitude": 118.63,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "17": {
    "location": "Broome",
    "state": "Western Australia",
    "latitude": -17.95, "longitude": 122.24,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "19": {
    "location": "Cairns",
    "detail": "Saddle Mountain",
    "state": "Queensland",
    "latitude": -16.82, "longitude": 145.68,
    "scale": [ 1, 2, 3, 4 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "22": {
    "location": "Mackay",
    "detail": "Mt Bassett",
    "state": "Queensland",
    "latitude": -21.12, "longitude": 149.22,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "23": {
    "location": "Gladstone",
    "state": "Queensland",
    "latitude": -23.86, "longitude": 151.26,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "24": {
    "location": "Bowen",
    "detail": "Abbot Point",
    "state": "Queensland",
    "latitude": -19.89, "longitude": 148.08,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "25": {
    "location": "Alice Springs",
    "state": "Northern Territory",
    "latitude": -23.80, "longitude": 133.89,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "27": {
    "location": "Woomera",
    "state": "South Australia",
    "latitude": -31.16, "longitude": 136.80,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "28": {
    "location": "Grafton",
    "state": "New South Wales",
    "latitude": -29.62, "longitude": 152.95,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "29": {
    "location": "Learmonth",
    "detail": "Cape Range Nat Pk",
    "state": "Western Australia",
    "latitude": -22.10, "longitude": 114.00,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "30": {
    "location": "Mildura",
    "state": "Victoria",
    "latitude": -34.24, "longitude": 142.09,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "31": {
    "location": "Albany",
    "state": "Western Australia",
    "latitude": -34.94, "longitude": 117.82,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "32": {
    "location": "Esperance",
    "state": "Western Australia",
    "latitude": -33.83, "longitude": 121.89,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "33": {
    "location": "Ceduna",
    "state": "South Australia",
    "latitude": -32.13, "longitude": 133.70,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "36": {
    "location": "Mornington Is",
    "detail": "Gulf of Carpentaria",
    "state": "Northern Territory",
    "latitude": -16.67, "longitude": 139.17,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "37": {
    "location": "Hobart",
    "detail": "Hobart Airport",
    "state": "Tasmania",
    "latitude": -42.84, "longitude": 147.50,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240,
    "redirect": "76"
  },
  "39": {
    "location": "Halls Creek",
    "state": "Western Australia",
    "latitude": -18.23, "longitude": 127.66,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "40": {
    "location": "Canberra",
    "detail": "Captains Flat",
    "state": "New South Wales",
    "latitude": -35.66, "longitude": 149.51,
    "scale": [ 1, 2, 3, 4 ],
    "updatePeriod": 360, "updateOffset": 0, "updateLatency": 240
  },
  "41": {
    "location": "Willis Island",
    "state": "Queensland",
    "latitude": -16.29, "longitude": 149.96,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "42": {
    "location": "Katherine",
    "detail": "Tindal",
    "state": "Northern Territory",
    "latitude": -14.51, "longitude": 132.45,
    "scale": [ 1, 2, 3, 4 ],
    "updatePeriod": 600, "updateOffset": 300, "updateLatency": 240
  },
  "44": {
    "location": "Giles",
    "state": "Western Australia",
    "latitude": -25.03, "longitude": 128.30,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "46": {
    "location": "Adelaide",
    "detail": "Sellick Hills",
    "state": "South Australia",
    "latitude": -35.33, "longitude": 138.50,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "48": {
    "location": "Kalgoorlie",
    "state": "Western Australia",
    "latitude": -30.79, "longitude": 121.45,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "49": {
    "location": "Yarrawonga",
    "state": "Victoria",
    "latitude": -36.03, "longitude": 146.02,
    "scale": [ 1, 2, 3, 4 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "50": {
    "location": "Brisbane",
    "detail": "Marburg",
    "state": "Queensland",
    "latitude": -27.61, "longitude": 152.54,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "51": {
    "location": "Melbourne",
    "detail": "Melbourne Airport",
    "state": "Victoria",
    "latitude": -37.67, "longitude": 144.83,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240,
    "redirect": "02"
  },
  "52": {
    "location": "NW Tasmania",
    "detail": "West Takone",
    "state": "Tasmania",
    "latitude": -41.18, "longitude": 145.58,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "53": {
    "location": "Moree",
    "state": "New South Wales",
    "latitude": -29.50, "longitude": 149.85,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "54": {
    "location": "Sydney",
    "detail": "Kurnell",
    "state": "New South Wales",
    "latitude": -34.01, "longitude": 151.23,
    "scale": [ 1, 2, 3, 4 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240,
    "redirect": "71"
  },
  "55": {
    "location": "Wagga Wagga",
    "state": "New South Wales",
    "latitude": -35.17, "longitude": 147.47,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "56": {
    "location": "Longreach",
    "state": "Queensland",
    "latitude": -23.43, "longitude": 144.29,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "62": {
    "location": "Norfolk Island",
    "state": "New South Wales",
    "latitude": -29.03, "longitude": 167.93,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "63": {
    "location": "Darwin",
    "detail": "Berrimah",
    "state": "Northern Territory",
    "latitude": -12.46, "longitude": 130.93,
    "scale": [ 1, 2, 3, 4 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "64": {
    "location": "Adelaide",
    "detail": "Buckland Park",
    "state": "South Australia",
    "latitude": -34.62, "longitude": 138.47,
    "scale": [ 1, 2, 3, 4 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "65": {
    "location": "Tennant Creek",
    "state": "Northern Territory",
    "latitude": -19.64, "longitude": 134.18,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "66": {
    "location": "Brisbane",
    "detail": "Mt Stapylton",
    "state": "Queensland",
    "latitude": -27.72, "longitude": 153.24,
    "scale": [ 1, 2, 3, 4 ],
    "updatePeriod": 360, "updateOffset": 0, "updateLatency": 240
  },
  "67": {
    "location": "Warrego",
    "state": "Queensland",
    "latitude": -26.44, "longitude": 147.35,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "68": {
    "location": "Bairnsdale",
    "state": "Victoria",
    "latitude": -37.89, "longitude": 147.58,
    "scale": [ 1, 2, 3 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "69": {
    "location": "Namoi",
    "detail": "Blackjack Mountain",
    "state": "New South Wales",
    "latitude": -31.02, "longitude": 150.19,
    "scale": [ 1, 2, 3, 4 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "70": {
    "location": "Perth",
    "detail": "Serpentine",
    "state": "Western Australia",
    "latitude": -32.39, "longitude": 115.87,
    "scale": [ 1, 2, 3, 4 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "71": {
    "location": "Sydney",
    "detail": "Terrey Hills",
    "state": "New South Wales",
    "latitude": -33.70, "longitude": 151.21,
    "scale": [ 1, 2, 3, 4 ],
    "updatePeriod": 360, "updateOffset": 0, "updateLatency": 240
  },
  "72": {
    "location": "Emerald",
    "state": "Queensland",
    "latitude": -23.55, "longitude": 148.24,
    "scale": [ 1, 2, 3, 4 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "73": {
    "location": "Townsville",
    "detail": "Hervey Range",
    "state": "Queensland",
    "latitude": -19.42, "longitude": 146.55,
    "scale": [ 1, 2, 3, 4 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  },
  "75": {
    "location": "Mt Isa",
    "state": "Queensland",
    "latitude": -20.71, "longitude": 139.56,
    "scale": [ 1, 2, 3, 4 ],
    "updatePeriod": 360, "updateOffset": 0, "updateLatency": 240
  },
  "76": {
    "location": "Hobart",
    "detail": "Mt Koonya",
    "state": "Tasmania",
    "latitude": -43.11, "longitude": 147.81,
    "scale": [ 1, 2, 3, 4 ],
    "updatePeriod": 360, "updateOffset": 0, "updateLatency": 240
  },
  "77": {
    "location": "Warruwi",
    "state": "Northern Territory",
    "latitude": -11.65, "longitude": 133.38,
    "scale": [ 1, 2, 3, 4 ],
    "updatePeriod": 360, "updateOffset": 0, "updateLatency": 240
  },
  "78": {
    "location": "Weipa",
    "state": "Queensland",
    "latitude": -12.67, "longitude": 141.92,
    "scale": [ 1, 2, 3, 4 ],
    "updatePeriod": 600, "updateOffset": 0, "updateLatency": 240
  }
};

// #C68600 represents coastline on background images.
// (Except some maps such as 044, which use slightly different colours.)
var BACKGROUND_COASTLINE_COLOR1 = 0xC68600;
var BACKGROUND_COASTLINE_COLOR2 = 0xC08000;
var BACKGROUND_LAND_COLOR1 = 0xE7DCBD;
var BACKGROUND_LAND_COLOR2 = 0xE0D8B8;
var BACKGROUND_OCEAN_COLOR1 = 0xC3D9EB;
var BACKGROUND_OCEAN_COLOR2 = 0xC0D8E8;

// The top and bottom of the radar images are
// obscured by text.  Strip them out.
var IMAGE_HEADER_PIXELS = 16;
var IMAGE_FOOTER_PIXELS = 16;

// BOM backgrounds are 512 pixels square, palette with bitdepth 2 or less.
function isBomBackgroundImage(pngObject) {
	return pngObject.IHDR.width === 512 &&
		pngObject.IHDR.height === 512 &&
		pngObject.IHDR.colorType === 3 &&
		pngObject.IHDR.bitDepth <= 2;
}

// BOM radars are 512 pixels square, palette with bitdepth 8.
function isBomRadarImage(pngObject) {
	return pngObject.IHDR.width === 512 &&
		pngObject.IHDR.height === 512 &&
		pngObject.IHDR.colorType === 3 &&
		pngObject.IHDR.bitDepth === 8;
}

function getBomRadarInfo(radarId, radarScale) {
	if (radarId < 10) radarId = "0" + radarId;
	var radarInfo = RADAR_SITES[radarId];
	if (radarInfo === undefined) return undefined;
	if (radarScale < 1) radarScale = 1;
	if (radarInfo.scale.indexOf(radarScale) === -1)
		radarScale = radarInfo.scale[radarInfo.scale.length-1];
	return {
		"name": radarInfo.location,
		"id": +radarId,
		"scale": radarScale,
		"supersede": radarInfo.updatePeriod + radarInfo.updateLatency,
		"latitude": radarInfo.latitude,
		"longitude": radarInfo.longitude
	};
}

function getBomRadarInfoNear(lat, lon, oldRadarId, radarScale) {
	var nearestId;
	var nearestDistanceSquared = 1e12;
	// Go through all radar locations.
	for (var site in RADAR_SITES) {
		var latDifference = lat - RADAR_SITES[site].latitude;
		var lonDifference = lon - RADAR_SITES[site].longitude;
		var distanceSquared =
			latDifference*latDifference +
			lonDifference*lonDifference;
		if (distanceSquared < nearestDistanceSquared) {
			nearestId = site;
			nearestDistanceSquared = distanceSquared;
		}
	}
	console.log("Nearest radar is id " + nearestId);
	// Radars which are down, deprecated or otherwise
	// not suitable for the Nearest Radar test.
	while (RADAR_SITES[nearestId].redirect !== undefined)
	{
		nearestId = RADAR_SITES[nearestId].redirect;
		console.log("Redirected to radar id " + nearestId);
	}
	if (oldRadarId !== +nearestId) {
		// Change scale only if also changing radar.
		if (nearestDistanceSquared < 0.33) {
			radarScale = 4; // 64 km (if it exists)
		} else if (nearestDistanceSquared < 1.33) {
			radarScale = 3; // 128 km
		} else if (nearestDistanceSquared < 5.33) {
			radarScale = 2; // 256 km
		} else {
			radarScale = 1; // 512 km.
		}
	}
	return getBomRadarInfo(+nearestId, radarScale);
}

function getBomBackgroundUrl(radarId, radarScale) {
	if (radarId < 10) radarId = "0" + radarId;
	return BACKGROUND_BASE + "IDR" + radarId + radarScale + ".background.png";
}

function huntOffsets(radarId, radarScale) {
	// Radar might be at different timestamp.
	var lastFrame = RADAR_SITES[radarId].updatePeriod / 60;
	return [0, -1, -lastFrame, -lastFrame-1, -3];
}

function guessBomRadarUrl(radarId, radarScale, time, misses) {
	if (radarId < 10) radarId = "0" + radarId;
	var updatePeriod = RADAR_SITES[radarId].updatePeriod;
	var updateLatency = RADAR_SITES[radarId].updateLatency;
	var updateOffset = RADAR_SITES[radarId].updateOffset;
	var latestTimestamp =
		Math.floor((time - updateLatency - updateOffset) / updatePeriod)
			* updatePeriod + updateOffset;
	// Guess URL based on number of wrong guesses so far.
	var hunt = huntOffsets(radarId, radarScale);
	if (hunt[misses] === undefined) return undefined;
	latestTimestamp += 60 * hunt[misses];
	// Build timestamp corresponding to the URL.
	var latestDate = new Date(latestTimestamp * 1000);
	var timeString = latestDate.getUTCFullYear().toString();
	if (latestDate.getUTCMonth() < 9) timeString += "0";
	timeString += latestDate.getUTCMonth() + 1;
	if (latestDate.getUTCDate() < 10) timeString += "0";
	timeString += latestDate.getUTCDate();
	if (latestDate.getUTCHours() < 10) timeString += "0";
	timeString += latestDate.getUTCHours();
	if (latestDate.getUTCMinutes() < 10) timeString += "0";
	timeString += latestDate.getUTCMinutes();
	return {
		"url" : RADAR_BASE + "IDR" + radarId + radarScale + ".T." + timeString + ".png",
		"time" : latestDate
	};
}

function getBomStateRadarCount(stateName) {
	var count = 0;
	for (site in RADAR_SITES) {
		if (RADAR_SITES[site].state === stateName) ++count;
	}
	return count;
}

function getBomStateRadarInfo(stateName, stateRadarIndex) {
	for (var site in RADAR_SITES) {
		if (RADAR_SITES[site].state === stateName) {
			if (stateRadarIndex-- === 0) {
				var radarInfo = RADAR_SITES[site];
				return {
					"id": +site,
					"name": radarInfo.location,
					"detail": radarInfo.detail
				}
			}
		}
	}
}
