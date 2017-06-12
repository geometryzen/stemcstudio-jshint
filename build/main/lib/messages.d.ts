export interface CodeAndDesc {
    code: string;
    desc: string;
}
export declare const errors: {
    [code: string]: CodeAndDesc;
};
export declare const warnings: {
    [code: string]: CodeAndDesc;
};
export declare const info: {
    [code: string]: CodeAndDesc;
};
