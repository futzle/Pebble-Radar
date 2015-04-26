#include <pebble.h>

uint8_t getRadarId(void);
void setRadarId(uint8_t id);

uint8_t getRadarScale(void);
void setRadarScale(uint8_t scale);

bool getZoomOutHintPrinted(void);
void setZoomOutHintPrinted(bool printed);

bool getUseNearestRadar(void);
void setUseNearestRadar(bool nearest);

void readPersistentData(void);
void writePersistentData(void);