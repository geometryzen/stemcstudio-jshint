"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var EventEmitter_1 = require("./EventEmitter");
var vars_1 = require("./vars");
var messages_1 = require("./messages");
var lex_1 = require("./lex");
var reg_1 = require("./reg");
var state_1 = require("./state");
var style_1 = require("./style");
var options_1 = require("./options");
var scope_manager_1 = require("./scope-manager");
var contains_1 = require("../fp/contains");
var clone_1 = require("../fp/clone");
var each_1 = require("../fp/each");
var extend_1 = require("../fp/extend");
var has_1 = require("../fp/has");
var isEmpty_1 = require("../fp/isEmpty");
var isNumber_1 = require("../fp/isNumber");
var reject_1 = require("../fp/reject");
var zip_1 = require("../fp/zip");
// We need this module here because environments such as IE and Rhino
// don't necessarilly expose the 'console' API and browserify uses
// it to log things. It's a sad state of affair, really.
// var console = require("console-browserify");
// We build the application inside a function so that we produce only a singleton
// variable. That function will be invoked immediately, and its return value is
// the JSHINT function itself.
// Throw away the type information because JSHINT is both a function with attributes!
var api, // Extension API
// These are operators that should not be used with the ! operator.
bang = {
    "<": true,
    "<=": true,
    "==": true,
    "===": true,
    "!==": true,
    "!=": true,
    ">": true,
    ">=": true,
    "+": true,
    "-": true,
    "*": true,
    "/": true,
    "%": true
}, declared, // Globals that were declared using /*global ... */ syntax.
functionicity = [
    "closure", "exception", "global", "label",
    "outer", "unused", "var"
], functions, // All of the functions
inblock, indent, lookahead, lex, member, membersOnly, predefined, // Global variables defined by option
stack, urls;
var extraModules = [];
var emitter = new EventEmitter_1.EventEmitter();
function checkOption(name, t) {
    name = name.trim();
    if (/^[+-]W\d{3}$/g.test(name)) {
        return true;
    }
    if (options_1.validNames.indexOf(name) === -1) {
        if (t.type !== "jslint" && !has_1.has(options_1.removed, name)) {
            error("E001", t, name);
            return false;
        }
    }
    return true;
}
function isString(arg) {
    return Object.prototype.toString.call(arg) === "[object String]";
}
function isIdentifier(tkn, value) {
    if (!tkn) {
        return false;
    }
    if (!tkn.identifier || tkn.value !== value) {
        return false;
    }
    return true;
}
function isReserved(token) {
    if (!token.reserved) {
        return false;
    }
    var meta = token.meta;
    if (meta && meta.isFutureReservedWord && state_1.state.inES5()) {
        // ES3 FutureReservedWord in an ES5 environment.
        if (!meta.es5) {
            return false;
        }
        // Some ES5 FutureReservedWord identifiers are active only
        // within a strict mode environment.
        if (meta.strictOnly) {
            if (!state_1.state.option.strict && !state_1.state.isStrict()) {
                return false;
            }
        }
        if (token.isProperty) {
            return false;
        }
    }
    return true;
}
function supplant(str, data) {
    // FIXME: The typing of the replacer function.
    return str.replace(/\{([^{}]*)\}/g, function replacer(a, b) {
        var r = data[b];
        return typeof r === "string" || typeof r === "number" ? r : a;
    });
}
function combine(dest, src) {
    Object.keys(src).forEach(function (name) {
        if (has_1.has(exports.JSHINT.blacklist, name))
            return;
        dest[name] = src[name];
    });
}
function processenforceall() {
    if (state_1.state.option.enforceall) {
        for (var enforceopt in options_1.bool.enforcing) {
            if (state_1.state.option[enforceopt] === void 0 &&
                !options_1.noenforceall[enforceopt]) {
                state_1.state.option[enforceopt] = true;
            }
        }
        for (var relaxopt in options_1.bool.relaxing) {
            if (state_1.state.option[relaxopt] === void 0) {
                state_1.state.option[relaxopt] = false;
            }
        }
    }
}
function assume() {
    processenforceall();
    /**
     * TODO: Remove in JSHint 3
     */
    if (!state_1.state.option.esversion && !state_1.state.option.moz) {
        if (state_1.state.option.es3) {
            state_1.state.option.esversion = 3;
        }
        else if (state_1.state.option.esnext) {
            state_1.state.option.esversion = 6;
        }
        else {
            state_1.state.option.esversion = 5;
        }
    }
    if (state_1.state.inES5()) {
        combine(predefined, vars_1.ecmaIdentifiers[5]);
    }
    if (state_1.state.inES6()) {
        combine(predefined, vars_1.ecmaIdentifiers[6]);
    }
    /**
     * Use `in` to check for the presence of any explicitly-specified value for
     * `globalstrict` because both `true` and `false` should trigger an error.
     */
    if (state_1.state.option.strict === "global" && "globalstrict" in state_1.state.option) {
        quit("E059", state_1.state.tokens.next, "strict", "globalstrict");
    }
    if (state_1.state.option.module) {
        if (state_1.state.option.strict === true) {
            state_1.state.option.strict = "global";
        }
        /**
         * TODO: Extend this restriction to *all* ES6-specific options.
         */
        if (!state_1.state.inES6()) {
            warning("W134", state_1.state.tokens.next, "module", 6);
        }
    }
    if (state_1.state.option.couch) {
        combine(predefined, vars_1.couch);
    }
    if (state_1.state.option.qunit) {
        combine(predefined, vars_1.qunit);
    }
    if (state_1.state.option.rhino) {
        combine(predefined, vars_1.rhino);
    }
    if (state_1.state.option.shelljs) {
        combine(predefined, vars_1.shelljs);
        combine(predefined, vars_1.node);
    }
    if (state_1.state.option.typed) {
        combine(predefined, vars_1.typed);
    }
    if (state_1.state.option.phantom) {
        combine(predefined, vars_1.phantom);
        if (state_1.state.option.strict === true) {
            state_1.state.option.strict = "global";
        }
    }
    if (state_1.state.option.prototypejs) {
        combine(predefined, vars_1.prototypejs);
    }
    if (state_1.state.option.node) {
        combine(predefined, vars_1.node);
        combine(predefined, vars_1.typed);
        if (state_1.state.option.strict === true) {
            state_1.state.option.strict = "global";
        }
    }
    if (state_1.state.option.devel) {
        combine(predefined, vars_1.devel);
    }
    if (state_1.state.option.dojo) {
        combine(predefined, vars_1.dojo);
    }
    if (state_1.state.option.browser) {
        combine(predefined, vars_1.browser);
        combine(predefined, vars_1.typed);
    }
    if (state_1.state.option.browserify) {
        combine(predefined, vars_1.browser);
        combine(predefined, vars_1.typed);
        combine(predefined, vars_1.browserify);
        if (state_1.state.option.strict === true) {
            state_1.state.option.strict = "global";
        }
    }
    if (state_1.state.option.nonstandard) {
        combine(predefined, vars_1.nonstandard);
    }
    if (state_1.state.option.jasmine) {
        combine(predefined, vars_1.jasmine);
    }
    if (state_1.state.option.jquery) {
        combine(predefined, vars_1.jquery);
    }
    if (state_1.state.option.mootools) {
        combine(predefined, vars_1.mootools);
    }
    if (state_1.state.option.worker) {
        combine(predefined, vars_1.worker);
    }
    if (state_1.state.option.wsh) {
        combine(predefined, vars_1.wsh);
    }
    if (state_1.state.option.globalstrict && state_1.state.option.strict !== false) {
        state_1.state.option.strict = "global";
    }
    if (state_1.state.option.yui) {
        combine(predefined, vars_1.yui);
    }
    if (state_1.state.option.mocha) {
        combine(predefined, vars_1.mocha);
    }
}
/**
 * Produce an error warning by throwing a JSHintError.
 */
