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
class ObjectProxyHandler extends Object {
    constructor(backing, observer, propertyKey) {
        super();
        this.backing = backing;
        this.observerIsMap = false;
        this.proxyInstance = null;
        this.observer = null;
        this.propertyKey = null;
        if (observer) {
            this.addObserver(observer, propertyKey);
        }
    }
    static create(backing, observer = null, propertyKey = null) {
        let proxyHandler = null;
        if (Array.isArray(backing)) {
            proxyHandler = new ArrayProxyHandler(backing, observer, propertyKey);
        }
        else if (backing instanceof Map) {
            proxyHandler = new MapProxyHandler(backing, observer, propertyKey);
        }
        else {
            proxyHandler = new ObjectProxyHandler(backing, observer, propertyKey);
        }
        const value = new Proxy(backing, proxyHandler);
        proxyHandler.proxyInstance = value;
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
    dispose() {
        super['dispose']();
    }
    addObserver(observer, propertyKey) {
        if (this.observer !== observer) {
            if (!this.observer) {
                this.observer = observer;
                this.propertyKey = propertyKey;
                observer.registerObserved(this, propertyKey);
            }
            else if (this.observerIsMap) {
                if (!this.observer.has(observer)) {
                    this.observer.set(observer, propertyKey);
                    observer.registerObserved(this, propertyKey);
                }
            }
            else {
                const map = new Map();
                map.set(this.observer, this.propertyKey);
                this.observer = map;
                this.observerIsMap = true;
                this.propertyKey = null;
                map.set(observer, propertyKey);
                observer.registerObserved(this, propertyKey);
            }
        }
    }
    removeObserver(observer) {
        if (this.observerIsMap) {
            const observedPropertyKey = this.observer.get(observer);
            if (observedPropertyKey !== undefined) {
                const map = this.observer;
                map.delete(observer);
                observer.unregisterObserved(this, observedPropertyKey);
                if (map.size === 1) {
                    map.forEach((propertyKey, element) => {
                        this.observer = element;
                        this.propertyKey = propertyKey;
                        this.observerIsMap = false;
                    });
                    map.clear();
                }
            }
        }
        else if (this.observer === observer) {
            const observedPropertyKey = this.propertyKey;
            this.observer = null;
            this.propertyKey = null;
            observer.unregisterObserved(this, observedPropertyKey);
        }
    }
    registerObserved(proxyHandler, propertyKey) {
        //Silent
    }
    unregisterObserved(proxyHandler, propertyKey) {
        //Silent
    }
    notify(value, oldValue, operation, path) {
        if (this.observer) {
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
        this.isArray = true;
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
class MapProxyHandlerEntriesIterator {
    constructor(backingMap, backing, observer) {
        this.backingMap = backingMap;
        this.backing = backing;
        this.observer = observer;
    }
    [Symbol.iterator]() {
        return this;
    }
    next(value) {
        let entry = this.backing.next();
        if (entry.done) {
            return entry;
        }
        else {
            let valueLocal = entry.value[1];
            if (valueLocal instanceof Object) {
                if (valueLocal.isProxy) {
                    const proxyHandler = valueLocal.proxyHandler;
                    if (proxyHandler.observer !== this.observer) {
                        proxyHandler.addObserver(this.observer);
                    }
                }
                else {
                    const key = entry.value[0];
                    const newValue = ObjectProxyHandler.create(valueLocal, this.observer, key);
                    this.backingMap.set(key, newValue);
                    entry = {
                        done: entry.done,
                        value: [key, newValue]
                    };
                }
            }
            return entry;
        }
    }
}
exports.MapProxyHandlerEntriesIterator = MapProxyHandlerEntriesIterator;
class MapProxyHandlerValuesIterator {
    constructor(backingMap, backing, observer) {
        this.backingMap = backingMap;
        this.backing = backing;
        this.observer = observer;
    }
    [Symbol.iterator]() {
        return this;
    }
    next(value) {
        let entry = this.backing.next();
        if (entry.done) {
            return entry;
        }
        else {
            const key = entry.value[0];
            let valueLocal = entry.value[1];
            if (valueLocal instanceof Object) {
                if (valueLocal.isProxy) {
                    const proxyHandler = valueLocal.proxyHandler;
                    if (proxyHandler.observer !== this.observer) {
                        proxyHandler.addObserver(this.observer);
                    }
                }
                else {
                    valueLocal = ObjectProxyHandler.create(valueLocal, this.observer, key);
                    this.backingMap.set(key, valueLocal);
                }
            }
            return {
                done: entry.done,
                value: valueLocal
            };
        }
    }
}
exports.MapProxyHandlerValuesIterator = MapProxyHandlerValuesIterator;
class MapProxyHandler extends ObjectProxyHandler {
    constructor() {
        super(...arguments);
        this.isMap = true;
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
                },
                entries: () => {
                    return new MapProxyHandlerEntriesIterator(self.backing, self.backing.entries(), self);
                },
                values: () => {
                    return new MapProxyHandlerValuesIterator(self.backing, self.backing.entries(), self);
                },
                clear: () => {
                    const oldValue = [];
                    for (const el of self.backing.entries()) {
                        oldValue.push([el[0], el[1] instanceof Object && el[1].isProxy ? el[1].backing : el[1]]);
                    }
                    const res = self.backing.clear();
                    this.notify(undefined, oldValue, 'clear', ['*']);
                    return res;
                },
                forEach: (callback, thisArg) => {
                    for (const entry of self._handlers.entries()) {
                        callback.call(thisArg, entry[1], entry[0], self.proxyInstance);
                    }
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
                case 'entries':
                    return this.handlers.entries;
                case 'values':
                    return this.handlers.values;
                case 'clear':
                    return this.handlers.clear;
                case Symbol.iterator:
                    return this.handlers.entries;
                case 'forEach':
                    return this.handlers.forEach;
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
