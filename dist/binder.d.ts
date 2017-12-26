import { Instrumentation, PropertyCallType } from './instrumentation';
export interface BinderDispatchDetail {
    binder: Binder;
    content: {
        dispatchValue: any;
        dispatchOldValue: any;
        value: any;
        oldValue: any;
        operation: DispatchOperation;
        path: Array<string>;
        match: DispatchMatch;
    };
}
export declare type BinderConsumerType = (value: any, detai: BinderDispatchDetail) => any | any;
export declare type DispatchOperation = 'init' | 'call' | 'delete' | 'set' | 'push' | 'pop' | 'unshift' | 'shift' | 'clear';
export declare type DispatchMatch = '<' | '=' | '>';
export declare function currentBinderDispatchDetail(): any;
export declare function bypassNextBinderDispatch(): void;
export declare class Binder {
    readonly outInstrumentation: Instrumentation;
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
    inInstrumentation: Instrumentation;
    constructor(outInstrumentation: Instrumentation, producer: any, producerPropertyKey: any, producerPropertyPath: Array<any>, producerPropertyPathRegExp: RegExp, producerPropertyCallTypeDetail: [PropertyCallType, any], consumer: BinderConsumerType, consumerPropertyKey: any, consumerPropertyCallType: PropertyCallType, deep: boolean, active: boolean);
    readonly outOwner: any;
    readonly inOwner: any;
    readonly disposed: boolean;
    dispatch(value: any, oldValue: any, operation: DispatchOperation, path: Array<string>, match: DispatchMatch): any;
    dispose(): void;
}
