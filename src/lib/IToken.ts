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
    assign?;
    base?: number;
    beginStmt?;
    /**
     * Duplicates beginStmt?
     */
    beginsStmt?;
    block?;
    body?;
    caseFallsThrough?;
    cases?: any[];
    char?: string;
    character?;
    check?;
    comment?;
    commentType?: number | string;
    context?;
    delim?;
    depth?;
    destructAssign?: { id: string; token: IToken }[];
    exprs?: IToken[];
    exps?: boolean;
    first?: IToken | IToken[];
    flags?: string[];
    forgiveUndef?: boolean;
    from?: number;
    fud?;
    // id or identifier or both?
    id?: string;
    identifier?;
    immed?;
    inBracelessBlock?;
    infix?: boolean;
    isFutureReservedWord?: boolean;
    isLegacy?: boolean;
    isMalformed?: boolean;
    isMetaProperty?;
    isMultiline?: boolean;
    isProperty?: boolean;
    isSpecial?;
    isUnclosed?;
    jump?: number;
    label?;
    labelled?;
    lbp?: number;
    led?: LeftDenotation;
    left?: IToken;
    line?;
    /**
     * Duplicates isMalformed?
     */
    malformed?: boolean;
    meta?;
    name?: string;
    namedExpr?: boolean;
    noSubst?: boolean;
    nud?: NullDenotation;
    paren?: any;
    prereg?: boolean;
    quote?: "'" | '"';
    reach?;
    reserved?: boolean;
    right?: IToken;
    startChar?: number;
    startLine?: number;
    tail?;
    template?;
    text?: string;
    tokenLength?: number;
    type?: number | string;
    value?: string;
}
