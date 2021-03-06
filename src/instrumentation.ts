import { Binder, BinderDispatchDetail, DispatchOperation, BinderConsumerType, BinderDispatchCarrier, checkAbortNextBinderDispatch, cleanAbortNextBinderDispatch } from './binder'
import { ObjectProxyHandler } from './proxy_handler'

export const ABORT_ACTION = { toString: () => 'ABORT_ACTION' }
export type PropertyCallType = 'none' | 'function' | 'setter' | 'writable'
export type PropertyCallTypeDetail = [PropertyCallType, any]

const prototypeInstrumented = new Map<any, Map<any, PropertyCallTypeDetail>>()
const propertyCallTypeFromPrototypeCache = new Map<any, Map<any, PropertyCallTypeDetail>>()
const binderInstrumented = new Map<any, Map<any, PropertyCallTypeDetail>>()

export type BindOutParamsType =
    Array<
    [string, (value: any, detail: BinderDispatchDetail) => any] |
    [string, (value: any, detail: BinderDispatchDetail) => any, boolean] |
    [string, any, any] |
    [string, any, any, boolean]
    > |
    [string, (value: any, detail: BinderDispatchDetail) => any] |
    [string, (value: any, detail: BinderDispatchDetail) => any, boolean] |
    [string, any, any] |
    [string, any, any, boolean]

export type BindInParamsType =
    Array<
    [any, string, (value: any, detail: BinderDispatchDetail) => any] |
    [any, string, (value: any, detail: BinderDispatchDetail) => any, boolean] |
    [any, string, any] |
    [any, string, any, boolean]
    > |
    [any, string, (value: any, detail: BinderDispatchDetail) => any] |
    [any, string, (value: any, detail: BinderDispatchDetail) => any, boolean] |
    [any, string, any] |
    [any, string, any, boolean]

export interface PropertyDescriptorPrototype {
    isPropertyDescriptorPrototype: boolean
    propertyKey: PropertyKey
    descriptor: PropertyDescriptor
    prototype: any
}

export function pathContains(path: Array<any>, contained: Array<any>): boolean {
    if (contained.length > path.length) {
        return false
    } else {
        for (let i = 0; i < contained.length; i++) {
            const pv = path[i]
            const ov = contained[i]

            if (pv !== '*' && ov !== '*' && pv != ov) {
                return false
            }
        }

        return true
    }
}

export function getHeadPrototype(prototype: any): any {
    let nextPrototype = prototype

    do {
        prototype = nextPrototype
        nextPrototype = Object.getPrototypeOf(prototype)
    } while (!!nextPrototype)

    return prototype
}

export function getHeadPrototypeFromInstance(instance: any): any {
    return getHeadPrototype(instance.constructor.prototype)
}

export function getPropertyDescriptorPrototype(prototype: any, propertyKey: PropertyKey): PropertyDescriptorPrototype {
    let nextPrototype = prototype
    let descriptor: any = null

    do {
        prototype = nextPrototype
        descriptor = Object.getOwnPropertyDescriptor(prototype, propertyKey)
        nextPrototype = Object.getPrototypeOf(prototype)
    } while (descriptor === undefined && !!nextPrototype)

    return descriptor === undefined ? undefined : {
        isPropertyDescriptorPrototype: true,
        propertyKey: propertyKey,
        descriptor: descriptor,
        prototype: prototype
    }
}

export function getPropertyDescriptorPrototypeFromInstance(instance: any, propertyKey: PropertyKey): PropertyDescriptorPrototype {
    return getPropertyDescriptorPrototype(instance.constructor.prototype, propertyKey)
}

export function getPropertyCallTypeFromPrototype(prototype, propertyKey: PropertyKey): PropertyCallTypeDetail {
    let result: PropertyCallTypeDetail = ['none', null]

    if (!propertyCallTypeFromPrototypeCache.has(prototype) || !propertyCallTypeFromPrototypeCache.get(prototype).has(propertyKey)) {
        let registeredMap: Map<any, PropertyCallTypeDetail> = propertyCallTypeFromPrototypeCache.get(prototype)

        if (!registeredMap) {
            registeredMap = new Map()
            propertyCallTypeFromPrototypeCache.set(prototype, registeredMap)
        }

        const propertyDescriptorPrototype = getPropertyDescriptorPrototype(prototype, propertyKey)

        if (propertyDescriptorPrototype !== undefined) {
            result = propertyDescriptorPrototype.descriptor.set !== undefined ?
                ['setter', propertyDescriptorPrototype.descriptor] : ['function', propertyDescriptorPrototype.descriptor]
        }

        registeredMap.set(propertyKey, result)
    } else {
        result = propertyCallTypeFromPrototypeCache.get(prototype).get(propertyKey) as any
    }

    return result
}

