/**
 * Determines whether the array contains the specified element.
 */
/**
 * Determines whether the array contains the specified element.
 */ export function contains(xs, element) {
    for (var _i = 0, xs_1 = xs; _i < xs_1.length; _i++) {
        var x = xs_1[_i];
        if (x === element) {
            return true;
        }
    }
    return false;
}
