export declare const loggerObserver: {
    notify: (value: any, oldValue: any, operation: string, path: PropertyKey[]) => void;
};
export declare class ObjectProxyHandler<T extends object> implements ProxyHandler<T> {
    readonly backing: any;
    observer: any;
    propertyKey: PropertyKey;
    observerIsMap: boolean;
    static create(backing: any, observer?: any, propertyKey?: PropertyKey): any;
    constructor(backing: any, observer: any, propertyKey: PropertyKey);
    readonly isProxyHandler: boolean;
    addObserver(observer: any, propertyKey: PropertyKey): void;
    removeObserver(observer: any): void;
    notify(value: any, oldValue: any, operation: string, path: Array<PropertyKey>): void;
    get(target: T, p: PropertyKey, receiver: any): any;
    set(target: T, p: PropertyKey, value: any, receiver: any): boolean;
    deleteProperty(target: T, p: PropertyKey): boolean;
}
export declare class ArrayProxyHandler<T extends object> extends ObjectProxyHandler<T> {
    _handlers: any;
    readonly handlers: any;
    get(target: T, p: PropertyKey, receiver: any): any;
}
export declare class MapProxyHandler<T extends object> extends ObjectProxyHandler<T> {
    _handlers: any;
    readonly handlers: any;
    get(target: T, p: PropertyKey, receiver: any): any;
}
