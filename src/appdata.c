#include "appdata.h"
#include <pebble.h>
#include "appinfo.h"

// Persistent properties, saved and restored by the app.
uint8_t radarId;
uint8_t radarScale;
bool zoomOutHintPrinted = false;
bool useNearestRadar = true;

uint8_t getRadarId(void) {
	return radarId;
}

void setRadarId(uint8_t id) {
	radarId = id;
}

uint8_t getRadarScale(void) {
	return radarScale;
}

void setRadarScale(uint8_t scale) {
	radarScale = scale;
}

bool getZoomOutHintPrinted(void) {
	return zoomOutHintPrinted;
}

void setZoomOutHintPrinted(bool printed) {
	zoomOutHintPrinted = printed;
}

bool getUseNearestRadar(void) {
	return useNearestRadar;
}

void setUseNearestRadar(bool nearest) {
	useNearestRadar = nearest;
}

void readPersistentData(void) {
	APP_LOG(APP_LOG_LEVEL_DEBUG, "Reading persistent data");
	int32_t persistVersion;
	persistVersion = persist_read_int(PERSIST_VERSION);
	switch (persistVersion) {
	case 1:	
		APP_LOG(APP_LOG_LEVEL_DEBUG, "Persistent data version 1");
		persist_read_data(PERSIST_RADAR_ID, &radarId, sizeof(radarId));
		persist_read_data(PERSIST_RADAR_SCALE, &radarScale, sizeof(radarScale));
		zoomOutHintPrinted = persist_read_bool(PERSIST_ZOOM_OUT_HINT);
		useNearestRadar = persist_read_bool(PERSIST_USE_NEAREST_RADAR);
		APP_LOG(APP_LOG_LEVEL_DEBUG, "Last used radar ID: %d", (int) radarId);
		APP_LOG(APP_LOG_LEVEL_DEBUG, "Last used radar Scale: %d", (int) radarScale);
		APP_LOG(APP_LOG_LEVEL_DEBUG, "Use %s radar", useNearestRadar ? "nearest" : "fixed");
		break;
	default:
		APP_LOG(APP_LOG_LEVEL_DEBUG, "No persistent data");
		radarId = 0;
		radarScale = 1;
	}
}

void writePersistentData(void) {
	APP_LOG(APP_LOG_LEVEL_DEBUG, "Storing persistent data");
	int32_t persistVersion = 1;
	persist_write_int(PERSIST_VERSION, persistVersion);
	persist_write_data(PERSIST_RADAR_ID, &radarId, sizeof(radarId));
	persist_write_data(PERSIST_RADAR_SCALE, &radarScale, sizeof(radarScale));
	persist_write_bool(PERSIST_ZOOM_OUT_HINT, zoomOutHintPrinted);
	persist_write_bool(PERSIST_USE_NEAREST_RADAR, useNearestRadar);
}