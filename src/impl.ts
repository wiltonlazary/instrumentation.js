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

function defineObjectMethod(name: string, value: any) {
    Object.defineProperty(Object.prototype, name, {
        enumerable: false,
        configurable: false,
        value: value
    })
}

defineObjectMethod('dispose', function () {
    if (this.isProxy) {
        this.proxyHandler.dispose()
    }

    if (this.__instrumentation !== undefined) {
        this.__instrumentation.dispose()
        this.__instrumentation = undefined
    }
})

defineObjectMethod('bindOut', function (...params): Binder | Array<Binder> {
    const instrumentation = this.instrumentation
    let result = null

    if (params.length === 1) {
        const arr = params[0]
        result = []

        if (arr.length > 0) {
            if (arr[0] instanceof Array) {
                arr.forEach((element) => {
                    if (element.length === 2) {
                        result.push(instrumentation.bindOut(element[0], element[1]))
                    } if (element.length === 3) {
                        if (typeof element[1] === 'function') {
                            result.push(instrumentation.bindOut(element[0], element[1], undefined, element[2]))
                        } else {
                            result.push(instrumentation.bindOut(element[0], element[1], element[2]))
                        }
                    } else if (element.length === 4) {
                        result.push(instrumentation.bindOut(element[0], element[1], element[2], element[3]))
                    }
                })
            } else {
                result.push(instrumentation.bindOut(arr[0], arr[1], arr[2], arr[3]))
            }
        }
    } else if (params.length > 1) {
        result = instrumentation.bindOut(params[0], params[1], params[2], params[3])
    }

    return result
})

function bindInProcessor(self: any, element: Array<any>, storage?: Array<any>): Binder {
    let result: Binder = undefined

    if (element.length === 3) {
        if (typeof element[2] === 'function') {
            result = element[0].bindOut(element[1], element[2])
        } else {
            result = element[0].bindOut(element[1], self, element[2])
        }
    } else if (element.length === 4) {
        if (typeof element[2] === 'function') {
            result = element[0].bindOut(element[1], element[2], undefined, element[3])
        } else {
            result = element[0].bindOut(element[1], self, element[2], element[3])
        }
    }

    if (storage && result) {
        storage.push(result)
    }

    return result
}

defineObjectMethod('bindIn', function (...params): Binder | Array<Binder> {
    let result = null

    if (params.length === 1) {
        const arr = params[0]
        result = []

        if (arr.length > 0) {
            if (arr[0] instanceof Array) {
                arr.forEach((element) => {
                    bindInProcessor(this, element, result)
                })
            } else {
                bindInProcessor(this, arr, result)
            }
        }
    } else if (params.length > 1) {
        result = bindInProcessor(this, params)
    }

    return this
})

defineObjectMethod('toProxy', function (): any {
    if (this.isProxy) {
        return this
    } else {
        return ObjectProxyHandler.create(this)
    }
})

defineObjectMethod('toJson', function (): string {
    return JSON.stringify(this)
})
