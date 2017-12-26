export const loggerObserver = {
    notify: (value: any, oldValue: any, operation: string, path: Array<PropertyKey>) => {
        console.log(`loggerObserver.notify: operation="${operation}" path=${JSON.stringify(path.join('.'))} oldValue=${JSON.stringify(oldValue)} value=${JSON.stringify(value)}`)
    }
}

const booleanTruePropertyDefinition: PropertyDescriptor = {
    get: function () { return true },
    enumerable: false,
    configurable: false
}

export class ObjectProxyHandler<T extends object> extends Object implements ProxyHandler<T> {
    observerIsMap = false
    proxyInstance: any = null
    observer: any = null
    propertyKey: any = null

    static create(backing: any, observer: any = null, propertyKey: any = null): any {
        let proxyHandler = null

        if (Array.isArray(backing)) {
            proxyHandler = new ArrayProxyHandler(backing, observer, propertyKey)
        } else if (backing instanceof Map) {
            proxyHandler = new MapProxyHandler(backing, observer, propertyKey)
        } else {
            proxyHandler = new ObjectProxyHandler(backing, observer, propertyKey)
        }

        const value = new Proxy(backing, proxyHandler)
        proxyHandler.proxyInstance = value
        Object.defineProperty(value, 'isProxy', booleanTruePropertyDefinition)

        Object.defineProperty(value, 'proxyHandler', {
            get: function () { return proxyHandler },
            enumerable: false,
            configurable: false
        })

        return value
    }

    constructor(public readonly backing: any, observer: any, propertyKey: any) {
        super()

        if (observer) {
            this.addObserver(observer, propertyKey)
        }
    }

    get isProxyHandler(): boolean {
        return true
    }

    dispose() {
        super['dispose']()
    }

    addObserver(observer: any, propertyKey: any) {
        if (this.observer !== observer) {
            if (!this.observer) {
                this.observer = observer
                this.propertyKey = propertyKey
                observer.registerObserved(this, propertyKey)
            } else if (this.observerIsMap) {
                if (!this.observer.has(observer)) {
                    this.observer.set(observer, propertyKey)
                    observer.registerObserved(this, propertyKey)
                }
            } else {
                const map = new Map()
                map.set(this.observer, this.propertyKey)
                this.observer = map
                this.observerIsMap = true
                this.propertyKey = null
                map.set(observer, propertyKey)
                observer.registerObserved(this, propertyKey)
            }
        }
    }

    removeObserver(observer: any) {
        if (this.observerIsMap) {
            const observedPropertyKey = this.observer.get(observer)

            if (observedPropertyKey !== undefined) {
                const map = this.observer
                map.delete(observer)
                observer.unregisterObserved(this, observedPropertyKey)

                if (map.size === 1) {
                    map.forEach((propertyKey, element) => {
                        this.observer = element
                        this.propertyKey = propertyKey
                        this.observerIsMap = false
                    })

                    map.clear()
                }
            }
        } else if (this.observer === observer) {
            const observedPropertyKey = this.propertyKey
            this.observer = null
            this.propertyKey = null
            observer.unregisterObserved(this, observedPropertyKey)
        }
    }

    registerObserved(proxyHandler: ObjectProxyHandler<any>, propertyKey: any) {
        //Silent
    }

    unregisterObserved(proxyHandler: ObjectProxyHandler<any>, propertyKey: any) {
        //Silent
    }

    notify(value: any, oldValue: any, operation: string, path: Array<any>) {
        if (this.observer) {
            if (this.observerIsMap) {
                this.observer.forEach((propertyKey, element) => {
                    path.unshift(propertyKey)
                    element.notify(value, oldValue, operation, path)
                    path.shift()
                })
            } else {
                path.unshift(this.propertyKey)
                this.observer.notify(value, oldValue, operation, path)
            }
        }
    }

