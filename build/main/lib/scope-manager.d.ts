import { IState } from './state';
import { IToken } from './IToken';
/**
 * Creates a scope manager that handles variables and labels, storing usages
 * and resolving when variables are used and undefined
 */
export declare const scopeManager: (state: IState, predefined: any, exported: any, declared: any) => {
    on: (names: string, listener: Function) => void;
    isPredefined: (labelName: string) => boolean;
    stack: (type: string) => void;
    unstack: () => void;
    addParam: (labelName: string, token: IToken, type: string) => void;
    validateParams: () => void;
    getUsedOrDefinedGlobals: () => string[];
    getImpliedGlobals: () => any;
    getUnuseds: () => {
        name: string;
        line: number;
        character: number;
    }[];
    has: (labelName: string, unused?: any) => boolean;
    labeltype: (labelName: string) => any;
    addExported: (labelName: string) => void;
    setExported: (labelName: string, token: IToken) => void;
    addlabel: (labelName: string, opts: {
        type: string;
        token: IToken;
    }) => void;
    funct: {
        labeltype: (labelName: string, options?: {
            excludeCurrent?: boolean;
            excludeParams?: boolean;
            onlyBlockscoped?: boolean;
        }) => any;
        hasBreakLabel: (labelName: string) => boolean;
        has: (labelName: string, options?: {
            excludeCurrent?: boolean;
            excludeParams?: boolean;
            onlyBlockscoped?: boolean;
        }) => boolean;
        add: (labelName: string, type: string, tok: IToken, unused: any) => void;
    };
    block: {
        isGlobal: () => boolean;
        use: (labelName: string, token: IToken) => void;
        reassign: (labelName: string, token: IToken) => void;
        modify: (labelName: string, token: IToken) => void;
        add: (labelName: string, type: string, tok: IToken, unused: any) => void;
        addBreakLabel: (labelName: string, opts: {
            token: IToken;
        }) => void;
    };
};