function quit(code, token, a, b) {
    var percentage = Math.floor((token.line / state_1.state.lines.length) * 100);
    var message = messages_1.errors[code].desc;
    var exception = {
        name: "JSHintError",
        line: token.line,
        character: token.from,
        message: message + " (" + percentage + "% scanned).",
        raw: message,
        code: code,
        a: a,
        b: b,
        reason: void 0
    };
    exception.reason = supplant(message, exception) + " (" + percentage + "% scanned).";
    throw exception;
}
function removeIgnoredMessages() {
    var ignored = state_1.state.ignoredLines;
    if (isEmpty_1.isEmpty(ignored)) {
        return;
    }
    var errors = exports.JSHINT.errors;
    exports.JSHINT.errors = reject_1.reject(errors, function excluder(err) { return ignored[err.line]; });
}
function warning(code, t, a, b, c, d) {
    var msg;
    if (/^W\d{3}$/.test(code)) {
        if (state_1.state.ignored[code]) {
            return;
        }
        msg = messages_1.warnings[code];
    }
    else if (/E\d{3}/.test(code)) {
        msg = messages_1.errors[code];
    }
    else if (/I\d{3}/.test(code)) {
        msg = messages_1.info[code];
    }
    t = t || state_1.state.tokens.next || {};
    if (t.id === "(end)") {
        t = state_1.state.tokens.curr;
    }
    var l = t.line;
    var ch = t.from;
    var warn = {
        id: "(error)",
        raw: msg.desc,
        code: msg.code,
        evidence: state_1.state.lines[l - 1] || "",
        line: l,
        character: ch,
        scope: exports.JSHINT.scope,
        a: a,
        b: b,
        c: c,
        d: d
    };
    warn.reason = supplant(msg.desc, warn);
    exports.JSHINT.errors.push(warn);
    removeIgnoredMessages();
    if (exports.JSHINT.errors.length >= state_1.state.option.maxerr)
        quit("E043", t);
    return warn;
}
function warningAt(code, l, ch, a, b, c, d) {
    return warning(code, { line: l, from: ch }, a, b, c, d);
}
function error(m, t, a, b, c, d) {
    warning(m, t, a, b, c, d);
}
function errorAt(m, l, ch, a, b, c, d) {
    return error(m, {
        line: l,
        from: ch
    }, a, b, c, d);
}
// Tracking of "internal" scripts, like eval containing a static string
function addInternalSrc(elem, src) {
    var i;
    i = {
        id: "(internal)",
        elem: elem,
        value: src
    };
    exports.JSHINT.internals.push(i);
    return i;
}
function doOption() {
    var nt = state_1.state.tokens.next;
    var body = nt.body.split(",").map(function (s) { return s.trim(); });
    var predef = {};
    if (nt.type === "globals") {
        body.forEach(function (g, idx) {
            g = g.split(":");
            var key = (g[0] || "").trim();
            var val = (g[1] || "").trim();
            if (key === "-" || !key.length) {
                // Ignore trailing comma
                if (idx > 0 && idx === body.length - 1) {
                    return;
                }
                error("E002", nt);
                return;
            }
            if (key.charAt(0) === "-") {
                key = key.slice(1);
                val = false;
                exports.JSHINT.blacklist[key] = key;
                delete predefined[key];
            }
            else {
                predef[key] = (val === "true");
            }
        });
        combine(predefined, predef);
        for (var key in predef) {
            if (has_1.has(predef, key)) {
                declared[key] = nt;
            }
        }
    }
    if (nt.type === "exported") {
        body.forEach(function (e, idx) {
            if (!e.length) {
                // Ignore trailing comma
                if (idx > 0 && idx === body.length - 1) {
                    return;
                }
                error("E002", nt);
                return;
            }
            state_1.state.funct["(scope)"].addExported(e);
        });
    }
    if (nt.type === "members") {
        membersOnly = membersOnly || {};
        body.forEach(function (m) {
            var ch1 = m.charAt(0);
            var ch2 = m.charAt(m.length - 1);
            if (ch1 === ch2 && (ch1 === "\"" || ch1 === "'")) {
                m = m
                    .substr(1, m.length - 2)
                    .replace("\\\"", "\"");
            }
            membersOnly[m] = false;
        });
    }
    var numvals = [
        "maxstatements",
        "maxparams",
        "maxdepth",
        "maxcomplexity",
        "maxerr",
        "maxlen",
        "indent"
    ];
    if (nt.type === "jshint" || nt.type === "jslint") {
        body.forEach(function (g) {
            g = g.split(":");
            var key = (g[0] || "").trim();
            var val = (g[1] || "").trim();
            if (!checkOption(key, nt)) {
                return;
            }
            if (numvals.indexOf(key) >= 0) {
                // GH988 - numeric options can be disabled by setting them to `false`
                if (val !== "false") {
                    val = +val;
                    if (typeof val !== "number" || !isFinite(val) || val <= 0 || Math.floor(val) !== val) {
                        error("E032", nt, g[1].trim());
                        return;
                    }
                    state_1.state.option[key] = val;
                }
                else {
                    state_1.state.option[key] = key === "indent" ? 4 : false;
                }
                return;
            }
            /**
             * TODO: Remove in JSHint 3
             */
            if (key === "es5") {
                if (val === "true" && state_1.state.option.es5) {
                    warning("I003");
                }
            }
            if (key === "validthis") {
                // `validthis` is valid only within a function scope.
                if (state_1.state.funct["(global)"])
                    return void error("E009");
                if (val !== "true" && val !== "false")
                    return void error("E002", nt);
                state_1.state.option.validthis = (val === "true");
                return;
            }
            if (key === "quotmark") {
                switch (val) {
                    case "true":
                    case "false":
                        state_1.state.option.quotmark = (val === "true");
                        break;
                    case "double":
                    case "single":
                        state_1.state.option.quotmark = val;
                        break;
                    default:
                        error("E002", nt);
                }
                return;
            }
            if (key === "shadow") {
                switch (val) {
                    case "true":
                        state_1.state.option.shadow = true;
                        break;
                    case "outer":
                        state_1.state.option.shadow = "outer";
                        break;
                    case "false":
                    case "inner":
                        state_1.state.option.shadow = "inner";
                        break;
                    default:
                        error("E002", nt);
                }
                return;
            }
            if (key === "unused") {
                switch (val) {
                    case "true":
                        state_1.state.option.unused = true;
                        break;
                    case "false":
                        state_1.state.option.unused = false;
                        break;
                    case "vars":
                    case "strict":
                        state_1.state.option.unused = val;
                        break;
                    default:
                        error("E002", nt);
                }
                return;
            }
            if (key === "latedef") {
                switch (val) {
                    case "true":
                        state_1.state.option.latedef = true;
                        break;
                    case "false":
                        state_1.state.option.latedef = false;
                        break;
                    case "nofunc":
                        state_1.state.option.latedef = "nofunc";
                        break;
                    default:
                        error("E002", nt);
                }
                return;
            }
            if (key === "ignore") {
                switch (val) {
                    case "line":
                        state_1.state.ignoredLines[nt.line] = true;
                        removeIgnoredMessages();
                        break;
                    default:
                        error("E002", nt);
                }
                return;
            }
            if (key === "strict") {
                switch (val) {
                    case "true":
                        state_1.state.option.strict = true;
                        break;
                    case "false":
                        state_1.state.option.strict = false;
                        break;
                    case "func":
                    case "global":
                    case "implied":
                        state_1.state.option.strict = val;
                        break;
                    default:
                        error("E002", nt);
                }
                return;
            }
            if (key === "module") {
                /**
                 * TODO: Extend this restriction to *all* "environmental" options.
                 */
                if (!hasParsedCode(state_1.state.funct)) {
                    error("E055", state_1.state.tokens.next, "module");
                }
            }
            /**
             * TODO: Remove in JSHint 3
             */
            var esversions = {
                es3: 3,
                es5: 5,
                esnext: 6
            };
            if (has_1.has(esversions, key)) {
                switch (val) {
                    case "true":
                        state_1.state.option.moz = false;
                        state_1.state.option.esversion = esversions[key];
                        break;
                    case "false":
                        if (!state_1.state.option.moz) {
                            state_1.state.option.esversion = 5;
                        }
                        break;
                    default:
                        error("E002", nt);
                }
                return;
            }
            if (key === "esversion") {
                switch (val) {
                    case "5":
                        if (state_1.state.inES5(true)) {
                            warning("I003");
                        }
                    /* falls through */
                    case "3":
                    case "6":
                        state_1.state.option.moz = false;
                        state_1.state.option.esversion = +val;
                        break;
                    case "2015":
                        state_1.state.option.moz = false;
                        state_1.state.option.esversion = 6;
                        break;
                    default:
                        error("E002", nt);
                }
                if (!hasParsedCode(state_1.state.funct)) {
                    error("E055", state_1.state.tokens.next, "esversion");
                }
                return;
            }
            var match = /^([+-])(W\d{3})$/g.exec(key);
            if (match) {
                // ignore for -W..., unignore for +W...
                state_1.state.ignored[match[2]] = (match[1] === "-");
                return;
            }
            var tn;
            if (val === "true" || val === "false") {
                if (nt.type === "jslint") {
                    tn = options_1.renamed[key] || key;
                    state_1.state.option[tn] = (val === "true");
                    if (options_1.inverted[tn] !== void 0) {
                        state_1.state.option[tn] = !state_1.state.option[tn];
                    }
                }
                else {
                    state_1.state.option[key] = (val === "true");
                }
                return;
            }
            error("E002", nt);
        });
        assume();
    }
}
// We need a peek function. If it has an argument, it peeks that much farther
// ahead. It is used to distinguish
//     for ( var i in ...
// from
//     for ( var i = ...
function peek(p) {
    var i = p || 0, j = lookahead.length, t;
    if (i < j) {
        return lookahead[i];
    }
    while (j <= i) {
        t = lookahead[j];
        if (!t) {
            t = lookahead[j] = lex.token();
        }
        j += 1;
    }
    // Peeking past the end of the program should produce the "(end)" token.
    if (!t && state_1.state.tokens.next.id === "(end)") {
        return state_1.state.tokens.next;
    }
    return t;
}
function peekIgnoreEOL() {
    var i = 0;
    var t;
    do {
        t = peek(i++);
    } while (t.id === "(endline)");
    return t;
}
// Produce the next token. It looks for programming errors.
function advance(id, t) {
    switch (state_1.state.tokens.curr.id) {
        case "(number)":
            if (state_1.state.tokens.next.id === ".") {
                warning("W005", state_1.state.tokens.curr);
            }
            break;
        case "-":
            if (state_1.state.tokens.next.id === "-" || state_1.state.tokens.next.id === "--") {
                warning("W006");
            }
            break;
        case "+":
            if (state_1.state.tokens.next.id === "+" || state_1.state.tokens.next.id === "++") {
                warning("W007");
            }
            break;
    }
    if (id && state_1.state.tokens.next.id !== id) {
        if (t) {
            if (state_1.state.tokens.next.id === "(end)") {
                error("E019", t, t.id);
            }
            else {
                error("E020", state_1.state.tokens.next, id, t.id, t.line, state_1.state.tokens.next.value);
            }
        }
        else if (state_1.state.tokens.next.type !== "(identifier)" || state_1.state.tokens.next.value !== id) {
            warning("W116", state_1.state.tokens.next, id, state_1.state.tokens.next.value);
        }
    }
    state_1.state.tokens.prev = state_1.state.tokens.curr;
    state_1.state.tokens.curr = state_1.state.tokens.next;
    for (;;) {
        state_1.state.tokens.next = lookahead.shift() || lex.token();
        if (!state_1.state.tokens.next) {
            quit("E041", state_1.state.tokens.curr);
        }
        if (state_1.state.tokens.next.id === "(end)" || state_1.state.tokens.next.id === "(error)") {
            return;
        }
        if (state_1.state.tokens.next.check) {
            state_1.state.tokens.next.check();
        }
        if (state_1.state.tokens.next.isSpecial) {
            if (state_1.state.tokens.next.type === "falls through") {
                state_1.state.tokens.curr.caseFallsThrough = true;
            }
            else {
                doOption();
            }
        }
        else {
            if (state_1.state.tokens.next.id !== "(endline)") {
                break;
            }
        }
    }
}
function isInfix(token) {
    return token.infix || (!token.identifier && !token.template && !!token.led);
}
function isEndOfExpr() {
    var curr = state_1.state.tokens.curr;
    var next = state_1.state.tokens.next;
    if (next.id === ";" || next.id === "}" || next.id === ":") {
        return true;
    }
    if (isInfix(next) === isInfix(curr) || (curr.id === "yield" && state_1.state.inMoz())) {
        return curr.line !== startLine(next);
    }
    return false;
}
function isBeginOfExpr(prev) {
    return !prev.left && prev.arity !== "unary";
}
// This is the heart of JSHINT, the Pratt parser. In addition to parsing, it
// is looking for ad hoc lint patterns. We add .fud to Pratt's model, which is
// like .nud except that it is only used on the first token of a statement.
// Having .fud makes it much easier to define statement-oriented languages like
// JavaScript. I retained Pratt's nomenclature.
// .nud  Null denotation
// .fud  First null denotation
// .led  Left denotation
//  lbp  Left binding power
//  rbp  Right binding power
// They are elements of the parsing method called Top Down Operator Precedence.
function expression(rbp, initial) {
    var left;
    var isArray = false, isObject = false, isLetExpr = false;
    state_1.state.nameStack.push();
    // if current expression is a let expression
    if (!initial && state_1.state.tokens.next.value === "let" && peek(0).value === "(") {
        if (!state_1.state.inMoz()) {
            warning("W118", state_1.state.tokens.next, "let expressions");
        }
        isLetExpr = true;
        // create a new block scope we use only for the current expression
        state_1.state.funct["(scope)"].stack();
        advance("let");
        advance("(");
        state_1.state.tokens.prev.fud();
        advance(")");
    }
    if (state_1.state.tokens.next.id === "(end)")
        error("E006", state_1.state.tokens.curr);
    var isDangerous = state_1.state.option.asi &&
        state_1.state.tokens.prev.line !== startLine(state_1.state.tokens.curr) &&
        contains_1.contains(["]", ")"], state_1.state.tokens.prev.id) &&
        contains_1.contains(["[", "("], state_1.state.tokens.curr.id);
    if (isDangerous)
        warning("W014", state_1.state.tokens.curr, state_1.state.tokens.curr.id);
    advance();
    if (initial) {
        state_1.state.funct["(verb)"] = state_1.state.tokens.curr.value;
        state_1.state.tokens.curr.beginsStmt = true;
    }
    if (initial === true && state_1.state.tokens.curr.fud) {
        left = state_1.state.tokens.curr.fud();
    }
    else {
        if (state_1.state.tokens.curr.nud) {
            left = state_1.state.tokens.curr.nud();
        }
        else {
            error("E030", state_1.state.tokens.curr, state_1.state.tokens.curr.id);
        }
        // TODO: use pratt mechanics rather than special casing template tokens
        while ((rbp < state_1.state.tokens.next.lbp || state_1.state.tokens.next.type === "(template)") &&
            !isEndOfExpr()) {
            isArray = state_1.state.tokens.curr.value === "Array";
            isObject = state_1.state.tokens.curr.value === "Object";
            // #527, new Foo.Array(), Foo.Array(), new Foo.Object(), Foo.Object()
            // Line breaks in IfStatement heads exist to satisfy the checkJSHint
            // "Line too long." error.
            if (left && (left.value || (left.first && left.first.value))) {
                // If the left.value is not "new", or the left.first.value is a "."
                // then safely assume that this is not "new Array()" and possibly
                // not "new Object()"...
                if (left.value !== "new" ||
                    (left.first && left.first.value && left.first.value === ".")) {
                    isArray = false;
                    // ...In the case of Object, if the left.value and state.tokens.curr.value
                    // are not equal, then safely assume that this not "new Object()"
                    if (left.value !== state_1.state.tokens.curr.value) {
                        isObject = false;
                    }
                }
            }
            advance();
            if (isArray && state_1.state.tokens.curr.id === "(" && state_1.state.tokens.next.id === ")") {
                warning("W009", state_1.state.tokens.curr);
            }
            if (isObject && state_1.state.tokens.curr.id === "(" && state_1.state.tokens.next.id === ")") {
                warning("W010", state_1.state.tokens.curr);
            }
            if (left && state_1.state.tokens.curr.led) {
                left = state_1.state.tokens.curr.led(left);
            }
            else {
                error("E033", state_1.state.tokens.curr, state_1.state.tokens.curr.id);
            }
        }
    }
    if (isLetExpr) {
        state_1.state.funct["(scope)"].unstack();
    }
    state_1.state.nameStack.pop();
    return left;
}
// Functions for conformance of style.
function startLine(token) {
    return token.startLine || token.line;
}
function nobreaknonadjacent(left, right) {
    left = left || state_1.state.tokens.curr;
    right = right || state_1.state.tokens.next;
    if (!state_1.state.option.laxbreak && left.line !== startLine(right)) {
        warning("W014", right, right.value);
    }
}
function nolinebreak(t) {
    t = t || state_1.state.tokens.curr;
    if (t.line !== startLine(state_1.state.tokens.next)) {
        warning("E022", t, t.value);
    }
}
function nobreakcomma(left, right) {
    if (left.line !== startLine(right)) {
        if (!state_1.state.option.laxcomma) {
            if (comma['first']) {
                warning("I001");
                comma['first'] = false;
            }
            warning("W014", left, right.value);
        }
    }
}
function comma(opts) {
    opts = opts || {};
    if (!opts.peek) {
        nobreakcomma(state_1.state.tokens.curr, state_1.state.tokens.next);
        advance(",");
    }
    else {
        nobreakcomma(state_1.state.tokens.prev, state_1.state.tokens.curr);
    }
    if (state_1.state.tokens.next.identifier && !(opts.property && state_1.state.inES5())) {
        // Keywords that cannot follow a comma operator.
        switch (state_1.state.tokens.next.value) {
            case "break":
            case "case":
            case "catch":
            case "continue":
            case "default":
            case "do":
            case "else":
            case "finally":
            case "for":
            case "if":
            case "in":
            case "instanceof":
            case "return":
            case "switch":
            case "throw":
            case "try":
            case "var":
            case "let":
            case "while":
            case "with":
                error("E024", state_1.state.tokens.next, state_1.state.tokens.next.value);
                return false;
        }
    }
    if (state_1.state.tokens.next.type === "(punctuator)") {
        switch (state_1.state.tokens.next.value) {
            case "}":
            case "]":
            case ",":
                if (opts.allowTrailing) {
                    return true;
                }
            /* falls through */
            case ")":
                error("E024", state_1.state.tokens.next, state_1.state.tokens.next.value);
                return false;
        }
    }
    return true;
}
// Functional constructors for making the symbols that will be inherited by
// tokens.
function symbol(s, p) {
    var x = state_1.state.syntax[s];
    if (!x || typeof x !== "object") {
        state_1.state.syntax[s] = x = {
            id: s,
            lbp: p,
            value: s
        };
    }
    return x;
}
function delim(s) {
    var x = symbol(s, 0);
    x.delim = true;
    return x;
}
function stmt(s, f) {
    var x = delim(s);
    x.identifier = x.reserved = true;
    x.fud = f;
    return x;
}
function blockstmt(s, f) {
    var x = stmt(s, f);
    x.block = true;
    return x;
}
function reserveName(x) {
    var c = x.id.charAt(0);
    if ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z")) {
        x.identifier = x.reserved = true;
    }
    return x;
}
function prefix(s, f) {
    var x = symbol(s, 150);
    reserveName(x);
    x.nud = (typeof f === "function") ? f : function () {
        this.arity = "unary";
        this.right = expression(150);
        if (this.id === "++" || this.id === "--") {
            if (state_1.state.option.plusplus) {
                warning("W016", this, this.id);
            }
            else if (this.right && (!this.right.identifier || isReserved(this.right)) &&
                this.right.id !== "." && this.right.id !== "[") {
                warning("W017", this);
            }
            if (this.right && this.right.isMetaProperty) {
                error("E031", this);
                // detect increment/decrement of a const
                // in the case of a.b, right will be the "." punctuator
            }
            else if (this.right && this.right.identifier) {
                state_1.state.funct["(scope)"].block.modify(this.right.value, this);
            }
        }
        return this;
    };
    return x;
}
function type(s, func) {
    var x = delim(s);
    x.type = s;
    x.nud = func;
    return x;
}
function reserve(name, func) {
    var x = type(name, func);
    x.identifier = true;
    x.reserved = true;
    return x;
}
function FutureReservedWord(name, meta) {
    var x = type(name, (meta && meta.nud) || function () {
        return this;
    });
    meta = meta || {};
    meta.isFutureReservedWord = true;
    x.value = name;
    x.identifier = true;
    x.reserved = true;
    x.meta = meta;
    return x;
}
function reservevar(s, v) {
    return reserve(s, function () {
        if (typeof v === "function") {
            v(this);
        }
        return this;
    });
}
function infix(s, f, p, w) {
    var x = symbol(s, p);
    reserveName(x);
    x.infix = true;
    x.led = function (left) {
        if (!w) {
            nobreaknonadjacent(state_1.state.tokens.prev, state_1.state.tokens.curr);
        }
        if ((s === "in" || s === "instanceof") && left.id === "!") {
            warning("W018", left, "!");
        }
        if (typeof f === "function") {
            return f(left, this);
        }
        else {
            this.left = left;
            this.right = expression(p);
            return this;
        }
    };
    return x;
}
function application(s) {
    var x = symbol(s, 42);
    x.led = function (left) {
        nobreaknonadjacent(state_1.state.tokens.prev, state_1.state.tokens.curr);
        this.left = left;
        this.right = doFunction({ type: "arrow", loneArg: left });
        return this;
    };
    return x;
}
function relation(s, f) {
    var x = symbol(s, 100);
    x.led = function (left) {
        nobreaknonadjacent(state_1.state.tokens.prev, state_1.state.tokens.curr);
        this.left = left;
        var right = this.right = expression(100);
        if (isIdentifier(left, "NaN") || isIdentifier(right, "NaN")) {
            warning("W019", this);
        }
        else if (f) {
            f.apply(this, [left, right]);
        }
        if (!left || !right) {
            quit("E041", state_1.state.tokens.curr);
        }
        if (left.id === "!") {
            warning("W018", left, "!");
        }
        if (right.id === "!") {
            warning("W018", right, "!");
        }
        return this;
    };
    return x;
}
function isPoorRelation(node) {
    return node &&
        ((node.type === "(number)" && +node.value === 0) ||
            (node.type === "(string)" && node.value === "") ||
            (node.type === "null" && !state_1.state.option.eqnull) ||
            node.type === "true" ||
            node.type === "false" ||
            node.type === "undefined");
}
var typeofValues = {};
typeofValues.legacy = [
    // E4X extended the `typeof` operator to return "xml" for the XML and
    // XMLList types it introduced.
    // Ref: 11.3.2 The typeof Operator
    // http://www.ecma-international.org/publications/files/ECMA-ST/Ecma-357.pdf
    "xml",
    // IE<9 reports "unknown" when the `typeof` operator is applied to an
    // object existing across a COM+ bridge. In lieu of official documentation
    // (which does not exist), see:
    // http://robertnyman.com/2005/12/21/what-is-typeof-unknown/
    "unknown"
];
typeofValues.es3 = [
    "undefined", "boolean", "number", "string", "function", "object",
];
typeofValues.es3 = typeofValues.es3.concat(typeofValues.legacy);
typeofValues.es6 = typeofValues.es3.concat("symbol");
// Checks whether the 'typeof' operator is used with the correct
// value. For docs on 'typeof' see:
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof
function isTypoTypeof(left, right, state) {
    var values;
    if (state.option.notypeof)
        return false;
    if (!left || !right)
        return false;
    values = state.inES6() ? typeofValues.es6 : typeofValues.es3;
    if (right.type === "(identifier)" && right.value === "typeof" && left.type === "(string)")
        return !contains_1.contains(values, left.value);
    return false;
}
function isGlobalEval(left, state) {
    var isGlobal = false;
    // permit methods to refer to an "eval" key in their own context
    if (left.type === "this" && state.funct["(context)"] === null) {
        isGlobal = true;
    }
    else if (left.type === "(identifier)") {
        if (state.option.node && left.value === "global") {
            isGlobal = true;
        }
        else if (state.option.browser && (left.value === "window" || left.value === "document")) {
            isGlobal = true;
        }
    }
    return isGlobal;
}
function findNativePrototype(left) {
    var natives = [
        "Array", "ArrayBuffer", "Boolean", "Collator", "DataView", "Date",
        "DateTimeFormat", "Error", "EvalError", "Float32Array", "Float64Array",
        "Function", "Infinity", "Intl", "Int16Array", "Int32Array", "Int8Array",
        "Iterator", "Number", "NumberFormat", "Object", "RangeError",
        "ReferenceError", "RegExp", "StopIteration", "String", "SyntaxError",
        "TypeError", "Uint16Array", "Uint32Array", "Uint8Array", "Uint8ClampedArray",
        "URIError"
    ];
    function walkPrototype(obj) {
        if (typeof obj !== "object")
            return;
        return obj.right === "prototype" ? obj : walkPrototype(obj.left);
    }
    function walkNative(obj) {
        while (!obj.identifier && typeof obj.left === "object")
            obj = obj.left;
        if (obj.identifier && natives.indexOf(obj.value) >= 0)
            return obj.value;
    }
    var prototype = walkPrototype(left);
    if (prototype)
        return walkNative(prototype);
}
/**
 * Checks the left hand side of an assignment for issues, returns if ok
 * @param {token} left - the left hand side of the assignment
 * @param {token=} assignToken - the token for the assignment, used for reporting
 * @param {object=} options - optional object
 * @param {boolean} options.allowDestructuring - whether to allow destructuting binding
 * @returns {boolean} Whether the left hand side is OK
 */
