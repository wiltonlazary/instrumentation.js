export const loggerObserver = {
    notify: (value: any, oldValue: any, operation: string, path: Array<PropertyKey>) => {
        console.log(`loggerObserver.notify: operation="${operation}" path=${JSON.stringify(path.join('.'))} oldValue=${JSON.stringify(oldValue)} value=${JSON.stringify(value)}`)
    }
}

const booleanTruePropertyDefinition = {
    get: function () { return true },
    enumerable: false,
    configurable: false
}

export class ProxyHandler<T extends object> implements ProxyHandler<T> {
    observerIsMap = false

    static create(backing: any, observer: any = null, propertyKey: PropertyKey = null): any {
        const proxyHandler = new ProxyHandler(backing, observer, propertyKey)
        const value = new Proxy(backing, new ProxyHandler(backing, observer, propertyKey))
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
            value = ProxyHandler.create(value, this, p)
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

//----------------------------------------------------------------------------------//
declare const global: any
global.ProxyHandler = ProxyHandler