export function getPropertyCallTypeFromPrototypeFromInstance(instance, propertyKey: PropertyKey): PropertyCallTypeDetail {
    return getPropertyCallTypeFromPrototype(instance.constructor.prototype, propertyKey)
}

export function valueFromPath(object, templatePlate: Array<any>, path: Array<any>): any {
    if (object instanceof Object) {
        let current = object

        for (let i = 0; i < templatePlate.length; i++) {
            let key = templatePlate[i]

            if (key === '*' && path[i]) {
                key = path[i]
            }

            current = current[key]

            if (!(current instanceof Object)) {
                if (i < path.length - 1) {
                    current = undefined
                }

                break
            }
        }

        return current
    } else {
        return undefined
    }
}

export class Instrumentation extends Object {
    deepBy: Map<any, Set<Binder>> = null
    ownInstrumented: Map<any, PropertyCallTypeDetail> = null
    outBinders: Map<any, Set<Binder>> = null
    inBinders: Map<any, Set<Binder>> = null
    observedProxyHandlers: Map<ObjectProxyHandler<any>, any> = null

    constructor(public readonly owner: any) {
        super()
    }

    clear() {
        if (this.observedProxyHandlers !== null) {
            for (const proxyHandler of this.observedProxyHandlers.keys()) {
                proxyHandler.removeObserver(this)
            }
        }

        if (this.outBinders !== null) {
            for (const element of this.outBinders.values()) {
                for (const binder of element) {
                    binder.dispose()
                }

                element.clear()
            }
        }

        if (this.inBinders !== null) {
            for (const element of this.inBinders.values()) {
                for (const binder of element) {
                    binder.dispose()
                }

                element.clear()
            }
        }
    }

    dispose() {
        this.clear()
        super['dispose']()
    }

    registerObserved(proxyHandler: ObjectProxyHandler<any>, propertyKey: any) {
        if (this.observedProxyHandlers === null) {
            this.observedProxyHandlers = new Map()
        }

        this.observedProxyHandlers.set(proxyHandler, propertyKey)
    }

    unregisterObserved(proxyHandler: ObjectProxyHandler<any>, propertyKey: any) {
        this.observedProxyHandlers.delete(proxyHandler)

        if (this.observedProxyHandlers.size === 0) {
            this.observedProxyHandlers = null
        }
    }

    addDeepBy(binder: Binder) {
        if (!this.deepBy) {
            this.deepBy = new Map()
        }

        let binderSet = this.deepBy.get(binder.producerPropertyKey)

        if (!binderSet) {
            binderSet = new Set()
            this.deepBy.set(binder.producerPropertyKey, binderSet)
        }

        binderSet.add(binder)
    }

    removeDeepBy(binder: Binder) {
        let binderSet = this.deepBy.get(binder.producerPropertyKey)

        if (binderSet) {
            binderSet.delete(binder)

            if (binderSet.size === 0) {
                this.deepBy.delete(binder.producerPropertyKey)

                if (this.deepBy.size === 0) {
                    this.deepBy = null
                }
            }
        }
    }

