
// Map the fifteen radar levels to greys from pale to dark.
// These values are chosen arbitrarily to convey the
// most information about nearby rain.
var greyLevels = new Uint8Array(
	[210, 170, 150, 130, 110,
	90, 75, 55, 45, 30,
	20, 15, 10, 5, 0]
);


/* Rescale a greyscale bitmap to a smaller size. */
function resizeBitmap(originalData, originalWidth, originalHeight, newWidth, newHeight) {
	var newData = new Uint8Array(newWidth * newHeight);	
	// Iterate over every new pixel (in the smaller bitmap).
	// A new pixel may straddle partial pixels in the original image.
	for (var nx = 0; nx < newWidth; ++nx)
	{
		for (var ny = 0; ny < newHeight; ++ny)
		{
			// Get boundaries of this pixel in the old (larger) image space.
			var ox1 = nx * originalWidth / newWidth;
			if (ox1 < 0) ox1 = 0;
			var ox2 = (nx + 1) * originalWidth / newWidth;
			if (ox2 > originalWidth) ox2 = originalWidth;
			var oy1 = ny * originalHeight / newHeight;
			if (oy1 < 0) oy1 = 0;
			var oy2 = (ny + 1) * originalHeight / newHeight;
			if (oy2 > originalHeight) oy2 = originalHeight;
			// Collect values from every pixel in range [ox1, ox2), [oy1, oy2).
			var sum = 0;
			// Left partial pixels.
			if (ox1 !== 0)
			{
				// Top left corner.
				if (oy1 !== 0)
				{
					sum += originalData[(Math.ceil(oy1)-1) * originalWidth + (Math.ceil(ox1)-1)] * (Math.ceil(oy1) - oy1) * (Math.ceil(ox1) - ox1);
				}
				// Left edge.
				for (var iy = Math.ceil(oy1); iy < Math.floor(oy2); ++iy)
				{
					sum += originalData[iy * originalWidth + Math.ceil(ox1)-1] * (Math.ceil(ox1)-ox1);
				}
				// Bottom left corner.
				if (oy2 != originalHeight)
				{
					sum += originalData[(Math.floor(oy2)) * originalWidth + (Math.ceil(ox1)-1)] * (oy2 - Math.floor(oy2)) * (Math.ceil(ox1) - ox1);
				}
			}
			for (var ix = Math.ceil(ox1); ix < Math.floor(ox2); ++ix)
			{
				// Top partial pixels.
				if (oy1 !== 0)
				{
					sum += originalData[(Math.ceil(oy1)-1) * originalWidth + ix] * (Math.ceil(oy1) - oy1);
				}
				// Full pixels.
				for (var iy = Math.ceil(oy1); iy < Math.floor(oy2); ++iy)
				{
					sum += originalData[iy * originalWidth + ix];
				}
				// Bottom partial pixels.
				if (oy2 != originalHeight)
				{
					sum += originalData[(Math.floor(oy2)) * originalWidth + ix] * (oy2 - Math.floor(oy2));
				}
			}
			// Right partial pixels.
			if (ox2 != originalWidth)
			{
				// Top right corner.
				if (oy1 !== 0)
				{
					sum += originalData[(Math.ceil(oy1)-1) * originalWidth + (Math.floor(ox2))] * (Math.ceil(oy1) - oy1) * (ox2 - Math.floor(ox2));
				}
				// Right edge.
				for (var iy = Math.ceil(oy1); iy < Math.floor(oy2); ++iy)
				{
					sum += originalData[iy * originalWidth + Math.floor(ox2)] * (ox2 - Math.floor(ox2));
				}
				// Bottom right corner.
				if (oy2 != originalHeight)
				{
					sum += originalData[(Math.floor(oy2)) * originalWidth + (Math.floor(ox2))] * (oy2 - Math.floor(oy2)) * (ox2 - Math.floor(ox2));
				}
			}
			// Scale sum for size of new pixels.
			var nv = sum * newWidth * newHeight / originalWidth / originalHeight;
			// Clamp to [0,255] in case of rounding errors.
			if (nv < 0) nv = 0;
			if (nv > 255) nv = 255;
			// Round to nearest integer.
			newData[ny * newWidth + nx] = Math.floor(nv + 0.5);
		}
	}
	return newData;
}

