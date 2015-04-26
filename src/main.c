#include "main.h"
#include <pebble.h>
//#include "build/src/resource_ids.auto.h"
#include "appinfo.h"
#include "appdata.h"
#include "location.h"

// Draw the radar bitmap in a rectangle this big.
static const int imageWidth = 120;
static const int imageHeight = 113;

Window *mainWindow;	
// Main layer.
Layer *mainLayer;
// Location.
bool locationValid = false;
int32_t crosshairs_x;
int32_t crosshairs_y;
// Background (coastline map).
BitmapLayer *backgroundBitmapLayer;
GBitmap *background = NULL;
int backgroundRetries;
AppTimer* backgroundWatchdog = NULL;
// Radar (overlay).
BitmapLayer *radarBitmapLayer;
GBitmap *radar = NULL;
int radarRetries;
AppTimer* radarWatchdog = NULL;
// Location crosshairs.
BitmapLayer *crosshairsBitmapLayer;
GBitmap *crosshairs = NULL;
int crosshairsCountdown;
// Title (radar name).
TextLayer *radarNameLayer;
char radarName[18];
// Image age.
TextLayer *frameAgeLayer;
uint32_t frameAge;  // seconds.
uint32_t frameSupersedeAge;  // seconds.
char frameAgeText[12];
// Radar scale.
BitmapLayer *radarScaleLayer;
GBitmap *radarScaleBitmap = NULL;
// Action bar.
ActionBarLayer *actionBarLayer;
GBitmap *locationIcon = NULL;
GBitmap *pauseIcon = NULL;
GBitmap *playIcon = NULL;
GBitmap *magnifyIcon = NULL;
// Status layer.
Layer *statusLayer;
TextLayer *statusTextLayer;
char statusText[150] = "Loading...";

static void setStatusMessage(const char *m) {
	APP_LOG(APP_LOG_LEVEL_DEBUG, "Status layer: %s", m);
	strncpy(statusText, m, sizeof(statusText));
	statusText[sizeof(statusText)-1] = 0;
	text_layer_set_text(statusTextLayer, statusText);
	layer_set_hidden(statusLayer, false);
	layer_add_child(window_get_root_layer(mainWindow), statusLayer);
}

static void clearStatus(void) {
	APP_LOG(APP_LOG_LEVEL_DEBUG, "Hiding status layer");
	layer_set_hidden(statusLayer, true);
}

static void drawStatusLayer(Layer *statusLayer, GContext *statusContext) {
	GRect statusLayerSize = layer_get_bounds(statusLayer);
	graphics_context_set_fill_color(statusContext, GColorBlack);
	graphics_fill_rect(statusContext, GRect(
		statusLayerSize.origin.x + 8,
		statusLayerSize.origin.y + 6,
		statusLayerSize.size.w - 16,
		statusLayerSize.size.h - 12), 4, GCornersAll);
	graphics_context_set_fill_color(statusContext, GColorWhite);
	graphics_fill_rect(statusContext, GRect(
		statusLayerSize.origin.x + 10,
		statusLayerSize.origin.y + 8,
		statusLayerSize.size.w - 20,
		statusLayerSize.size.h - 16), 3, GCornersAll);
}

static void getRadarName() {
	DictionaryIterator *iter;
	app_message_outbox_begin(&iter);
	if (getUseNearestRadar()) {
		dict_write_uint8(iter, GET_NEAREST_RADAR_NAME, 1);
	} else {
		dict_write_uint8(iter, GET_RADAR_NAME, 1);
	}
	dict_write_uint8(iter, RADAR_ID, getRadarId());
	dict_write_uint8(iter, RADAR_SCALE, getRadarScale());
	dict_write_end(iter);
	app_message_outbox_send();
}

static void backgroundTimeout(void *data);