function checkLeftSideAssign(left, assignToken, options) {
    var allowDestructuring = options && options.allowDestructuring;
    assignToken = assignToken || left;
    if (state_1.state.option.freeze) {
        var nativeObject = findNativePrototype(left);
        if (nativeObject)
            warning("W121", left, nativeObject);
    }
    if (left.identifier && !left.isMetaProperty) {
        // reassign also calls modify
        // but we are specific in order to catch function re-assignment
        // and globals re-assignment
        state_1.state.funct["(scope)"].block.reassign(left.value, left);
    }
    if (left.id === ".") {
        if (!left.left || left.left.value === "arguments" && !state_1.state.isStrict()) {
            warning("E031", assignToken);
        }
        state_1.state.nameStack.set(state_1.state.tokens.prev);
        return true;
    }
    else if (left.id === "{" || left.id === "[") {
        if (allowDestructuring && state_1.state.tokens.curr.left.destructAssign) {
            state_1.state.tokens.curr.left.destructAssign.forEach(function (t) {
                if (t.id) {
                    state_1.state.funct["(scope)"].block.modify(t.id, t.token);
                }
            });
        }
        else {
            if (left.id === "{" || !left.left) {
                warning("E031", assignToken);
            }
            else if (left.left.value === "arguments" && !state_1.state.isStrict()) {
                warning("E031", assignToken);
            }
        }
        if (left.id === "[") {
            state_1.state.nameStack.set(left.right);
        }
        return true;
    }
    else if (left.isMetaProperty) {
        error("E031", assignToken);
        return true;
    }
    else if (left.identifier && !isReserved(left)) {
        if (state_1.state.funct["(scope)"].labeltype(left.value) === "exception") {
            warning("W022", left);
        }
        state_1.state.nameStack.set(left);
        return true;
    }
    if (left === state_1.state.syntax["function"]) {
        warning("W023", state_1.state.tokens.curr);
    }
    return false;
}
function assignop(s, f, p) {
    var x = infix(s, typeof f === "function" ? f : function (left, that) {
        that.left = left;
        if (left && checkLeftSideAssign(left, that, { allowDestructuring: true })) {
            that.right = expression(10);
            return that;
        }
        error("E031", that);
    }, p);
    x.exps = true;
    x.assign = true;
    return x;
}
function bitwise(s, f, p) {
    var x = symbol(s, p);
    reserveName(x);
    x.led = (typeof f === "function") ? f : function (left) {
        if (state_1.state.option.bitwise) {
            warning("W016", this, this.id);
        }
        this.left = left;
        this.right = expression(p);
        return this;
    };
    return x;
}
function bitwiseassignop(s) {
    return assignop(s, function (left, that) {
        if (state_1.state.option.bitwise) {
            warning("W016", that, that.id);
        }
        if (left && checkLeftSideAssign(left, that)) {
            that.right = expression(10);
            return that;
        }
        error("E031", that);
    }, 20);
}
function suffix(s) {
    var x = symbol(s, 150);
    x.led = function (left) {
        // this = suffix e.g. "++" punctuator
        // left = symbol operated e.g. "a" identifier or "a.b" punctuator
        if (state_1.state.option.plusplus) {
            warning("W016", this, this.id);
        }
        else if ((!left.identifier || isReserved(left)) && left.id !== "." && left.id !== "[") {
            warning("W017", this);
        }
        if (left.isMetaProperty) {
            error("E031", this);
            // detect increment/decrement of a const
            // in the case of a.b, left will be the "." punctuator
        }
        else if (left && left.identifier) {
            state_1.state.funct["(scope)"].block.modify(left.value, left);
        }
        this.left = left;
        return this;
    };
    return x;
}
// fnparam means that this identifier is being defined as a function
// argument (see identifier())
// prop means that this identifier is that of an object property
function optionalidentifier(fnparam, prop, preserve) {
    if (!state_1.state.tokens.next.identifier) {
        return;
    }
    if (!preserve) {
        advance();
    }
    var curr = state_1.state.tokens.curr;
    var val = state_1.state.tokens.curr.value;
    if (!isReserved(curr)) {
        return val;
    }
    if (prop) {
        if (state_1.state.inES5()) {
            return val;
        }
    }
    if (fnparam && val === "undefined") {
        return val;
    }
    warning("W024", state_1.state.tokens.curr, state_1.state.tokens.curr.id);
    return val;
}
// fnparam means that this identifier is being defined as a function
// argument
// prop means that this identifier is that of an object property
function identifier(fnparam, prop) {
    var i = optionalidentifier(fnparam, prop, false);
    if (i) {
        return i;
    }
    // parameter destructuring with rest operator
    if (state_1.state.tokens.next.value === "...") {
        if (!state_1.state.inES6(true)) {
            warning("W119", state_1.state.tokens.next, "spread/rest operator", "6");
        }
        advance();
        if (checkPunctuator(state_1.state.tokens.next, "...")) {
            warning("E024", state_1.state.tokens.next, "...");
            while (checkPunctuator(state_1.state.tokens.next, "...")) {
                advance();
            }
        }
        if (!state_1.state.tokens.next.identifier) {
            warning("E024", state_1.state.tokens.curr, "...");
            return;
        }
        return identifier(fnparam, prop);
    }
    else {
        error("E030", state_1.state.tokens.next, state_1.state.tokens.next.value);
        // The token should be consumed after a warning is issued so the parser
        // can continue as though an identifier were found. The semicolon token
        // should not be consumed in this way so that the parser interprets it as
        // a statement delimeter;
        if (state_1.state.tokens.next.id !== ";") {
            advance();
        }
    }
}
function reachable(controlToken) {
    var i = 0, t;
    if (state_1.state.tokens.next.id !== ";" || controlToken.inBracelessBlock) {
        return;
    }
    for (;;) {
        do {
            t = peek(i);
            i += 1;
        } while (t.id !== "(end)" && t.id === "(comment)");
        if (t.reach) {
            return;
        }
        if (t.id !== "(endline)") {
            if (t.id === "function") {
                if (state_1.state.option.latedef === true) {
                    warning("W026", t);
                }
                break;
            }
            warning("W027", t, t.value, controlToken.value);
            break;
        }
    }
}
function parseFinalSemicolon() {
    if (state_1.state.tokens.next.id !== ";") {
        // don't complain about unclosed templates / strings
        if (state_1.state.tokens.next.isUnclosed)
            return advance();
        var sameLine = startLine(state_1.state.tokens.next) === state_1.state.tokens.curr.line &&
            state_1.state.tokens.next.id !== "(end)";
        var blockEnd = checkPunctuator(state_1.state.tokens.next, "}");
        if (sameLine && !blockEnd) {
            errorAt("E058", state_1.state.tokens.curr.line, state_1.state.tokens.curr.character);
        }
        else if (!state_1.state.option.asi) {
            // If this is the last statement in a block that ends on
            // the same line *and* option lastsemic is on, ignore the warning.
            // Otherwise, complain about missing semicolon.
            if ((blockEnd && !state_1.state.option.lastsemic) || !sameLine) {
                warningAt("W033", state_1.state.tokens.curr.line, state_1.state.tokens.curr.character);
            }
        }
    }
    else {
        advance(";");
    }
}
function statement() {
    var i = indent, r, t = state_1.state.tokens.next, hasOwnScope = false;
    if (t.id === ";") {
        advance(";");
        return;
    }
    // Is this a labelled statement?
    var res = isReserved(t);
    // We're being more tolerant here: if someone uses
    // a FutureReservedWord as a label, we warn but proceed
    // anyway.
    if (res && t.meta && t.meta.isFutureReservedWord && peek().id === ":") {
        warning("W024", t, t.id);
        res = false;
    }
    if (t.identifier && !res && peek().id === ":") {
        advance();
        advance(":");
        hasOwnScope = true;
        state_1.state.funct["(scope)"].stack();
        state_1.state.funct["(scope)"].block.addBreakLabel(t.value, { token: state_1.state.tokens.curr });
        if (!state_1.state.tokens.next.labelled && state_1.state.tokens.next.value !== "{") {
            warning("W028", state_1.state.tokens.next, t.value, state_1.state.tokens.next.value);
        }
        state_1.state.tokens.next.label = t.value;
        t = state_1.state.tokens.next;
    }
    // Is it a lonely block?
    if (t.id === "{") {
        // Is it a switch case block?
        //
        //  switch (foo) {
        //    case bar: { <= here.
        //      ...
        //    }
        //  }
        var iscase = (state_1.state.funct["(verb)"] === "case" && state_1.state.tokens.curr.value === ":");
        block(true, true, false, false, iscase);
        return;
    }
    // Parse the statement.
    r = expression(0, true);
    if (r && !(r.identifier && r.value === "function") &&
        !(r.type === "(punctuator)" && r.left &&
            r.left.identifier && r.left.value === "function")) {
        if (!state_1.state.isStrict() &&
            state_1.state.option.strict === "global") {
            warning("E007");
        }
    }
    // Look for the final semicolon.
    if (!t.block) {
        if (!state_1.state.option.expr && (!r || !r.exps)) {
            warning("W030", state_1.state.tokens.curr);
        }
        else if (state_1.state.option.nonew && r && r.left && r.id === "(" && r.left.id === "new") {
            warning("W031", t);
        }
        parseFinalSemicolon();
    }
    // Restore the indentation.
    indent = i;
    if (hasOwnScope) {
        state_1.state.funct["(scope)"].unstack();
    }
    return r;
}
function statements() {
    var a = [], p;
    while (!state_1.state.tokens.next.reach && state_1.state.tokens.next.id !== "(end)") {
        if (state_1.state.tokens.next.id === ";") {
            p = peek();
            if (!p || (p.id !== "(" && p.id !== "[")) {
                warning("W032");
            }
            advance(";");
        }
        else {
            a.push(statement());
        }
    }
    return a;
}
/*
 * read all directives
 * recognizes a simple form of asi, but always
 * warns, if it is used
 */
function directives() {
    var i, p, pn;
    while (state_1.state.tokens.next.id === "(string)") {
        p = peek(0);
        if (p.id === "(endline)") {
            i = 1;
            do {
                pn = peek(i++);
            } while (pn.id === "(endline)");
            if (pn.id === ";") {
                p = pn;
            }
            else if (pn.value === "[" || pn.value === ".") {
                // string -> [ | . is a valid production
                break;
            }
            else if (!state_1.state.option.asi || pn.value === "(") {
                // string -> ( is not a valid production
                warning("W033", state_1.state.tokens.next);
            }
        }
        else if (p.id === "." || p.id === "[") {
            break;
        }
        else if (p.id !== ";") {
            warning("W033", p);
        }
        advance();
        var directive = state_1.state.tokens.curr.value;
        if (state_1.state.directive[directive] ||
            (directive === "use strict" && state_1.state.option.strict === "implied")) {
            warning("W034", state_1.state.tokens.curr, directive);
        }
        // there's no directive negation, so always set to true
        state_1.state.directive[directive] = true;
        if (p.id === ";") {
            advance(";");
        }
    }
    if (state_1.state.isStrict()) {
        state_1.state.option.undef = true;
    }
}
/*
 * Parses a single block. A block is a sequence of statements wrapped in
 * braces.
 *
 * ordinary   - true for everything but function bodies and try blocks.
 * stmt       - true if block can be a single statement (e.g. in if/for/while).
 * isfunc     - true if block is a function body
 * isfatarrow - true if its a body of a fat arrow function
 * iscase      - true if block is a switch case block
 */
