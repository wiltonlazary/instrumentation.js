export declare const loggerObserver: {
    notify: (value: any, oldValue: any, operation: string, path: PropertyKey[]) => void;
};
export declare class ObjectProxyHandler<T extends object> implements ProxyHandler<T> {
    readonly backing: any;
    observer: any;
    propertyKey: PropertyKey;
    observerIsMap: boolean;
    proxyInstance: any;
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
    isArray: boolean;
    _handlers: any;
    readonly handlers: any;
    get(target: T, p: PropertyKey, receiver: any): any;
}
export declare class MapProxyHandlerEntriesIterator {
    readonly backingMap: any;
    readonly backing: any;
    readonly observer: any;
    constructor(backingMap: any, backing: any, observer: any);
    next(): any;
}
export declare class MapProxyHandlerValuesIterator {
    readonly backingMap: any;
    readonly backing: any;
    readonly observer: any;
    constructor(backingMap: any, backing: any, observer: any);
    next(): any;
}
export declare class MapProxyHandler<T extends object> extends ObjectProxyHandler<T> {
    isMap: boolean;
    _handlers: any;
    readonly handlers: any;
    get(target: T, p: PropertyKey, receiver: any): any;
}
