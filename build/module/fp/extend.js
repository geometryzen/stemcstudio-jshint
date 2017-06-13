/**
 * Extends the first object using properties from the second.
 */
/**
 * Extends the first object using properties from the second.
 */ export function extend(obj, x) {
    var keys = Object.keys(x);
    for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
        var key = keys_1[_i];
        var prop = x[key];
        obj[key] = prop;
    }
    return obj;
}
