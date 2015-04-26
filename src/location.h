#include <pebble.h>

void selectLocationGetRadarForStates(void);
void selectLocationSetRadarCountForState(uint8_t s, uint16_t count);
void selectLocationSetRadarInfoForState(uint8_t s, uint8_t i, char *name, char *detail, uint8_t id);
void selectLocationDeallocate(void);