import { JSHINT } from './jshint';
import { JSHintError } from './JSHintError';

function expectError(errors: JSHintError[], index: number, code: string, position: [number, number], reason: string, evidence: string) {
    const error = errors[index];
    expect(error.id).toBe("(error)");
    expect(error.code).toBe(code, "code");
    // expect(error.raw).toBe("Bad number '{a}'.");
    expect(error.evidence).toBe(evidence, "evidence");
    expect(error.line).toBe(position[0], "line");
    expect(error.character).toBe(position[1], "character");
    expect(error.scope).toBe("(main)");
    expect(error.reason).toBe(reason, "reason");

}

describe("JSHINT", function () {
    describe("confusingOps", function () {
        it("Confusing minuses", function () {
            const response = JSHINT("var a = 3 - -3;", {});
            expect(response).toBe(false);
            expect(JSHINT.errors.length).toBe(1);
            const error = JSHINT.errors[0];
            expect(error.id).toBe("(error)");
            expect(error.code).toBe("W006");
            expect(error.raw).toBe("Confusing minuses.");
            expect(error.evidence).toBe("var a = 3 - -3;");
            expect(error.line).toBe(1);
            expect(error.character).toBe(13);
            expect(error.scope).toBe("(main)");
            expect(error.reason).toBe("Confusing minuses.");
            // console.log(JSON.stringify(JSHINT.errors[0]));
        });
        it("Confusing minuses", function () {
            const response = JSHINT("var a = 3 + +3;", {});
            expect(response).toBe(false);
            expect(JSHINT.errors.length).toBe(1);
            const error = JSHINT.errors[0];
            expect(error.id).toBe("(error)");
            expect(error.code).toBe("W007");
            expect(error.raw).toBe("Confusing plusses.");
            expect(error.evidence).toBe("var a = 3 + +3;");
            expect(error.line).toBe(1);
            expect(error.character).toBe(13);
            expect(error.scope).toBe("(main)");
            expect(error.reason).toBe("Confusing plusses.");
            // console.log(JSON.stringify(JSHINT.errors[0]));
        });
    });
    xdescribe("plusplus", function () {
        it("Confusing minuses", function () {
            const response = JSHINT("var a = ++[2];", {});
            expect(response).toBe(false);
            expect(JSHINT.errors.length).toBe(1);
            const error = JSHINT.errors[0];
            expect(error.id).toBe("(error)");
            expect(error.code).toBe("W006");
            expect(error.raw).toBe("Confusing minuses.");
            expect(error.evidence).toBe("var a = 3 - -3;");
            expect(error.line).toBe(1);
            expect(error.character).toBe(13);
            expect(error.scope).toBe("(main)");
            expect(error.reason).toBe("Confusing minuses.");
            console.log(JSON.stringify(JSHINT.errors[0]));
        });
    });
    describe("NaN", function () {
        it("...", function () {
            const response = JSHINT("var a = 2 === NaN;", {});
            expect(response).toBe(false);
            expect(JSHINT.errors.length).toBe(1);
            const error = JSHINT.errors[0];
            expect(error.id).toBe("(error)");
            expect(error.code).toBe("W019");
            expect(error.raw).toBe("Use the isNaN function to compare with NaN.");
            expect(error.evidence).toBe("var a = 2 === NaN;");
            expect(error.line).toBe(1);
            expect(error.character).toBe(11);
            expect(error.scope).toBe("(main)");
            expect(error.reason).toBe("Use the isNaN function to compare with NaN.");
            // console.log(JSON.stringify(JSHINT.errors[0]));
        });
    });
    describe("Numbers", function () {
        const code = [
            "var a = 10e307;",
            "var b = 10e308;",
            "var c = 0.03 + 0.3 + 3.0 + 30.00;",
            "var d = 03;",
            "var e = .3;",
            "var f = 0xAAg;",
            "var g = 0033;",
            "var h = 3.;",
            "var i = 3.7.toString();",
            "var j = 1e-10;", // GH-821
            "var k = 0o1234567;",
            "var l = 0b101;",
            "var m = 0x;",
            "var n = 09;",
            "var o = 1e-A;",
            "var p = 1/;",
            "var q = 1x;"
        ].join("\n");
        it("...", function () {
            const response = JSHINT(code, {});
            expect(response).toBe(false);
            expect(JSHINT.errors.length).toBe(20);
            const errors = JSHINT.errors;
            expectError(errors, 0, "W045", [2, 15], "Bad number '10e308'.", "var b = 10e308;");
            expectError(errors, 1, "W008", [5, 11], "A leading decimal point can be confused with a dot: '.3'.", "var e = .3;");
        });
    });
});
