import { Binder, BinderDispatchDetail, DispatchOperation } from './binder';
import { ObjectProxyHandler } from './proxy_handler';
export declare const ABORT_ACTION: {
    toString: () => string;
};
export declare type PropertyCallType = 'none' | 'function' | 'setter' | 'writable';
export declare type PropertyCallTypeDetail = [PropertyCallType, any];
export declare type BindOutParamsType = Array<[string, (value: any, detail: BinderDispatchDetail) => any] | [string, (value: any, detail: BinderDispatchDetail) => any, boolean] | [string, any, any] | [string, any, any, boolean]> | [string, (value: any, detail: BinderDispatchDetail) => any] | [string, (value: any, detail: BinderDispatchDetail) => any, boolean] | [string, any, any] | [string, any, any, boolean];
export declare type BindInParamsType = Array<[any, string, (value: any, detail: BinderDispatchDetail) => any] | [any, string, (value: any, detail: BinderDispatchDetail) => any, boolean] | [any, string, any] | [any, string, any, boolean]> | [any, string, (value: any, detail: BinderDispatchDetail) => any] | [any, string, (value: any, detail: BinderDispatchDetail) => any, boolean] | [any, string, any] | [any, string, any, boolean];
export interface PropertyDescriptorPrototype {
    isPropertyDescriptorPrototype: boolean;
    propertyKey: PropertyKey;
    descriptor: PropertyDescriptor;
    prototype: any;
}
export declare function pathContains(path: Array<any>, contained: Array<any>): boolean;
export declare function getHeadPrototype(prototype: any): any;
export declare function getHeadPrototypeFromInstance(instance: any): any;
export declare function getPropertyDescriptorPrototype(prototype: any, propertyKey: PropertyKey): PropertyDescriptorPrototype;
export declare function getPropertyDescriptorPrototypeFromInstance(instance: any, propertyKey: PropertyKey): PropertyDescriptorPrototype;
export declare function getPropertyCallTypeFromPrototype(prototype: any, propertyKey: PropertyKey): PropertyCallTypeDetail;
export declare function getPropertyCallTypeFromPrototypeFromInstance(instance: any, propertyKey: PropertyKey): PropertyCallTypeDetail;
export declare function valueFromPath(object: any, templatePlate: Array<any>, path: Array<any>): any;
export declare class Instrumentation extends Object {
    readonly owner: any;
    deepBy: Map<any, Set<Binder>>;
    ownInstrumented: Map<any, PropertyCallTypeDetail>;
    outBinders: Map<any, Set<Binder>>;
    inBinders: Map<any, Set<Binder>>;
    observedProxyHandlers: Map<ObjectProxyHandler<any>, any>;
    constructor(owner: any);
    clear(): void;
    dispose(): void;
    registerObserved(proxyHandler: ObjectProxyHandler<any>, propertyKey: any): void;
    unregisterObserved(proxyHandler: ObjectProxyHandler<any>, propertyKey: any): void;
    addDeepBy(binder: Binder): void;
    removeDeepBy(binder: Binder): void;
    ensureIntrumentation(propertyKey: PropertyKey, instrumentPrototype?: boolean): PropertyCallTypeDetail;
    instrument(target: any, propertyKey: PropertyKey, descriptor: PropertyDescriptor): PropertyCallTypeDetail;
    instrumentOwn(propertyKey: PropertyKey, descriptor: PropertyDescriptor): PropertyCallTypeDetail;
    bindOut(expression: string, consumer: any | ((any, Binder) => any), consumerPropertyKey?: any, active?: boolean): Binder;
    bindIn(binder: Binder): Binder;
    unbindOut(binder: Binder): void;
    unbindIn(binder: Binder): void;
    notify(value: any, oldValue: any, operation: DispatchOperation, path: Array<any>, execute?: [(value) => any, any]): any;
}
