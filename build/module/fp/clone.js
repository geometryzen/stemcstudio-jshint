/**
 * Makes a shallow copy of an object.
 */
/**
 * Makes a shallow copy of an object.
 */ export function clone(x) {
    var keys = Object.keys(x);
    var result = {};
    for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
        var key = keys_1[_i];
        var prop = x[key];
        result[key] = prop;
    }
    return result;
}