    get(target: T, p: PropertyKey, receiver: any): any {
        let value = this.backing[p]

        if (!(value instanceof Object) || value.isProxy || value.isProxyHandler) {
            return value
        } else {
            value = ObjectProxyHandler.create(value, this, p)
            this.backing[p] = value
            return value
        }
    }

    set(target: T, p: PropertyKey, value: any, receiver: any): boolean {
        const oldValue = this.backing[p]

        if (oldValue instanceof Object && oldValue.isProxy) {
            oldValue.proxyHandler.removeObserver(this)
        }

        if (value instanceof Object && value.isProxy) {
            value.proxyHandler.addObserver(this)
        }

        this.backing[p] = value
        this.notify(value, oldValue, 'set', [p])
        return true
    }

    deleteProperty(target: T, p: PropertyKey): boolean {
        const oldValue = this.backing[p]

        if (oldValue instanceof Object && oldValue.isProxy) {
            oldValue.proxyHandler.removeObserver(this)
        }

        delete this.backing[p]
        this.notify(undefined, oldValue, 'delete', [p])
        return true
    }
}

export class ArrayProxyHandler extends ObjectProxyHandler<Array<any>> {
    isArray = true
    _handlers = null

    get handlers(): any {
        const self = this

        if (this._handlers === null) {
            this._handlers = {
                push: (element): number => {
                    if (element instanceof Object && element.isProxy) {
                        element.proxyHandler.addObserver(this)
                    }

                    const res = self.backing.push(element)
                    self.notify(element, undefined, 'push', [res - 1])
                    return res
                },
                pop: (): any => {
                    const index = self.backing.length - 1
                    const oldElement = index >= 0 ? self.backing[index] : undefined

                    if (oldElement instanceof Object && oldElement.isProxy) {
                        oldElement.proxyHandler.removeObserver(this)
                    }

                    const res = self.backing.pop()
                    self.notify(undefined, oldElement, 'pop', [index])
                    return res
                },
                unshift: (element): number => {
                    const oldElement = self.backing.length >= 1 ? self.backing[0] : undefined

                    if (element instanceof Object && element.isProxy) {
                        element.proxyHandler.addObserver(this)
                    }

                    if (oldElement instanceof Object && oldElement.isProxy) {
                        oldElement.proxyHandler.removeObserver(this)
                    }

                    const res = self.backing.unshift(element)
                    self.notify(element, oldElement, 'unshift', [0])
                    return res
                },
                shift: (): any => {
                    const oldElement = self.backing.length >= 1 ? self.backing[0] : undefined

                    if (oldElement instanceof Object && oldElement.isProxy) {
                        oldElement.proxyHandler.removeObserver(this)
                    }
                    
                    const res = self.backing.shift()
                    self.notify(self.backing.length >= 1 ? self.backing[0] : undefined, oldElement, 'shift', [0])
                    return res
                }
            }
        }

        return this._handlers
    }

    get(target: Array<any>, p: PropertyKey, receiver: any): any {
        let value = this.backing[p]

        if (typeof value === 'function') {
            switch (p) {
                case 'push':
                    return this.handlers.push
                case 'pop':
                    return this.handlers.pop
                case 'shift':
                    return this.handlers.shift
                case 'unshift':
                    return this.handlers.unshift
                default:
                    return super.get(target, p, receiver)
            }
        } else {
            return super.get(target, p, receiver)
        }
    }
}

export class MapProxyHandlerEntriesIterator implements Iterable<[any, any]> {
    constructor(public readonly backingMap: any, public readonly backing: any, public readonly observer: any) {

    }

    [Symbol.iterator](): IterableIterator<[any, any]> {
        return this
    }

    next(value?: any): IteratorResult<[any, any]> {
        let entry = this.backing.next()

        if (entry.done) {
            return entry
        } else {
            let valueLocal = entry.value[1]

            if (valueLocal instanceof Object) {
                if (valueLocal.isProxy) {
                    const proxyHandler = valueLocal.proxyHandler

                    if (proxyHandler.observer !== this.observer) {
                        proxyHandler.addObserver(this.observer)
                    }
                } else {
                    const key = entry.value[0]
                    const newValue = ObjectProxyHandler.create(valueLocal, this.observer, key)
                    this.backingMap.set(key, newValue)

                    entry = {
                        done: entry.done,
                        value: [key, newValue]
                    }
                }
            }

            return entry
        }
    }
}

