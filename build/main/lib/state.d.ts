import { NameStack } from "./name-stack";
import { IToken } from './IToken';
import { JSHintOptions } from "./JSHintOptions";
export interface IState {
    option: JSHintOptions;
    cache: {};
    condition: boolean;
    directive: {
        [name: string]: boolean;
    };
    esVersion: number;
    funct: any;
    ignored: {
        [line: string]: boolean;
    };
    tab: string;
    lines: string[];
    syntax: {
        [name: string]: IToken;
    };
    forinifcheckneeded: boolean;
    forinifchecks: any[];
    isStrict(): boolean;
    stmtMissingStrict(): boolean;
    allowsGlobalUsd(): boolean;
    impliedClosure(): boolean;
    inMoz(): boolean;
    inES6(strict?: boolean): boolean;
    inES5(strict?: boolean): boolean;
    inClassBody: boolean;
    ignoredLines: {
        [line: number]: boolean;
    };
    jsonMode: boolean;
    jsonWarnings: any[];
    nameStack: NameStack;
    inferEsVersion(): string | null;
    reset(): void;
    tokens: {
        prev: IToken;
        next: IToken;
        curr: IToken;
    };
}
export declare const state: IState;