    ensureIntrumentation(propertyKey: PropertyKey, instrumentPrototype: boolean = false): PropertyCallTypeDetail {
        const ownerPrototype = this.owner.constructor.prototype
        let result: PropertyCallTypeDetail = ['none', null]

        if (this.ownInstrumented !== null && this.ownInstrumented.has(propertyKey)) {
            result = this.ownInstrumented.get(propertyKey)
        } else if (!binderInstrumented.has(ownerPrototype) || !binderInstrumented.get(ownerPrototype).has(propertyKey)) {
            const ownPropertyDescriptor = Object.getOwnPropertyDescriptor(this.owner, propertyKey)

            if (ownPropertyDescriptor !== undefined) {
                result = this.instrumentOwn(propertyKey, ownPropertyDescriptor)
            } else if (instrumentPrototype) {
                let binderRegisteredMap: Map<any, PropertyCallTypeDetail> = binderInstrumented.get(ownerPrototype)

                if (!binderRegisteredMap) {
                    binderRegisteredMap = new Map()
                    binderInstrumented.set(ownerPrototype, binderRegisteredMap)
                }

                const propertyDescriptorPrototype = getPropertyDescriptorPrototype(ownerPrototype, propertyKey)

                if (!propertyDescriptorPrototype) {
                    throw new Error(`Property key not found on owner prototype: ${propertyKey}`)
                } else if (
                    !prototypeInstrumented.has(propertyDescriptorPrototype.prototype) ||
                    !prototypeInstrumented.get(propertyDescriptorPrototype.prototype).has(propertyKey)
                ) {
                    let prototypeRegisteredMap: Map<any, PropertyCallTypeDetail> = prototypeInstrumented.get(propertyDescriptorPrototype.prototype)

                    if (!prototypeRegisteredMap) {
                        prototypeRegisteredMap = new Map()
                        prototypeInstrumented.set(propertyDescriptorPrototype.prototype, prototypeRegisteredMap)
                    }

                    result = this.instrument(
                        propertyDescriptorPrototype.prototype,
                        propertyDescriptorPrototype.propertyKey,
                        propertyDescriptorPrototype.descriptor
                    )

                    prototypeRegisteredMap.set(propertyKey, result)
                } else {
                    result = prototypeInstrumented.get(propertyDescriptorPrototype.prototype).get(propertyKey) as any
                }

                binderRegisteredMap.set(propertyKey, result)
            } else {
                const propertyDescriptorPrototype = getPropertyDescriptorPrototype(ownerPrototype, propertyKey)

                if (!propertyDescriptorPrototype) {
                    throw new Error(`Property key not found on owner prototype: ${propertyKey}`)
                } else {
                    result = this.instrumentOwn(propertyKey, propertyDescriptorPrototype.descriptor)
                }
            }
        } else {
            result = binderInstrumented.get(ownerPrototype).get(propertyKey) as any
        }

        return result
    }

    instrument(target: any, propertyKey: PropertyKey, descriptor: PropertyDescriptor): PropertyCallTypeDetail {
        if (typeof descriptor.value === 'function') {
            const originalMethod = descriptor.value
            delete target[propertyKey]

            target[propertyKey] = function () {
                const value = arguments

                this.instrumentation.notify(
                    value, undefined, 'call', [propertyKey],
                    [(value) => { return originalMethod.apply(this, value) }, this]
                )
            }

            return ['function', originalMethod]
        } else if (descriptor.writable) {
            const originalDescriptor = descriptor

            Object.defineProperty(target, propertyKey, {
                get: function () { return originalDescriptor.value },
                set: function (value) {
                    const instrumentation = this.instrumentation
                    let oldValue = originalDescriptor.value
                    let newValue = value

                    if (value instanceof Object && instrumentation.deepBy && instrumentation.deepBy.has(propertyKey)) {
                        if (value.isProxy) {
                            const proxyHandler = value.proxyHandler

                            if (proxyHandler.observer !== instrumentation) {
                                proxyHandler.addObserver(instrumentation, propertyKey)
                            }
                        } else {
                            newValue = ObjectProxyHandler.create(value, instrumentation, propertyKey)
                        }
                    }

                    this.instrumentation.notify(
                        newValue, oldValue, 'set', [propertyKey],
                        [(value) => {
                            if (oldValue && oldValue.isProxy) {
                                oldValue.proxyHandler.removeObserver(instrumentation)
                            }

                            originalDescriptor.value = value
                        }, this]
                    )
                },
                enumerable: originalDescriptor.enumerable,
                configurable: originalDescriptor.configurable
            })

            return ['writable', originalDescriptor]
        } else if (descriptor.set !== undefined) {
            const originalDescriptor = descriptor

            Object.defineProperty(target, propertyKey, {
                get: originalDescriptor.get,
                set: function (value) {
                    const instrumentation = this.instrumentation
                    let oldValue = originalDescriptor.get.call(this)
                    let newValue = value

                    if (value instanceof Object && instrumentation.deepBy && instrumentation.deepBy.has(propertyKey)) {
                        if (value.isProxy) {
                            const ObjectProxyHandler = value.proxyHandler

                            if (ObjectProxyHandler.observer !== instrumentation) {
                                ObjectProxyHandler.addObserver(instrumentation, propertyKey)
                            }
                        } else {
                            newValue = ObjectProxyHandler.create(value, instrumentation, propertyKey)
                        }
                    }

                    this.instrumentation.notify(
                        newValue, oldValue, 'set', [propertyKey],
                        [(value) => {
                            if (oldValue && oldValue.isProxy) {
                                oldValue.proxyHandler.removeObserver(instrumentation)
                            }

                            originalDescriptor.set.call(this, value)
                        }, this]
                    )
                },
                enumerable: originalDescriptor.enumerable,
                configurable: originalDescriptor.configurable
            })

            return ['setter', originalDescriptor]
        } else {
            return ['none', null]
        }
    }