// Ask the JavaScript on the phone to fetch the background.
static void getBackground(void) {
	if (--backgroundRetries == 0) {
		// Failed to fetch the background after three times.
		setStatusMessage("Getting terrain from Bureau of Meteorology...\nFailed");
		return;
	}
	DictionaryIterator *iter;
	app_message_outbox_begin(&iter);
	dict_write_uint32(iter, GET_BACKGROUND, app_message_inbox_size_maximum() - 100);
	dict_write_uint8(iter, IMAGE_WIDTH, imageWidth);
	dict_write_uint8(iter, IMAGE_HEIGHT, imageHeight);
	dict_write_uint8(iter, RADAR_ID, getRadarId());
	dict_write_uint8(iter, RADAR_SCALE, getRadarScale());
	dict_write_end(iter);
	app_message_outbox_send();
	// If phone didn't have full Internet connection at startup,
	// the previous GET_BACKGROUND call may have gone into a
	// black hole.
	backgroundWatchdog = app_timer_register(5000, backgroundTimeout, NULL);
}

static void backgroundTimeout(void *data) {
	setStatusMessage("Getting terrain from Bureau of Meteorology...\nRetrying...");
	getBackground();
}

static void radarTimeout(void *data);

// Ask the JavaScript on the phone to fetch the radar image.
static void getRadar(uint32_t misses) {
	if (--radarRetries == 0) {
		// Failed to fetch the radar after three times.
		setStatusMessage("Getting radar image from Bureau of Meteorology...\nFailed");
		return;
	}
	DictionaryIterator *iter;
	app_message_outbox_begin(&iter);
	dict_write_uint32(iter, GET_RADAR, app_message_inbox_size_maximum() - 100);
	dict_write_uint8(iter, IMAGE_WIDTH, imageWidth);
	dict_write_uint8(iter, IMAGE_HEIGHT, imageHeight);
	dict_write_uint8(iter, RADAR_ID, getRadarId());
	dict_write_uint8(iter, RADAR_SCALE, getRadarScale());
	dict_write_uint32(iter, RADAR_MISSES, misses);
	dict_write_end(iter);
	app_message_outbox_send();
	radarWatchdog = app_timer_register(5000, radarTimeout, NULL);
}

static void radarTimeout(void *data) {
	setStatusMessage("Getting radar image from Bureau of Meteorology...\nRetrying...");
	// This sets the hunt misses back to zero, not ideal,
	// but timeouts are usually on the first try.
	getRadar(0);
}

static void updateFrameAge(uint32_t min) {
	APP_LOG(APP_LOG_LEVEL_DEBUG, "Updating frame age: %lu min", min);
	snprintf(frameAgeText, 12, "%lu min ago", min);
	text_layer_set_text(frameAgeLayer, frameAgeText);	
}

static void supersedeFrame(void) {
	if (frameAge >= frameSupersedeAge) {
		// Image is old enough that there may be a replacement.
		action_bar_layer_remove_from_window(actionBarLayer);
		setStatusMessage("Updating radar image from Bureau of Meteorology...");
		radarRetries = 3;
		getRadar(0);
	}
}

static void tickHandler(struct tm *tick_time, TimeUnits units_changed) {
	if (units_changed & SECOND_UNIT) {
		// Blink crosshairs.
		if (crosshairsCountdown == 0)
			layer_set_hidden(bitmap_layer_get_layer(crosshairsBitmapLayer),
				tick_time->tm_sec % 2 == 0);
		else
			--crosshairsCountdown;
	}
	if (units_changed & MINUTE_UNIT) {
		frameAge = ((frameAge + 59) / 60 + 1) * 60;
		updateFrameAge(frameAge/60);
		// Don't refresh the radar if it isn't visible.
		if (window_stack_get_top_window() == mainWindow) {
			supersedeFrame();
		}
	}
}

static void zoomCleanup(void) {
	layer_remove_from_parent(text_layer_get_layer(radarNameLayer));
	layer_remove_from_parent(bitmap_layer_get_layer(radarScaleLayer));
	gbitmap_destroy(radarScaleBitmap);
	radarScaleBitmap = NULL;
	layer_remove_from_parent(bitmap_layer_get_layer(backgroundBitmapLayer));
	layer_remove_from_parent(text_layer_get_layer(frameAgeLayer));
	layer_remove_from_parent(bitmap_layer_get_layer(radarBitmapLayer));
	action_bar_layer_remove_from_window(actionBarLayer);
}

