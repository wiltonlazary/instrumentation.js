import { ObjectProxyHandler } from './proxy_handler';
import { BinderConsumerType, Binder, currentBinderDispatchDetail, bypassNextBinderDispatch, abortNextBinderDispatch } from './binder'

import {
    BindInParamsType, BindOutParamsType, getHeadPrototype, getHeadPrototypeFromInstance,
    getPropertyDescriptorPrototype, getPropertyDescriptorPrototypeFromInstance, Instrumentation, ABORT_ACTION
} from './instrumentation'

declare const global: any

if (!global) {
    if (self) {
        self['global'] = self
    } else {
        window['global'] = window
    }
}

global.ABORT_ACTION = ABORT_ACTION
global.ObjectProxyHandler = ObjectProxyHandler
global.abortNextBinderDispatch = abortNextBinderDispatch
global.bypassNextBinderDispatch = bypassNextBinderDispatch
global.currentBinderDispatchDetail = currentBinderDispatchDetail
global.getHeadPrototype = getHeadPrototype
global.getHeadPrototypeFromInstance = getHeadPrototypeFromInstance
global.getPropertyDescriptorPrototype = getPropertyDescriptorPrototype
global.getPropertyDescriptorPrototypeFromInstance = getPropertyDescriptorPrototypeFromInstance

if (Object.getOwnPropertyDescriptor(Object.prototype, 'instrumentation') === undefined) {
    Object.defineProperty(Object.prototype, 'instrumentation', {
        enumerable: false,
        configurable: false,
        get: function () {
            if (Object.getOwnPropertyDescriptor(this, '__instrumentation') === undefined) {
                let __instrumentation = new Instrumentation(this)

                Object.defineProperty(this, '__instrumentation', {
                    enumerable: false,
                    configurable: false,
                    get: function () {
                        return __instrumentation
                    },
                    set: function (value) {
                        __instrumentation = value
                    }
                })
            }

            return this.__instrumentation
        },
        set: function (value) {
            this.__instrumentation = value
        }
    })
}

Object.prototype['dispose'] = function () {
    if (this.isProxy) {
        this.proxyHandler.dispose()
    }

    if (this.__instrumentation !== undefined) {
        this.__instrumentation.dispose()
        this.__instrumentation = undefined
    }
}

Object.prototype['bind'] = function (expression: string, consumer: BinderConsumerType, consumerPropertyKey?: any, active?: boolean): Binder {
    return this.instrumentation.bindOut(expression, consumer, consumerPropertyKey, active)
}

Object.prototype['bindOut'] = function (params: BindOutParamsType): any {
    params.forEach(element => {
        if (element.length === 2) {
            this.bind(element[0], element[1])
        } if (element.length === 3) {
            if (typeof element[1] === 'function') {
                this.bind(element[0], element[1], undefined, element[2])
            } else {
                this.bind(element[0], element[1], element[2])
            }
        } else if (element.length === 4) {
            this.bind(element[0], element[1], element[2], element[3])
        }
    })

    return this
}

Object.prototype['bindIn'] = function (params: BindInParamsType): any {
    params.forEach(element => {
        if (element.length === 3) {
            if (typeof element[2] === 'function') {
                element[0].bind(element[1], element[2])
            } else {
                element[0].bind(element[1], this, element[2])
            }
        } else if (element.length === 4) {
            if (typeof element[2] === 'function') {
                element[0].bind(element[1], element[2], undefined, element[3])
            } else {
                element[0].bind(element[1], this, element[2], element[3])
            }
        }
    })

    params.forEach(element => {
        if (typeof element[2] === 'function') {
            element[0].bind(element[1], element[2])
        } else {
            element[0].bind(element[1], this, element[2])
        }
    })

    return this
}

Object.prototype['toProxy'] = function (): any {
    if (this.isProxy) {
        return this
    } else {
        return ObjectProxyHandler.create(this)
    }
}