function block(ordinary, stmt, isfunc, isfatarrow, iscase) {
    var a, b = inblock, old_indent = indent, m, t, line, d;
    inblock = ordinary;
    t = state_1.state.tokens.next;
    var metrics = state_1.state.funct["(metrics)"];
    metrics.nestedBlockDepth += 1;
    metrics.verifyMaxNestedBlockDepthPerFunction();
    if (state_1.state.tokens.next.id === "{") {
        advance("{");
        // create a new block scope
        state_1.state.funct["(scope)"].stack();
        state_1.state.funct["(noblockscopedvar)"] = false;
        line = state_1.state.tokens.curr.line;
        if (state_1.state.tokens.next.id !== "}") {
            indent += state_1.state.option.indent;
            while (!ordinary && state_1.state.tokens.next.from > indent) {
                indent += state_1.state.option.indent;
            }
            if (isfunc) {
                m = {};
                for (d in state_1.state.directive) {
                    if (has_1.has(state_1.state.directive, d)) {
                        m[d] = state_1.state.directive[d];
                    }
                }
                directives();
                if (state_1.state.option.strict && state_1.state.funct["(context)"]["(global)"]) {
                    if (!m["use strict"] && !state_1.state.isStrict()) {
                        warning("E007");
                    }
                }
            }
            a = statements();
            metrics.statementCount += a.length;
            indent -= state_1.state.option.indent;
        }
        advance("}", t);
        if (isfunc) {
            state_1.state.funct["(scope)"].validateParams();
            if (m) {
                state_1.state.directive = m;
            }
        }
        state_1.state.funct["(scope)"].unstack();
        indent = old_indent;
    }
    else if (!ordinary) {
        if (isfunc) {
            state_1.state.funct["(scope)"].stack();
            m = {};
            if (stmt && !isfatarrow && !state_1.state.inMoz()) {
                error("W118", state_1.state.tokens.curr, "function closure expressions");
            }
            if (!stmt) {
                for (d in state_1.state.directive) {
                    if (has_1.has(state_1.state.directive, d)) {
                        m[d] = state_1.state.directive[d];
                    }
                }
            }
            expression(10);
            if (state_1.state.option.strict && state_1.state.funct["(context)"]["(global)"]) {
                if (!m["use strict"] && !state_1.state.isStrict()) {
                    warning("E007");
                }
            }
            state_1.state.funct["(scope)"].unstack();
        }
        else {
            error("E021", state_1.state.tokens.next, "{", state_1.state.tokens.next.value);
        }
    }
    else {
        // check to avoid let declaration not within a block
        // though is fine inside for loop initializer section
        state_1.state.funct["(noblockscopedvar)"] = state_1.state.tokens.next.id !== "for";
        state_1.state.funct["(scope)"].stack();
        if (!stmt || state_1.state.option.curly) {
            warning("W116", state_1.state.tokens.next, "{", state_1.state.tokens.next.value);
        }
        state_1.state.tokens.next.inBracelessBlock = true;
        indent += state_1.state.option.indent;
        // test indentation only if statement is in new line
        a = [statement()];
        indent -= state_1.state.option.indent;
        state_1.state.funct["(scope)"].unstack();
        delete state_1.state.funct["(noblockscopedvar)"];
    }
    // Don't clear and let it propagate out if it is "break", "return" or similar in switch case
    switch (state_1.state.funct["(verb)"]) {
        case "break":
        case "continue":
        case "return":
        case "throw":
            if (iscase) {
                break;
            }
        /* falls through */
        default:
            state_1.state.funct["(verb)"] = null;
    }
    inblock = b;
    if (ordinary && state_1.state.option.noempty && (!a || a.length === 0)) {
        warning("W035", state_1.state.tokens.prev);
    }
    metrics.nestedBlockDepth -= 1;
    return a;
}
function countMember(m) {
    if (membersOnly && typeof membersOnly[m] !== "boolean") {
        warning("W036", state_1.state.tokens.curr, m);
    }
    if (typeof member[m] === "number") {
        member[m] += 1;
    }
    else {
        member[m] = 1;
    }
}
// Build the syntax table by declaring the syntactic elements of the language.
type("(number)", function () {
    return this;
});
type("(string)", function () {
    return this;
});
state_1.state.syntax["(identifier)"] = {
    type: "(identifier)",
    lbp: 0,
    identifier: true,
    nud: function () {
        var v = this.value;
        // If this identifier is the lone parameter to a shorthand "fat arrow"
        // function definition, i.e.
        //
        //     x => x;
        //
        // ...it should not be considered as a variable in the current scope. It
        // will be added to the scope of the new function when the next token is
        // parsed, so it can be safely ignored for now.
        if (state_1.state.tokens.next.id === "=>") {
            return this;
        }
        if (!state_1.state.funct["(comparray)"].check(v)) {
            state_1.state.funct["(scope)"].block.use(v, state_1.state.tokens.curr);
        }
        return this;
    },
    led: function () {
        error("E033", state_1.state.tokens.next, state_1.state.tokens.next.value);
    }
};
var baseTemplateSyntax = {
    lbp: 0,
    identifier: false,
    template: true,
};
state_1.state.syntax["(template)"] = extend_1.extend({
    type: "(template)",
    nud: doTemplateLiteral,
    led: doTemplateLiteral,
    noSubst: false
}, baseTemplateSyntax);
state_1.state.syntax["(template middle)"] = extend_1.extend({
    type: "(template middle)",
    middle: true,
    noSubst: false
}, baseTemplateSyntax);
state_1.state.syntax["(template tail)"] = extend_1.extend({
    type: "(template tail)",
    tail: true,
    noSubst: false
}, baseTemplateSyntax);
state_1.state.syntax["(no subst template)"] = extend_1.extend({
    type: "(template)",
    nud: doTemplateLiteral,
    led: doTemplateLiteral,
    noSubst: true,
    tail: true // mark as tail, since it's always the last component
}, baseTemplateSyntax);
type("(regexp)", function () {
    return this;
});
// ECMAScript parser
delim("(endline)");
(function (x) {
    x.line = x.from = 0;
})(delim("(begin)"));
delim("(end)").reach = true;
delim("(error)").reach = true;
delim("}").reach = true;
delim(")");
delim("]");
delim("\"").reach = true;
delim("'").reach = true;
delim(";");
delim(":").reach = true;
delim("#");
reserve("else");
reserve("case").reach = true;
reserve("catch");
reserve("default").reach = true;
reserve("finally");
reservevar("arguments", function (x) {
    if (state_1.state.isStrict() && state_1.state.funct["(global)"]) {
        warning("E008", x);
    }
});
reservevar("eval");
reservevar("false");
reservevar("Infinity");
reservevar("null");
reservevar("this", function (x) {
    if (state_1.state.isStrict() && !isMethod() &&
        !state_1.state.option.validthis && ((state_1.state.funct["(statement)"] &&
        state_1.state.funct["(name)"].charAt(0) > "Z") || state_1.state.funct["(global)"])) {
        warning("W040", x);
    }
});
reservevar("true");
reservevar("undefined");
assignop("=", "assign", 20);
assignop("+=", "assignadd", 20);
assignop("-=", "assignsub", 20);
assignop("*=", "assignmult", 20);
assignop("/=", "assigndiv", 20).nud = function () {
    error("E014");
};
assignop("%=", "assignmod", 20);
bitwiseassignop("&=");
bitwiseassignop("|=");
bitwiseassignop("^=");
bitwiseassignop("<<=");
bitwiseassignop(">>=");
bitwiseassignop(">>>=");
infix(",", function (left, that) {
    var expr;
    that.exprs = [left];
    if (state_1.state.option.nocomma) {
        warning("W127");
    }
    if (!comma({ peek: true })) {
        return that;
    }
    while (true) {
        if (!(expr = expression(10))) {
            break;
        }
        that.exprs.push(expr);
        if (state_1.state.tokens.next.value !== "," || !comma()) {
            break;
        }
    }
    return that;
}, 10, true);
infix("?", function (left, that) {
    increaseComplexityCount();
    that.left = left;
    that.right = expression(10);
    advance(":");
    that["else"] = expression(10);
    return that;
}, 30);
var orPrecendence = 40;
infix("||", function (left, that) {
    increaseComplexityCount();
    that.left = left;
    that.right = expression(orPrecendence);
    return that;
}, orPrecendence);
infix("&&", "and", 50);
bitwise("|", "bitor", 70);
bitwise("^", "bitxor", 80);
bitwise("&", "bitand", 90);
relation("==", function (left, right) {
    var eqnull = state_1.state.option.eqnull &&
        ((left && left.value) === "null" || (right && right.value) === "null");
    switch (true) {
        case !eqnull && state_1.state.option.eqeqeq:
            this.from = this.character;
            warning("W116", this, "===", "==");
            break;
        case isPoorRelation(left):
            warning("W041", this, "===", left.value);
            break;
        case isPoorRelation(right):
            warning("W041", this, "===", right.value);
            break;
        case isTypoTypeof(right, left, state_1.state):
            warning("W122", this, right.value);
            break;
        case isTypoTypeof(left, right, state_1.state):
            warning("W122", this, left.value);
            break;
    }
    return this;
});
relation("===", function (left, right) {
    if (isTypoTypeof(right, left, state_1.state)) {
        warning("W122", this, right.value);
    }
    else if (isTypoTypeof(left, right, state_1.state)) {
        warning("W122", this, left.value);
    }
    return this;
});
relation("!=", function (left, right) {
    var eqnull = state_1.state.option.eqnull &&
        ((left && left.value) === "null" || (right && right.value) === "null");
    if (!eqnull && state_1.state.option.eqeqeq) {
        this.from = this.character;
        warning("W116", this, "!==", "!=");
    }
    else if (isPoorRelation(left)) {
        warning("W041", this, "!==", left.value);
    }
    else if (isPoorRelation(right)) {
        warning("W041", this, "!==", right.value);
    }
    else if (isTypoTypeof(right, left, state_1.state)) {
        warning("W122", this, right.value);
    }
    else if (isTypoTypeof(left, right, state_1.state)) {
        warning("W122", this, left.value);
    }
    return this;
});
relation("!==", function (left, right) {
    if (isTypoTypeof(right, left, state_1.state)) {
        warning("W122", this, right.value);
    }
    else if (isTypoTypeof(left, right, state_1.state)) {
        warning("W122", this, left.value);
    }
    return this;
});
relation("<");
relation(">");
relation("<=");
relation(">=");
bitwise("<<", "shiftleft", 120);
bitwise(">>", "shiftright", 120);
bitwise(">>>", "shiftrightunsigned", 120);
infix("in", "in", 120);
infix("instanceof", "instanceof", 120);
infix("+", function (left, that) {
    var right;
    that.left = left;
    that.right = right = expression(130);
    if (left && right && left.id === "(string)" && right.id === "(string)") {
        left.value += right.value;
        left.character = right.character;
        if (!state_1.state.option.scripturl && reg_1.javascriptURL.test(left.value)) {
            warning("W050", left);
        }
        return left;
    }
    return that;
}, 130);
prefix("+", "num");
prefix("+++", function () {
    warning("W007");
    this.arity = "unary";
    this.right = expression(150);
    return this;
});
infix("+++", function (left) {
    warning("W007");
    this.left = left;
    this.right = expression(130);
    return this;
}, 130);
infix("-", "sub", 130);
prefix("-", "neg");
prefix("---", function () {
    warning("W006");
    this.arity = "unary";
    this.right = expression(150);
    return this;
});
infix("---", function (left) {
    warning("W006");
    this.left = left;
    this.right = expression(130);
    return this;
}, 130);
infix("*", "mult", 140);
infix("/", "div", 140);
infix("%", "mod", 140);
suffix("++");
prefix("++", "preinc");
state_1.state.syntax["++"].exps = true;
suffix("--");
prefix("--", "predec");
state_1.state.syntax["--"].exps = true;
prefix("delete", function () {
    var p = expression(10);
    if (!p) {
        return this;
    }
    if (p.id !== "." && p.id !== "[") {
        warning("W051");
    }
    this.first = p;
    // The `delete` operator accepts unresolvable references when not in strict
    // mode, so the operand may be undefined.
    if (p.identifier && !state_1.state.isStrict()) {
        p.forgiveUndef = true;
    }
    return this;
}).exps = true;
prefix("~", function () {
    if (state_1.state.option.bitwise) {
        warning("W016", this, "~");
    }
    this.arity = "unary";
    this.right = expression(150);
    return this;
});
prefix("...", function () {
    if (!state_1.state.inES6(true)) {
        warning("W119", this, "spread/rest operator", "6");
    }
    // TODO: Allow all AssignmentExpression
    // once parsing permits.
    //
    // How to handle eg. number, boolean when the built-in
    // prototype of may have an @@iterator definition?
    //
    // Number.prototype[Symbol.iterator] = function * () {
    //   yield this.valueOf();
    // };
    //
    // var a = [ ...1 ];
    // console.log(a); // [1];
    //
    // for (let n of [...10]) {
    //    console.log(n);
    // }
    // // 10
    //
    //
    // Boolean.prototype[Symbol.iterator] = function * () {
    //   yield this.valueOf();
    // };
    //
    // var a = [ ...true ];
    // console.log(a); // [true];
    //
    // for (let n of [...false]) {
    //    console.log(n);
    // }
    // // false
    //
    if (!state_1.state.tokens.next.identifier &&
        state_1.state.tokens.next.type !== "(string)" &&
        !checkPunctuators(state_1.state.tokens.next, ["[", "("])) {
        error("E030", state_1.state.tokens.next, state_1.state.tokens.next.value);
    }
    expression(150);
    return this;
});
prefix("!", function () {
    this.arity = "unary";
    this.right = expression(150);
    if (!this.right) {
        quit("E041", this);
    }
    if (bang[this.right.id] === true) {
        warning("W018", this, "!");
    }
    return this;
});
prefix("typeof", (function () {
    var p = expression(150);
    this.first = this.right = p;
    if (!p) {
        quit("E041", this);
    }
    // The `typeof` operator accepts unresolvable references, so the operand
    // may be undefined.
    if (p.identifier) {
        p.forgiveUndef = true;
    }
    return this;
}));
prefix("new", function () {
    var mp = metaProperty("target", function () {
        if (!state_1.state.inES6(true)) {
            warning("W119", state_1.state.tokens.prev, "new.target", "6");
        }
        var inFunction, c = state_1.state.funct;
        while (c) {
            inFunction = !c["(global)"];
            if (!c["(arrow)"]) {
                break;
            }
            c = c["(context)"];
        }
        if (!inFunction) {
            warning("W136", state_1.state.tokens.prev, "new.target");
        }
    });
    if (mp) {
        return mp;
    }
    var c = expression(155), i;
    if (c && c.id !== "function") {
        if (c.identifier) {
            c["new"] = true;
            switch (c.value) {
                case "Number":
                case "String":
                case "Boolean":
                case "Math":
                case "JSON":
                    warning("W053", state_1.state.tokens.prev, c.value);
                    break;
                case "Symbol":
                    if (state_1.state.inES6()) {
                        warning("W053", state_1.state.tokens.prev, c.value);
                    }
                    break;
                case "Function":
                    if (!state_1.state.option.evil) {
                        warning("W054");
                    }
                    break;
                case "Date":
                case "RegExp":
                case "this":
                    break;
                default:
                    if (c.id !== "function") {
                        i = c.value.substr(0, 1);
                        if (state_1.state.option.newcap && (i < "A" || i > "Z") &&
                            !state_1.state.funct["(scope)"].isPredefined(c.value)) {
                            warning("W055", state_1.state.tokens.curr);
                        }
                    }
            }
        }
        else {
            if (c.id !== "." && c.id !== "[" && c.id !== "(") {
                warning("W056", state_1.state.tokens.curr);
            }
        }
    }
    else {
        if (!state_1.state.option.supernew)
            warning("W057", this);
    }
    if (state_1.state.tokens.next.id !== "(" && !state_1.state.option.supernew) {
        warning("W058", state_1.state.tokens.curr, state_1.state.tokens.curr.value);
    }
    this.first = this.right = c;
    return this;
});
state_1.state.syntax["new"].exps = true;
prefix("void").exps = true;
infix(".", function (left, that) {
    var m = identifier(false, true);
    if (typeof m === "string") {
        countMember(m);
    }
    that.left = left;
    that.right = m;
    if (m && m === "hasOwnProperty" && state_1.state.tokens.next.value === "=") {
        warning("W001");
    }
    if (left && left.value === "arguments" && (m === "callee" || m === "caller")) {
        if (state_1.state.option.noarg)
            warning("W059", left, m);
        else if (state_1.state.isStrict())
            error("E008");
    }
    else if (!state_1.state.option.evil && left && left.value === "document" &&
        (m === "write" || m === "writeln")) {
        warning("W060", left);
    }
    if (!state_1.state.option.evil && (m === "eval" || m === "execScript")) {
        if (isGlobalEval(left, state_1.state)) {
            warning("W061");
        }
    }
    return that;
}, 160, true);
infix("(", function (left, that) {
    if (state_1.state.option.immed && left && !left.immed && left.id === "function") {
        warning("W062");
    }
    var n = 0;
    var p = [];
    if (left) {
        if (left.type === "(identifier)") {
            if (left.value.match(/^[A-Z]([A-Z0-9_$]*[a-z][A-Za-z0-9_$]*)?$/)) {
                if ("Array Number String Boolean Date Object Error Symbol".indexOf(left.value) === -1) {
                    if (left.value === "Math") {
                        warning("W063", left);
                    }
                    else if (state_1.state.option.newcap) {
                        warning("W064", left);
                    }
                }
            }
        }
    }
    if (state_1.state.tokens.next.id !== ")") {
        for (;;) {
            p[p.length] = expression(10);
            n += 1;
            if (state_1.state.tokens.next.id !== ",") {
                break;
            }
            comma();
        }
    }
    advance(")");
    if (typeof left === "object") {
        if (!state_1.state.inES5() && left.value === "parseInt" && n === 1) {
            warning("W065", state_1.state.tokens.curr);
        }
        if (!state_1.state.option.evil) {
            if (left.value === "eval" || left.value === "Function" ||
                left.value === "execScript") {
                warning("W061", left);
                if (p[0] && p[0].id === "(string)") {
                    addInternalSrc(left, p[0].value);
                }
            }
            else if (p[0] && p[0].id === "(string)" &&
                (left.value === "setTimeout" ||
                    left.value === "setInterval")) {
                warning("W066", left);
                addInternalSrc(left, p[0].value);
                // window.setTimeout/setInterval
            }
            else if (p[0] && p[0].id === "(string)" &&
                left.value === "." &&
                left.left.value === "window" &&
                (left.right === "setTimeout" ||
                    left.right === "setInterval")) {
                warning("W066", left);
                addInternalSrc(left, p[0].value);
            }
        }
        if (!left.identifier && left.id !== "." && left.id !== "[" && left.id !== "=>" &&
            left.id !== "(" && left.id !== "&&" && left.id !== "||" && left.id !== "?" &&
            !(state_1.state.inES6() && left["(name)"])) {
            warning("W067", that);
        }
    }
    that.left = left;
    return that;
}, 155, true).exps = true;
prefix("(", function () {
    var pn = state_1.state.tokens.next, pn1, i = -1;
    var ret, triggerFnExpr, first, last;
    var parens = 1;
    var opening = state_1.state.tokens.curr;
    var preceeding = state_1.state.tokens.prev;
    var isNecessary = !state_1.state.option.singleGroups;
    do {
        if (pn.value === "(") {
            parens += 1;
        }
        else if (pn.value === ")") {
            parens -= 1;
        }
        i += 1;
        pn1 = pn;
        pn = peek(i);
    } while (!(parens === 0 && pn1.value === ")") && pn.value !== ";" && pn.type !== "(end)");
    if (state_1.state.tokens.next.id === "function") {
        triggerFnExpr = state_1.state.tokens.next.immed = true;
    }
    // If the balanced grouping operator is followed by a "fat arrow", the
    // current token marks the beginning of a "fat arrow" function and parsing
    // should proceed accordingly.
    if (pn.value === "=>") {
        return doFunction({ type: "arrow", parsedOpening: true });
    }
    var exprs = [];
    if (state_1.state.tokens.next.id !== ")") {
        for (;;) {
            exprs.push(expression(10));
            if (state_1.state.tokens.next.id !== ",") {
                break;
            }
            if (state_1.state.option.nocomma) {
                warning("W127");
            }
            comma();
        }
    }
    advance(")", this);
    if (state_1.state.option.immed && exprs[0] && exprs[0].id === "function") {
        if (state_1.state.tokens.next.id !== "(" &&
            state_1.state.tokens.next.id !== "." && state_1.state.tokens.next.id !== "[") {
            warning("W068", this);
        }
    }
    if (!exprs.length) {
        return;
    }
    if (exprs.length > 1) {
        ret = Object.create(state_1.state.syntax[","]);
        ret.exprs = exprs;
        first = exprs[0];
        last = exprs[exprs.length - 1];
        if (!isNecessary) {
            isNecessary = preceeding.assign || preceeding.delim;
        }
    }
    else {
        ret = first = last = exprs[0];
        if (!isNecessary) {
            isNecessary =
                // Used to distinguish from an ExpressionStatement which may not
                // begin with the `{` and `function` tokens
                (opening.beginsStmt && (ret.id === "{" || triggerFnExpr || isFunctor(ret))) ||
                    // Used to signal that a function expression is being supplied to
                    // some other operator.
                    (triggerFnExpr &&
                        // For parenthesis wrapping a function expression to be considered
                        // necessary, the grouping operator should be the left-hand-side of
                        // some other operator--either within the parenthesis or directly
                        // following them.
                        (!isEndOfExpr() || state_1.state.tokens.prev.id !== "}")) ||
                    // Used to demarcate an arrow function as the left-hand side of some
                    // operator.
                    (isFunctor(ret) && !isEndOfExpr()) ||
                    // Used as the return value of a single-statement arrow function
                    (ret.id === "{" && preceeding.id === "=>") ||
                    // Used to delineate an integer number literal from a dereferencing
                    // punctuator (otherwise interpreted as a decimal point)
                    (ret.type === "(number)" &&
                        checkPunctuator(pn, ".") && /^\d+$/.test(ret.value));
        }
    }
    if (ret) {
        // The operator may be necessary to override the default binding power of
        // neighboring operators (whenever there is an operator in use within the
        // first expression *or* the current group contains multiple expressions)
        if (!isNecessary && (first.left || first.right || ret.exprs)) {
            isNecessary =
                (!isBeginOfExpr(preceeding) && first.lbp <= preceeding.lbp) ||
                    (!isEndOfExpr() && last.lbp < state_1.state.tokens.next.lbp);
        }
        if (!isNecessary) {
            warning("W126", opening);
        }
        ret.paren = true;
    }
    return ret;
});
application("=>");
infix("[", function (left, that) {
    var e = expression(10);
    var s;
    if (e && e.type === "(string)") {
        if (!state_1.state.option.evil && (e.value === "eval" || e.value === "execScript")) {
            if (isGlobalEval(left, state_1.state)) {
                warning("W061");
            }
        }
        countMember(e.value);
        if (!state_1.state.option.sub && reg_1.identifierRegExp.test(e.value)) {
            s = state_1.state.syntax[e.value];
            if (!s || !isReserved(s)) {
                warning("W069", state_1.state.tokens.prev, e.value);
            }
        }
    }
    advance("]", that);
    if (e && e.value === "hasOwnProperty" && state_1.state.tokens.next.value === "=") {
        warning("W001");
    }
    that.left = left;
    that.right = e;
    return that;
}, 160, true);
function comprehensiveArrayExpression() {
    var res = {};
    res.exps = true;
    state_1.state.funct["(comparray)"].stack();
    // Handle reversed for expressions, used in spidermonkey
    var reversed = false;
    if (state_1.state.tokens.next.value !== "for") {
        reversed = true;
        if (!state_1.state.inMoz()) {
            warning("W116", state_1.state.tokens.next, "for", state_1.state.tokens.next.value);
        }
        state_1.state.funct["(comparray)"].setState("use");
        res.right = expression(10);
    }
    advance("for");
    if (state_1.state.tokens.next.value === "each") {
        advance("each");
        if (!state_1.state.inMoz()) {
            warning("W118", state_1.state.tokens.curr, "for each");
        }
    }
    advance("(");
    state_1.state.funct["(comparray)"].setState("define");
    res.left = expression(130);
    if (contains_1.contains(["in", "of"], state_1.state.tokens.next.value)) {
        advance();
    }
    else {
        error("E045", state_1.state.tokens.curr);
    }
    state_1.state.funct["(comparray)"].setState("generate");
    expression(10);
    advance(")");
    if (state_1.state.tokens.next.value === "if") {
        advance("if");
        advance("(");
        state_1.state.funct["(comparray)"].setState("filter");
        res.filter = expression(10);
        advance(")");
    }
    if (!reversed) {
        state_1.state.funct["(comparray)"].setState("use");
        res.right = expression(10);
    }
    advance("]");
    state_1.state.funct["(comparray)"].unstack();
    return res;
}
// this function is used to determine whether a squarebracket or a curlybracket
// expression is a comprehension array, destructuring assignment or a json value.
var lookupBlockType = function () {
    var pn, pn1, prev;
    var i = -1;
    var bracketStack = 0;
    var ret = {};
    if (checkPunctuators(state_1.state.tokens.curr, ["[", "{"])) {
        bracketStack += 1;
    }
    do {
        prev = i === -1 ? state_1.state.tokens.curr : pn;
        pn = i === -1 ? state_1.state.tokens.next : peek(i);
        pn1 = peek(i + 1);
        i = i + 1;
        if (checkPunctuators(pn, ["[", "{"])) {
            bracketStack += 1;
        }
        else if (checkPunctuators(pn, ["]", "}"])) {
            bracketStack -= 1;
        }
        if (bracketStack === 1 && pn.identifier && pn.value === "for" &&
            !checkPunctuator(prev, ".")) {
            ret.isCompArray = true;
            ret.notJson = true;
            break;
        }
        if (bracketStack === 0 && checkPunctuators(pn, ["}", "]"])) {
            if (pn1.value === "=") {
                ret.isDestAssign = true;
                ret.notJson = true;
                break;
            }
            else if (pn1.value === ".") {
                ret.notJson = true;
                break;
            }
        }
        if (checkPunctuator(pn, ";")) {
            ret.isBlock = true;
            ret.notJson = true;
        }
    } while (bracketStack > 0 && pn.id !== "(end)");
    return ret;
};
prefix("[", function () {
    var blocktype = lookupBlockType();
    if (blocktype.isCompArray) {
        if (!state_1.state.option.esnext && !state_1.state.inMoz()) {
            warning("W118", state_1.state.tokens.curr, "array comprehension");
        }
        return comprehensiveArrayExpression();
    }
    else if (blocktype.isDestAssign) {
        this.destructAssign = destructuringPattern({ openingParsed: true, assignment: true });
        return this;
    }
    var b = state_1.state.tokens.curr.line !== startLine(state_1.state.tokens.next);
    this.first = [];
    if (b) {
        indent += state_1.state.option.indent;
        if (state_1.state.tokens.next.from === indent + state_1.state.option.indent) {
            indent += state_1.state.option.indent;
        }
    }
    while (state_1.state.tokens.next.id !== "(end)") {
        while (state_1.state.tokens.next.id === ",") {
            if (!state_1.state.option.elision) {
                if (!state_1.state.inES5()) {
                    // Maintain compat with old options --- ES5 mode without
                    // elision=true will warn once per comma
                    warning("W070");
                }
                else {
                    warning("W128");
                    do {
                        advance(",");
                    } while (state_1.state.tokens.next.id === ",");
                    continue;
                }
            }
            advance(",");
        }
        if (state_1.state.tokens.next.id === "]") {
            break;
        }
        this.first.push(expression(10));
        if (state_1.state.tokens.next.id === ",") {
            comma({ allowTrailing: true });
            if (state_1.state.tokens.next.id === "]" && !state_1.state.inES5()) {
                warning("W070", state_1.state.tokens.curr);
                break;
            }
        }
        else {
            break;
        }
    }
    if (b) {
        indent -= state_1.state.option.indent;
    }
    advance("]", this);
    return this;
});
function isMethod() {
    return state_1.state.funct["(statement)"] && state_1.state.funct["(statement)"].type === "class" ||
        state_1.state.funct["(context)"] && state_1.state.funct["(context)"]["(verb)"] === "class";
}
function isPropertyName(token) {
    return token.identifier || token.id === "(string)" || token.id === "(number)";
}
function propertyName(preserveOrToken) {
    var id;
    var preserve = true;
    if (typeof preserveOrToken === "object") {
        id = preserveOrToken;
    }
    else {
        preserve = preserveOrToken;
        id = optionalidentifier(false, true, preserve);
    }
    if (!id) {
        if (state_1.state.tokens.next.id === "(string)") {
            id = state_1.state.tokens.next.value;
            if (!preserve) {
                advance();
            }
        }
        else if (state_1.state.tokens.next.id === "(number)") {
            id = state_1.state.tokens.next.value.toString();
            if (!preserve) {
                advance();
            }
        }
    }
    else if (typeof id === "object") {
        if (id.id === "(string)" || id.id === "(identifier)")
            id = id.value;
        else if (id.id === "(number)")
            id = id.value.toString();
    }
    if (id === "hasOwnProperty") {
        warning("W001");
    }
    return id;
}
/**
 * @param {Object} [options]
 * @param {token} [options.loneArg] The argument to the function in cases
 *                                  where it was defined using the
 *                                  single-argument shorthand.
 * @param {bool} [options.parsedOpening] Whether the opening parenthesis has
 *                                       already been parsed.
 * @returns {{ arity: number, params: Array.<string>}}
 */