static void continueZoom(void *context) {
	getRadarName();
}

static void zoomIn(ClickRecognizerRef recognizer, void *context) {
	setRadarScale(getRadarScale() + 1);
	zoomCleanup();
	if (!getZoomOutHintPrinted()) {
		setStatusMessage("Zooming in...\n\nLong press to zoom out");
		app_timer_register(1500, continueZoom, NULL);  // Give time to read.
	}
	else
	{
		setStatusMessage("Zooming in...");
		app_timer_register(500, continueZoom, NULL);  // Give time to read.
	}
	setZoomOutHintPrinted(true);
}

static void zoomOutStart(ClickRecognizerRef recognizer, void *context) {
	setStatusMessage("Zooming out...");
}

static void zoomOut(ClickRecognizerRef recognizer, void *context) {
	setRadarScale(getRadarScale() - 1);
	zoomCleanup();
	app_timer_register(500, continueZoom, NULL);
}

static void selectLocation(ClickRecognizerRef recognizer, void *context) {
	APP_LOG(APP_LOG_LEVEL_DEBUG, "Selecting location");
	action_bar_layer_remove_from_window(actionBarLayer);
	setStatusMessage("Getting radar list...");
	selectLocationGetRadarForStates();
}

void prepareForCancelledSelectLocation(void) {
	action_bar_layer_add_to_window(actionBarLayer, mainWindow);
}

void finishSelectLocation(const char *message) {
	setStatusMessage(message);
	zoomCleanup();
	getRadarName();
}

static void recoverMissing(void *context) {
	clearStatus();
	setStatusMessage("Choose another radar...");
	selectLocationGetRadarForStates();
}

static void configureClickHandlers(void *context) {
	window_single_click_subscribe(BUTTON_ID_DOWN, zoomIn);
	window_long_click_subscribe(BUTTON_ID_DOWN, 500, zoomOutStart, zoomOut);
	window_single_click_subscribe(BUTTON_ID_UP, selectLocation);
}

