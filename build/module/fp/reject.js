/**
 * Returns a subset of the elements of an array that DON'T satisfy a predicate.
 */
/**
 * Returns a subset of the elements of an array that DON'T satisfy a predicate.
 */ export function reject(xs, predicate) {
    var result = [];
    for (var _i = 0, xs_1 = xs; _i < xs_1.length; _i++) {
        var x = xs_1[_i];
        if (!predicate(x)) {
            result.push(x);
        }
    }
    return result;
}
