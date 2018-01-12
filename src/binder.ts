import { Instrumentation, PropertyCallType, valueFromPath, ABORT_ACTION } from './instrumentation'

export interface BinderDispatchCarrier {
    value: any
    oldValue: any
    abort?: boolean
    preventDefault?: boolean
    onFinished?: (value: any, oldValue: any, result: any) => void
}

export interface BinderDispatchDetail {
    binder: Binder
    carrier: BinderDispatchCarrier
    content: {
        value: any
        oldValue: any
        slicedValue: any
        slicedOldValue: any
        operation: DispatchOperation
        path: Array<any>
        match: DispatchMatch
        changed: boolean
    }
}

let _currentBinderDispatchDetail: BinderDispatchDetail = null
let _bypassNextBinderDispatch = false
let _abortNextBinderDispatch = false

export type BinderConsumerType = (value: any, detai: BinderDispatchDetail) => any | any
export type DispatchOperation = 'init' | 'call' | 'delete' | 'set' | 'push' | 'pop' | 'unshift' | 'shift' | 'clear'
export type DispatchMatch = '<' | '=' | '>'

export function currentBinderDispatchDetail(): any {
    return _currentBinderDispatchDetail
}

export function bypassNextBinderDispatch() {
    _bypassNextBinderDispatch = true
}

export function abortNextBinderDispatch() {
    _abortNextBinderDispatch = true
}

export function checkAbortNextBinderDispatch(): boolean {
    return _abortNextBinderDispatch
}

export function cleanAbortNextBinderDispatch() {
    _abortNextBinderDispatch = false
}

export class Binder {
    _disposed = false
    consumerInstrumentation: Instrumentation = null

    constructor(
        public readonly producerInstrumentation: Instrumentation,
        public readonly producer: any,
        public readonly producerPropertyKey: any,
        public readonly producerPropertyPath: Array<any>,
        public readonly producerPropertyPathRegExp: RegExp,
        public readonly producerPropertyCallTypeDetail: [PropertyCallType, any],
        public readonly consumer: BinderConsumerType,
        public readonly consumerPropertyKey: any,
        public readonly consumerPropertyCallType: PropertyCallType,
        public deep: boolean,
        public active: boolean
    ) {
    }

    get producerOwner(): any {
        return this.producerInstrumentation.owner
    }

    get consumerOwner(): any {
        return !!this.consumerInstrumentation ? this.consumerInstrumentation.owner : null
    }

    get disposed(): boolean {
        return this._disposed
    }

    dispatch(carrier: BinderDispatchCarrier, operation: DispatchOperation, path: Array<any>, match: DispatchMatch): any {
        let result = undefined

        if (_abortNextBinderDispatch) {
            _abortNextBinderDispatch = false
            _bypassNextBinderDispatch = false
            result = ABORT_ACTION
        } else if (_bypassNextBinderDispatch) {
            _abortNextBinderDispatch = false
            _bypassNextBinderDispatch = false
        } else {
            const value = carrier.value
            const oldValue = carrier.oldValue
            let slicedValue = value
            let slicedOldValue = oldValue

            if (match === '<') {
                const templatePath = this.producerPropertyPath.slice(path.length)
                const basePath = path.slice(1)
                slicedValue = valueFromPath(value, templatePath, basePath)
                slicedOldValue = valueFromPath(oldValue, templatePath, basePath)
            } else if (match === '>') {
                slicedOldValue = valueFromPath(this.producerOwner, this.producerPropertyPath, path)
                
                //?is not possible to do a deep object clone and replace parts without compromises the immutability and relations?
                slicedValue = slicedOldValue 
            }

            const dispatchDetail: BinderDispatchDetail = {
                binder: this,
                carrier: carrier,
                content: {
                    value: value,
                    oldValue: oldValue,
                    slicedValue: slicedValue,
                    slicedOldValue: slicedOldValue,
                    operation: operation,
                    path: path,
                    match: match,
                    changed: value != oldValue
                }
            }

            const savedBinderBinderDispatchDetail = _currentBinderDispatchDetail
            _currentBinderDispatchDetail = dispatchDetail

            try {
                if (this.consumerPropertyCallType === 'none') {
                    result = this.consumer(slicedValue, dispatchDetail)
                } else if (this.consumerPropertyCallType === 'function') {
                    if (this.producerPropertyCallTypeDetail[0] === 'function') {
                        result = this.consumer[this.consumerPropertyKey](...slicedValue)
                    } else {
                        result = this.consumer[this.consumerPropertyKey](slicedValue)
                    }
                } else {
                    if (this.producerPropertyCallTypeDetail[0] === 'function') {
                        this.consumer[this.consumerPropertyKey] = slicedValue instanceof Array ? (slicedValue.length > 0 ? slicedValue[0] : undefined) : slicedValue
                    } else {
                        this.consumer[this.consumerPropertyKey] = slicedValue
                    }
                }
            } finally {
                _currentBinderDispatchDetail = savedBinderBinderDispatchDetail
            }
        }

        return result
    }

    dispose() {
        if (!this._disposed) {
            this._disposed = true
            this.producerInstrumentation.unbindOut(this)

            if (this.consumerInstrumentation !== null) {
                this.consumerInstrumentation.unbindIn(this)
            }
        }
    }
}