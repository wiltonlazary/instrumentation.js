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

export class ObjectProxyHandler<T extends object> implements ProxyHandler<T> {
    observerIsMap = false

    static create(backing: any, observer: any = null, propertyKey: PropertyKey = null): any {
        let proxyHandler = null

        if (Array.isArray(backing)) {
            proxyHandler = new ArrayProxyHandler(backing, observer, propertyKey)
        } else {
            proxyHandler = new ObjectProxyHandler(backing, observer, propertyKey)
        }

        const value = new Proxy(backing, proxyHandler)
        Object.defineProperty(value, 'isProxy', booleanTruePropertyDefinition)

        Object.defineProperty(value, 'proxyHandler', {
            get: function () { return proxyHandler },
            enumerable: false,
            configurable: false
        })

        return value
    }

    constructor(public readonly backing: any, public observer: any, public propertyKey: PropertyKey) {
        this.observerIsMap = observer instanceof Map
    }

    get isProxyHandler(): boolean {
        return true
    }

    addObserver(observer: any, propertyKey: PropertyKey) {
        if (!this.observer) {
            this.observer = observer
            this.propertyKey = propertyKey
        } else if (this.observerIsMap) {
            this.observer.set(observer, propertyKey)
        } else if (this.observer !== observer) {
            this.observer = new Map([this.observer, this.propertyKey])
            this.observerIsMap = true
            this.propertyKey = null
        }
    }

    removeObserver(observer: any) {
        if (this.observerIsMap) {
            this.observer.delete(observer)

            if (this.observer.size === 1) {
                this.observerIsMap = false
                const map = this.observer

                this.observer.forEach((propertyKey, element) => {
                    this.observer = element
                    this.propertyKey = propertyKey
                })

                map.clear()
            } else if (this.observer.size === 0) {
                this.observerIsMap = false
                this.observer = null
                this.propertyKey = null
            }
        } else if (this.observer === observer) {
            this.observer = null
            this.propertyKey = null
        }
    }

    notify(value: any, oldValue: any, operation: string, path: Array<PropertyKey>) {
        if (!!this.observer) {
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
        this.backing[p] = value
        this.notify(value, oldValue, 'set', [p])
        return true
    }

    deleteProperty(target: T, p: PropertyKey): boolean {
        const oldValue = this.backing[p]
        delete this.backing[p]
        this.notify(undefined, oldValue, 'delete', [p])
        return true
    }
}

export class ArrayProxyHandler<T extends object> extends ObjectProxyHandler<T> {
    _handlers = null

    get handlers(): any {
        const self = this

        if (this._handlers === null) {
            this._handlers = {
                push: (element): number => {
                    const res = self.backing.push(element)
                    self.notify(element, undefined, 'push', [res - 1])
                    return res
                },
                pop: (): any => {
                    const index = self.backing.length - 1
                    const oldValue = index >= 0 ? self.backing[index] : undefined
                    const res = self.backing.pop()
                    self.notify(undefined, oldValue, 'pop', [index])
                    return res
                },
                unshift: (element): number => {
                    const oldValue = self.backing.length >= 1 ? self.backing[0] : undefined
                    const res = self.backing.unshift(element)
                    self.notify(element, oldValue, 'unshift', [0])
                    return res
                },
                shift: (): any => {
                    const oldValue = self.backing.length >= 1 ? self.backing[0] : undefined
                    const res = self.backing.shift()
                    self.notify(self.backing.length >= 1 ? self.backing[0] : undefined, oldValue, 'shift', [0])
                    return res
                }
            }
        }

        return this._handlers
    }

    get(target: T, p: PropertyKey, receiver: any): any {
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

//----------------------------------------------------------------------------------//
declare const global: any
global.ObjectProxyHandler = ObjectProxyHandler