function functionparams(options) {
    var next;
    var paramsIds = [];
    var ident;
    var tokens = [];
    var t;
    var pastDefault = false;
    var pastRest = false;
    var arity = 0;
    var loneArg = options && options.loneArg;
    if (loneArg && loneArg.identifier === true) {
        state_1.state.funct["(scope)"].addParam(loneArg.value, loneArg);
        return { arity: 1, params: [loneArg.value] };
    }
    next = state_1.state.tokens.next;
    if (!options || !options.parsedOpening) {
        advance("(");
    }
    if (state_1.state.tokens.next.id === ")") {
        advance(")");
        return;
    }
    function addParam(addParamArgs) {
        state_1.state.funct["(scope)"].addParam.apply(state_1.state.funct["(scope)"], addParamArgs);
    }
    for (;;) {
        arity++;
        // are added to the param scope
        var currentParams = [];
        if (contains_1.contains(["{", "["], state_1.state.tokens.next.id)) {
            tokens = destructuringPattern();
            for (t in tokens) {
                if (tokens.hasOwnProperty(t)) {
                    t = tokens[t];
                    if (t.id) {
                        paramsIds.push(t.id);
                        currentParams.push([t.id, t.token]);
                    }
                }
            }
        }
        else {
            if (checkPunctuator(state_1.state.tokens.next, "..."))
                pastRest = true;
            ident = identifier(true);
            if (ident) {
                paramsIds.push(ident);
                currentParams.push([ident, state_1.state.tokens.curr]);
            }
            else {
                // Skip invalid parameter.
                while (!checkPunctuators(state_1.state.tokens.next, [",", ")"]))
                    advance();
            }
        }
        // It is valid to have a regular argument after a default argument
        // since undefined can be used for missing parameters. Still warn as it is
        // a possible code smell.
        if (pastDefault) {
            if (state_1.state.tokens.next.id !== "=") {
                error("W138", state_1.state.tokens.curr);
            }
        }
        if (state_1.state.tokens.next.id === "=") {
            if (!state_1.state.inES6()) {
                warning("W119", state_1.state.tokens.next, "default parameters", "6");
            }
            advance("=");
            pastDefault = true;
            expression(10);
        }
        // now we have evaluated the default expression, add the variable to the param scope
        currentParams.forEach(addParam);
        if (state_1.state.tokens.next.id === ",") {
            if (pastRest) {
                warning("W131", state_1.state.tokens.next);
            }
            comma();
        }
        else {
            advance(")", next);
            return { arity: arity, params: paramsIds };
        }
    }
}
function functor(name, token, overwrites) {
    var funct = {
        "(name)": name,
        "(breakage)": 0,
        "(loopage)": 0,
        "(tokens)": {},
        "(properties)": {},
        "(catch)": false,
        "(global)": false,
        "(line)": null,
        "(character)": null,
        "(metrics)": null,
        "(statement)": null,
        "(context)": null,
        "(scope)": null,
        "(comparray)": null,
        "(generator)": null,
        "(arrow)": null,
        "(params)": null
    };
    if (token) {
        extend_1.extend(funct, {
            "(line)": token.line,
            "(character)": token.character,
            "(metrics)": createMetrics(token)
        });
    }
    extend_1.extend(funct, overwrites);
    if (funct["(context)"]) {
        funct["(scope)"] = funct["(context)"]["(scope)"];
        funct["(comparray)"] = funct["(context)"]["(comparray)"];
    }
    return funct;
}
function isFunctor(token) {
    return "(scope)" in token;
}
/**
 * Determine if the parser has begun parsing executable code.
 *
 * @param {Token} funct - The current "functor" token
 *
 * @returns {boolean}
 */
function hasParsedCode(funct) {
    return funct["(global)"] && !funct["(verb)"];
}
function doTemplateLiteral(left) {
    // ASSERT: this.type === "(template)"
    // jshint validthis: true
    var ctx = this.context;
    var noSubst = this.noSubst;
    var depth = this.depth;
    if (!noSubst) {
        while (!end()) {
            if (!state_1.state.tokens.next.template || state_1.state.tokens.next.depth > depth) {
                expression(0); // should probably have different rbp?
            }
            else {
                // skip template start / middle
                advance();
            }
        }
    }
    return {
        id: "(template)",
        type: "(template)",
        tag: left
    };
    function end() {
        if (state_1.state.tokens.curr.template && state_1.state.tokens.curr.tail &&
            state_1.state.tokens.curr.context === ctx)
            return true;
        var complete = (state_1.state.tokens.next.template && state_1.state.tokens.next.tail &&
            state_1.state.tokens.next.context === ctx);
        if (complete)
            advance();
        return complete || state_1.state.tokens.next.isUnclosed;
    }
}
/**
 * @param {Object} [options]
 * @param {token} [options.name] The identifier belonging to the function (if
 *                               any)
 * @param {boolean} [options.statement] The statement that triggered creation
 *                                      of the current function.
 * @param {string} [options.type] If specified, either "generator" or "arrow"
 * @param {token} [options.loneArg] The argument to the function in cases
 *                                  where it was defined using the
 *                                  single-argument shorthand
 * @param {bool} [options.parsedOpening] Whether the opening parenthesis has
 *                                       already been parsed
 * @param {token} [options.classExprBinding] Define a function with this
 *                                           identifier in the new function's
 *                                           scope, mimicking the bahavior of
 *                                           class expression names within
 *                                           the body of member functions.
 */
function doFunction(options) {
    var f, token, name, statement, classExprBinding, isGenerator, isArrow, ignoreLoopFunc;
    var oldOption = state_1.state.option;
    var oldIgnored = state_1.state.ignored;
    if (options) {
        name = options.name;
        statement = options.statement;
        classExprBinding = options.classExprBinding;
        isGenerator = options.type === "generator";
        isArrow = options.type === "arrow";
        ignoreLoopFunc = options.ignoreLoopFunc;
    }
    state_1.state.option = Object.create(state_1.state.option);
    state_1.state.ignored = Object.create(state_1.state.ignored);
    state_1.state.funct = functor(name || state_1.state.nameStack.infer(), state_1.state.tokens.next, {
        "(statement)": statement,
        "(context)": state_1.state.funct,
        "(arrow)": isArrow,
        "(generator)": isGenerator
    });
    f = state_1.state.funct;
    token = state_1.state.tokens.curr;
    token.funct = state_1.state.funct;
    functions.push(state_1.state.funct);
    // So that the function is available to itself and referencing itself is not
    // seen as a closure, add the function name to a new scope, but do not
    // test for unused (unused: false)
    // it is a new block scope so that params can override it, it can be block scoped
    // but declarations inside the function don't cause already declared error
    state_1.state.funct["(scope)"].stack("functionouter");
    var internallyAccessibleName = name || classExprBinding;
    if (internallyAccessibleName) {
        state_1.state.funct["(scope)"].block.add(internallyAccessibleName, classExprBinding ? "class" : "function", state_1.state.tokens.curr, false);
    }
    // create the param scope (params added in functionparams)
    state_1.state.funct["(scope)"].stack("functionparams");
    var paramsInfo = functionparams(options);
    if (paramsInfo) {
        state_1.state.funct["(params)"] = paramsInfo.params;
        state_1.state.funct["(metrics)"].arity = paramsInfo.arity;
        state_1.state.funct["(metrics)"].verifyMaxParametersPerFunction();
    }
    else {
        state_1.state.funct["(metrics)"].arity = 0;
    }
    if (isArrow) {
        if (!state_1.state.inES6(true)) {
            warning("W119", state_1.state.tokens.curr, "arrow function syntax (=>)", "6");
        }
        if (!options.loneArg) {
            advance("=>");
        }
    }
    block(false, true, true, isArrow);
    if (!state_1.state.option.noyield && isGenerator &&
        state_1.state.funct["(generator)"] !== "yielded") {
        warning("W124", state_1.state.tokens.curr);
    }
    state_1.state.funct["(metrics)"].verifyMaxStatementsPerFunction();
    state_1.state.funct["(metrics)"].verifyMaxComplexityPerFunction();
    state_1.state.funct["(unusedOption)"] = state_1.state.option.unused;
    state_1.state.option = oldOption;
    state_1.state.ignored = oldIgnored;
    state_1.state.funct["(last)"] = state_1.state.tokens.curr.line;
    state_1.state.funct["(lastcharacter)"] = state_1.state.tokens.curr.character;
    // unstack the params scope
    state_1.state.funct["(scope)"].unstack(); // also does usage and label checks
    // unstack the function outer stack
    state_1.state.funct["(scope)"].unstack();
    state_1.state.funct = state_1.state.funct["(context)"];
    if (!ignoreLoopFunc && !state_1.state.option.loopfunc && state_1.state.funct["(loopage)"]) {
        // If the function we just parsed accesses any non-local variables
        // trigger a warning. Otherwise, the function is safe even within
        // a loop.
        if (f["(isCapturing)"]) {
            warning("W083", token);
        }
    }
    return f;
}
function createMetrics(functionStartToken) {
    return {
        statementCount: 0,
        nestedBlockDepth: -1,
        ComplexityCount: 1,
        arity: 0,
        verifyMaxStatementsPerFunction: function () {
            if (state_1.state.option.maxstatements &&
                this.statementCount > state_1.state.option.maxstatements) {
                warning("W071", functionStartToken, this.statementCount);
            }
        },
        verifyMaxParametersPerFunction: function () {
            if (isNumber_1.isNumber(state_1.state.option.maxparams) &&
                this.arity > state_1.state.option.maxparams) {
                warning("W072", functionStartToken, this.arity);
            }
        },
        verifyMaxNestedBlockDepthPerFunction: function () {
            if (state_1.state.option.maxdepth &&
                this.nestedBlockDepth > 0 &&
                this.nestedBlockDepth === state_1.state.option.maxdepth + 1) {
                warning("W073", null, this.nestedBlockDepth);
            }
        },
        verifyMaxComplexityPerFunction: function () {
            var max = state_1.state.option.maxcomplexity;
            var cc = this.ComplexityCount;
            if (max && cc > max) {
                warning("W074", functionStartToken, cc);
            }
        }
    };
}
function increaseComplexityCount() {
    state_1.state.funct["(metrics)"].ComplexityCount += 1;
}
// Parse assignments that were found instead of conditionals.
// For example: if (a = 1) { ... }
function checkCondAssignment(expr) {
    var id, paren;
    if (expr) {
        id = expr.id;
        paren = expr.paren;
        if (id === "," && (expr = expr.exprs[expr.exprs.length - 1])) {
            id = expr.id;
            paren = paren || expr.paren;
        }
    }
    switch (id) {
        case "=":
        case "+=":
        case "-=":
        case "*=":
        case "%=":
        case "&=":
        case "|=":
        case "^=":
        case "/=":
            if (!paren && !state_1.state.option.boss) {
                warning("W084");
            }
    }
}
/**
 * @param {object} props Collection of property descriptors for a given
 *                       object.
 */
