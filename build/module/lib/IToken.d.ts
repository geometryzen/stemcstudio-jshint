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
    assign?: any;
    base?: number;
    beginStmt?: any;
    /**
     * Duplicates beginStmt?
     */
    beginsStmt?: any;
    block?: any;
    body?: any;
    caseFallsThrough?: any;
    cases?: any[];
    char?: string;
    character?: any;
    check?: any;
    comment?: any;
    commentType?: number | string;
    context?: any;
    delim?: any;
    depth?: any;
    destructAssign?: {
        id: string;
        token: IToken;
    }[];
    exprs?: IToken[];
    exps?: boolean;
    first?: IToken | IToken[];
    flags?: string[];
    forgiveUndef?: boolean;
    from?: number;
    fud?: any;
    id?: string;
    identifier?: any;
    immed?: any;
    inBracelessBlock?: any;
    infix?: boolean;
    isFutureReservedWord?: boolean;
    isLegacy?: boolean;
    isMalformed?: boolean;
    isMetaProperty?: any;
    isMultiline?: boolean;
    isProperty?: boolean;
    isSpecial?: any;
    isUnclosed?: any;
    jump?: number;
    label?: any;
    labelled?: any;
    lbp?: number;
    led?: LeftDenotation;
    left?: IToken;
    line?: any;
    /**
     * Duplicates isMalformed?
     */
    malformed?: boolean;
    meta?: any;
    name?: string;
    namedExpr?: boolean;
    noSubst?: boolean;
    nud?: NullDenotation;
    paren?: any;
    prereg?: boolean;
    quote?: "'" | '"';
    reach?: any;
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