    instrumentOwn(
        propertyKey: PropertyKey,
        descriptor: PropertyDescriptor
    ): PropertyCallTypeDetail {
        if (this.ownInstrumented === null) {
            this.ownInstrumented = new Map()
        }

        const result = this.instrument(this.owner, propertyKey, descriptor)
        this.ownInstrumented.set(propertyKey, result)
        return result
    }

    bindOut(expression: string, consumer: any | ((any, Binder) => any), consumerPropertyKey?: any, active?: boolean): Binder {
        if (this.outBinders === null) {
            this.outBinders = new Map()
        }

        let init = false
        let expr = expression

        if (expr.startsWith('+')) {
            init = true
            expr = expr.substr(1)
        }

        let producerPropertyKey = expr
        let producerPropertyKeyPath = expr
        let producerPropertyKeyPathRegExp = null
        let deep = false

        if (expr.indexOf('/') >= 0) {
            deep = true
            const indexOfSep = expr.indexOf('/')
            producerPropertyKeyPath = expr.substring(0, indexOfSep)
            producerPropertyKey = producerPropertyKeyPath
            const regExpStr = expr.substr(indexOfSep + 1)
            const indexOfSecSep = regExpStr.indexOf('/')

            if (indexOfSecSep >= 0) {
                producerPropertyKeyPathRegExp = new RegExp(regExpStr.substring(0, indexOfSecSep), regExpStr.substr(indexOfSep + 1))
            } else {
                producerPropertyKeyPathRegExp = new RegExp(regExpStr)
            }
        }

        if (producerPropertyKey.indexOf('.') >= 0) {
            deep = true
            producerPropertyKey = producerPropertyKey.substring(0, producerPropertyKey.indexOf('.'))
        }

        const producerPropertyCallTypeDetail = this.ensureIntrumentation(producerPropertyKey)

        const binder = new Binder(
            this, this.owner, producerPropertyKey, producerPropertyKeyPath.split('.'), producerPropertyKeyPathRegExp,
            producerPropertyCallTypeDetail, consumer, consumerPropertyKey,
            !consumerPropertyKey ? 'none' : getPropertyCallTypeFromPrototypeFromInstance(consumer, consumerPropertyKey)[0],
            deep, active === undefined ? true : active
        )

        let bindersLocal = this.outBinders.get(producerPropertyKey)

        if (bindersLocal === undefined) {
            bindersLocal = new Set()
            this.outBinders.set(producerPropertyKey, bindersLocal)
        }

        bindersLocal.add(binder)

        if (consumerPropertyKey !== undefined && typeof consumer !== 'function') {
            consumer.instrumentation.bindIn(binder)
        }

        if (binder.deep) {
            this.addDeepBy(binder)

            switch (producerPropertyCallTypeDetail[0]) {
                case 'setter': {
                    const descriptor = producerPropertyCallTypeDetail[1]
                    const value = descriptor.get.call(this.owner)

                    if (value) {
                        if (value.isProxy) {
                            const objectProxyHandler = value.proxyHandler

                            if (objectProxyHandler.observer !== this) {
                                objectProxyHandler.addObserver(this, producerPropertyKey)
                            }
                        } else if (value instanceof Object) {
                            descriptor.set.call(this.owner, ObjectProxyHandler.create(value, this, producerPropertyKey))
                        } else {
                            descriptor.set.call(this.owner, value)
                        }
                    } else {
                        descriptor.set.call(this.owner, value)
                    }
                } break
                case 'writable': {
                    const descriptor = producerPropertyCallTypeDetail[1]
                    const value = descriptor.value

                    if (value) {
                        if (value.isProxy) {
                            const objectProxyHandler = value.proxyHandler

                            if (objectProxyHandler.observer !== this) {
                                objectProxyHandler.addObserver(this, producerPropertyKey)
                            }
                        } else if (value instanceof Object) {
                            descriptor.value = ObjectProxyHandler.create(value, this, producerPropertyKey)
                        } else {
                            descriptor.value = value
                        }
                    } else {
                        descriptor.value = value
                    }
                } break
            }
        }

        if (init) {
            binder.dispatch(
                {
                    value: this.owner[producerPropertyKey],
                    oldValue: undefined
                },
                'init', [producerPropertyKey],
                binder.producerPropertyPath.length === 1 ? '=' : '<'
            )
        }

        return binder
    }

