export declare class EventEmitter {
    _events: {
        [type: string]: any;
    };
    _maxListeners: number;
    constructor();
    setMaxListeners(n: number): this;
    emit(type: string, event: any, listener?: any): boolean;
    on(type: string, listener: any): this;
    once(type: any, listener: any): this;
    off(type: string, listener: any): this;
    removeAllListeners(type?: any): this;
    listeners(type: string): any;
    static defaultMaxListeners: number;
    static listenerCount(emitter: any, type: any): number;
}
