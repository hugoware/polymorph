var polymorph = (function (exports) {
'use strict';

function isString(obj) {
    return typeof obj === 'string';
}

var selectorRegex = /^([#|\.]|path)/i;
function getPath(selector) {
    if (isString(selector)) {
        if (!selectorRegex.test(selector)) {
            return selector;
        }
        selector = document.querySelector(selector);
    }
    return selector.getAttribute('d');
}

var _ = undefined;
var V = 'V';
var H = 'H';
var Z = 'Z';
var M = 'M';
var C = 'C';
var S = 'S';
var Q = 'Q';
var T = 'T';

var math = Math;
var abs = math.abs;
var min = math.min;
var max = math.max;
var floor = math.floor;
var sqrt = math.sqrt;
var quadraticRatio = 2.0 / 3;
var EPSILON = Math.pow(2, -52);

function renderPath(ns) {
    if (isString(ns)) {
        return ns;
    }
    var parts = [];
    for (var i = 0; i < ns.length; i++) {
        var n = ns[i];
        parts.push(M, formatNumber(n[0]), formatNumber(n[1]), C);
        for (var f = 2; f < n.length; f++) {
            parts.push(formatNumber(n[f]));
        }
    }
    return parts.join(' ');
}
function formatNumber(n) {
    return (floor(n * 100) / 100).toString();
}

function raiseError() {
    throw new Error(Array.prototype.join.call(arguments, ' '));
}

function reversePoints(s) {
    var d = s.slice(-2);
    for (var i = s.length - 3; i > -1; i -= 6) {
        d.push(s[i - 1], s[i], s[i - 3], s[i - 2], s[i - 5], s[i - 4]);
    }
    return d;
}

function fillObject(dest, src) {
    for (var key in src) {
        if (!dest.hasOwnProperty(key)) {
            dest[key] = src[key];
        }
    }
    return dest;
}

function fillSegments(larger, smaller) {
    var largeLen = larger.length;
    var smallLen = smaller.length;
    if (largeLen < smallLen) {
        return fillSegments(smaller, larger);
    }
    smaller.length = largeLen;
    for (var i = smallLen; i < largeLen; i++) {
        var l = larger[i];
        var d = Array(l.d.length);
        for (var k = 0; k < l.d.length; k += 2) {
            d[k] = l.ox;
            d[k + 1] = l.oy;
        }
        smaller[i] = fillObject({ d: d }, l);
    }
}

function rotatePoints(ns, count) {
    while (count--) {
        ns.push(ns.shift());
    }
}

function distance(x1, y1, x2, y2) {
    return sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));
}

function normalizePoints(ns) {
    var len = ns.length;
    if (ns[len - 2] !== ns[0] || ns[len - 1] !== ns[1]) {
        return;
    }
    ns.splice(0, 2);
    len = ns.length;
    var index, minAmount;
    for (var i = 0; i < len; i += 6) {
        var next = distance(0, 0, ns[i], ns[i + 1]);
        if (minAmount === _ || next < minAmount) {
            minAmount = next;
            index = i;
        }
    }
    rotatePoints(ns, index);
    ns.splice(0, 0, ns[len - 2], ns[len - 1]);
}

function fillPoints(larger, smaller) {
    if (larger.length < smaller.length) {
        return fillPoints(smaller, larger);
    }
    var numberInSmaller = (smaller.length - 2) / 6;
    var numberInLarger = (larger.length - 2) / 6;
    var numberToInsert = numberInLarger - numberInSmaller;
    if (numberToInsert === 0) {
        return;
    }
    var dist = numberToInsert / numberInLarger;
    for (var i = 0; i < numberToInsert; i++) {
        var index = min(floor(dist * i * 6) + 2, smaller.length);
        var x = smaller[index - 2];
        var y = smaller[index - 1];
        smaller.splice(index, 0, x, y, x, y, x, y);
    }
}

function sizeDesc(a, b) {
    return b.p - a.p;
}
function normalizePaths(left, right) {
    var leftPath = left.data.slice().sort(sizeDesc);
    var rightPath = right.data.slice().sort(sizeDesc);
    if (leftPath[0].p < 0) {
        leftPath.forEach(function (s) { return reversePoints(s.d); });
    }
    if (rightPath[0].p < 0) {
        rightPath.forEach(function (s) { return reversePoints(s.d); });
    }
    if (leftPath.length !== rightPath.length) {
        fillSegments(leftPath, rightPath);
    }
    var l = leftPath.map(function (p) { return p.d; });
    var r = rightPath.map(function (p) { return p.d; });
    for (var i = 0; i < leftPath.length; i++) {
        normalizePoints(l[i]);
        normalizePoints(r[i]);
    }
    for (var i = 0; i < leftPath.length; i++) {
        fillPoints(l[i], r[i]);
    }
    return [l, r];
}

function interpolatePath(paths) {
    if (!paths || paths.length < 2) {
        raiseError('invalid arguments');
    }
    var hlen = paths.length - 1;
    var items = Array(hlen);
    for (var h = 0; h < hlen; h++) {
        items[h] = getPathInterpolator(paths[h], paths[h + 1]);
    }
    return function (offset) {
        var d = hlen * offset;
        var flr = min(floor(d), hlen - 1);
        return renderPath(items[flr]((d - flr) / (flr + 1)));
    };
}
function getPathInterpolator(left, right) {
    var matrix = normalizePaths(left, right);
    var n = matrix[0].length;
    return function (offset) {
        if (abs(offset - 0) < EPSILON) {
            return left.path;
        }
        if (abs(offset - 1) < EPSILON) {
            return right.path;
        }
        var results = Array(n);
        for (var h = 0; h < n; h++) {
            results[h] = mixPoints(matrix[0][h], matrix[1][h], offset);
        }
        return results;
    };
}
function mixPoints(a, b, o) {
    var alen = a.length;
    var results = Array(alen);
    for (var i = 0; i < alen; i++) {
        results[i] = a[i] + (b[i] - a[i]) * o;
    }
    return results;
}

function coalesce(current, fallback) {
    return current === _ ? fallback : current;
}

var argLengths = { M: 2, H: 1, V: 1, L: 2, Z: 0, C: 6, S: 4, Q: 4, T: 2 };
function m(ctx) {
    var n = ctx.t;
    addSegment(ctx, n[0], n[1]);
}
function h(ctx) {
    addCurve(ctx, _, _, _, _, ctx.t[0], _);
}
function v(ctx) {
    addCurve(ctx, _, _, _, _, _, ctx.t[0]);
}
function l(ctx) {
    var n = ctx.t;
    addCurve(ctx, _, _, _, _, n[0], n[1]);
}
function z(ctx) {
    addCurve(ctx, _, _, _, _, ctx.p[0], ctx.p[1]);
}
function c(ctx) {
    var n = ctx.t;
    addCurve(ctx, n[0], n[1], n[2], n[3], n[4], n[5]);
    ctx.cx = n[2];
    ctx.cy = n[3];
}
function s(ctx) {
    var n = ctx.t;
    var isInitialCurve = ctx.lc !== S && ctx.lc !== C;
    var x1 = isInitialCurve ? _ : ctx.x * 2 - ctx.cx;
    var y1 = isInitialCurve ? _ : ctx.y * 2 - ctx.cy;
    addCurve(ctx, x1, y1, n[0], n[1], n[2], n[3]);
    ctx.cx = n[0];
    ctx.cy = n[1];
}
function q(ctx) {
    var n = ctx.t;
    var cx1 = n[0];
    var cy1 = n[1];
    var dx = n[2];
    var dy = n[3];
    var x = ctx.x;
    var y = ctx.y;
    addCurve(ctx, x + (cx1 - x) * quadraticRatio, y + (cy1 - y) * quadraticRatio, dx + (cx1 - dx) * quadraticRatio, dy + (cy1 - dy) * quadraticRatio, dx, dy);
    ctx.cx = cx1;
    ctx.cy = cy1;
}
function t(ctx) {
    var n = ctx.t;
    var dx = n[0];
    var dy = n[1];
    var x = ctx.x;
    var y = ctx.y;
    var x1, y1, x2, y2;
    if (ctx.lc === Q || ctx.lc === T) {
        var cx1 = x * 2 - ctx.cx;
        var cy1 = y * 2 - ctx.cy;
        x1 = x + (cx1 - x) * quadraticRatio;
        y1 = y + (cy1 - y) * quadraticRatio;
        x2 = dx + (cx1 - dx) * quadraticRatio;
        y2 = dy + (cy1 - dy) * quadraticRatio;
    }
    else {
        x1 = x2 = x;
        y1 = y2 = y;
    }
    addCurve(ctx, x1, y1, x2, y2, dx, dy);
    ctx.cx = x2;
    ctx.cy = y2;
}
var parsers = {
    M: m,
    H: h,
    V: v,
    L: l,
    Z: z,
    C: c,
    S: s,
    Q: q,
    T: t
};
function addSegment(ctx, x, y) {
    ctx.x = x;
    ctx.y = y;
    var p = [x, y];
    ctx.s.push(p);
    ctx.p = p;
}
function addCurve(ctx, x1, y1, x2, y2, dx, dy) {
    var x = ctx.x;
    var y = ctx.y;
    ctx.x = coalesce(dx, x);
    ctx.y = coalesce(dy, y);
    ctx.p.push(coalesce(x1, x), (y1 = coalesce(y1, y)), (x2 = coalesce(x2, x)), (y2 = coalesce(y2, y)), ctx.x, ctx.y);
    ctx.lc = ctx.c;
}
function convertToAbsolute(ctx) {
    if (ctx.c === V) {
        ctx.t[0] += ctx.y;
    }
    else if (ctx.c === H) {
        ctx.t[0] += ctx.x;
    }
    else {
        for (var j = 0; j < ctx.t.length; j += 2) {
            ctx.t[j] += ctx.x;
            ctx.t[j + 1] += ctx.y;
        }
    }
}
function parseSegments(d) {
    return d
        .replace(/[\^\s]?([mhvlzcsqta]|\-?\d*\.?\d+)[,\$\s]?/gi, ' $1')
        .replace(/([mhvlzcsqta])/gi, ' $1')
        .trim()
        .split('  ')
        .map(parseSegment);
}
function parseSegment(s2) {
    return s2.split(' ').map(parseCommand);
}
function parseCommand(str, i) {
    return i === 0 ? str : +str;
}
function parsePoints(d) {
    var ctx = {
        x: 0,
        y: 0,
        s: []
    };
    var segments = parseSegments(d);
    for (var i = 0; i < segments.length; i++) {
        var terms = segments[i];
        var commandLetter = terms[0];
        var command = commandLetter.toUpperCase();
        var isRelative = command !== Z && command !== commandLetter;
        ctx.c = command;
        var parser = parsers[command];
        var maxLength = argLengths[command];
        if (!parser) {
            raiseError(ctx.c, ' is not supported');
        }
        var t2 = terms;
        var k = 1;
        do {
            ctx.t = t2.length === 1 ? t2 : t2.slice(k, k + maxLength);
            if (isRelative) {
                convertToAbsolute(ctx);
            }
            parser(ctx);
            k += maxLength;
        } while (k < t2.length);
    }
    return ctx.s;
}

function perimeterPoints(pts) {
    var n = pts.length;
    var x2 = pts[n - 2];
    var y2 = pts[n - 1];
    var p = 0;
    for (var i = 0; i < n; i += 6) {
        p += distance(pts[i], pts[i + 1], x2, y2);
        x2 = pts[i];
        y2 = pts[i + 1];
    }
    return floor(p);
}

function createPathSegmentArray(points) {
    var xmin = points[0];
    var ymin = points[1];
    var ymax = ymin;
    var xmax = xmin;
    for (var i = 2; i < points.length; i += 6) {
        var x = points[i + 4];
        var y = points[i + 5];
        xmin = min(xmin, x);
        xmax = max(xmax, x);
        ymin = min(ymin, y);
        ymax = max(ymax, y);
    }
    var width = xmax - xmin;
    var height = ymax - ymin;
    return {
        d: points,
        ox: width / 2 + xmin,
        oy: height / 2 + ymin,
        w: width,
        h: height,
        p: perimeterPoints(points)
    };
}
function parsePath(d) {
    return {
        path: d,
        data: parsePoints(d).map(createPathSegmentArray)
    };
}

function parse(d) {
    return parsePath(getPath(d));
}

function interpolate(paths) {
    return interpolatePath(paths.map(parse));
}

exports.getPath = getPath;
exports.interpolate = interpolate;

return exports;

}({}));
