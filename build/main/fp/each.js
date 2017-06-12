"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Executes a callback function for each key-value pair in a map.
 */
function each(obj, callback) {
    if (!obj) {
        return;
    }
    var keys = Object.keys(obj);
    for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
        var key = keys_1[_i];
        var value = obj[key];
        callback(value, key);
    }
}
exports.each = each;
