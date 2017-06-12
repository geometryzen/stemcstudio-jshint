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
    char?: string;
    character?: any;
    check?: any;
    comment?: any;
    commentType?: number | string;
    context?: any;
    delim?: any;
    depth?: any;
    exps?: boolean;
    first?: IToken;
    flags?: string[];
    forgiveUndef?: boolean;
    from?: number;
    fud?: any;
    id?: string;
    identifier?: any;
    immed?: any;
    inBracelessBlock?: any;
    infix?: boolean;
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
    lbp?: any;
    led?: any;
    left?: any;
    line?: any;
    /**
     * Duplicates isMalformed?
     */
    malformed?: boolean;
    meta?: any;
    nud?: any;
    quote?: "'" | '"';
    reach?: any;
    reserved?: boolean;
    startChar?: number;
    startLine?: number;
    tail?: any;
    template?: any;
    text?: string;
    tokenLength?: number;
    type?: number | string;
    value?: string;
}
