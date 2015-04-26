/* Decode chunk: PNG header. */
function readChunkIHDR(chunkData) {
	console.log("Decoding IHDR chunk");
	var header = new Object();
	header.width = readUInt32BE(chunkData, 0);
	header.height = readUInt32BE(chunkData, 4);
	header.bitDepth = chunkData[8];
	header.colorType = chunkData[9];
	header.compressionMethod = chunkData[10];
	header.filterMethod = chunkData[11];
	header.interlaceMethod = chunkData[12];
	return header;
}

/* Decode chunk: Palette. */
function readChunkPLTE(chunkData) {
	console.log("Decoding PLTE chunk");
	if (chunkData.length % 3 != 0) {
		throw "Palette is not multiple of three bytes long";
	}
	var palette = new Array;
	for (var i = 0; i * 3 < chunkData.length; ++i) {
		// RRGGBB format.
		palette[i] = chunkData[i * 3] << 16 |
			chunkData[i * 3 + 1] << 8 |
			chunkData[i * 3 + 2];
	}
	return {
		"palette": palette
	};
}

/* Decode chunk: Significant bits. */
function readChunksBIT(chunkData, chunkIHDR) {
	switch (chunkIHDR.colorType) {
	case 0:
		return { "grey": chunkData[0] };
	case 2:
	case 3:
		return { "red": chunkData[0],
			"green": chunkData[1],
			"blue": chunkData[2] };
	case 4:
		return { "grey": chunkData[0],
			"alpha": chunkData[1] };
	case 6:
		return { "red": chunkData[0],
			"green": chunkData[1],
			"blue": chunkData[2],
			"alpha": chunkData[3] };
	default:
		throw "Cannot handle sBIT chunk with unknown color type";
	}
}

/* Read a chunk of PNG. */
function readChunk(pngStream, chunkStart, previousChunks) {
	var result = { };
	result.length = readUInt32BE(pngStream, chunkStart);
	var crcActual = pngStream.subarray(chunkStart+8+result.length, chunkStart+12+result.length);
	var crcExpected = crc32(pngStream.subarray(chunkStart+4, chunkStart+8+result.length));
	if (!arrayEqual(crcActual, crcExpected)) {
		throw "Bad CRC";
	}
	result.type = String.fromCharCode(pngStream[chunkStart+4]) +
	String.fromCharCode(pngStream[chunkStart+5]) +
	String.fromCharCode(pngStream[chunkStart+6]) +
	String.fromCharCode(pngStream[chunkStart+7]);
	var data = pngStream.subarray(chunkStart+8, chunkStart+8+result.length);
	switch (result.type) {
	case "IHDR":
		// PNG header.
		extend(result, readChunkIHDR(data));
		break;
	case "PLTE":
		// Palette.
		extend(result, readChunkPLTE(data));
		break;
	case "sBIT":
		// Significant bits.
		extend(result, readChunksBIT(data, previousChunks.IHDR));
		break;
	case "IDAT":
		// Image data chunks will be concatenated, decompressed, and filtered later.
		extend(result, { "stream": data });
		break;
	case "IEND":
		// End image chunk.
		break;
	default:
		console.log("Ignoring unrecognized chunk " + result.type);
	}
	return result;
}

/* Filter the decompressed PNG stream into scanlines. */
function filterScanLines(data, width, height, bitDepth) {
	// Width must be an integral number of bytes.
	var width8 = ((width * bitDepth + 7) & ~7) / bitDepth;
	var result = new Uint8Array(width8 * height * bitDepth / 8);
	for (var y = 0; y < height; ++y) {
		var filterType = data[y * (width8 * bitDepth / 8 + 1)];
		var filter;
		switch (filterType) {
		case 0:
			// "un"filtered.
			filter = function(current, a, b, c) {
				return current;
			}
			break;
		case 1:
		case 2:
		case 3:
		case 4:
			// Not yet implemented.
			throw "Filter type " + filterType + " not implemented";
		default:
			// Not in the specification.
			throw "Filter type " + filterType + " not known";
		}
		// Apply filter to every byte in this scanline.
		for (var x = 0; x < width8 * bitDepth / 8; ++x) {
			var val = filter(data[y * (width8 * bitDepth / 8 + 1) + x + 1]);
			result[y * width8 * bitDepth / 8 + x] = val;
		}
	}
	return result;
}