/* Dither a greyscale bitmap into a monochrome bitmap using
   Floyd-Steinberg error distribution. */
function floydSteinberg(data, width, height) {
	var newData = new Uint8Array(data);
	for (var y = 0; y < height; ++y)
	{
		for (var x = 0; x < width; ++x)
		{
			var ov = newData[y * width + x];
			var nv = (ov > 128) ? 255 : 0;
			newData[y * width + x] = nv;
			var quant_error = ov - nv;
			if (x != width - 1)
			{
				// Not right edge.
				var nv1 = newData[y*width + x+1] + quant_error * 7/16;
				newData[y*width + x+1] = nv1 < 0 ? 0 :
					nv1 > 255 ? 255 :
					Math.round(nv1);
			}
			if (y != height - 1)
			{
				// Not bottom row.
				if (x !== 0)
				{
					// Not left edge.
					var nv2 = newData[(y+1)*width + x-1] + quant_error * 3/16;
					newData[(y+1)*width + x-1] = nv2 < 0 ? 0 :
						nv2 > 255 ? 255 :
						Math.round(nv2);
				}
				var nv3 = newData[(y+1)*width + x] + quant_error * 5/16;
				newData[(y+1)*width + x] = nv3 < 0 ? 0 :
					nv3 > 255 ? 255 :
					Math.round(nv3);
				if (x != width - 1)
				{
					// Not right edge.
					var nv4 = newData[(y+1)*width + x+1] + quant_error * 1/16;
					newData[(y+1)*width + x+1] = nv4 < 0 ? 0 :
						nv4 > 255 ? 255 :
						Math.round(nv4);
				}
			}
		}
	}
	return newData;
}

/* Turn a greyscale bitmap into a packed bitmap for transfer to the Pebble. */
function packBitmap(greyScale, width, height)
{
  var width32 = (width + 31) & ~31;
  var result = new Uint8Array(width32 / 8 * height);
  for (var y = 0; y < height; ++y) {
	for (var x = 0; x < width32 / 8; ++x) {
	  var val = 0;
	  for (var xPixel = 0; xPixel < 8; ++xPixel) {
		if (x * 8 + xPixel < width) val |= (greyScale[y * width + x * 8 + xPixel] > 128 ? 1 : 0) << xPixel;
	  }
	  result[y * width32 / 8 + x] = val;
	}
  }
  return result;
}

/* Produce a bitmap that shows just the coastline of the radar station. */
function partitionAndResizeBackgroundBitmap(pngObject, newWidth, newHeight, onFailure) {
	if (!isBomBackgroundImage(pngObject)) {
		onFailure("Background format has changed");
		return;
	}
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
	var resized = resizeBitmap(partitioned, pngObject.IHDR.width,
		pngObject.IHDR.height - IMAGE_HEADER_PIXELS - IMAGE_FOOTER_PIXELS,
		newWidth, newHeight);
	// Make pixels black or white.
	for (var i = 0; i < newWidth * newHeight; ++i) {
		// 224 is from experimentation.  Higher = blacker coastlines.
		resized[i] = resized[i] >= 224 ? 255 : 0;
	}
  console.log("Resized background bitmap, " + resized.length + " pixels");
  var packedBitmap = packBitmap(resized, newWidth, newHeight);
  sendBackgroundToPebble(packedBitmap, newWidth, newHeight);
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
	var dithered = floydSteinberg(resized, newWidth, newHeight);
	console.log("Resized radar bitmap, " + dithered.length + " pixels");
	var packedBitmap = packBitmap(dithered, newWidth, newHeight);
	sendRadarToPebble(packedBitmap, newWidth, newHeight, context);
}

