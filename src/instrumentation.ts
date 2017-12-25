import { Binder, BinderDispatchDetail, DispatchOperation, BinderConsumerType } from './binder'
import { ProxyHandler } from './proxy_handler'

export type PropertyCallTypeDetail = [PropertyCallType, any]

const prototypeInstrumented = new Map<any, Map<any, PropertyCallTypeDetail>>()
const propertyCallTypeFromPrototypeCache = new Map<any, Map<any, PropertyCallTypeDetail>>()
const binderInstrumented = new Map<any, Map<any, PropertyCallTypeDetail>>()

export const ABORT_ACTION = { toString: () => 'ABORT_ACTION' }

export type PropertyCallType = 'none' | 'function' | 'setter' | 'ownSetter'

export type BindOutParamsType = Array<
    [string, (value: any, detai: BinderDispatchDetail) => any] |
    [string, (value: any, detai: BinderDispatchDetail) => any, boolean] |
    [string, any, string] |
    [string, any, string, boolean]
    >

export type BindInParamsType = Array<
    [any, string, (value: any, detai: BinderDispatchDetail) => any] |
    [any, string, (value: any, detai: BinderDispatchDetail) => any, boolean] |
    [any, string, string] |
    [any, string, string, boolean]
    >

export interface PropertyDescriptorPrototype {
    propertyKey: string
    descriptor: PropertyDescriptor
    prototype: any
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

export function getPropertyDescriptorPrototype(prototype: any, propertyKey: string): PropertyDescriptorPrototype {
    let nextPrototype = prototype
    let descriptor: any = null

    do {
        prototype = nextPrototype
        descriptor = Object.getOwnPropertyDescriptor(prototype, propertyKey)
        nextPrototype = Object.getPrototypeOf(prototype)
    } while (descriptor === undefined && !!nextPrototype)

    return descriptor === undefined ? undefined : {
        propertyKey: propertyKey,
        descriptor: descriptor,
        prototype: prototype
    }
}

export function getPropertyDescriptorPrototypeFromInstance(instance: any, propertyKey: string): PropertyDescriptorPrototype {
    return getPropertyDescriptorPrototype(instance.constructor.prototype, propertyKey)
}

export function getPropertyCallTypeFromPrototype(prototype, propertyKey: string): PropertyCallTypeDetail {
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

export function getPropertyCallTypeFromPrototypeFromInstance(instance, propertyKey: string): PropertyCallTypeDetail {
    return getPropertyCallTypeFromPrototype(instance.constructor.prototype, propertyKey)
}

export function valueFromPath(object, path: Array<string>): any {
    if (object instanceof Object) {
        let current = object
        let index = 0

        for (const element of path) {
            const test = object//Test
            current = current[element]

            if (!(current instanceof Object)) {
                if (index < path.length - 1) {
                    current = undefined
                }

                break
            }

            index += 1
        }

        return current
    } else {
        return undefined
    }
}

export class Instrumentation {
    deepBy: Map<string, Set<Binder>> = null
    ownInstrumented: Map<string, PropertyCallTypeDetail> = null
    outBinders: Map<string, Set<Binder>> = null
    inBinders: Map<string, Set<Binder>> = null

    constructor(
        public readonly owner: any
    ) {

    }

    clear() {
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

    defineOwnProperty(propertyKey: string): [PropertyCallType, PropertyDescriptor] {
        let backingProperty = this.owner[propertyKey]
        delete this.owner[propertyKey]

        const backingPropertyDescriptor: PropertyDescriptor = {
            get: function () {
                return backingProperty
            },
            set: function (value) {
                backingProperty = value
            },
            enumerable: false,
            configurable: false
        }

        Object.defineProperty(this.owner, propertyKey, {
            get: function () {
                return backingProperty
            },
            set: function (value) {
                const instrumentation = this.instrumentation
                let newValue = value

                if (value instanceof Object && instrumentation.deepBy && instrumentation.deepBy.has(propertyKey)) {
                    if (value.isProxy) {
                        const proxyHandler = value.proxyHandler

                        if (proxyHandler.observer !== instrumentation) {
                            proxyHandler.addObserver(instrumentation, propertyKey)
                        }
                    } else {
                        newValue = ProxyHandler.create(value, instrumentation, propertyKey)
                    }
                }

                this.instrumentation.notify(
                    newValue, backingProperty, 'set', [propertyKey],
                    [(value) => {
                        if (backingProperty && backingProperty.isProxy) {
                            backingProperty.proxyHandler.removeObserver(instrumentation)
                        }

                        backingProperty = value
                    }, this]
                )
            },
            enumerable: true,
            configurable: false
        })

        return ['ownSetter', backingPropertyDescriptor]
    }

    ensureIntrumentation(propertyKey: string): PropertyCallTypeDetail {
        const ownerPrototype = this.owner.constructor.prototype
        let result: PropertyCallTypeDetail = ['none', null]

        if (this.ownInstrumented !== null && this.ownInstrumented.has(propertyKey)) {
            result = this.ownInstrumented.get(propertyKey)
        } else if (!binderInstrumented.has(ownerPrototype) || !binderInstrumented.get(ownerPrototype).has(propertyKey)) {
            if (Object.getOwnPropertyDescriptor(this.owner, propertyKey) !== undefined) {
                result = this.defineOwnProperty(propertyKey)

                if (this.ownInstrumented === null) {
                    this.ownInstrumented = new Map()
                }

                this.ownInstrumented.set(propertyKey, result)
            } else {
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

                    result = this.observed(propertyDescriptorPrototype)
                    prototypeRegisteredMap.set(propertyKey, result)
                } else {
                    result = prototypeInstrumented.get(propertyDescriptorPrototype.prototype).get(propertyKey) as any
                }

                binderRegisteredMap.set(propertyKey, result)
            }
        } else {
            result = binderInstrumented.get(ownerPrototype).get(propertyKey) as any
        }

        return result
    }

    observed(propertyDescriptorPrototype: PropertyDescriptorPrototype): PropertyCallTypeDetail {
        if (typeof propertyDescriptorPrototype.descriptor.value === 'function') {
            const originalMethod = propertyDescriptorPrototype.descriptor.value
            delete propertyDescriptorPrototype.prototype[propertyDescriptorPrototype.propertyKey]

            propertyDescriptorPrototype.prototype[propertyDescriptorPrototype.propertyKey] = function () {
                const value = arguments

                this.instrumentation.notify(
                    value, undefined, 'call', [propertyDescriptorPrototype.propertyKey],
                    [(value) => { return originalMethod.apply(this, value) }, this]
                )
            }

            return ['function', originalMethod]
        } else if (propertyDescriptorPrototype.descriptor.set !== undefined) {
            const originalDescriptor = propertyDescriptorPrototype.descriptor

            Object.defineProperty(propertyDescriptorPrototype.prototype, propertyDescriptorPrototype.propertyKey, {
                get: originalDescriptor.get,
                set: function (value) {
                    const instrumentation = this.instrumentation
                    let oldValue = originalDescriptor.get.call(this)
                    let newValue = value

                    if (value instanceof Object && instrumentation.deepBy && instrumentation.deepBy.has(propertyDescriptorPrototype.propertyKey)) {
                        if (value.isProxy) {
                            const proxyHandler = value.proxyHandler

                            if (proxyHandler.observer !== instrumentation) {
                                proxyHandler.addObserver(instrumentation, propertyDescriptorPrototype.propertyKey)
                            }
                        } else {
                            newValue = ProxyHandler.create(value, instrumentation, propertyDescriptorPrototype.propertyKey)
                        }
                    }

                    this.instrumentation.notify(
                        newValue, oldValue, 'set', [propertyDescriptorPrototype.propertyKey],
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

    bindOut(key: string, consumer: any | ((any, Binder) => any), consumerPropertyKey?: string, active?: boolean): Binder {
        if (this.outBinders === null) {
            this.outBinders = new Map()
        }

        let producerPropertyKey = key
        let producerPropertyKeyPath = key
        let producerPropertyKeyPathRegExp = null
        let deep = false

        if (key.indexOf('/') >= 0) {
            deep = true
            const indexOfSep = key.indexOf('/')
            producerPropertyKeyPath = key.substring(0, indexOfSep)
            producerPropertyKey = producerPropertyKeyPath
            const regExpStr = key.substr(indexOfSep + 1)
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
            this, this.owner, producerPropertyKey, producerPropertyKeyPath,
            producerPropertyKeyPath.split('.'), producerPropertyKeyPathRegExp,
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
                case 'ownSetter': {
                    const descriptor = producerPropertyCallTypeDetail[1]
                    const value = descriptor.get()

                    if (value.isProxy) {
                        if (value.observer !== this) {
                            value.addObserver(this, producerPropertyKey)
                        }
                    } else {
                        descriptor.set(ProxyHandler.create(value, this, producerPropertyKey))
                    }
                } break
                case 'setter': {
                    const descriptor = producerPropertyCallTypeDetail[1]
                    const value = descriptor.get.call(this.owner)

                    if (value.isProxy) {
                        const proxyHandler = value.proxyHandler

                        if (proxyHandler.observer !== this) {
                            proxyHandler.addObserver(this, producerPropertyKey)
                        }
                    } else {
                        descriptor.set.call(this.owner, ProxyHandler.create(value, this, producerPropertyKey))
                    }
                } break
            }
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
        binder.inInstrumentation = this
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

    notify(value: any, oldValue: any, operation: DispatchOperation, path: Array<string>, execute?: [(value) => any, any]): any {
        if (this.outBinders !== null) {
            const propertyKey = path[0].toString()
            let abortAction = false
            const bindersByKey = this.outBinders.get(propertyKey)

            if (bindersByKey !== undefined) {
                const pathStr = path.join('.')
                const pathToMatch = path.slice(1).join('.')

                for (const binder of bindersByKey) {
                    if (binder.active) {
                        if (binder.producerPropertyKeyPath == pathStr) {
                            if (binder.dispatch(value, oldValue, operation, path, '=') === ABORT_ACTION) {
                                abortAction = true
                                break
                            }
                        } else if (binder.producerPropertyKeyPathParts.slice(0, binder.producerPropertyKeyPathParts.length - 1).join('.').startsWith(pathStr)) {
                            if (binder.dispatch(value, oldValue, operation, path, '<') === ABORT_ACTION) {
                                abortAction = true
                                break
                            }
                        } else if (
                            path.length > binder.producerPropertyKeyPathParts.length &&
                            pathStr.startsWith(`${binder.producerPropertyKeyPath}.`) &&
                            binder.producerPropertyKeyPathRegExp &&
                            binder.producerPropertyKeyPathRegExp.exec(path.slice(binder.producerPropertyKeyPathParts.length).join('.'))
                        ) {
                            if (binder.dispatch(value, oldValue, operation, path, '>') === ABORT_ACTION) {
                                abortAction = true
                                break
                            }
                        }
                    }
                }
            }

            if (!abortAction && !!execute) {
                return execute[0].call(execute[1], value)
            } else {
                return undefined
            }
        } else if (!!execute) {
            return execute[0].call(execute[1], value)
        }
    }
}