// Called when a message is received from PebbleKitJS
static void in_received_handler(DictionaryIterator *received, void *context) {
	Tuple *tuple;

	tuple = dict_find(received, JAVASCRIPT_READY);
	if (tuple) {
		// The JavaScript engine on the phone is ready to receive messages.
		setStatusMessage("Getting settings...");
		getRadarName();
		return;
	}

	tuple = dict_find(received, SET_RADAR_NAME);
	if (tuple) {
		// The JavaScript contains the radar site names.
		APP_LOG(APP_LOG_LEVEL_DEBUG, "Getting radar name");
		strncpy(radarName, tuple->value->cstring, sizeof(radarName));
		APP_LOG(APP_LOG_LEVEL_DEBUG, "Radar name is %s", radarName);
		tuple = dict_find(received, RADAR_ID);
		if (tuple)
		{
			setRadarId(tuple->value->uint8);
		}
		tuple = dict_find(received, FRAME_SUPERSEDE_AGE);
		if (tuple)
		{
			frameSupersedeAge = tuple->value->uint32;
			APP_LOG(APP_LOG_LEVEL_DEBUG, "Will refresh when image is %u seconds old.", (unsigned int) frameSupersedeAge);
		}
		locationValid = false;
		tuple = dict_find(received, CROSSHAIRS_X);
		if (tuple)
		{
			crosshairs_x = tuple->value->int32;
			tuple = dict_find(received, CROSSHAIRS_Y);
			if (tuple)
			{
				crosshairs_y = tuple->value->int32;
				locationValid = true;
			}
		}
		tuple = dict_find(received, SET_RADAR_SCALE);
		if (tuple) {
			// JavaScript may override the actual radar scale.
			setRadarScale(tuple->value->uint8);
			
			// Font has a bit of white space above and below; trim.
			text_layer_set_font(radarNameLayer, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
			text_layer_set_text(radarNameLayer, radarName);
			text_layer_set_text_alignment(radarNameLayer, GTextAlignmentCenter);
			layer_add_child(mainLayer, text_layer_get_layer(radarNameLayer));

			// Display an icon representing the radar scale.
			switch (getRadarScale()) {
			case 1:
				radarScaleBitmap = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_SCALE_1);
				break;
			case 2:
				radarScaleBitmap = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_SCALE_2);
				break;
			case 3:
				radarScaleBitmap = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_SCALE_3);
				break;
			case 4:
				radarScaleBitmap = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_SCALE_4);
				break;
			}
			bitmap_layer_set_bitmap(radarScaleLayer, radarScaleBitmap);
			layer_add_child(mainLayer, bitmap_layer_get_layer(radarScaleLayer));
		
			// Having got the radar name, get the background (terrain) image.
			backgroundRetries = 3; 
			setStatusMessage("Getting terrain from Bureau of Meteorology...");
			getBackground();
		}
		return;
	}

	tuple = dict_find(received, RADAR_PICK_LOCATION);
	if (tuple) {
		// Location services are off.
		setStatusMessage("Location unavailable. Choose a location...");
		selectLocationGetRadarForStates();
	}
	
	tuple = dict_find(received, BACKGROUND_CONNECTED);
	if(tuple) {
		// Background download from BOM -> Phone is starting.
		app_timer_reschedule(backgroundWatchdog, 5000);
		setStatusMessage("Getting terrain from Bureau of Meteorology...\nConnected.");
		APP_LOG(APP_LOG_LEVEL_DEBUG, "Background download starting");
		return;
	}
	tuple = dict_find(received, START_BACKGROUND);
	if(tuple) {
		// About to receive background image in chunks.
		app_timer_cancel(backgroundWatchdog);
		setStatusMessage("Getting terrain from Bureau of Meteorology...\nDone.");
		APP_LOG(APP_LOG_LEVEL_DEBUG, "Receiving background");
		return;
	}
	tuple = dict_find(received, BACKGROUND_DATA);
	if(tuple) {
		// One chunk of the background.
		APP_LOG(APP_LOG_LEVEL_DEBUG, "Still receiving background");
		void *data = tuple->value->data;
		tuple = dict_find(received, DATA_OFFSET);
		if (tuple) {
			int offset = tuple->value->int32;
			tuple = dict_find(received, DATA_LENGTH);
			if (tuple) {
				int length = tuple->value->int32;
				memcpy(background->addr + offset, data, length);
			}
		}
		return;
	}
	tuple = dict_find(received, END_BACKGROUND);
	if(tuple) {
		// All chunks have been transmitted.  Show background image.
		APP_LOG(APP_LOG_LEVEL_DEBUG, "Finished receiving background");
		bitmap_layer_set_bitmap(backgroundBitmapLayer, background);
		layer_add_child(mainLayer, bitmap_layer_get_layer(backgroundBitmapLayer));
		
		// Having displayed the background, move on to the radar overlay.
		setStatusMessage("Getting radar image from Bureau of Meteorology...");
		radarRetries = 3; 
		getRadar(0);
		return;
	}
	tuple = dict_find(received, BACKGROUND_TIMEOUT);
	if (tuple) {
		// Timeout can happen if phone was sleeping.
		app_timer_cancel(backgroundWatchdog);
		setStatusMessage("Getting terrain from Bureau of Meteorology...\nTimeout...");
		getBackground();
		return;
	}
	tuple = dict_find(received, BACKGROUND_MISSING);
	if(tuple) {
		app_timer_cancel(backgroundWatchdog);
		setStatusMessage("Terrain image missing");
		app_timer_register(1500, recoverMissing, NULL);
		return;
	}
	tuple = dict_find(received, BACKGROUND_ERROR);
	if(tuple) {
		app_timer_cancel(backgroundWatchdog);
		char errorMessage[30];
		snprintf(errorMessage, sizeof(errorMessage), "Terrain download error: %s", tuple->value->cstring);
		setStatusMessage(errorMessage);
		return;
	}

	tuple = dict_find(received, RADAR_CONNECTED);
	if(tuple) {
		app_timer_reschedule(radarWatchdog, 5000);
		setStatusMessage("Getting radar image from Bureau of Meteorology...\nConnected.");
		APP_LOG(APP_LOG_LEVEL_DEBUG, "Radar download starting");
		return;
	}
	tuple = dict_find(received, START_RADAR);
	if(tuple) {
		// About to receive radar image in chunks.
		app_timer_cancel(radarWatchdog);
		setStatusMessage("Getting radar image from Bureau of Meteorology...\nDone.");
		tuple = dict_find(received, FRAME_AGE);
		if (tuple)
		{
			frameAge = tuple->value->int32;
			text_layer_set_font(frameAgeLayer, fonts_get_system_font(FONT_KEY_GOTHIC_14));
			updateFrameAge(frameAge / 60);
			layer_add_child(mainLayer, text_layer_get_layer(frameAgeLayer));		
		}
		return;
	}
	tuple = dict_find(received, RADAR_DATA);
	if(tuple) {
		// One chunk of the radar.
		APP_LOG(APP_LOG_LEVEL_DEBUG, "Still receiving radar");
		void *data = tuple->value->data;
		tuple = dict_find(received, DATA_OFFSET);
		if (tuple) {
			int offset = tuple->value->int32;
			tuple = dict_find(received, DATA_LENGTH);
			if (tuple) {
				int length = tuple->value->int32;
				memcpy(radar->addr + offset, data, length);
			}
		}
		return;
	}
	tuple = dict_find(received, END_RADAR);
	if(tuple) {
		// All chunks have been received.  Show radar image.
		APP_LOG(APP_LOG_LEVEL_DEBUG, "Finished receiving radar");
		bitmap_layer_set_bitmap(radarBitmapLayer, radar);
		bitmap_layer_set_compositing_mode(radarBitmapLayer, GCompOpAnd);
		layer_add_child(mainLayer, bitmap_layer_get_layer(radarBitmapLayer));
		if (locationValid) {
			APP_LOG(APP_LOG_LEVEL_DEBUG, "Displaying location crosshairs");
			GRect layerSize = layer_get_bounds(bitmap_layer_get_layer(backgroundBitmapLayer));
			bitmap_layer_set_bitmap(crosshairsBitmapLayer, crosshairs);
			layer_set_frame(bitmap_layer_get_layer(crosshairsBitmapLayer),
				GRect(
					crosshairs_x * layerSize.size.w / 2000 + layerSize.size.w/2 - crosshairs->bounds.size.w/2,
					crosshairs_y * layerSize.size.w / 2000 + layerSize.size.h/2 - crosshairs->bounds.size.h/2,
					crosshairs->bounds.size.w,
					crosshairs->bounds.size.h));
			layer_add_child(bitmap_layer_get_layer(backgroundBitmapLayer),
				bitmap_layer_get_layer(crosshairsBitmapLayer));
			layer_set_hidden(bitmap_layer_get_layer(crosshairsBitmapLayer), false);
			crosshairsCountdown = 2;
		} else {
			APP_LOG(APP_LOG_LEVEL_DEBUG, "Hiding location crosshairs");
			layer_remove_from_parent(bitmap_layer_get_layer(crosshairsBitmapLayer));
		}		

		// Done. Reveal the main window behind the status layer.
		clearStatus();
		action_bar_layer_add_to_window(actionBarLayer, mainWindow);

		// Increase the frame age once a minute.
		if (locationValid) {
			tick_timer_service_subscribe(SECOND_UNIT, tickHandler);
		} else {
			tick_timer_service_subscribe(MINUTE_UNIT, tickHandler);
		}
		return;
	}
	tuple = dict_find(received, RADAR_TIMEOUT);
	if (tuple) {
		// Timeout can happen if phone was sleeping.
		app_timer_cancel(radarWatchdog);
		setStatusMessage("Getting radar image from Bureau of Meteorology...\nTimeout...");
		getRadar(0);
		return;
	}
	tuple = dict_find(received, RADAR_HUNTING);
	if(tuple) {
		// Radar is not at the expected URL.  Try alternatives.
		app_timer_cancel(radarWatchdog);
		radarRetries = 3; 
		setStatusMessage("Getting radar image from Bureau of Meteorology...\nHunting...");
		getRadar(tuple->value->int32);
		return;
	}
	tuple = dict_find(received, RADAR_MISSING);
	if(tuple) {
		app_timer_cancel(radarWatchdog);
		setStatusMessage("Radar image missing");
		app_timer_register(1500, recoverMissing, NULL);
		return;
	}
	tuple = dict_find(received, RADAR_ERROR);
	if(tuple) {
		app_timer_cancel(radarWatchdog);
		setStatusMessage("Radar download error");
		return;
	}

	tuple = dict_find(received, SET_STATE_RADAR_COUNT);
	if (tuple) {
		uint8_t count = tuple->value->uint8;
		tuple = dict_find(received, STATE_INDEX);
		if (tuple) {
			uint8_t s = tuple->value->uint8;
			selectLocationSetRadarCountForState(s, count);
		}		
		return;
	}

	tuple = dict_find(received, SET_STATE_RADAR_INFO);
	if (tuple) {
		tuple = dict_find(received, STATE_INDEX);
		if (tuple) {
			uint8_t s = tuple->value->uint8;
			tuple = dict_find(received, STATE_RADAR_INDEX);
			if (tuple) {
				uint8_t i = tuple->value->uint8;
				tuple = dict_find(received, RADAR_ID);
				if (tuple) {
					uint8_t id = tuple->value->uint8;
					tuple = dict_find(received, RADAR_NAME);
					if (tuple) {
						char *name = malloc(1 + strlen(tuple->value->cstring));
						strncpy(name, tuple->value->cstring, strlen(tuple->value->cstring));
						char *detail = NULL;
						tuple = dict_find(received, RADAR_DETAIL);
						if (tuple) {
							detail = malloc(1 + strlen(tuple->value->cstring));
							strncpy(detail, tuple->value->cstring, strlen(tuple->value->cstring));
						}
						selectLocationSetRadarInfoForState(s, i, name, detail, id); 
					}
				}
			}
		}	
		return;
	}
	
	APP_LOG(APP_LOG_LEVEL_DEBUG, "Unrecognized AppMessage");	
}

