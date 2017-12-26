"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggerObserver = {
    notify: (value, oldValue, operation, path) => {
        console.log(`loggerObserver.notify: operation="${operation}" path=${JSON.stringify(path.join('.'))} oldValue=${JSON.stringify(oldValue)} value=${JSON.stringify(value)}`);
    }
};
const booleanTruePropertyDefinition = {
    get: function () { return true; },
    enumerable: false,
    configurable: false
};
class ObjectProxyHandler {
    constructor(backing, observer, propertyKey) {
        this.backing = backing;
        this.observer = observer;
        this.propertyKey = propertyKey;
        this.observerIsMap = false;
        this.observerIsMap = observer instanceof Map;
    }
    static create(backing, observer = null, propertyKey = null) {
        let proxyHandler = null;
        if (Array.isArray(backing)) {
            proxyHandler = new ArrayProxyHandler(backing, observer, propertyKey);
        }
        if (backing instanceof Map) {
            proxyHandler = new MapProxyHandler(backing, observer, propertyKey);
        }
        else {
            proxyHandler = new ObjectProxyHandler(backing, observer, propertyKey);
        }
        const value = new Proxy(backing, proxyHandler);
        Object.defineProperty(value, 'isProxy', booleanTruePropertyDefinition);
        Object.defineProperty(value, 'proxyHandler', {
            get: function () { return proxyHandler; },
            enumerable: false,
            configurable: false
        });
        return value;
    }
    get isProxyHandler() {
        return true;
    }
    addObserver(observer, propertyKey) {
        if (!this.observer) {
            this.observer = observer;
            this.propertyKey = propertyKey;
        }
        else if (this.observerIsMap) {
            this.observer.set(observer, propertyKey);
        }
        else if (this.observer !== observer) {
            this.observer = new Map([this.observer, this.propertyKey]);
            this.observerIsMap = true;
            this.propertyKey = null;
        }
    }
    removeObserver(observer) {
        if (this.observerIsMap) {
            this.observer.delete(observer);
            if (this.observer.size === 1) {
                this.observerIsMap = false;
                const map = this.observer;
                this.observer.forEach((propertyKey, element) => {
                    this.observer = element;
                    this.propertyKey = propertyKey;
                });
                map.clear();
            }
            else if (this.observer.size === 0) {
                this.observerIsMap = false;
                this.observer = null;
                this.propertyKey = null;
            }
        }
        else if (this.observer === observer) {
            this.observer = null;
            this.propertyKey = null;
        }
    }
    notify(value, oldValue, operation, path) {
        if (!!this.observer) {
            if (this.observerIsMap) {
                this.observer.forEach((propertyKey, element) => {
                    path.unshift(propertyKey);
                    element.notify(value, oldValue, operation, path);
                    path.shift();
                });
            }
            else {
                path.unshift(this.propertyKey);
                this.observer.notify(value, oldValue, operation, path);
            }
        }
    }
    get(target, p, receiver) {
        let value = this.backing[p];
        if (!(value instanceof Object) || value.isProxy || value.isProxyHandler) {
            return value;
        }
        else {
            value = ObjectProxyHandler.create(value, this, p);
            this.backing[p] = value;
            return value;
        }
    }
    set(target, p, value, receiver) {
        const oldValue = this.backing[p];
        this.backing[p] = value;
        this.notify(value, oldValue, 'set', [p]);
        return true;
    }
    deleteProperty(target, p) {
        const oldValue = this.backing[p];
        delete this.backing[p];
        this.notify(undefined, oldValue, 'delete', [p]);
        return true;
    }
}
exports.ObjectProxyHandler = ObjectProxyHandler;
class ArrayProxyHandler extends ObjectProxyHandler {
    constructor() {
        super(...arguments);
        this._handlers = null;
    }
    get handlers() {
        const self = this;
        if (this._handlers === null) {
            this._handlers = {
                push: (element) => {
                    const res = self.backing.push(element);
                    self.notify(element, undefined, 'push', [res - 1]);
                    return res;
                },
                pop: () => {
                    const index = self.backing.length - 1;
                    const oldValue = index >= 0 ? self.backing[index] : undefined;
                    const res = self.backing.pop();
                    self.notify(undefined, oldValue, 'pop', [index]);
                    return res;
                },
                unshift: (element) => {
                    const oldValue = self.backing.length >= 1 ? self.backing[0] : undefined;
                    const res = self.backing.unshift(element);
                    self.notify(element, oldValue, 'unshift', [0]);
                    return res;
                },
                shift: () => {
                    const oldValue = self.backing.length >= 1 ? self.backing[0] : undefined;
                    const res = self.backing.shift();
                    self.notify(self.backing.length >= 1 ? self.backing[0] : undefined, oldValue, 'shift', [0]);
                    return res;
                }
            };
        }
        return this._handlers;
    }
    get(target, p, receiver) {
        let value = this.backing[p];
        if (typeof value === 'function') {
            switch (p) {
                case 'push':
                    return this.handlers.push;
                case 'pop':
                    return this.handlers.pop;
                case 'shift':
                    return this.handlers.shift;
                case 'unshift':
                    return this.handlers.unshift;
                default:
                    return super.get(target, p, receiver);
            }
        }
        else {
            return super.get(target, p, receiver);
        }
    }
}
exports.ArrayProxyHandler = ArrayProxyHandler;
class MapProxyHandler extends ObjectProxyHandler {
    constructor() {
        super(...arguments);
        this._handlers = null;
    }
    get handlers() {
        const self = this;
        if (this._handlers === null) {
            this._handlers = {
                get: (key) => {
                    let value = self.backing.get(key);
                    if (!(value instanceof Object) || value.isProxy || value.isProxyHandler) {
                        return value;
                    }
                    else {
                        value = ObjectProxyHandler.create(value, self, key);
                        self.backing.set(key, value);
                        return value;
                    }
                },
                set: (key, value) => {
                    const oldValue = self.backing.get(key);
                    const res = self.backing.set(key, value);
                    self.notify(value, oldValue, 'set', [key]);
                    return res;
                },
                delete: (key) => {
                    const oldValue = self.backing.get(key);
                    const res = self.backing.delete(key);
                    this.notify(undefined, oldValue, 'delete', [key]);
                    return res;
                }
            };
        }
        return this._handlers;
    }
    get(target, p, receiver) {
        let value = this.backing[p];
        if (typeof value === 'function') {
            switch (p) {
                case 'get':
                    return this.handlers.get;
                case 'set':
                    return this.handlers.set;
                case 'delete':
                    return this.handlers.delete;
                default:
                    return super.get(target, p, receiver);
            }
        }
        else {
            return super.get(target, p, receiver);
        }
    }
}
exports.MapProxyHandler = MapProxyHandler;
global.ObjectProxyHandler = ObjectProxyHandler;

//# sourceMappingURL=proxy_handler.js.map