/* Unpack pixels, if more than one appears in a byte (bitDepth < 8). */
function unpackScanLines(data, width, height, bitDepth) {
	var width8 = ((width * bitDepth + 7) & ~7) / bitDepth;
	var result = new Uint8Array(width * height);
	for (var y = 0; y < height; ++y) {
		for (var x = 0; x < width; ++x) {
			var val;
			switch (bitDepth) {
			case 1:
				var byte = data[y * width8 / 8 + Math.floor(x/8)];
				val = (byte >>> (7 - (x % 8))) & 0x1;
				break;
			case 2:
				var byte = data[y * width8 / 4 + Math.floor(x/4)];
				val = (byte >>> (6 - 2 * (x % 4))) & 0x3;
				break;
			case 4:
				var byte = data[y * width8 / 2 + Math.floor(x/2)];
				val = (byte >>> (4 - 4 * (x % 2))) & 0xF;
				break;
			case 8:
				var byte = data[y * width8 + x];
				val = byte;
				break;
			default:
				throw "Bit depth " + bitDepth + " not supported";
			}
			result[y * width + x] = val;
		}
	}
	return result;
}

/* Decode the PNG stream, and call onSuccess() with the decoded stream. */
function decodePng(pngStream, onSuccess, onFailure) {
	if (arrayEqual(pngStream.subarray(0,8), [137, 80, 78, 71, 13, 10, 26, 10])) {
		console.log("PNG signature found");
		// Start after the eight-byte PNG signature.
		var chunkStart = 8;
		var result = { };
		// Read each chunk in the stream.
		while (true) {
			var chunk;
			try {
				chunk = readChunk(pngStream, chunkStart, result);
			} catch (err) {
				onFailure(err);
				return;
			}
			if (result[chunk.type]) {
				if (chunk.type === "IDAT") {
					// Chunk may be repeated.
					result.IDAT.length += chunk.length;
					onFailure("Repeating IDAT not implemented.");
					return;
				} else {
					// Chunk not expected to repeat.
					onFailure("Chunk type " + chunk.type + " may not be repeated");
					return;
				}
			} else {
				// First instance of this chunk.
				result[chunk.type] = chunk;
			}
			// IEND is the last chunk.
			if (chunk.type === "IEND") break;
			// Chunk tag + length + CRC is 12 bytes.
			chunkStart += chunk.length + 12;
		}
		// All chunks read, now decompress the data in IDAT.
		switch (result.IHDR.compressionMethod) {
		case 0:
	  var inflated = new FlateStream(new Stream(result.IDAT.stream));
	  // Successfully inflated.
	  result.IDAT.inflated = inflated.getBytes();
	  // Pass through filter.
	  result.IDAT.unfiltered =
		filterScanLines(result.IDAT.inflated, result.IHDR.width, result.IHDR.height, result.IHDR.bitDepth);
	  // Unpack pixels into bytes.
	  result.IDAT.unpacked =
		unpackScanLines(result.IDAT.unfiltered, result.IHDR.width, result.IHDR.height, result.IHDR.bitDepth);
	  switch (result.IHDR.colorType) {
	  case 0:
	  case 2:
	  case 4:
	  case 6:
		// Non-palette images are already greyscale or RGBA or ...
		break;
	  case 3:
		// If I wanted to map palette colours to RGB, I'd do it here.
		break;
	  default:
		onFailure("Color type " + result.IHDR.colorType + " not yet implemented");
		return;
	  }
	  // Now pass fully decoded object back to user code.
	  onSuccess(result, onFailure);
			break;
		default:
			onFailure("Unknown compression method");
			return;
		}
		return result;
	} else {
		onFailure("PNG signature expected");
	}
}