// Called when an incoming message from PebbleKitJS is dropped.
// With any luck, the JavaScript will try again.
static void in_dropped_handler(AppMessageResult reason, void *context) {
	// setStatusMessage("Internal error: Inbox dropped");
	APP_LOG(APP_LOG_LEVEL_DEBUG, "INBOX DROPPED");	
}

// Called when PebbleKitJS does not acknowledge receipt of a message
static void out_failed_handler(DictionaryIterator *failed, AppMessageResult reason, void *context) {
	//setStatusMessage("Internal error: Outbox failed");
	APP_LOG(APP_LOG_LEVEL_DEBUG, "OUTBOX FAILED");
}

static void mainWindowDisappear(Window *w) {
	clearStatus();
}

static void mainWindowAppear(Window *w) {
}

static void init(void) {
	readPersistentData();
	
	mainWindow = window_create();
	window_set_window_handlers(mainWindow, (WindowHandlers) {
		.disappear = mainWindowDisappear,
		.appear = mainWindowAppear,
	});
	window_stack_push(mainWindow, true);
	
	// Register AppMessage handlers
	app_message_register_inbox_received(in_received_handler); 
	app_message_register_inbox_dropped(in_dropped_handler); 
	app_message_register_outbox_failed(out_failed_handler);
	app_message_open(app_message_inbox_size_maximum(), app_message_outbox_size_maximum());

	// Action bar icons.
	locationIcon = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_ICON_CROSSHAIRS);
	playIcon = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_ICON_PLAY);
	pauseIcon = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_ICON_PAUSE);
	magnifyIcon = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_ICON_MAGNIFY);

	// Main layer has Radar image.
	mainLayer = layer_create(GRect(0, 0, 144, 152));
	layer_add_child(window_get_root_layer(mainWindow), mainLayer);
	
	// Action bar lets user pick scale and site.
	actionBarLayer = action_bar_layer_create();
	action_bar_layer_set_icon(actionBarLayer, BUTTON_ID_UP, locationIcon);
	// action_bar_layer_set_icon(actionBarLayer, BUTTON_ID_SELECT, playIcon);
  	action_bar_layer_set_icon(actionBarLayer, BUTTON_ID_DOWN, magnifyIcon);
	action_bar_layer_set_click_config_provider(actionBarLayer, configureClickHandlers);

	// Status layer pops up with current information about
	// download status, progress and errors.
	GRect statusWindowRect = layer_get_bounds(window_get_root_layer(mainWindow));
	statusLayer = layer_create(statusWindowRect);
	layer_set_update_proc(statusLayer, drawStatusLayer);
	statusTextLayer = text_layer_create(GRect(
		statusWindowRect.origin.x + 15, statusWindowRect.origin.y + 13,
		statusWindowRect.size.w - 30, statusWindowRect.size.h - 26));
	text_layer_set_font(statusTextLayer, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD));
	text_layer_set_overflow_mode(statusTextLayer, GTextOverflowModeTrailingEllipsis);
	text_layer_set_text_alignment(statusTextLayer, GTextAlignmentCenter);
	layer_add_child(statusLayer, text_layer_get_layer(statusTextLayer));
	layer_add_child(window_get_root_layer(mainWindow), statusLayer);

	crosshairs = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_ICON_LOCATION);
	crosshairsBitmapLayer = bitmap_layer_create(crosshairs->bounds);
	bitmap_layer_set_compositing_mode(crosshairsBitmapLayer, GCompOpAnd);
	radarNameLayer = text_layer_create(GRect(0, -3, 124, 21));
	radarScaleLayer = bitmap_layer_create(GRect(82, 133, 40, 16));
	radarBitmapLayer = bitmap_layer_create(GRect(1, 18, imageWidth, imageHeight));
	background = gbitmap_create_blank(GSize(imageWidth, imageHeight));
	backgroundBitmapLayer = bitmap_layer_create(GRect(1, 18, imageWidth, imageHeight));
	radar = gbitmap_create_blank(GSize(imageWidth, imageHeight));
	frameAgeLayer = text_layer_create(GRect(1, 131, 60, 18));
	
	setStatusMessage("Connecting to Phone...");
	APP_LOG(APP_LOG_LEVEL_DEBUG, "Pebble main ready");
}

