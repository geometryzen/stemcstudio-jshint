export interface Linter {
    on(name: string, callback: Function): void;
    getCache(name: string): boolean | string;
    setCache(name: string, value: string): void;
    getOption(name: string): boolean | string;
    warn(code: string, warning: {
        line: number;
        char: number;
        data?: string[];
    }): void;
}
export interface Data {
    name: string;
    line: number;
    char: number;
    from: number;
    quote: string;
    value: string;
}
export declare function register(linter: Linter): void;
