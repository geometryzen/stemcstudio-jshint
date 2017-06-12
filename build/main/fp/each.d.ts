/**
 * Executes a callback function for each key-value pair in a map.
 */
export declare function each<T>(obj: {
    [key: string]: T;
} | null, callback: (value: T, key: string) => any): void;