function checkProperties(props) {
    // Check for lonely setters if in the ES5 mode.
    if (state_1.state.inES5()) {
        for (var name in props) {
            if (props[name] && props[name].setterToken && !props[name].getterToken) {
                warning("W078", props[name].setterToken);
            }
        }
    }
}
function metaProperty(name, c) {
    if (checkPunctuator(state_1.state.tokens.next, ".")) {
        var left = state_1.state.tokens.curr.id;
        advance(".");
        var id = identifier();
        state_1.state.tokens.curr.isMetaProperty = true;
        if (name !== id) {
            error("E057", state_1.state.tokens.prev, left, id);
        }
        else {
            c();
        }
        return state_1.state.tokens.curr;
    }
}
(function (x) {
    x.nud = function () {
        var b, f, i, p, t, isGeneratorMethod = false, nextVal;
        var props = Object.create(null); // All properties, including accessors
        b = state_1.state.tokens.curr.line !== startLine(state_1.state.tokens.next);
        if (b) {
            indent += state_1.state.option.indent;
            if (state_1.state.tokens.next.from === indent + state_1.state.option.indent) {
                indent += state_1.state.option.indent;
            }
        }
        var blocktype = lookupBlockType();
        if (blocktype.isDestAssign) {
            this.destructAssign = destructuringPattern({ openingParsed: true, assignment: true });
            return this;
        }
        for (;;) {
            if (state_1.state.tokens.next.id === "}") {
                break;
            }
            nextVal = state_1.state.tokens.next.value;
            if (state_1.state.tokens.next.identifier &&
                (peekIgnoreEOL().id === "," || peekIgnoreEOL().id === "}")) {
                if (!state_1.state.inES6()) {
                    warning("W104", state_1.state.tokens.next, "object short notation", "6");
                }
                i = propertyName(true);
                saveProperty(props, i, state_1.state.tokens.next);
                expression(10);
            }
            else if (peek().id !== ":" && (nextVal === "get" || nextVal === "set")) {
                advance(nextVal);
                if (!state_1.state.inES5()) {
                    error("E034");
                }
                i = propertyName();
                // ES6 allows for get() {...} and set() {...} method
                // definition shorthand syntax, so we don't produce an error
                // if linting ECMAScript 6 code.
                if (!i && !state_1.state.inES6()) {
                    error("E035");
                }
                // We don't want to save this getter unless it's an actual getter
                // and not an ES6 concise method
                if (i) {
                    saveAccessor(nextVal, props, i, state_1.state.tokens.curr);
                }
                t = state_1.state.tokens.next;
                f = doFunction();
                p = f["(params)"];
                // Don't warn about getter/setter pairs if this is an ES6 concise method
                if (nextVal === "get" && i && p) {
                    warning("W076", t, p[0], i);
                }
                else if (nextVal === "set" && i && (!p || p.length !== 1)) {
                    warning("W077", t, i);
                }
            }
            else {
                if (state_1.state.tokens.next.value === "*" && state_1.state.tokens.next.type === "(punctuator)") {
                    if (!state_1.state.inES6()) {
                        warning("W104", state_1.state.tokens.next, "generator functions", "6");
                    }
                    advance("*");
                    isGeneratorMethod = true;
                }
                else {
                    isGeneratorMethod = false;
                }
                if (state_1.state.tokens.next.id === "[") {
                    i = computedPropertyName();
                    state_1.state.nameStack.set(i);
                }
                else {
                    state_1.state.nameStack.set(state_1.state.tokens.next);
                    i = propertyName();
                    saveProperty(props, i, state_1.state.tokens.next);
                    if (typeof i !== "string") {
                        break;
                    }
                }
                if (state_1.state.tokens.next.value === "(") {
                    if (!state_1.state.inES6()) {
                        warning("W104", state_1.state.tokens.curr, "concise methods", "6");
                    }
                    doFunction({ type: isGeneratorMethod ? "generator" : null });
                }
                else {
                    advance(":");
                    expression(10);
                }
            }
            countMember(i);
            if (state_1.state.tokens.next.id === ",") {
                comma({ allowTrailing: true, property: true });
                if (state_1.state.tokens.next.id === ",") {
                    warning("W070", state_1.state.tokens.curr);
                }
                else if (state_1.state.tokens.next.id === "}" && !state_1.state.inES5()) {
                    warning("W070", state_1.state.tokens.curr);
                }
            }
            else {
                break;
            }
        }
        if (b) {
            indent -= state_1.state.option.indent;
        }
        advance("}", this);
        checkProperties(props);
        return this;
    };
    x.fud = function () {
        error("E036", state_1.state.tokens.curr);
    };
}(delim("{")));
function destructuringPattern(options) {
    var isAssignment = options && options.assignment;
    if (!state_1.state.inES6()) {
        warning("W104", state_1.state.tokens.curr, isAssignment ? "destructuring assignment" : "destructuring binding", "6");
    }
    return destructuringPatternRecursive(options);
}
function destructuringPatternRecursive(options) {
    var ids;
    var identifiers = [];
    var openingParsed = options && options.openingParsed;
    var isAssignment = options && options.assignment;
    var recursiveOptions = isAssignment ? { assignment: isAssignment } : null;
    var firstToken = openingParsed ? state_1.state.tokens.curr : state_1.state.tokens.next;
    var nextInnerDE = function () {
        var ident;
        if (checkPunctuators(state_1.state.tokens.next, ["[", "{"])) {
            ids = destructuringPatternRecursive(recursiveOptions);
            for (var key in ids) {
                if (ids.hasOwnProperty(key)) {
                    var id_1 = ids[key];
                    identifiers.push({ id: id_1.id, token: id_1.token });
                }
            }
        }
        else if (checkPunctuator(state_1.state.tokens.next, ",")) {
            identifiers.push({ id: null, token: state_1.state.tokens.curr });
        }
        else if (checkPunctuator(state_1.state.tokens.next, "(")) {
            advance("(");
            nextInnerDE();
            advance(")");
        }
        else {
            var is_rest = checkPunctuator(state_1.state.tokens.next, "...");
            if (isAssignment) {
                var identifierToken = is_rest ? peek(0) : state_1.state.tokens.next;
                if (!identifierToken.identifier) {
                    warning("E030", identifierToken, identifierToken.value);
                }
                var assignTarget = expression(155);
                if (assignTarget) {
                    checkLeftSideAssign(assignTarget);
                    // if the target was a simple identifier, add it to the list to return
                    if (assignTarget.identifier) {
                        ident = assignTarget.value;
                    }
                }
            }
            else {
                ident = identifier();
            }
            if (ident) {
                identifiers.push({ id: ident, token: state_1.state.tokens.curr });
            }
            return is_rest;
        }
        return false;
    };
    var assignmentProperty = function () {
        var id;
        if (checkPunctuator(state_1.state.tokens.next, "[")) {
            advance("[");
            expression(10);
            advance("]");
            advance(":");
            nextInnerDE();
        }
        else if (state_1.state.tokens.next.id === "(string)" ||
            state_1.state.tokens.next.id === "(number)") {
            advance();
            advance(":");
            nextInnerDE();
        }
        else {
            // this id will either be the property name or the property name and the assigning identifier
            id = identifier();
            if (checkPunctuator(state_1.state.tokens.next, ":")) {
                advance(":");
                nextInnerDE();
            }
            else if (id) {
                // in this case we are assigning (not declaring), so check assignment
                if (isAssignment) {
                    checkLeftSideAssign(state_1.state.tokens.curr);
                }
                identifiers.push({ id: id, token: state_1.state.tokens.curr });
            }
        }
    };
    var id, value;
    if (checkPunctuator(firstToken, "[")) {
        if (!openingParsed) {
            advance("[");
        }
        if (checkPunctuator(state_1.state.tokens.next, "]")) {
            warning("W137", state_1.state.tokens.curr);
        }
        var element_after_rest = false;
        while (!checkPunctuator(state_1.state.tokens.next, "]")) {
            if (nextInnerDE() && !element_after_rest &&
                checkPunctuator(state_1.state.tokens.next, ",")) {
                warning("W130", state_1.state.tokens.next);
                element_after_rest = true;
            }
            if (checkPunctuator(state_1.state.tokens.next, "=")) {
                if (checkPunctuator(state_1.state.tokens.prev, "...")) {
                    advance("]");
                }
                else {
                    advance("=");
                }
                id = state_1.state.tokens.prev;
                value = expression(10);
                if (value && value.type === "undefined") {
                    warning("W080", id, id.value);
                }
            }
            if (!checkPunctuator(state_1.state.tokens.next, "]")) {
                advance(",");
            }
        }
        advance("]");
    }
    else if (checkPunctuator(firstToken, "{")) {
        if (!openingParsed) {
            advance("{");
        }
        if (checkPunctuator(state_1.state.tokens.next, "}")) {
            warning("W137", state_1.state.tokens.curr);
        }
        while (!checkPunctuator(state_1.state.tokens.next, "}")) {
            assignmentProperty();
            if (checkPunctuator(state_1.state.tokens.next, "=")) {
                advance("=");
                id = state_1.state.tokens.prev;
                value = expression(10);
                if (value && value.type === "undefined") {
                    warning("W080", id, id.value);
                }
            }
            if (!checkPunctuator(state_1.state.tokens.next, "}")) {
                advance(",");
                if (checkPunctuator(state_1.state.tokens.next, "}")) {
                    // Trailing comma
                    // ObjectBindingPattern: { BindingPropertyList , }
                    break;
                }
            }
        }
        advance("}");
    }
    return identifiers;
}
function destructuringPatternMatch(tokens, value) {
    var first = value.first;
    if (!first) {
        return;
    }
    zip_1.zip(tokens, Array.isArray(first) ? first : [first]).forEach(function (val) {
        var token = val[0];
        var value = val[1];
        if (token && value)
            token.first = value;
        else if (token && token.first && !value)
            warning("W080", token.first, token.first.value);
    });
}
function blockVariableStatement(type, statement, context) {
    // used for both let and const statements
    var prefix = context && context.prefix;
    var inexport = context && context.inexport;
    var isLet = type === "let";
    var isConst = type === "const";
    var tokens;
    var lone;
    var value;
    var letblock;
    if (!state_1.state.inES6()) {
        warning("W104", state_1.state.tokens.curr, type, "6");
    }
    if (isLet && state_1.state.tokens.next.value === "(") {
        if (!state_1.state.inMoz()) {
            warning("W118", state_1.state.tokens.next, "let block");
        }
        advance("(");
        state_1.state.funct["(scope)"].stack();
        letblock = true;
    }
    else if (state_1.state.funct["(noblockscopedvar)"]) {
        error("E048", state_1.state.tokens.curr, isConst ? "Const" : "Let");
    }
    statement.first = [];
    for (;;) {
        var names = [];
        if (contains_1.contains(["{", "["], state_1.state.tokens.next.value)) {
            tokens = destructuringPattern();
            lone = false;
        }
        else {
            tokens = [{ id: identifier(), token: state_1.state.tokens.curr }];
            lone = true;
        }
        if (!prefix && isConst && state_1.state.tokens.next.id !== "=") {
            warning("E012", state_1.state.tokens.curr, state_1.state.tokens.curr.value);
        }
        for (var name_1 in tokens) {
            if (tokens.hasOwnProperty(name_1)) {
                var t = tokens[name_1];
                if (state_1.state.funct["(scope)"].block.isGlobal()) {
                    if (predefined[t.id] === false) {
                        warning("W079", t.token, t.id);
                    }
                }
                if (t.id && !state_1.state.funct["(noblockscopedvar)"]) {
                    state_1.state.funct["(scope)"].addlabel(t.id, {
                        type: type,
                        token: t.token
                    });
                    names.push(t.token);
                    if (lone && inexport) {
                        state_1.state.funct["(scope)"].setExported(t.token.value, t.token);
                    }
                }
            }
        }
        if (state_1.state.tokens.next.id === "=") {
            advance("=");
            if (!prefix && peek(0).id === "=" && state_1.state.tokens.next.identifier) {
                warning("W120", state_1.state.tokens.next, state_1.state.tokens.next.value);
            }
            var id = state_1.state.tokens.prev;
            // don't accept `in` in expression if prefix is used for ForIn/Of loop.
            value = expression(prefix ? 120 : 10);
            if (!prefix && value && value.type === "undefined") {
                warning("W080", id, id.value);
            }
            if (lone) {
                tokens[0].token.first = value;
            }
            else {
                destructuringPatternMatch(names, value);
            }
        }
        statement.first = statement.first.concat(names);
        if (state_1.state.tokens.next.id !== ",") {
            break;
        }
        comma();
    }
    if (letblock) {
        advance(")");
        block(true, true);
        statement.block = true;
        state_1.state.funct["(scope)"].unstack();
    }
    return statement;
}
var conststatement = stmt("const", function (context) {
    return blockVariableStatement("const", this, context);
});
conststatement.exps = true;
var letstatement = stmt("let", function (context) {
    return blockVariableStatement("let", this, context);
});
letstatement.exps = true;
var varstatement = stmt("var", function (context) {
    var prefix = context && context.prefix;
    var inexport = context && context.inexport;
    var tokens, lone, value;
    // If the `implied` option is set, bindings are set differently.
    var implied = context && context.implied;
    var report = !(context && context.ignore);
    this.first = [];
    for (;;) {
        var names = [];
        if (contains_1.contains(["{", "["], state_1.state.tokens.next.value)) {
            tokens = destructuringPattern();
            lone = false;
        }
        else {
            tokens = [{ id: identifier(), token: state_1.state.tokens.curr }];
            lone = true;
        }
        if (!(prefix && implied) && report && state_1.state.option.varstmt) {
            warning("W132", this);
        }
        this.first = this.first.concat(names);
        for (var name in tokens) {
            if (tokens.hasOwnProperty(name)) {
                var t = tokens[name];
                if (!implied && state_1.state.funct["(global)"]) {
                    if (predefined[t.id] === false) {
                        warning("W079", t.token, t.id);
                    }
                    else if (state_1.state.option.futurehostile === false) {
                        if ((!state_1.state.inES5() && vars_1.ecmaIdentifiers[5][t.id] === false) ||
                            (!state_1.state.inES6() && vars_1.ecmaIdentifiers[6][t.id] === false)) {
                            warning("W129", t.token, t.id);
                        }
                    }
                }
                if (t.id) {
                    if (implied === "for") {
                        if (!state_1.state.funct["(scope)"].has(t.id)) {
                            if (report)
                                warning("W088", t.token, t.id);
                        }
                        state_1.state.funct["(scope)"].block.use(t.id, t.token);
                    }
                    else {
                        state_1.state.funct["(scope)"].addlabel(t.id, {
                            type: "var",
                            token: t.token
                        });
                        if (lone && inexport) {
                            state_1.state.funct["(scope)"].setExported(t.id, t.token);
                        }
                    }
                    names.push(t.token);
                }
            }
        }
        if (state_1.state.tokens.next.id === "=") {
            state_1.state.nameStack.set(state_1.state.tokens.curr);
            advance("=");
            if (peek(0).id === "=" && state_1.state.tokens.next.identifier) {
                if (!prefix && report &&
                    !state_1.state.funct["(params)"] ||
                    state_1.state.funct["(params)"].indexOf(state_1.state.tokens.next.value) === -1) {
                    warning("W120", state_1.state.tokens.next, state_1.state.tokens.next.value);
                }
            }
            var id = state_1.state.tokens.prev;
            // don't accept `in` in expression if prefix is used for ForIn/Of loop.
            value = expression(prefix ? 120 : 10);
            if (value && !prefix && report && !state_1.state.funct["(loopage)"] && value.type === "undefined") {
                warning("W080", id, id.value);
            }
            if (lone) {
                tokens[0].first = value;
            }
            else {
                destructuringPatternMatch(names, value);
            }
        }
        if (state_1.state.tokens.next.id !== ",") {
            break;
        }
        comma();
    }
    return this;
});
varstatement.exps = true;
blockstmt("class", function () {
    return classdef.call(this, true);
});
function classdef(isStatement) {
    /*jshint validthis:true */
    if (!state_1.state.inES6()) {
        warning("W104", state_1.state.tokens.curr, "class", "6");
    }
    if (isStatement) {
        // BindingIdentifier
        this.name = identifier();
        state_1.state.funct["(scope)"].addlabel(this.name, {
            type: "class",
            token: state_1.state.tokens.curr
        });
    }
    else if (state_1.state.tokens.next.identifier && state_1.state.tokens.next.value !== "extends") {
        // BindingIdentifier(opt)
        this.name = identifier();
        this.namedExpr = true;
    }
    else {
        this.name = state_1.state.nameStack.infer();
    }
    classtail(this);
    return this;
}
function classtail(c) {
    var wasInClassBody = state_1.state.inClassBody;
    // ClassHeritage(opt)
    if (state_1.state.tokens.next.value === "extends") {
        advance("extends");
        c.heritage = expression(10);
    }
    state_1.state.inClassBody = true;
    advance("{");
    // ClassBody(opt)
    c.body = classbody(c);
    advance("}");
    state_1.state.inClassBody = wasInClassBody;
}
function classbody(c) {
    var name;
    var isStatic;
    var isGenerator;
    var getset;
    var props = Object.create(null);
    var staticProps = Object.create(null);
    var computed;
    for (var i = 0; state_1.state.tokens.next.id !== "}"; ++i) {
        name = state_1.state.tokens.next;
        isStatic = false;
        isGenerator = false;
        getset = null;
        // The ES6 grammar for ClassElement includes the `;` token, but it is
        // defined only as a placeholder to facilitate future language
        // extensions. In ES6 code, it serves no purpose.
        if (name.id === ";") {
            warning("W032");
            advance(";");
            continue;
        }
        if (name.id === "*") {
            isGenerator = true;
            advance("*");
            name = state_1.state.tokens.next;
        }
        if (name.id === "[") {
            name = computedPropertyName();
            computed = true;
        }
        else if (isPropertyName(name)) {
            // Non-Computed PropertyName
            advance();
            computed = false;
            if (name.identifier && name.value === "static") {
                if (checkPunctuator(state_1.state.tokens.next, "*")) {
                    isGenerator = true;
                    advance("*");
                }
                if (isPropertyName(state_1.state.tokens.next) || state_1.state.tokens.next.id === "[") {
                    computed = state_1.state.tokens.next.id === "[";
                    isStatic = true;
                    name = state_1.state.tokens.next;
                    if (state_1.state.tokens.next.id === "[") {
                        name = computedPropertyName();
                    }
                    else
                        advance();
                }
            }
            if (name.identifier && (name.value === "get" || name.value === "set")) {
                if (isPropertyName(state_1.state.tokens.next) || state_1.state.tokens.next.id === "[") {
                    computed = state_1.state.tokens.next.id === "[";
                    getset = name;
                    name = state_1.state.tokens.next;
                    if (state_1.state.tokens.next.id === "[") {
                        name = computedPropertyName();
                    }
                    else
                        advance();
                }
            }
        }
        else {
            warning("W052", state_1.state.tokens.next, state_1.state.tokens.next.value || state_1.state.tokens.next.type);
            advance();
            continue;
        }
        if (!checkPunctuator(state_1.state.tokens.next, "(")) {
            // error --- class properties must be methods
            error("E054", state_1.state.tokens.next, state_1.state.tokens.next.value);
            while (state_1.state.tokens.next.id !== "}" &&
                !checkPunctuator(state_1.state.tokens.next, "(")) {
                advance();
            }
            if (state_1.state.tokens.next.value !== "(") {
                doFunction({ statement: c });
            }
        }
        if (!computed) {
            // We don't know how to determine if we have duplicate computed property names :(
            if (getset) {
                saveAccessor(getset.value, isStatic ? staticProps : props, name.value, name, true, isStatic);
            }
            else {
                if (name.value === "constructor") {
                    state_1.state.nameStack.set(c);
                }
                else {
                    state_1.state.nameStack.set(name);
                }
                saveProperty(isStatic ? staticProps : props, name.value, name, true, isStatic);
            }
        }
        if (getset && name.value === "constructor") {
            var propDesc = getset.value === "get" ? "class getter method" : "class setter method";
            error("E049", name, propDesc, "constructor");
        }
        else if (name.value === "prototype") {
            error("E049", name, "class method", "prototype");
        }
        propertyName(name);
        doFunction({
            statement: c,
            type: isGenerator ? "generator" : null,
            classExprBinding: c.namedExpr ? c.name : null
        });
    }
    checkProperties(props);
}
blockstmt("function", function (context) {
    var inexport = context && context.inexport;
    var generator = false;
    if (state_1.state.tokens.next.value === "*") {
        advance("*");
        if (state_1.state.inES6(true)) {
            generator = true;
        }
        else {
            warning("W119", state_1.state.tokens.curr, "function*", "6");
        }
    }
    if (inblock) {
        warning("W082", state_1.state.tokens.curr);
    }
    var i = optionalidentifier();
    state_1.state.funct["(scope)"].addlabel(i, {
        type: "function",
        token: state_1.state.tokens.curr
    });
    if (i === void 0) {
        warning("W025");
    }
    else if (inexport) {
        state_1.state.funct["(scope)"].setExported(i, state_1.state.tokens.prev);
    }
    doFunction({
        name: i,
        statement: this,
        type: generator ? "generator" : null,
        ignoreLoopFunc: inblock // a declaration may already have warned
    });
    if (state_1.state.tokens.next.id === "(" && state_1.state.tokens.next.line === state_1.state.tokens.curr.line) {
        error("E039");
    }
    return this;
});
prefix("function", function () {
    var generator = false;
    if (state_1.state.tokens.next.value === "*") {
        if (!state_1.state.inES6()) {
            warning("W119", state_1.state.tokens.curr, "function*", "6");
        }
        advance("*");
        generator = true;
    }
    var i = optionalidentifier();
    doFunction({ name: i, type: generator ? "generator" : null });
    return this;
});
blockstmt("if", function () {
    var t = state_1.state.tokens.next;
    increaseComplexityCount();
    state_1.state.condition = true;
    advance("(");
    var expr = expression(0);
    checkCondAssignment(expr);
    // When the if is within a for-in loop, check if the condition
    // starts with a negation operator
    var forinifcheck = null;
    if (state_1.state.option.forin && state_1.state.forinifcheckneeded) {
        state_1.state.forinifcheckneeded = false; // We only need to analyze the first if inside the loop
        forinifcheck = state_1.state.forinifchecks[state_1.state.forinifchecks.length - 1];
        if (expr.type === "(punctuator)" && expr.value === "!") {
            forinifcheck.type = "(negative)";
        }
        else {
            forinifcheck.type = "(positive)";
        }
    }
    advance(")", t);
    state_1.state.condition = false;
    var s = block(true, true);
    // When the if is within a for-in loop and the condition has a negative form,
    // check if the body contains nothing but a continue statement
    if (forinifcheck && forinifcheck.type === "(negative)") {
        if (s && s[0] && s[0].type === "(identifier)" && s[0].value === "continue") {
            forinifcheck.type = "(negative-with-continue)";
        }
    }
    if (state_1.state.tokens.next.id === "else") {
        advance("else");
        if (state_1.state.tokens.next.id === "if" || state_1.state.tokens.next.id === "switch") {
            statement();
        }
        else {
            block(true, true);
        }
    }
    return this;
});
blockstmt("try", function () {
    var b;
    function doCatch() {
        advance("catch");
        advance("(");
        state_1.state.funct["(scope)"].stack("catchparams");
        if (checkPunctuators(state_1.state.tokens.next, ["[", "{"])) {
            var tokens = destructuringPattern();
            tokens.forEach(function (token) {
                if (token.id) {
                    state_1.state.funct["(scope)"].addParam(token.id, token, "exception");
                }
            });
        }
        else if (state_1.state.tokens.next.type !== "(identifier)") {
            warning("E030", state_1.state.tokens.next, state_1.state.tokens.next.value);
        }
        else {
            // only advance if we have an identifier so we can continue parsing in the most common error - that no param is given.
            state_1.state.funct["(scope)"].addParam(identifier(), state_1.state.tokens.curr, "exception");
        }
        if (state_1.state.tokens.next.value === "if") {
            if (!state_1.state.inMoz()) {
                warning("W118", state_1.state.tokens.curr, "catch filter");
            }
            advance("if");
            expression(0);
        }
        advance(")");
        block(false);
        state_1.state.funct["(scope)"].unstack();
    }
    block(true);
    while (state_1.state.tokens.next.id === "catch") {
        increaseComplexityCount();
        if (b && (!state_1.state.inMoz())) {
            warning("W118", state_1.state.tokens.next, "multiple catch blocks");
        }
        doCatch();
        b = true;
    }
    if (state_1.state.tokens.next.id === "finally") {
        advance("finally");
        block(true);
        return;
    }
    if (!b) {
        error("E021", state_1.state.tokens.next, "catch", state_1.state.tokens.next.value);
    }
    return this;
});
blockstmt("while", function () {
    var t = state_1.state.tokens.next;
    state_1.state.funct["(breakage)"] += 1;
    state_1.state.funct["(loopage)"] += 1;
    increaseComplexityCount();
    advance("(");
    checkCondAssignment(expression(0));
    advance(")", t);
    block(true, true);
    state_1.state.funct["(breakage)"] -= 1;
    state_1.state.funct["(loopage)"] -= 1;
    return this;
}).labelled = true;
blockstmt("with", function () {
    var t = state_1.state.tokens.next;
    if (state_1.state.isStrict()) {
        error("E010", state_1.state.tokens.curr);
    }
    else if (!state_1.state.option.withstmt) {
        warning("W085", state_1.state.tokens.curr);
    }
    advance("(");
    expression(0);
    advance(")", t);
    block(true, true);
    return this;
});
blockstmt("switch", function () {
    var t = state_1.state.tokens.next;
    var g = false;
    var noindent = false;
    state_1.state.funct["(breakage)"] += 1;
    advance("(");
    checkCondAssignment(expression(0));
    advance(")", t);
    t = state_1.state.tokens.next;
    advance("{");
    if (state_1.state.tokens.next.from === indent)
        noindent = true;
    if (!noindent)
        indent += state_1.state.option.indent;
    this.cases = [];
    for (;;) {
        switch (state_1.state.tokens.next.id) {
            case "case":
                switch (state_1.state.funct["(verb)"]) {
                    case "yield":
                    case "break":
                    case "case":
                    case "continue":
                    case "return":
                    case "switch":
                    case "throw":
                        break;
                    default:
                        // You can tell JSHint that you don't use break intentionally by
                        // adding a comment /* falls through */ on a line just before
                        // the next `case`.
                        if (!state_1.state.tokens.curr.caseFallsThrough) {
                            warning("W086", state_1.state.tokens.curr, "case");
                        }
                }
                advance("case");
                this.cases.push(expression(0));
                increaseComplexityCount();
                g = true;
                advance(":");
                state_1.state.funct["(verb)"] = "case";
                break;
            case "default":
                switch (state_1.state.funct["(verb)"]) {
                    case "yield":
                    case "break":
                    case "continue":
                    case "return":
                    case "throw":
                        break;
                    default:
                        // Do not display a warning if 'default' is the first statement or if
                        // there is a special /* falls through */ comment.
                        if (this.cases.length) {
                            if (!state_1.state.tokens.curr.caseFallsThrough) {
                                warning("W086", state_1.state.tokens.curr, "default");
                            }
                        }
                }
                advance("default");
                g = true;
                advance(":");
                break;
            case "}":
                if (!noindent)
                    indent -= state_1.state.option.indent;
                advance("}", t);
                state_1.state.funct["(breakage)"] -= 1;
                state_1.state.funct["(verb)"] = void 0;
                return;
            case "(end)":
                error("E023", state_1.state.tokens.next, "}");
                return;
            default:
                indent += state_1.state.option.indent;
                if (g) {
                    switch (state_1.state.tokens.curr.id) {
                        case ",":
                            error("E040");
                            return;
                        case ":":
                            g = false;
                            statements();
                            break;
                        default:
                            error("E025", state_1.state.tokens.curr);
                            return;
                    }
                }
                else {
                    if (state_1.state.tokens.curr.id === ":") {
                        advance(":");
                        error("E024", state_1.state.tokens.curr, ":");
                        statements();
                    }
                    else {
                        error("E021", state_1.state.tokens.next, "case", state_1.state.tokens.next.value);
                        return;
                    }
                }
                indent -= state_1.state.option.indent;
        }
    }
}).labelled = true;
stmt("debugger", function () {
    if (!state_1.state.option.debug) {
        warning("W087", this);
    }
    return this;
}).exps = true;
(function () {
    var x = stmt("do", function () {
        state_1.state.funct["(breakage)"] += 1;
        state_1.state.funct["(loopage)"] += 1;
        increaseComplexityCount();
        this.first = block(true, true);
        advance("while");
        var t = state_1.state.tokens.next;
        advance("(");
        checkCondAssignment(expression(0));
        advance(")", t);
        state_1.state.funct["(breakage)"] -= 1;
        state_1.state.funct["(loopage)"] -= 1;
        return this;
    });
    x.labelled = true;
    x.exps = true;
}());
blockstmt("for", function () {
    var s, t = state_1.state.tokens.next;
    var letscope = false;
    var foreachtok = null;
    if (t.value === "each") {
        foreachtok = t;
        advance("each");
        if (!state_1.state.inMoz()) {
            warning("W118", state_1.state.tokens.curr, "for each");
        }
    }
    increaseComplexityCount();
    advance("(");
    // what kind of for(…) statement it is? for(…of…)? for(…in…)? for(…;…;…)?
    var nextop; // contains the token of the "in" or "of" operator
    var i = 0;
    var inof = ["in", "of"];
    var level = 0; // BindingPattern "level" --- level 0 === no BindingPattern
    var comma; // First comma punctuator at level 0
    var initializer; // First initializer at level 0
    // If initial token is a BindingPattern, count it as such.
    if (checkPunctuators(state_1.state.tokens.next, ["{", "["]))
        ++level;
    do {
        nextop = peek(i);
        ++i;
        if (checkPunctuators(nextop, ["{", "["]))
            ++level;
        else if (checkPunctuators(nextop, ["}", "]"]))
            --level;
        if (level < 0)
            break;
        if (level === 0) {
            if (!comma && checkPunctuator(nextop, ","))
                comma = nextop;
            else if (!initializer && checkPunctuator(nextop, "="))
                initializer = nextop;
        }
    } while (level > 0 || !contains_1.contains(inof, nextop.value) && nextop.value !== ";" &&
        nextop.type !== "(end)"); // Is this a JSCS bug? This looks really weird.
    // if we're in a for (… in|of …) statement
    if (contains_1.contains(inof, nextop.value)) {
        if (!state_1.state.inES6() && nextop.value === "of") {
            warning("W104", nextop, "for of", "6");
        }
        var ok = !(initializer || comma);
        if (initializer) {
            error("W133", comma, nextop.value, "initializer is forbidden");
        }
        if (comma) {
            error("W133", comma, nextop.value, "more than one ForBinding");
        }
        if (state_1.state.tokens.next.id === "var") {
            advance("var");
            state_1.state.tokens.curr.fud({ prefix: true });
        }
        else if (state_1.state.tokens.next.id === "let" || state_1.state.tokens.next.id === "const") {
            advance(state_1.state.tokens.next.id);
            // create a new block scope
            letscope = true;
            state_1.state.funct["(scope)"].stack();
            state_1.state.tokens.curr.fud({ prefix: true });
        }
        else {
            // Parse as a var statement, with implied bindings. Ignore errors if an error
            // was already reported
            Object.create(varstatement).fud({ prefix: true, implied: "for", ignore: !ok });
        }
        advance(nextop.value);
        expression(20);
        advance(")", t);
        if (nextop.value === "in" && state_1.state.option.forin) {
            state_1.state.forinifcheckneeded = true;
            if (state_1.state.forinifchecks === void 0) {
                state_1.state.forinifchecks = [];
            }
            // Push a new for-in-if check onto the stack. The type will be modified
            // when the loop's body is parsed and a suitable if statement exists.
            state_1.state.forinifchecks.push({
                type: "(none)"
            });
        }
        state_1.state.funct["(breakage)"] += 1;
        state_1.state.funct["(loopage)"] += 1;
        s = block(true, true);
        if (nextop.value === "in" && state_1.state.option.forin) {
            if (state_1.state.forinifchecks && state_1.state.forinifchecks.length > 0) {
                var check = state_1.state.forinifchecks.pop();
                if (s && s.length > 0 && (typeof s[0] !== "object" || s[0].value !== "if") ||
                    // Positive if statement is not the only one in loop body
                    check.type === "(positive)" && s.length > 1 ||
                    // Negative if statement but no continue
                    check.type === "(negative)") {
                    warning("W089", this);
                }
            }
            // Reset the flag in case no if statement was contained in the loop body
            state_1.state.forinifcheckneeded = false;
        }
        state_1.state.funct["(breakage)"] -= 1;
        state_1.state.funct["(loopage)"] -= 1;
    }
    else {
        if (foreachtok) {
            error("E045", foreachtok);
        }
        if (state_1.state.tokens.next.id !== ";") {
            if (state_1.state.tokens.next.id === "var") {
                advance("var");
                state_1.state.tokens.curr.fud();
            }
            else if (state_1.state.tokens.next.id === "let") {
                advance("let");
                // create a new block scope
                letscope = true;
                state_1.state.funct["(scope)"].stack();
                state_1.state.tokens.curr.fud();
            }
            else {
                for (;;) {
                    expression(0, "for");
                    if (state_1.state.tokens.next.id !== ",") {
                        break;
                    }
                    comma();
                }
            }
        }
        nolinebreak(state_1.state.tokens.curr);
        advance(";");
        // start loopage after the first ; as the next two expressions are executed
        // on every loop
        state_1.state.funct["(loopage)"] += 1;
        if (state_1.state.tokens.next.id !== ";") {
            checkCondAssignment(expression(0));
        }
        nolinebreak(state_1.state.tokens.curr);
        advance(";");
        if (state_1.state.tokens.next.id === ";") {
            error("E021", state_1.state.tokens.next, ")", ";");
        }
        if (state_1.state.tokens.next.id !== ")") {
            for (;;) {
                expression(0, "for");
                if (state_1.state.tokens.next.id !== ",") {
                    break;
                }
                comma();
            }
        }
        advance(")", t);
        state_1.state.funct["(breakage)"] += 1;
        block(true, true);
        state_1.state.funct["(breakage)"] -= 1;
        state_1.state.funct["(loopage)"] -= 1;
    }
    // unstack loop blockscope
    if (letscope) {
        state_1.state.funct["(scope)"].unstack();
    }
    return this;
}).labelled = true;
stmt("break", function () {
    var v = state_1.state.tokens.next.value;
    if (!state_1.state.option.asi)
        nolinebreak(this);
    if (state_1.state.tokens.next.id !== ";" && !state_1.state.tokens.next.reach &&
        state_1.state.tokens.curr.line === startLine(state_1.state.tokens.next)) {
        if (!state_1.state.funct["(scope)"].funct.hasBreakLabel(v)) {
            warning("W090", state_1.state.tokens.next, v);
        }
        this.first = state_1.state.tokens.next;
        advance();
    }
    else {
        if (state_1.state.funct["(breakage)"] === 0)
            warning("W052", state_1.state.tokens.next, this.value);
    }
    reachable(this);
    return this;
}).exps = true;
stmt("continue", function () {
    var v = state_1.state.tokens.next.value;
    if (state_1.state.funct["(breakage)"] === 0)
        warning("W052", state_1.state.tokens.next, this.value);
    if (!state_1.state.funct["(loopage)"])
        warning("W052", state_1.state.tokens.next, this.value);
    if (!state_1.state.option.asi)
        nolinebreak(this);
    if (state_1.state.tokens.next.id !== ";" && !state_1.state.tokens.next.reach) {
        if (state_1.state.tokens.curr.line === startLine(state_1.state.tokens.next)) {
            if (!state_1.state.funct["(scope)"].funct.hasBreakLabel(v)) {
                warning("W090", state_1.state.tokens.next, v);
            }
            this.first = state_1.state.tokens.next;
            advance();
        }
    }
    reachable(this);
    return this;
}).exps = true;
stmt("return", function () {
    if (this.line === startLine(state_1.state.tokens.next)) {
        if (state_1.state.tokens.next.id !== ";" && !state_1.state.tokens.next.reach) {
            this.first = expression(0);
            if (this.first &&
                this.first.type === "(punctuator)" && this.first.value === "=" &&
                !this.first.paren && !state_1.state.option.boss) {
                warningAt("W093", this.first.line, this.first.character);
            }
        }
    }
    else {
        if (state_1.state.tokens.next.type === "(punctuator)" &&
            ["[", "{", "+", "-"].indexOf(state_1.state.tokens.next.value) > -1) {
            nolinebreak(this); // always warn (Line breaking error)
        }
    }
    reachable(this);
    return this;
}).exps = true;
(function (x) {
    x.exps = true;
    x.lbp = 25;
}(prefix("yield", function () {
    var prev = state_1.state.tokens.prev;
    if (state_1.state.inES6(true) && !state_1.state.funct["(generator)"]) {
        // If it's a yield within a catch clause inside a generator then that's ok
        if (!("(catch)" === state_1.state.funct["(name)"] && state_1.state.funct["(context)"]["(generator)"])) {
            error("E046", state_1.state.tokens.curr, "yield");
        }
    }
    else if (!state_1.state.inES6()) {
        warning("W104", state_1.state.tokens.curr, "yield", "6");
    }
    state_1.state.funct["(generator)"] = "yielded";
    var delegatingYield = false;
    if (state_1.state.tokens.next.value === "*") {
        delegatingYield = true;
        advance("*");
    }
    if (this.line === startLine(state_1.state.tokens.next) || !state_1.state.inMoz()) {
        if (delegatingYield ||
            (state_1.state.tokens.next.id !== ";" && !state_1.state.option.asi &&
                !state_1.state.tokens.next.reach && state_1.state.tokens.next.nud)) {
            nobreaknonadjacent(state_1.state.tokens.curr, state_1.state.tokens.next);
            this.first = expression(10);
            if (this.first.type === "(punctuator)" && this.first.value === "=" &&
                !this.first.paren && !state_1.state.option.boss) {
                warningAt("W093", this.first.line, this.first.character);
            }
        }
        if (state_1.state.inMoz() && state_1.state.tokens.next.id !== ")" &&
            (prev.lbp > 30 || (!prev.assign && !isEndOfExpr()) || prev.id === "yield")) {
            error("E050", this);
        }
    }
    else if (!state_1.state.option.asi) {
        nolinebreak(this); // always warn (Line breaking error)
    }
    return this;
})));
stmt("throw", function () {
    nolinebreak(this);
    this.first = expression(20);
    reachable(this);
    return this;
}).exps = true;
stmt("import", function () {
    if (!state_1.state.inES6()) {
        warning("W119", state_1.state.tokens.curr, "import", "6");
    }
    if (state_1.state.tokens.next.type === "(string)") {
        // ModuleSpecifier :: StringLiteral
        advance("(string)");
        return this;
    }
    if (state_1.state.tokens.next.identifier) {
        // ImportClause :: ImportedDefaultBinding
        this.name = identifier();
        // Import bindings are immutable (see ES6 8.1.1.5.5)
        state_1.state.funct["(scope)"].addlabel(this.name, {
            type: "const",
            token: state_1.state.tokens.curr
        });
        if (state_1.state.tokens.next.value === ",") {
            // ImportClause :: ImportedDefaultBinding , NameSpaceImport
            // ImportClause :: ImportedDefaultBinding , NamedImports
            advance(",");
            // At this point, we intentionally fall through to continue matching
            // either NameSpaceImport or NamedImports.
            // Discussion:
            // https://github.com/jshint/jshint/pull/2144#discussion_r23978406
        }
        else {
            advance("from");
            advance("(string)");
            return this;
        }
    }
    if (state_1.state.tokens.next.id === "*") {
        // ImportClause :: NameSpaceImport
        advance("*");
        advance("as");
        if (state_1.state.tokens.next.identifier) {
            this.name = identifier();
            // Import bindings are immutable (see ES6 8.1.1.5.5)
            state_1.state.funct["(scope)"].addlabel(this.name, {
                type: "const",
                token: state_1.state.tokens.curr
            });
        }
    }
    else {
        // ImportClause :: NamedImports
        advance("{");
        for (;;) {
            if (state_1.state.tokens.next.value === "}") {
                advance("}");
                break;
            }
            var importName;
            if (state_1.state.tokens.next.type === "default") {
                importName = "default";
                advance("default");
            }
            else {
                importName = identifier();
            }
            if (state_1.state.tokens.next.value === "as") {
                advance("as");
                importName = identifier();
            }
            // Import bindings are immutable (see ES6 8.1.1.5.5)
            state_1.state.funct["(scope)"].addlabel(importName, {
                type: "const",
                token: state_1.state.tokens.curr
            });
            if (state_1.state.tokens.next.value === ",") {
                advance(",");
            }
            else if (state_1.state.tokens.next.value === "}") {
                advance("}");
                break;
            }
            else {
                error("E024", state_1.state.tokens.next, state_1.state.tokens.next.value);
                break;
            }
        }
    }
    // FromClause
    advance("from");
    advance("(string)");
    return this;
}).exps = true;
stmt("export", function () {
    var ok = true;
    var token;
    var identifier;
    if (!state_1.state.inES6()) {
        warning("W119", state_1.state.tokens.curr, "export", "6");
        ok = false;
    }
    if (!state_1.state.funct["(scope)"].block.isGlobal()) {
        error("E053", state_1.state.tokens.curr);
        ok = false;
    }
    if (state_1.state.tokens.next.value === "*") {
        // ExportDeclaration :: export * FromClause
        advance("*");
        advance("from");
        advance("(string)");
        return this;
    }
    if (state_1.state.tokens.next.type === "default") {
        // ExportDeclaration ::
        //      export default [lookahead  { function, class }] AssignmentExpression[In] ;
        //      export default HoistableDeclaration
        //      export default ClassDeclaration
        state_1.state.nameStack.set(state_1.state.tokens.next);
        advance("default");
        var exportType = state_1.state.tokens.next.id;
        if (exportType === "function" || exportType === "class") {
            this.block = true;
        }
        token = peek();
        expression(10);
        identifier = token.value;
        if (this.block) {
            state_1.state.funct["(scope)"].addlabel(identifier, {
                type: exportType,
                token: token
            });
            state_1.state.funct["(scope)"].setExported(identifier, token);
        }
        return this;
    }
    if (state_1.state.tokens.next.value === "{") {
        // ExportDeclaration :: export ExportClause
        advance("{");
        var exportedTokens = [];
        for (;;) {
            if (!state_1.state.tokens.next.identifier) {
                error("E030", state_1.state.tokens.next, state_1.state.tokens.next.value);
            }
            advance();
            exportedTokens.push(state_1.state.tokens.curr);
            // Casting to thwart a bug in TypeScript!
            if (state_1.state.tokens.next.value === "as") {
                advance("as");
                if (!state_1.state.tokens.next.identifier) {
                    error("E030", state_1.state.tokens.next, state_1.state.tokens.next.value);
                }
                advance();
            }
            if (state_1.state.tokens.next.value === ",") {
                advance(",");
            }
            else if (state_1.state.tokens.next.value === "}") {
                advance("}");
                break;
            }
            else {
                error("E024", state_1.state.tokens.next, state_1.state.tokens.next.value);
                break;
            }
        }
        if (state_1.state.tokens.next.value === "from") {
            // ExportDeclaration :: export ExportClause FromClause
            advance("from");
            advance("(string)");
        }
        else if (ok) {
            exportedTokens.forEach(function (token) {
                state_1.state.funct["(scope)"].setExported(token.value, token);
            });
        }
        return this;
    }
    if (state_1.state.tokens.next.id === "var") {
        // ExportDeclaration :: export VariableStatement
        advance("var");
        state_1.state.tokens.curr.fud({ inexport: true });
    }
    else if (state_1.state.tokens.next.id === "let") {
        // ExportDeclaration :: export VariableStatement
        advance("let");
        state_1.state.tokens.curr.fud({ inexport: true });
    }
    else if (state_1.state.tokens.next.id === "const") {
        // ExportDeclaration :: export VariableStatement
        advance("const");
        state_1.state.tokens.curr.fud({ inexport: true });
    }
    else if (state_1.state.tokens.next.id === "function") {
        // ExportDeclaration :: export Declaration
        this.block = true;
        advance("function");
        state_1.state.syntax["function"].fud({ inexport: true });
    }
    else if (state_1.state.tokens.next.id === "class") {
        // ExportDeclaration :: export Declaration
        this.block = true;
        advance("class");
        var classNameToken = state_1.state.tokens.next;
        state_1.state.syntax["class"].fud();
        state_1.state.funct["(scope)"].setExported(classNameToken.value, classNameToken);
    }
    else {
        error("E024", state_1.state.tokens.next, state_1.state.tokens.next.value);
    }
    return this;
}).exps = true;
// Future Reserved Words
FutureReservedWord("abstract");
FutureReservedWord("boolean");
FutureReservedWord("byte");
FutureReservedWord("char");
FutureReservedWord("class", { es5: true, nud: classdef });
FutureReservedWord("double");
FutureReservedWord("enum", { es5: true });
FutureReservedWord("export", { es5: true });
FutureReservedWord("extends", { es5: true });
FutureReservedWord("final");
FutureReservedWord("float");
FutureReservedWord("goto");
FutureReservedWord("implements", { es5: true, strictOnly: true });
FutureReservedWord("import", { es5: true });
FutureReservedWord("int");
FutureReservedWord("interface", { es5: true, strictOnly: true });
FutureReservedWord("long");
FutureReservedWord("native");
FutureReservedWord("package", { es5: true, strictOnly: true });
FutureReservedWord("private", { es5: true, strictOnly: true });
FutureReservedWord("protected", { es5: true, strictOnly: true });
FutureReservedWord("public", { es5: true, strictOnly: true });
FutureReservedWord("short");
FutureReservedWord("static", { es5: true, strictOnly: true });
FutureReservedWord("super", { es5: true });
FutureReservedWord("synchronized");
FutureReservedWord("transient");
FutureReservedWord("volatile");
function saveProperty(props, name, tkn, isClass, isStatic) {
    var msgs = ["key", "class method", "static class method"];
    var msg = msgs[(isClass || false) + (isStatic || false)];
    if (tkn.identifier) {
        name = tkn.value;
    }
    if (props[name] && name !== "__proto__") {
        warning("W075", state_1.state.tokens.next, msg, name);
    }
    else {
        props[name] = Object.create(null);
    }
    props[name].basic = true;
    props[name].basictkn = tkn;
}
/**
 * @param {string} accessorType - Either "get" or "set"
 * @param {object} props - a collection of all properties of the object to
 *                         which the current accessor is being assigned
 * @param {object} tkn - the identifier token representing the accessor name
 * @param {boolean} isClass - whether the accessor is part of an ES6 Class
 *                            definition
 * @param {boolean} isStatic - whether the accessor is a static method
 */
