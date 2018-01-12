import { Instrumentation, PropertyCallType } from './instrumentation';
export interface BinderDispatchCarrier {
    value: any;
    oldValue: any;
    abort?: boolean;
    preventDefault?: boolean;
    onFinished?: (value: any, oldValue: any, result: any) => void;
}
export interface BinderDispatchDetail {
    binder: Binder;
    carrier: BinderDispatchCarrier;
    content: {
        value: any;
        oldValue: any;
        slicedValue: any;
        slicedOldValue: any;
        operation: DispatchOperation;
        path: Array<any>;
        match: DispatchMatch;
        changed: boolean;
    };
}
export declare type BinderConsumerType = (value: any, detai: BinderDispatchDetail) => any | any;
export declare type DispatchOperation = 'init' | 'call' | 'delete' | 'set' | 'push' | 'pop' | 'unshift' | 'shift' | 'clear';
export declare type DispatchMatch = '<' | '=' | '>';
export declare function currentBinderDispatchDetail(): any;
export declare function bypassNextBinderDispatch(): void;
export declare function abortNextBinderDispatch(): void;
export declare function checkAbortNextBinderDispatch(): boolean;
export declare function cleanAbortNextBinderDispatch(): void;
export declare class Binder {
    readonly producerInstrumentation: Instrumentation;
    readonly producer: any;
    readonly producerPropertyKey: any;
    readonly producerPropertyPath: Array<any>;
    readonly producerPropertyPathRegExp: RegExp;
    readonly producerPropertyCallTypeDetail: [PropertyCallType, any];
    readonly consumer: BinderConsumerType;
    readonly consumerPropertyKey: any;
    readonly consumerPropertyCallType: PropertyCallType;
    deep: boolean;
    active: boolean;
    _disposed: boolean;
    consumerInstrumentation: Instrumentation;
    constructor(producerInstrumentation: Instrumentation, producer: any, producerPropertyKey: any, producerPropertyPath: Array<any>, producerPropertyPathRegExp: RegExp, producerPropertyCallTypeDetail: [PropertyCallType, any], consumer: BinderConsumerType, consumerPropertyKey: any, consumerPropertyCallType: PropertyCallType, deep: boolean, active: boolean);
    readonly producerOwner: any;
    readonly consumerOwner: any;
    readonly disposed: boolean;
    dispatch(carrier: BinderDispatchCarrier, operation: DispatchOperation, path: Array<any>, match: DispatchMatch): any;
    dispose(): void;
}