static void deinit(void) {
	writePersistentData();
	selectLocationDeallocate();
	
	// Memory leak of 40 bytes in Pebble SDK here.
	// http://forums.getpebble.com/discussion/16697/localtime-makes-40b-leak
	tick_timer_service_unsubscribe();

	app_message_deregister_callbacks();
	if (frameAgeLayer)
		text_layer_destroy(frameAgeLayer);
	if (radarScaleLayer)
		bitmap_layer_destroy(radarScaleLayer);
	if (radarScaleBitmap)
		gbitmap_destroy(radarScaleBitmap);
	if (radarNameLayer)
		text_layer_destroy(radarNameLayer);
	if (radarBitmapLayer)
		bitmap_layer_destroy(radarBitmapLayer);
	if (radar)
		gbitmap_destroy(radar);
	if (backgroundBitmapLayer)
		bitmap_layer_destroy(backgroundBitmapLayer);
	if (background)
		gbitmap_destroy(background);
	if (actionBarLayer)
		action_bar_layer_destroy(actionBarLayer);
	if (crosshairsBitmapLayer)
		bitmap_layer_destroy(crosshairsBitmapLayer);
	gbitmap_destroy(locationIcon);
	gbitmap_destroy(playIcon);
	gbitmap_destroy(pauseIcon);
	gbitmap_destroy(magnifyIcon);
	gbitmap_destroy(crosshairs);
	text_layer_destroy(statusTextLayer);
	layer_destroy(statusLayer);
	layer_destroy(mainLayer);
	window_destroy(mainWindow);
}

int main(void) {
	init();
	app_event_loop();
	deinit();
}
