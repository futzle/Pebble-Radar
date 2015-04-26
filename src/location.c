#include "location.h"

#include <pebble.h>
#include "appinfo.h"
#include "appdata.h"
#include "main.h"

#define STATES 7

static struct stateInfo {
	const char *name;
	uint16_t radarCount;
	char **radarName;
	char **radarDetail;
	uint8_t *radarId;
} state[STATES] = {
	{ "New South Wales", 0, NULL, NULL, NULL },
	{"Northern Territory", 0, NULL, NULL, NULL },
	{ "Queensland", 0, NULL, NULL, NULL },
	{ "South Australia", 0, NULL, NULL, NULL },
	{ "Tasmania", 0, NULL, NULL, NULL },
	{ "Victoria", 0, NULL, NULL, NULL },
	{ "Western Australia", 0, NULL, NULL, NULL },
};

static MenuLayer *selectLocationMenuLayer = NULL;

// Number of sections in the menu: states,
// plus one for Current Location.
static uint16_t selectLocationGetNumSections(MenuLayer *m, void *data) {
	return STATES + 1;
}

// Number of rows in each section.
static uint16_t selectLocationGetNumRows(MenuLayer *m, uint16_t s, void *data) {
	switch (s) {
	case 0:
		return 1;
	default:
		// Number of radar sites.
		return state[s-1].radarCount;
	}
}

// Height of header rows in pixels.
static int16_t selectLocationHeaderHeight(MenuLayer *m, uint16_t s, void *data) {
	// Current Location header is hidden.
	if (s == 0) return 0;
	// States as normal.
	return MENU_CELL_BASIC_HEADER_HEIGHT;
}

// Draw header (state) text.
static void selectLocationDrawHeader(GContext* ctx, const Layer *c, uint16_t s, void *data) {
	switch (s) {
	case 0:
		break;
	default:
		menu_cell_basic_header_draw(ctx, c, state[s-1].name);	
		break;
	}
}

// Draw menu item (radar) text.
static void selectLocationDrawRow(GContext* ctx, const Layer *c, MenuIndex *i, void *data) {
	switch (i->section) {
	case 0:
		switch (i->row) {
		case 0:
			menu_cell_basic_draw(ctx, c, "Current location", "Choose closest radar", NULL);
			break;
		default:
			break;
		}
		break;
	default:
		menu_cell_basic_draw(ctx, c,
			state[i->section-1].radarName[i->row],
			state[i->section-1].radarDetail[i->row], NULL);
	}
}

// User has selected a radar site.
void selectLocationSelect(MenuLayer *m, MenuIndex *i, void *data) {
	static char statusMessage[50];
	switch (i->section) {
	case 0:
		// Nearest radar.
		switch (i->row) {
		case 0:
			setUseNearestRadar(true);
			snprintf(statusMessage, sizeof statusMessage, "Selected nearest radar");
			break;
		default:
			break;
		}
		break;
	default:
		// Specific radar site.
		setUseNearestRadar(false);
		APP_LOG(APP_LOG_LEVEL_DEBUG, "Radar selected: id %u", (unsigned) state[i->section-1].radarId[i->row]);
		setRadarId(state[i->section-1].radarId[i->row]);
		snprintf(statusMessage, sizeof statusMessage, "Selected radar %s", state[i->section-1].radarName[i->row]);
		break;
	}
	// Remove the window.
	window_stack_pop(true);
	finishSelectLocation(statusMessage);
}

// Find the currently selected radar so we can
// preselect it in the menu.
static MenuIndex getIndexOfCurrentRadar(bool useNearestRadar, uint8_t radarId) {
	if (useNearestRadar)
		return MenuIndex(0, 0);
	for (uint8_t s = 0; s < STATES; ++s) {
		for (uint16_t i = 0; i < state[s].radarCount; ++i) {
			if (radarId == state[s].radarId[i])
				return MenuIndex(s+1, i);
		}
	}
	// Shouldn't happen.
	return MenuIndex(0, 0);
}

// When window loads, fill it with a menu layer.
static void selectLocationWindowLoad(Window *w) {
	APP_LOG(APP_LOG_LEVEL_DEBUG, "Loading Select Location window");
	
	Layer *windowLayer = window_get_root_layer(w);
	GRect windowBounds = layer_get_frame(windowLayer);
	selectLocationMenuLayer = menu_layer_create(windowBounds);
	menu_layer_set_callbacks(selectLocationMenuLayer, state,
		(MenuLayerCallbacks){
			.get_num_sections = selectLocationGetNumSections,
			.get_num_rows = selectLocationGetNumRows,
			.get_header_height = selectLocationHeaderHeight,
			.draw_header = selectLocationDrawHeader,
			.draw_row = selectLocationDrawRow,
			.select_click = selectLocationSelect,
		});
	menu_layer_set_click_config_onto_window(selectLocationMenuLayer, w);
	// Preselect the currently used radar.
	MenuIndex currentIndex = getIndexOfCurrentRadar(getUseNearestRadar(), getRadarId());
	menu_layer_set_selected_index(selectLocationMenuLayer,
		currentIndex, MenuRowAlignCenter, false);
	layer_add_child(windowLayer, menu_layer_get_layer(selectLocationMenuLayer));
}

