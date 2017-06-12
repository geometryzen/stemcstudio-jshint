"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function mixin(obj, base) {
    var wild = obj;
    for (var key in base) {
        if (base.hasOwnProperty(key)) {
            wild[key] = base[key];
        }
    }
    return wild;
}
exports.mixin = mixin;
