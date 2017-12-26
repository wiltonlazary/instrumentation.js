import { Instrumentation, PropertyCallType, valueFromPath } from './instrumentation'

export interface BinderDispatchDetail {
    binder: Binder
    content: {
        dispatchValue: any
        dispatchOldValue: any
        value: any
        oldValue: any
        operation: DispatchOperation
        path: Array<string>
        match: DispatchMatch
    }
}

let _currentBinderDispatchDetail: BinderDispatchDetail = null
let _bypassBinderDispatch = false

export type BinderConsumerType = (value: any, detai: BinderDispatchDetail) => any | any
export type DispatchOperation = 'call' | 'delete' | 'set' | 'push' | 'pop' | 'unshift' | 'shift'
export type DispatchMatch = '<' | '=' | '>'

export function currentBinderDispatchDetail(): any {
    return _currentBinderDispatchDetail
}

export function bypassBinderDispatch() {
    _bypassBinderDispatch = true
}

export class Binder {
    _disposed = false
    inInstrumentation: Instrumentation = null

    constructor(
        public readonly outInstrumentation: Instrumentation,
        public readonly producer: any,
        public readonly producerPropertyKey: string,
        public readonly producerPropertyPath: Array<string>,
        public readonly producerPropertyPathRegExp: RegExp,
        public readonly producerPropertyCallTypeDetail: [PropertyCallType, any],
        public readonly consumer: BinderConsumerType,
        public readonly consumerPropertyKey: string,
        public readonly consumerPropertyCallType: PropertyCallType,
        public deep: boolean,
        public active: boolean
    ) {
    }

    get outOwner(): any {
        return this.outInstrumentation.owner
    }

    get inOwner(): any {
        return !!this.inInstrumentation ? this.inInstrumentation.owner : null
    }

    get disposed(): boolean {
        return this._disposed
    }

    dispatch(value: any, oldValue: any, operation: DispatchOperation, path: Array<string>, match: DispatchMatch): any {
        let result = undefined

        if (_bypassBinderDispatch) {
            _bypassBinderDispatch = false
        } else {
            let valueLocal = value
            let oldValueLocal = oldValue

            if (match === '<') {
                const templatePath = this.producerPropertyPath.slice(path.length)
                valueLocal = valueFromPath(value, templatePath, path)
                oldValueLocal = valueFromPath(oldValue, templatePath, path)
            } else if (match === '>') {
                valueLocal = valueFromPath(this.outOwner, this.producerPropertyPath, path)
                oldValueLocal = undefined
            }

            const dispatchDetail: BinderDispatchDetail = {
                binder: this,
                content: {
                    dispatchValue: value,
                    dispatchOldValue: oldValue,
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
            this.outInstrumentation.unbindOut(this)

            if (this.inInstrumentation !== null) {
                this.inInstrumentation.unbindIn(this)
            }
        }
    }
}