    bindIn(binder: Binder): Binder {
        if (this.inBinders === null) {
            this.inBinders = new Map()
        }

        let bindersLocal = this.inBinders.get(binder.consumerPropertyKey)

        if (bindersLocal === undefined) {
            bindersLocal = new Set()
            this.inBinders.set(binder.consumerPropertyKey, bindersLocal)
        }

        bindersLocal.add(binder)
        binder.consumerInstrumentation = this
        return binder
    }

    unbindOut(binder: Binder) {
        const bindersLocal = this.outBinders.get(binder.producerPropertyKey)
        bindersLocal.delete(binder)

        if (bindersLocal.size === 0) {
            this.outBinders.delete(binder.producerPropertyKey)

            if (this.outBinders.size === 0) {
                this.outBinders = null
            }
        }

        if (binder.deep) {
            this.removeDeepBy(binder)
        }
    }

    unbindIn(binder: Binder) {
        const bindersLocal = this.inBinders.get(binder.consumerPropertyKey)
        bindersLocal.delete(binder)

        if (bindersLocal.size === 0) {
            this.inBinders.delete(binder.consumerPropertyKey)

            if (this.inBinders.size === 0) {
                this.inBinders = null
            }
        }
    }

    notify(value: any, oldValue: any, operation: DispatchOperation, path: Array<any>, execute?: [(value) => any, any]): any {
        if (checkAbortNextBinderDispatch()) {
            cleanAbortNextBinderDispatch()
        } else {
            const carrier: BinderDispatchCarrier = {
                value: value,
                oldValue: oldValue
            }

            let result: any = undefined

            if (this.outBinders !== null) {
                const propertyKey = path[0].toString()
                let abortAction = false
                const bindersByKey = this.outBinders.get(propertyKey)

                if (bindersByKey !== undefined) {
                    const pathStr = path.join('.')
                    const pathToMatch = path.slice(1).join('.')

                    for (const binder of bindersByKey) {
                        if (binder.active) {
                            if (pathContains(binder.producerPropertyPath, path)) {
                                if (
                                    binder.dispatch(
                                        carrier, operation, path,
                                        path.length === binder.producerPropertyPath.length ? '=' : '<'
                                    ) === ABORT_ACTION || carrier.abort
                                ) {
                                    abortAction = true
                                    break
                                }
                            } else if (
                                path.length > binder.producerPropertyPath.length &&
                                pathContains(path, binder.producerPropertyPath) &&
                                binder.producerPropertyPathRegExp &&
                                binder.producerPropertyPathRegExp.exec(path.slice(binder.producerPropertyPath.length).join('.'))
                            ) {
                                if (binder.dispatch(carrier, operation, path, '>') === ABORT_ACTION || carrier.abort) {
                                    abortAction = true
                                    break
                                }
                            }
                        }
                    }
                }

                if (!!execute && !abortAction && !carrier.abort && !carrier.preventDefault) {
                    result = execute[0].call(execute[1], carrier.value)
                } else {
                    result = undefined
                }
            } else if (!!execute) {
                result = execute[0].call(execute[1], carrier.value)
            }

            if (carrier.onFinished) {
                carrier.onFinished.call(this, carrier.value, carrier.oldValue, result)
            }

            return result
        }
    }
}
