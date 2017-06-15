export declare class EventEmitter {
    _events: {
        [type: string]: any;
    };
    _maxListeners: number;
    constructor();
    setMaxListeners(n: number): this;
    emit(type: string, event: any, listener?: Function): boolean;
    on(type: string, listener: Function): this;
    once(type: string, listener: Function): this;
    off(type: string, listener: Function): this;
    removeAllListeners(type?: string): this;
    listeners(type: string): any;
    static defaultMaxListeners: number;
    static listenerCount(emitter: EventEmitter, type: string): number;
}
