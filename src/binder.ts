import { Instrumentation, PropertyCallType, valueFromPath, ABORT_ACTION } from './instrumentation'

export interface BinderDispatchCarrier {
    value: any
    abort?: boolean
}

export interface BinderDispatchDetail {
    binder: Binder
    carrier: BinderDispatchCarrier
    content: {
        dispatchedValue: any
        dispatchedOldValue: any
        value: any
        oldValue: any
        operation: DispatchOperation
        path: Array<any>
        match: DispatchMatch
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

    dispatch(carrier: BinderDispatchCarrier, oldValue: any, operation: DispatchOperation, path: Array<any>, match: DispatchMatch): any {
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
            let valueLocal = value
            let oldValueLocal = oldValue

            if (match === '<') {
                const templatePath = this.producerPropertyPath.slice(path.length)
                valueLocal = valueFromPath(value, templatePath, path)
                oldValueLocal = valueFromPath(oldValue, templatePath, path)
            } else if (match === '>') {
                valueLocal = valueFromPath(this.producerOwner, this.producerPropertyPath, path)
                oldValueLocal = undefined
            }

            const dispatchDetail: BinderDispatchDetail = {
                binder: this,
                carrier: carrier,
                content: {
                    dispatchedValue: value,
                    dispatchedOldValue: oldValue,
                    value: valueLocal,
                    oldValue: oldValueLocal,
                    operation: operation,
                    path: path,
                    match: match
                }
            }

            const savedBinderBinderDispatchDetail = _currentBinderDispatchDetail
            _currentBinderDispatchDetail = dispatchDetail

            try {
                if (this.consumerPropertyCallType === 'none') {
                    result = this.consumer(valueLocal, dispatchDetail)
                } else if (this.consumerPropertyCallType === 'function') {
                    if (this.producerPropertyCallTypeDetail[0] === 'function') {
                        result = this.consumer[this.consumerPropertyKey](...valueLocal)
                    } else {
                        result = this.consumer[this.consumerPropertyKey](valueLocal)
                    }
                } else {
                    if (this.producerPropertyCallTypeDetail[0] === 'function') {
                        this.consumer[this.consumerPropertyKey] = valueLocal instanceof Array ? (valueLocal.length > 0 ? valueLocal[0] : undefined) : valueLocal
                    } else {
                        this.consumer[this.consumerPropertyKey] = valueLocal
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