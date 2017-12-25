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
class ProxyHandler {
    constructor(backing, observer, propertyKey) {
        this.backing = backing;
        this.observer = observer;
        this.propertyKey = propertyKey;
        this.observerIsMap = false;
        this.observerIsMap = observer instanceof Map;
    }
    static create(backing, observer = null, propertyKey = null) {
        const proxyHandler = new ProxyHandler(backing, observer, propertyKey);
        const value = new Proxy(backing, new ProxyHandler(backing, observer, propertyKey));
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
            value = ProxyHandler.create(value, this, p);
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
exports.ProxyHandler = ProxyHandler;
global.ProxyHandler = ProxyHandler;

//# sourceMappingURL=proxy_handler.js.map