// When the window is closed, reclaim memory.
// Keep the radar name info around in case the user
// wants to redisplay the menu.
static void selectLocationWindowUnload(Window *w) {
	APP_LOG(APP_LOG_LEVEL_DEBUG, "Unloading Select Location window");
	menu_layer_destroy(selectLocationMenuLayer);
	window_destroy(w);
}

// Once all radar names have been learned from
// the JavaScript code, load the window and menu.
static void doSelectLocation() {
	// Fix up the main window in case the user cancels.
	prepareForCancelledSelectLocation();
	Window *selectLocationWindow = window_create();
	window_set_window_handlers(selectLocationWindow, (WindowHandlers) {
		.load = selectLocationWindowLoad,
		.unload = selectLocationWindowUnload,
	});
	window_stack_push(selectLocationWindow, true);	
}

// Compare two radar info entries; used when sorting.
static int compareRadarInfo(struct stateInfo *s, uint16_t a, uint16_t b) {
	int cmp = strcmp(s->radarName[a], s->radarName[b]);
	if (cmp) return cmp;
	cmp = strcmp(s->radarDetail[a], s->radarDetail[b]);
	return cmp;
}

// Swap two radar info entries; used when sorting.
static void swapRadarInfo(struct stateInfo *s, uint16_t a, uint16_t b) {
	char *tmp = s->radarName[a];
	s->radarName[a] = s->radarName[b];
	s->radarName[b] = tmp;
	tmp = s->radarDetail[a];
	s->radarDetail[a] = s->radarDetail[b];
	s->radarDetail[b] = tmp;
	uint8_t tmp2 = s->radarId[a];
	s->radarId[a] = s->radarId[b];
	s->radarId[b] = tmp2;
}

// Sort a state's radar sites by name.
static void sortRadars(struct stateInfo *s) {
	// Selection sort.
	for (uint16_t i = 0; i < s->radarCount - 1; ++i) {
		uint16_t smallest = i;
		for (uint16_t j = i + 1; j < s->radarCount; ++j) {
			if (compareRadarInfo(s, smallest, j) > 0)
				smallest = j;
		}
		if (i != smallest) swapRadarInfo(s, i, smallest);
	}	
}

// Ask the JavaScript for all of the radars in a state..
static void selectLocationGetRadarForState(uint8_t s) {
	if (s >= STATES) {
		// All states learned.
		APP_LOG(APP_LOG_LEVEL_DEBUG, "All radars learned");
		doSelectLocation();
	} else {
		// Still a state to learn.
		// Will be nonzero the second time we display this dialog.
		if (state[s].radarCount == 0) {
			APP_LOG(APP_LOG_LEVEL_DEBUG, "Getting state radar list for %s", state[s].name);
			DictionaryIterator *iter;
			app_message_outbox_begin(&iter);
			dict_write_cstring(iter, GET_STATE_RADAR_INFO, state[s].name);
			dict_write_uint8(iter, STATE_INDEX, s);
			dict_write_end(iter);
			app_message_outbox_send();
		} else {
			// Next state.
			selectLocationGetRadarForState(s + 1);
		}	
	}
}

// JavaScript has told us the info for one radar site.
void selectLocationSetRadarInfoForState(uint8_t s, uint8_t i, char *name, char *detail, uint8_t id) {
	state[s].radarName[i] = name;
	state[s].radarDetail[i] = detail;
	state[s].radarId[i] = id;
	
	// If this is the last radar site for this state...
	if (i == state[s].radarCount -1) {
		// Sort the entries for this state.
		sortRadars(&state[s]);
		// Move on to the next state.
		selectLocationGetRadarForState(s+1); 
	}
}

// JavaScript has told us how many radars a state has.  Allocate memory.
void selectLocationSetRadarCountForState(uint8_t s, uint16_t count) {
	APP_LOG(APP_LOG_LEVEL_DEBUG, "%u radars in %s", (unsigned) count, state[s].name);
	state[s].radarCount = count;
	state[s].radarName = (char **) malloc(count * sizeof(char *));
	memset(state[s].radarName, count * sizeof(char *), 0);
	state[s].radarDetail = (char **) malloc(count * sizeof(char *));
	memset(state[s].radarDetail, count * sizeof(char *), 0);
	state[s].radarId = (uint8_t *) malloc(count * sizeof(uint8_t));
}

// Entry point.  Ask JavaScript for all the radars
// and then display a selection dialog.
void selectLocationGetRadarForStates(void) {
	APP_LOG(APP_LOG_LEVEL_DEBUG, "Getting state radar lists");
	selectLocationGetRadarForState(0);
}

// Clean up at application exit.
void selectLocationDeallocate(void) {
	for (uint8_t s = 0; s < STATES; ++s) {
		for (uint16_t i = 0; i < state[s].radarCount; ++i) {
			free(state[s].radarName[i]);
			free(state[s].radarDetail[i]);
		}
		free(state[s].radarName);
		free(state[s].radarDetail);
		free(state[s].radarId);
		state[s].radarCount = 0;
	}
}