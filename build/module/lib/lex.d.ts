import { EventEmitter } from "./EventEmitter";
import { IToken } from './IToken';
export declare const Context: {
    Block: number;
    Template: number;
};
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
    on(names: string, listener: any): void;
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
    scanEscapeSequence(checks: any): IToken;
    scanTemplateLiteral(checks: any): IToken;
    scanStringLiteral(checks: any): IToken;
    scanRegExp(): IToken;
    scanNonBreakingSpaces(): IToken;
    scanUnsafeChars(): IToken;
    next(checks: any): IToken;
    nextLine(): IToken;
    start(): void;
    token(): IToken;
}
