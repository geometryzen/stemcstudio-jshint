"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Determines whether the specified object has any keys.
 */
function isEmpty(xs) {
    return Object.keys(xs).length === 0;
}
exports.isEmpty = isEmpty;
