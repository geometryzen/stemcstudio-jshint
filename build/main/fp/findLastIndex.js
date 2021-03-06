"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 *
 */
function findLastIndex(xs, callback) {
    for (var i = xs.length - 1; i >= 0; i--) {
        var x = xs[i];
        if (callback(x)) {
            return i;
        }
    }
    return -1;
}
exports.findLastIndex = findLastIndex;
