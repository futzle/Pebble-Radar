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
	var palette = new Array(chunkData.length / 3);
	for (var i = 0; i < palette.length; ++i) {
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
function unfilterScanLines(data, width, height, bitDepth) {
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
	  result.IDAT.inflated = pako.inflate(result.IDAT.stream);
	  // Pass through filter.
	  result.IDAT.unfiltered =
		unfilterScanLines(result.IDAT.inflated, result.IHDR.width, result.IHDR.height, result.IHDR.bitDepth);
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

/* Prepend a length, and append a CRC, to make a PNG chunk. */
function makeChunk(tag, data) {
	var result = new Uint8Array(12 + data.length);
	writeUInt32BE(result, data.length, 0);
	result[4] = tag.charCodeAt(0);
	result[5] = tag.charCodeAt(1);
	result[6] = tag.charCodeAt(2);
	result[7] = tag.charCodeAt(3);
	result.set(data, 8);
	var crc = crc32(result.subarray(4, result.length - 4));
	result.set(crc, result.length - 4)
	return result;
}

/* Concatenate a bunch of Uint8Arrays, to build a PNG. */
function concatArrays() {
    var totalLength = 0;
    for (var i = 0; i < arguments.length; i++) {
    	totalLength += arguments[i].length;
    }
	var result = new Uint8Array(totalLength);
	var position = 0;
	for (var i = 0; i < arguments.length; i++) {
		result.set(arguments[i], position);
		position += arguments[i].length;
	}
	return result;
}

/* Write the header chunk. */
function writeChunkIHDR(pngData) {
	console.log("Encoding IHDR chunk");
	var header = new Uint8Array(13);
	writeUInt32BE(header, pngData.width, 0);
	writeUInt32BE(header, pngData.height, 4);
	header[8] = pngData.bitDepth;  // bit depth
	header[9] = 3;  // indexed
	header[10] = 0;  // deflate
	header[11] = 0;  // default filtering
	header[12] = 0;  // no interlacing
	return makeChunk("IHDR", header);
}

/* Write the palette chunk. */
function writeChunkPLTE(pngData) {
	console.log("Encoding PLTE chunk");
	var palette = new Uint8Array(pngData.palette.length * 3);
	for (var i = 0; i < pngData.palette.length; i++) {
		palette[i * 3] = pngData.palette[i].red;
		palette[i * 3 + 1] = pngData.palette[i].green;
		palette[i * 3 + 2] = pngData.palette[i].blue;
	}
	return makeChunk("PLTE", palette);
}

/* Write the transparency chunk. */
function writeChunktRNS(pngData) {
	console.log("Encoding tRNS chunk");
	var header = new Uint8Array(pngData.palette.length);
	for (var i = 0; i < pngData.palette.length; ++i) {
		header[i] = pngData.palette[i].alpha;
	}
	return makeChunk("tRNS", header);
}

/* Pack PNG scan lines into bytes. */
function packScanLines(data, width, height, bitDepth) {
	// Packed width must be an integral number of bytes.
	var width8 = ((width * bitDepth + 7) & ~7) / bitDepth;
	var result = new Uint8Array(width8 * bitDepth / 8 * height);
	for (var i = 0; i < width8 * bitDepth / 8 * height; ++i) {
		result[i] = 0;
	}
	for (var y = 0; y < height; ++y) {
		for (var x = 0; x < width; ++x) {
			var val;
			switch (bitDepth) {
			case 1:
				result[y * width8 / 8 + Math.floor(x/8)] |=
					data[y * width + x] << (7 - x % 8);
				break;
			case 2:
				result[y * width8 / 4 + Math.floor(x/4)] |=
					data[y * width + x] << (3 - x % 4) * 2;
				break;
			case 4:
				result[y * width8 / 2 + Math.floor(x/2)] |=
					data[y * width + x] << (1 - x % 2) * 4;
				break;
			case 8:
				result[y * width8 + x] = data[y * width + x];
				break;
			}
		}
	}
	return result;
}

/* Apply the "none" filter to the scan lines, which adds a extra byte. */
function filterScanLines(packedData, width, height, bitDepth) {
	// Width must be an integral number of bytes.
	var width8 = ((width * bitDepth + 7) & ~7) / bitDepth;
	var result = new Uint8Array(height * (width8 * bitDepth / 8 + 1));
	for (var y = 0; y < height; ++y) {
		result[y * (width8 * bitDepth / 8 + 1)] = 0;  // No filter.
		for (var x = 0; x < width8 * bitDepth / 8; ++x) {
			result[y * (width8 * bitDepth / 8 + 1) + x + 1] =
				packedData[y * width8 * bitDepth / 8 + x];
		}
	}
	return result;
}

/* Write the compressed image data chunk. */
function writeChunkIDAT(pngData) {
	console.log("Encoding IDAT chunk");
	var packed = packScanLines(pngData.data, pngData.width, pngData.height, pngData.bitDepth);
	var filtered = filterScanLines(packed, pngData.width, pngData.height, pngData.bitDepth);
	return makeChunk("IDAT", pako.deflate(filtered));
}

/* Write the image-end chunk. */
function writeChunkIEND(pngData) {
	console.log("Encoding IEND chunk");
	return makeChunk("IEND", new Uint8Array(0));
}

/* Encode an image as a PNG stream, then call onSuccess() with the stream. */
function encodePng(pngData, width, height, context, onSuccess, onFailure) {
	var ihdrChunk = writeChunkIHDR(pngData);
	var plteChunk = writeChunkPLTE(pngData);
	var trnsChunk = writeChunktRNS(pngData);
	var idatChunk = writeChunkIDAT(pngData);
	var iendChunk = writeChunkIEND(pngData);
	var result = concatArrays(
			new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature.
			ihdrChunk,
			plteChunk,
			trnsChunk,
			idatChunk,
			iendChunk);
	onSuccess(result, width, height, context, onFailure);	
}