function saveAccessor(accessorType, props, name, tkn, isClass, isStatic) {
    var flagName = accessorType === "get" ? "getterToken" : "setterToken";
    var msg = "";
    if (isClass) {
        if (isStatic) {
            msg += "static ";
        }
        msg += accessorType + "ter method";
    }
    else {
        msg = "key";
    }
    state_1.state.tokens.curr.accessorType = accessorType;
    state_1.state.nameStack.set(tkn);
    if (props[name]) {
        if ((props[name].basic || props[name][flagName]) && name !== "__proto__") {
            warning("W075", state_1.state.tokens.next, msg, name);
        }
    }
    else {
        props[name] = Object.create(null);
    }
    props[name][flagName] = tkn;
}
function computedPropertyName() {
    advance("[");
    if (!state_1.state.inES6()) {
        warning("W119", state_1.state.tokens.curr, "computed property names", "6");
    }
    var value = expression(10);
    advance("]");
    return value;
}
/**
 * Test whether a given token is a punctuator matching one of the specified values.
 */
function checkPunctuators(token, values) {
    if (token.type === "(punctuator)") {
        return contains_1.contains(values, token.value);
    }
    return false;
}
/**
 * Test whether a given token is a punctuator matching the specified value
 * @param {Token} token
 * @param {string} value
 * @returns {boolean}
 */
