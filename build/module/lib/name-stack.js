var NameStack = (function () {
    function NameStack() {
        this._stack = [];
    }
    Object.defineProperty(NameStack.prototype, "length", {
        get: function () {
            return this._stack.length;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Create a new entry in the stack. Useful for tracking names across
     * expressions.
     */
    NameStack.prototype.push = function () {
        this._stack.push(null);
    };
    /**
     * Discard the most recently-created name on the stack.
     */
    NameStack.prototype.pop = function () {
        this._stack.pop();
    };
    /**
     * Update the most recent name on the top of the stack.
     *
     * @param {object} token The token to consider as the source for the most
     *                       recent name.
     */
    NameStack.prototype.set = function (token) {
        this._stack[this.length - 1] = token;
    };
    /**
     * Generate a string representation of the most recent name.
     */
    NameStack.prototype.infer = function () {
        var nameToken = this._stack[this.length - 1];
        // During expected operation, the topmost entry on the stack will only
        // reflect the current function's name when the function is declared without
        // the `function` keyword (i.e. for in-line accessor methods). In other
        // cases, the `function` expression itself will introduce an empty entry on
        // the top of the stack, and this should be ignored.
        if (!nameToken || nameToken.type === "class") {
            nameToken = this._stack[this.length - 2];
        }
        if (!nameToken) {
            return "(empty)";
        }
        var type = nameToken.type;
        if (type !== "(string)" && type !== "(number)" && type !== "(identifier)" && type !== "default") {
            return "(expression)";
        }
        var prefix = "";
        if (nameToken.accessorType) {
            prefix = nameToken.accessorType + " ";
        }
        return prefix + nameToken.value;
    };
    return NameStack;
}());
export { NameStack };
