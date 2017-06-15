import { ILexerContext } from './lex';

export interface LeftDenotation {
    (this: IToken, left: IToken): any;
}

export interface NullDenotation {
    (): IToken;
}

export interface IToken {
    accessorType?: 'get' | 'set';
    allowNewLine?: boolean;
    arity?: string;
    assign?: boolean;
    base?: number;
    beginStmt?: any;
    /**
     * Duplicates beginStmt?
     */
    beginsStmt?: boolean;
    block?: boolean;
    body?: string;
    caseFallsThrough?: boolean;
    cases?: any[];
    char?: string;
    character?: number;
    check?: () => void;
    comment?: boolean;
    commentType?: number | string;
    context?: ILexerContext;
    delim?: boolean;
    depth?: number;
    destructAssign?: { id: string; token: IToken }[];
    exprs?: IToken[];
    exps?: boolean;
    first?: IToken | IToken[];
    flags?: string[];
    forgiveUndef?: boolean;
    from?: number;
    fud?: ((this: IToken, context?: ILexerContext) => IToken | void);
    heritage?: IToken;
    // id or identifier or both?
    id?: string;
    identifier?: boolean;
    ignoreUndef?: boolean;
    ignoreW020?: boolean;
    ignoreW021?: boolean;
    immed?: boolean;
    inBracelessBlock?: boolean;
    infix?: boolean;
    isFutureReservedWord?: boolean;
    isLegacy?: boolean;
    isMalformed?: boolean;
    isMetaProperty?: boolean;
    isMultiline?: boolean;
    isProperty?: boolean;
    isSpecial?: boolean;
    isUnclosed?: boolean;
    jump?: number;
    label?: string;
    labelled?: boolean;
    lbp?: number;
    led?: LeftDenotation;
    left?: IToken;
    line?: number;
    /**
     * Duplicates isMalformed?
     */
    malformed?: boolean;
    meta?: { es5?: boolean; isFutureReservedWord?: boolean; strictOnly?: boolean };
    name?: string;
    namedExpr?: boolean;
    noSubst?: boolean;
    nud?: NullDenotation;
    paren?: any;
    prereg?: boolean;
    quote?: "'" | '"';
    raw_text?: string;
    reach?: boolean;
    reserved?: boolean;
    right?: IToken;
    startChar?: number;
    startLine?: number;
    tail?: any;
    template?: any;
    text?: string;
    tokenLength?: number;
    type?: number | string;
    value?: string;
}
