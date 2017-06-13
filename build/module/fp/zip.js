export function zip(xs, ys) {
    var zs = [];
    var N = xs.length;
    for (var i = 0; i < N; i++) {
        var x = xs[i];
        var y = ys[i];
        // TypeScript needs a little help here...
        var z = [x, y];
        zs.push(z);
    }
    return zs;
}
