export declare const loggerObserver: {
    notify: (value: any, oldValue: any, operation: string, path: PropertyKey[]) => void;
};
export declare class ObjectProxyHandler<T extends object> extends Object implements ProxyHandler<T> {
    readonly backing: any;
    observerIsMap: boolean;
    proxyInstance: any;
    observer: any;
    propertyKey: any;
    static create(backing: any, observer?: any, propertyKey?: any): any;
    constructor(backing: any, observer: any, propertyKey: any);
    readonly isProxyHandler: boolean;
    clear(): void;
    dispose(): void;
    addObserver(observer: any, propertyKey: any): void;
    removeObserver(observer: any): void;
    registerObserved(proxyHandler: ObjectProxyHandler<any>, propertyKey: any): void;
    unregisterObserved(proxyHandler: ObjectProxyHandler<any>, propertyKey: any): void;
    notify(value: any, oldValue: any, operation: string, path: Array<any>): void;
    get(target: T, p: PropertyKey, receiver: any): any;
    set(target: T, p: PropertyKey, value: any, receiver: any): boolean;
    deleteProperty(target: T, p: PropertyKey): boolean;
}
export declare class ArrayProxyHandler extends ObjectProxyHandler<Array<any>> {
    isArray: boolean;
    _handlers: any;
    readonly handlers: any;
    get(target: Array<any>, p: PropertyKey, receiver: any): any;
    set(target: Array<any>, p: PropertyKey, value: any, receiver: any): boolean;
}
export declare class MapProxyHandlerEntriesIterator implements Iterable<[any, any]> {
    readonly backingMap: any;
    readonly backing: any;
    readonly observer: any;
    constructor(backingMap: any, backing: any, observer: any);
    [Symbol.iterator](): IterableIterator<[any, any]>;
    next(value?: any): IteratorResult<[any, any]>;
}
export declare class MapProxyHandlerValuesIterator implements Iterable<any> {
    readonly backingMap: any;
    readonly backing: any;
    readonly observer: any;
    constructor(backingMap: any, backing: any, observer: any);
    [Symbol.iterator](): IterableIterator<any>;
    next(value?: any): IteratorResult<any>;
}
export declare class MapProxyHandler extends ObjectProxyHandler<Map<any, any>> {
    isMap: boolean;
    _handlers: any;
    readonly handlers: any;
    get(target: Map<any, any>, p: PropertyKey, receiver: any): any;
}
