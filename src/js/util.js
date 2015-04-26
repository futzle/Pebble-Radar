/* Compare two arrays for equality. */
function arrayEqual(a, b) {
	if (a.length != b.length) return false;
	for (var i = 0; i < a.length; ++i) {
		if (a[i] != b[i]) return false;
	}
	return true;
}

function readUInt32BE(array, offset) {
  	return array[offset] << 24 |
	  	array[offset+1] << 16 |
	  	array[offset+2] << 8 |
	  	array[offset+3];
}

function writeUInt32BE(array, val, offset) {
  	array[offset] = (val >>> 24) & 0xFF;
  	array[offset+1] = (val >>> 16) & 0xFF;
  	array[offset+2] = (val >>> 8) & 0xFF;
  	array[offset+3] = val & 0xFF;
}

function writeInt32BE(array, val, offset) {
  	array[offset] = (val >> 24) & 0xFF;
  	array[offset+1] = (val >> 16) & 0xFF;
  	array[offset+2] = (val >> 8) & 0xFF;
  	array[offset+3] = val & 0xFF;
}

/* Add properties from newObject to result. */
function extend(result, newObject) {
	for (var attrname in newObject) { result[attrname] = newObject[attrname]; }
}