function checkPunctuator(token, value) {
    return token.type === "(punctuator)" && token.value === value;
}
// Check whether this function has been reached for a destructuring assign with undeclared values
function destructuringAssignOrJsonValue() {
    // lookup for the assignment (ECMAScript 6 only)
    // if it has semicolons, it is a block, so go parse it as a block
    // or it's not a block, but there are assignments, check for undeclared variables
    var block = lookupBlockType();
    if (block.notJson) {
        if (!state_1.state.inES6() && block.isDestAssign) {
            warning("W104", state_1.state.tokens.curr, "destructuring assignment", "6");
        }
        statements();
        // otherwise parse json value
    }
    else {
        state_1.state.option.laxbreak = true;
        state_1.state.jsonMode = true;
        jsonValue();
    }
}
// array comprehension parsing function
// parses and defines the three states of the list comprehension in order
// to avoid defining global variables, but keeping them to the list comprehension scope
// only. The order of the states are as follows:
//  * "use" which will be the returned iterative part of the list comprehension
//  * "define" which will define the variables local to the list comprehension
//  * "filter" which will help filter out values
var arrayComprehension = function () {
    var CompArray = function () {
        this.mode = "use";
        this.variables = [];
    };
    var _carrays = [];
    var _current;
    function declare(v) {
        var l = _current.variables.filter(function (elt) {
            // if it has, change its undef state
            if (elt.value === v) {
                elt.undef = false;
                return v;
            }
        }).length;
        return l !== 0;
    }
    function use(v) {
        var l = _current.variables.filter(function (elt) {
            // and if it has been defined
            if (elt.value === v && !elt.undef) {
                if (elt.unused === true) {
                    elt.unused = false;
                }
                return v;
            }
        }).length;
        // otherwise we warn about it
        return (l === 0);
    }
    return {
        stack: function () {
            _current = new CompArray();
            _carrays.push(_current);
        },
        unstack: function () {
            _current.variables.filter(function (v) {
                if (v.unused)
                    warning("W098", v.token, v.raw_text || v.value);
                if (v.undef)
                    state_1.state.funct["(scope)"].block.use(v.value, v.token);
            });
            _carrays.splice(-1, 1);
            _current = _carrays[_carrays.length - 1];
        },
        setState: function (s) {
            if (contains_1.contains(["use", "define", "generate", "filter"], s))
                _current.mode = s;
        },
        check: function (v) {
            if (!_current) {
                return;
            }
            // When we are in "use" state of the list comp, we enqueue that var
            if (_current && _current.mode === "use") {
                if (use(v)) {
                    _current.variables.push({
                        funct: state_1.state.funct,
                        token: state_1.state.tokens.curr,
                        value: v,
                        undef: true,
                        unused: false
                    });
                }
                return true;
                // When we are in "define" state of the list comp,
            }
            else if (_current && _current.mode === "define") {
                // check if the variable has been used previously
                if (!declare(v)) {
                    _current.variables.push({
                        funct: state_1.state.funct,
                        token: state_1.state.tokens.curr,
                        value: v,
                        undef: false,
                        unused: true
                    });
                }
                return true;
                // When we are in the "generate" state of the list comp,
            }
            else if (_current && _current.mode === "generate") {
                state_1.state.funct["(scope)"].block.use(v, state_1.state.tokens.curr);
                return true;
                // When we are in "filter" state,
            }
            else if (_current && _current.mode === "filter") {
                // we check whether current variable has been declared
                if (use(v)) {
                    // if not we warn about it
                    state_1.state.funct["(scope)"].block.use(v, state_1.state.tokens.curr);
                }
                return true;
            }
            return false;
        }
    };
};
// Parse JSON
function jsonValue() {
    function jsonObject() {
        var o = {}, t = state_1.state.tokens.next;
        advance("{");
        if (state_1.state.tokens.next.id !== "}") {
            for (;;) {
                if (state_1.state.tokens.next.id === "(end)") {
                    error("E026", state_1.state.tokens.next, t.line);
                }
                else if (state_1.state.tokens.next.id === "}") {
                    warning("W094", state_1.state.tokens.curr);
                    break;
                }
                else if (state_1.state.tokens.next.id === ",") {
                    error("E028", state_1.state.tokens.next);
                }
                else if (state_1.state.tokens.next.id !== "(string)") {
                    warning("W095", state_1.state.tokens.next, state_1.state.tokens.next.value);
                }
                if (o[state_1.state.tokens.next.value] === true) {
                    warning("W075", state_1.state.tokens.next, "key", state_1.state.tokens.next.value);
                }
                else if ((state_1.state.tokens.next.value === "__proto__" &&
                    !state_1.state.option.proto) || (state_1.state.tokens.next.value === "__iterator__" &&
                    !state_1.state.option.iterator)) {
                    warning("W096", state_1.state.tokens.next, state_1.state.tokens.next.value);
                }
                else {
                    o[state_1.state.tokens.next.value] = true;
                }
                advance();
                advance(":");
                jsonValue();
                if (state_1.state.tokens.next.id !== ",") {
                    break;
                }
                advance(",");
            }
        }
        advance("}");
    }
    function jsonArray() {
        var t = state_1.state.tokens.next;
        advance("[");
        if (state_1.state.tokens.next.id !== "]") {
            for (;;) {
                if (state_1.state.tokens.next.id === "(end)") {
                    error("E027", state_1.state.tokens.next, t.line);
                }
                else if (state_1.state.tokens.next.id === "]") {
                    warning("W094", state_1.state.tokens.curr);
                    break;
                }
                else if (state_1.state.tokens.next.id === ",") {
                    error("E028", state_1.state.tokens.next);
                }
                jsonValue();
                if (state_1.state.tokens.next.id !== ",") {
                    break;
                }
                advance(",");
            }
        }
        advance("]");
    }
    switch (state_1.state.tokens.next.id) {
        case "{":
            jsonObject();
            break;
        case "[":
            jsonArray();
            break;
        case "true":
        case "false":
        case "null":
        case "(number)":
        case "(string)":
            advance();
            break;
        case "-":
            advance("-");
            advance("(number)");
            break;
        default:
            error("E003", state_1.state.tokens.next);
    }
}
var escapeRegex = function (str) {
    return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
};
/**
 * The actual JSHINT function itself.
 */
exports.JSHINT = function lint(s, o, g) {
    o = clone_1.clone(o);
    state_1.state.reset();
    if (o && o.scope) {
        exports.JSHINT.scope = o.scope;
    }
    else {
        exports.JSHINT.errors = [];
        exports.JSHINT.undefs = [];
        exports.JSHINT.internals = [];
        exports.JSHINT.blacklist = {};
        exports.JSHINT.scope = "(main)";
    }
    predefined = Object.create(null);
    combine(predefined, vars_1.ecmaIdentifiers[3]);
    combine(predefined, vars_1.reservedVars);
    combine(predefined, g || {});
    declared = Object.create(null);
    var exported = Object.create(null); // Variables that live outside the current file
    var newOptionObj = {};
    var newIgnoredObj = {};
    if (o) {
        if (o.predef) {
            o.predef.forEach(function (item) {
                if (item[0] === "-") {
                    var slice = item.slice(1);
                    exports.JSHINT.blacklist[slice] = slice;
                    // remove from predefined if there
                    delete predefined[slice];
                }
                else {
                    var prop = Object.getOwnPropertyDescriptor(o.predef, item);
                    predefined[item] = prop ? prop.value : false;
                }
            });
        }
        each_1.each(o.exported || null, function (value, item) {
            exported[item] = true;
        });
        delete o.predef;
        delete o.exported;
        var optionKeys = Object.keys(o);
        for (var _i = 0, optionKeys_1 = optionKeys; _i < optionKeys_1.length; _i++) {
            var optionKey = optionKeys_1[_i];
            if (/^-W\d{3}$/g.test(optionKey)) {
                newIgnoredObj[optionKey.slice(1)] = true;
            }
            else {
                newOptionObj[optionKey] = o[optionKey];
                if ((optionKey === "esversion" && o[optionKey] === 5) ||
                    (optionKey === "es5" && o[optionKey])) {
                    warningAt("I003", 0, 0);
                }
            }
        }
    }
    state_1.state.option = newOptionObj;
    state_1.state.ignored = newIgnoredObj;
    state_1.state.option.indent = state_1.state.option.indent || 4;
    state_1.state.option.maxerr = state_1.state.option.maxerr || 50;
    indent = 1;
    var scopeManagerInst = scope_manager_1.scopeManager(state_1.state, predefined, exported, declared);
    scopeManagerInst.on("warning", function (ev) {
        warning.apply(null, [ev.code, ev.token].concat(ev.data));
    });
    scopeManagerInst.on("error", function (ev) {
        error.apply(null, [ev.code, ev.token].concat(ev.data));
    });
    state_1.state.funct = functor("(global)", null, {
        "(global)": true,
        "(scope)": scopeManagerInst,
        "(comparray)": arrayComprehension(),
        "(metrics)": createMetrics(state_1.state.tokens.next)
    });
    functions = [state_1.state.funct];
    urls = [];
    stack = null;
    member = {};
    membersOnly = null;
    inblock = false;
    lookahead = [];
    if (!isString(s) && !Array.isArray(s)) {
        errorAt("E004", 0);
        return false;
    }
    api = {
        get isJSON() {
            return state_1.state.jsonMode;
        },
        getOption: function (name) {
            return state_1.state.option[name] || null;
        },
        getCache: function (name) {
            return state_1.state.cache[name];
        },
        setCache: function (name, value) {
            state_1.state.cache[name] = value;
        },
        warn: function (code, data) {
            warningAt.apply(null, [code, data.line, data.char].concat(data.data));
        },
        on: function (names, listener) {
            names.split(" ").forEach(function (name) {
                emitter.on(name, listener);
            }.bind(this));
        }
    };
    emitter.removeAllListeners();
    (extraModules || []).forEach(function (func) {
        func(api);
    });
    state_1.state.tokens.prev = state_1.state.tokens.curr = state_1.state.tokens.next = state_1.state.syntax["(begin)"];
    if (o && o.ignoreDelimiters) {
        if (!Array.isArray(o.ignoreDelimiters)) {
            o.ignoreDelimiters = [o.ignoreDelimiters];
        }
        o.ignoreDelimiters.forEach(function (delimiterPair) {
            if (!delimiterPair.start || !delimiterPair.end)
                return;
            var reIgnoreStr = escapeRegex(delimiterPair.start) +
                "[\\s\\S]*?" +
                escapeRegex(delimiterPair.end);
            var reIgnore = new RegExp(reIgnoreStr, "ig");
            s = s.replace(reIgnore, function (match) {
                return match.replace(/./g, " ");
            });
        });
    }
    lex = new lex_1.Lexer(s);
    lex.on("warning", function (ev) {
        warningAt.apply(null, [ev.code, ev.line, ev.character].concat(ev.data));
    });
    lex.on("error", function (ev) {
        errorAt.apply(null, [ev.code, ev.line, ev.character].concat(ev.data));
    });
    lex.on("fatal", function (ev) {
        quit("E041", ev);
    });
    lex.on("Identifier", function (ev) {
        emitter.emit("Identifier", ev);
    });
    lex.on("String", function (ev) {
        emitter.emit("String", ev);
    });
    lex.on("Number", function (ev) {
        emitter.emit("Number", ev);
    });
    lex.start();
    // Check options
    for (var name_2 in o) {
        if (has_1.has(o, name_2)) {
            checkOption(name_2, state_1.state.tokens.curr);
        }
    }
    try {
        assume();
        // combine the passed globals after we've assumed all our options
        combine(predefined, g || {});
        // reset values
        comma['first'] = true;
        advance();
        switch (state_1.state.tokens.next.id) {
            case "{":
            case "[":
                destructuringAssignOrJsonValue();
                break;
            default:
                directives();
                if (state_1.state.directive["use strict"]) {
                    if (state_1.state.option.strict !== "global" &&
                        !((state_1.state.option.strict === true || !state_1.state.option.strict) &&
                            (state_1.state.option.globalstrict || state_1.state.option.module || state_1.state.option.node ||
                                state_1.state.option.phantom || state_1.state.option.browserify))) {
                        warning("W097", state_1.state.tokens.prev);
                    }
                }
                statements();
        }
        if (state_1.state.tokens.next.id !== "(end)") {
            quit("E041", state_1.state.tokens.curr);
        }
        state_1.state.funct["(scope)"].unstack();
    }
    catch (err) {
        if (err && err.name === "JSHintError") {
            var nt = state_1.state.tokens.next;
            exports.JSHINT.errors.push({
                scope: "(main)",
                raw: err.raw,
                code: err.code,
                reason: err.reason,
                line: err.line || (nt ? nt.line : void 0),
                character: err.character || (nt ? nt.from : void 0)
            }, null);
        }
        else {
            throw err;
        }
    }
    // Loop over the listed "internals", and check them as well.
    if (exports.JSHINT.scope === "(main)") {
        o = o || {};
        for (var _a = 0, _b = exports.JSHINT.internals; _a < _b.length; _a++) {
            var k = _b[_a];
            o.scope = k.elem;
            exports.JSHINT(k.value, o, g);
        }
    }
    return exports.JSHINT.errors.length === 0;
};
// Modules.
exports.JSHINT.addModule = function (func) {
    extraModules.push(func);
};
exports.JSHINT.addModule(style_1.register);
// Data summary.
exports.JSHINT.data = function () {
    var data = {
        functions: [],
        options: state_1.state.option
    };
    var fu, f, i, j, n, globals;
    if (exports.JSHINT.errors.length) {
        data.errors = exports.JSHINT.errors;
    }
    if (state_1.state.jsonMode) {
        data.json = true;
    }
    var impliedGlobals = state_1.state.funct["(scope)"].getImpliedGlobals();
    if (impliedGlobals.length > 0) {
        data.implieds = impliedGlobals;
    }
    if (urls.length > 0) {
        data.urls = urls;
    }
    globals = state_1.state.funct["(scope)"].getUsedOrDefinedGlobals();
    if (globals.length > 0) {
        data.globals = globals;
    }
    for (i = 1; i < functions.length; i += 1) {
        f = functions[i];
        fu = {};
        for (j = 0; j < functionicity.length; j += 1) {
            fu[functionicity[j]] = [];
        }
        for (j = 0; j < functionicity.length; j += 1) {
            if (fu[functionicity[j]].length === 0) {
                delete fu[functionicity[j]];
            }
        }
        fu.name = f["(name)"];
        fu.param = f["(params)"];
        fu.line = f["(line)"];
        fu.character = f["(character)"];
        fu.last = f["(last)"];
        fu.lastcharacter = f["(lastcharacter)"];
        fu.metrics = {
            complexity: f["(metrics)"].ComplexityCount,
            parameters: f["(metrics)"].arity,
            statements: f["(metrics)"].statementCount
        };
        data.functions.push(fu);
    }
    var unuseds = state_1.state.funct["(scope)"].getUnuseds();
    if (unuseds.length > 0) {
        data.unused = unuseds;
    }
    for (n in member) {
        if (typeof member[n] === "number") {
            data.member = member;
            break;
        }
    }
    return data;
};