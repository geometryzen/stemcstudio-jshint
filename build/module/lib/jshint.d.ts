import { JSHintOptions } from './JSHintOptions';
import { JSHintError } from './JSHintError';
export interface IJSHINT {
    (s: string, o: JSHintOptions, g?: any): boolean;
    errors: JSHintError[];
    /**
     * I don't think this is being used.
     */
    undefs: any[];
    internals: {
        id: string;
        elem: string;
        value: any;
    }[];
    blacklist: {
        [key: string]: string;
    };
    scope: string;
    addModule(func: Function): void;
    data: Function;
}
/**
 * The actual JSHINT function itself.
 */
export declare const JSHINT: IJSHINT;
