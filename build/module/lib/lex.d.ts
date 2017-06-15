import { EventEmitter } from "./EventEmitter";
import { IToken } from './IToken';
export declare const Context: {
    Block: number;
    Template: number;
};
export interface ILexerContext {
    type?: number;
    prefix?: boolean;
    ignore?: boolean;
    implied?: string;
    inexport?: true;
}
export declare class Lexer {
    _lines: string[];
    emitter: EventEmitter;
    source: string | string[];
    prereg: boolean;
    line: number;
    char: number;
    from: number;
    input: string;
    inComment: boolean;
    private context;
    templateStarts: {
        line: number;
        char: number;
    }[];
    exhausted: boolean;
    ignoringLinterErrors: boolean;
    constructor(source: string | string[]);
    inContext(ctxType: number): boolean;
    private pushContext(ctxType);
    private popContext();
    private currentContext();
    getLines(): string[];
    setLines(val: string[]): void;
    peek(i?: number): string;
    skip(i?: number): void;
    on(names: string, listener: Function): void;
    /**
     * Trigger a token event.
     * All arguments will be passed to each listener.
     * TODO: Are `char` and `character` aliases?
     */
    private trigger(type, context);
    private triggerAsync(type, args, checks, fn);
    scanPunctuator(): IToken;
    scanComments(): IToken;
    scanKeyword(): IToken;
    scanIdentifier(): IToken;
    scanNumericLiteral(): IToken;
    private scanEscapeSequence(checks);
    private scanTemplateLiteral(checks);
    private scanStringLiteral(checks);
    scanRegExp(): IToken;
    scanNonBreakingSpaces(): number;
    scanUnsafeChars(): number;
    private next(checks);
    nextLine(): IToken;
    start(): void;
    token(): IToken;
}