export class MapProxyHandlerValuesIterator implements Iterable<any>{
    constructor(public readonly backingMap: any, public readonly backing: any, public readonly observer: any) {

    }

    [Symbol.iterator](): IterableIterator<any> {
        return this
    }

    next(value?: any): IteratorResult<any> {
        let entry = this.backing.next()

        if (entry.done) {
            return entry
        } else {
            const key = entry.value[0]
            let valueLocal = entry.value[1]

            if (valueLocal instanceof Object) {
                if (valueLocal.isProxy) {
                    const proxyHandler = valueLocal.proxyHandler

                    if (proxyHandler.observer !== this.observer) {
                        proxyHandler.addObserver(this.observer)
                    }
                } else {
                    valueLocal = ObjectProxyHandler.create(valueLocal, this.observer, key)
                    this.backingMap.set(key, valueLocal)
                }
            }

            return {
                done: entry.done,
                value: valueLocal
            }
        }
    }
}

export class MapProxyHandler extends ObjectProxyHandler<Map<any, any>> {
    isMap = true
    _handlers = null

    get handlers(): any {
        const self = this

        if (this._handlers === null) {
            this._handlers = {
                get: (key): any => {
                    let value = self.backing.get(key)

                    if (!(value instanceof Object) || value.isProxy || value.isProxyHandler) {
                        return value
                    } else {
                        value = ObjectProxyHandler.create(value, self, key)
                        self.backing.set(key, value)
                        return value
                    }
                },
                set: (key, value): any => {
                    const oldValue = self.backing.get(key)
                    const res = self.backing.set(key, value)
                    self.notify(value, oldValue, 'set', [key])
                    return res
                },
                delete: (key): any => {
                    const oldValue = self.backing.get(key)
                    const res = self.backing.delete(key)
                    this.notify(undefined, oldValue, 'delete', [key])
                    return res
                },
                entries: (): MapProxyHandlerEntriesIterator => {
                    return new MapProxyHandlerEntriesIterator(self.backing, self.backing.entries(), self)
                },
                values: (): MapProxyHandlerValuesIterator => {
                    return new MapProxyHandlerValuesIterator(self.backing, self.backing.entries(), self)
                },
                clear: (): any => {
                    const oldValue = []

                    for (const el of self.backing.entries()) {
                        oldValue.push([el[0], el[1] instanceof Object && el[1].isProxy ? el[1].backing : el[1]])
                    }

                    const res = self.backing.clear()
                    this.notify(undefined, oldValue, 'clear', ['*'])
                    return res
                },
                forEach: (callback, thisArg?): void => {
                    for (const entry of self._handlers.entries()) {
                        callback.call(thisArg, entry[1], entry[0], self.proxyInstance)
                    }
                }
            }
        }

        return this._handlers
    }

    get(target: Map<any, any>, p: PropertyKey, receiver: any): any {
        let value = this.backing[p]

        if (typeof value === 'function') {
            switch (p) {
                case 'get':
                    return this.handlers.get
                case 'set':
                    return this.handlers.set
                case 'delete':
                    return this.handlers.delete
                case 'entries':
                    return this.handlers.entries
                case 'values':
                    return this.handlers.values
                case 'clear':
                    return this.handlers.clear
                case Symbol.iterator:
                    return this.handlers.entries
                case 'forEach':
                    return this.handlers.forEach
                default:
                    return super.get(target, p, receiver)
            }
        } else {
            return super.get(target, p, receiver)
        }
    }
}

//----------------------------------------------------------------------------------//
declare const global: any
global.ObjectProxyHandler = ObjectProxyHandler
