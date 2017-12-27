"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const binder_1 = require("./binder");
const proxy_handler_1 = require("./proxy_handler");
exports.ABORT_ACTION = { toString: () => 'ABORT_ACTION' };
const prototypeInstrumented = new Map();
const propertyCallTypeFromPrototypeCache = new Map();
const binderInstrumented = new Map();
function pathContains(path, contained) {
    if (contained.length > path.length) {
        return false;
    }
    else {
        for (let i = 0; i < contained.length; i++) {
            const pv = path[i];
            const ov = contained[i];
            if (pv !== '*' && ov !== '*' && pv != ov) {
                return false;
            }
        }
        return true;
    }
}
exports.pathContains = pathContains;
function getHeadPrototype(prototype) {
    let nextPrototype = prototype;
    do {
        prototype = nextPrototype;
        nextPrototype = Object.getPrototypeOf(prototype);
    } while (!!nextPrototype);
    return prototype;
}
exports.getHeadPrototype = getHeadPrototype;
function getHeadPrototypeFromInstance(instance) {
    return getHeadPrototype(instance.constructor.prototype);
}
exports.getHeadPrototypeFromInstance = getHeadPrototypeFromInstance;
function getPropertyDescriptorPrototype(prototype, propertyKey) {
    let nextPrototype = prototype;
    let descriptor = null;
    do {
        prototype = nextPrototype;
        descriptor = Object.getOwnPropertyDescriptor(prototype, propertyKey);
        nextPrototype = Object.getPrototypeOf(prototype);
    } while (descriptor === undefined && !!nextPrototype);
    return descriptor === undefined ? undefined : {
        isPropertyDescriptorPrototype: true,
        propertyKey: propertyKey,
        descriptor: descriptor,
        prototype: prototype
    };
}
exports.getPropertyDescriptorPrototype = getPropertyDescriptorPrototype;
function getPropertyDescriptorPrototypeFromInstance(instance, propertyKey) {
    return getPropertyDescriptorPrototype(instance.constructor.prototype, propertyKey);
}
exports.getPropertyDescriptorPrototypeFromInstance = getPropertyDescriptorPrototypeFromInstance;
function getPropertyCallTypeFromPrototype(prototype, propertyKey) {
    let result = ['none', null];
    if (!propertyCallTypeFromPrototypeCache.has(prototype) || !propertyCallTypeFromPrototypeCache.get(prototype).has(propertyKey)) {
        let registeredMap = propertyCallTypeFromPrototypeCache.get(prototype);
        if (!registeredMap) {
            registeredMap = new Map();
            propertyCallTypeFromPrototypeCache.set(prototype, registeredMap);
        }
        const propertyDescriptorPrototype = getPropertyDescriptorPrototype(prototype, propertyKey);
        if (propertyDescriptorPrototype !== undefined) {
            result = propertyDescriptorPrototype.descriptor.set !== undefined ?
                ['setter', propertyDescriptorPrototype.descriptor] : ['function', propertyDescriptorPrototype.descriptor];
        }
        registeredMap.set(propertyKey, result);
    }
    else {
        result = propertyCallTypeFromPrototypeCache.get(prototype).get(propertyKey);
    }
    return result;
}
exports.getPropertyCallTypeFromPrototype = getPropertyCallTypeFromPrototype;
function getPropertyCallTypeFromPrototypeFromInstance(instance, propertyKey) {
    return getPropertyCallTypeFromPrototype(instance.constructor.prototype, propertyKey);
}
exports.getPropertyCallTypeFromPrototypeFromInstance = getPropertyCallTypeFromPrototypeFromInstance;
function valueFromPath(object, templatePlate, path) {
    if (object instanceof Object) {
        let current = object;
        for (let i = 0; i < templatePlate.length; i++) {
            let key = templatePlate[i];
            if (key === '*') {
                key = path[i];
            }
            current = current[key];
            if (!(current instanceof Object)) {
                if (i < path.length - 1) {
                    current = undefined;
                }
                break;
            }
        }
        return current;
    }
    else {
        return undefined;
    }
}
exports.valueFromPath = valueFromPath;
class Instrumentation extends Object {
    constructor(owner) {
        super();
        this.owner = owner;
        this.deepBy = null;
        this.ownInstrumented = null;
        this.outBinders = null;
        this.inBinders = null;
        this.observedProxyHandlers = null;
    }
    clear() {
        if (this.observedProxyHandlers !== null) {
            for (const proxyHandler of this.observedProxyHandlers.keys()) {
                proxyHandler.removeObserver(this);
            }
        }
        if (this.outBinders !== null) {
            for (const element of this.outBinders.values()) {
                for (const binder of element) {
                    binder.dispose();
                }
                element.clear();
            }
        }
        if (this.inBinders !== null) {
            for (const element of this.inBinders.values()) {
                for (const binder of element) {
                    binder.dispose();
                }
                element.clear();
            }
        }
    }
    dispose() {
        this.clear();
        super['dispose']();
    }
    registerObserved(proxyHandler, propertyKey) {
        if (this.observedProxyHandlers === null) {
            this.observedProxyHandlers = new Map();
        }
        this.observedProxyHandlers.set(proxyHandler, propertyKey);
    }
    unregisterObserved(proxyHandler, propertyKey) {
        this.observedProxyHandlers.delete(proxyHandler);
        if (this.observedProxyHandlers.size === 0) {
            this.observedProxyHandlers = null;
        }
    }
    addDeepBy(binder) {
        if (!this.deepBy) {
            this.deepBy = new Map();
        }
        let binderSet = this.deepBy.get(binder.producerPropertyKey);
        if (!binderSet) {
            binderSet = new Set();
            this.deepBy.set(binder.producerPropertyKey, binderSet);
        }
        binderSet.add(binder);
    }
    removeDeepBy(binder) {
        let binderSet = this.deepBy.get(binder.producerPropertyKey);
        if (binderSet) {
            binderSet.delete(binder);
            if (binderSet.size === 0) {
                this.deepBy.delete(binder.producerPropertyKey);
                if (this.deepBy.size === 0) {
                    this.deepBy = null;
                }
            }
        }
    }
    ensureIntrumentation(propertyKey, instrumentPrototype = false) {
        const ownerPrototype = this.owner.constructor.prototype;
        let result = ['none', null];
        if (this.ownInstrumented !== null && this.ownInstrumented.has(propertyKey)) {
            result = this.ownInstrumented.get(propertyKey);
        }
        else if (!binderInstrumented.has(ownerPrototype) || !binderInstrumented.get(ownerPrototype).has(propertyKey)) {
            const ownPropertyDescriptor = Object.getOwnPropertyDescriptor(this.owner, propertyKey);
            if (ownPropertyDescriptor !== undefined) {
                result = this.instrumentOwn(propertyKey, ownPropertyDescriptor);
            }
            else if (instrumentPrototype) {
                let binderRegisteredMap = binderInstrumented.get(ownerPrototype);
                if (!binderRegisteredMap) {
                    binderRegisteredMap = new Map();
                    binderInstrumented.set(ownerPrototype, binderRegisteredMap);
                }
                const propertyDescriptorPrototype = getPropertyDescriptorPrototype(ownerPrototype, propertyKey);
                if (!propertyDescriptorPrototype) {
                    throw new Error(`Property key not found on owner prototype: ${propertyKey}`);
                }
                else if (!prototypeInstrumented.has(propertyDescriptorPrototype.prototype) ||
                    !prototypeInstrumented.get(propertyDescriptorPrototype.prototype).has(propertyKey)) {
                    let prototypeRegisteredMap = prototypeInstrumented.get(propertyDescriptorPrototype.prototype);
                    if (!prototypeRegisteredMap) {
                        prototypeRegisteredMap = new Map();
                        prototypeInstrumented.set(propertyDescriptorPrototype.prototype, prototypeRegisteredMap);
                    }
                    result = this.instrument(propertyDescriptorPrototype.prototype, propertyDescriptorPrototype.propertyKey, propertyDescriptorPrototype.descriptor);
                    prototypeRegisteredMap.set(propertyKey, result);
                }
                else {
                    result = prototypeInstrumented.get(propertyDescriptorPrototype.prototype).get(propertyKey);
                }
                binderRegisteredMap.set(propertyKey, result);
            }
            else {
                const propertyDescriptorPrototype = getPropertyDescriptorPrototype(ownerPrototype, propertyKey);
                if (!propertyDescriptorPrototype) {
                    throw new Error(`Property key not found on owner prototype: ${propertyKey}`);
                }
                else {
                    result = this.instrumentOwn(propertyKey, propertyDescriptorPrototype.descriptor);
                }
            }
        }
        else {
            result = binderInstrumented.get(ownerPrototype).get(propertyKey);
        }
        return result;
    }
    instrument(target, propertyKey, descriptor) {
        if (typeof descriptor.value === 'function') {
            const originalMethod = descriptor.value;
            delete target[propertyKey];
            target[propertyKey] = function () {
                const value = arguments;
                this.instrumentation.notify(value, undefined, 'call', [propertyKey], [(value) => { return originalMethod.apply(this, value); }, this]);
            };
            return ['function', originalMethod];
        }
        else if (descriptor.writable) {
            const originalDescriptor = descriptor;
            Object.defineProperty(target, propertyKey, {
                get: function () { return originalDescriptor.value; },
                set: function (value) {
                    const instrumentation = this.instrumentation;
                    let oldValue = originalDescriptor.value;
                    let newValue = value;
                    if (value instanceof Object && instrumentation.deepBy && instrumentation.deepBy.has(propertyKey)) {
                        if (value.isProxy) {
                            const proxyHandler = value.proxyHandler;
                            if (proxyHandler.observer !== instrumentation) {
                                proxyHandler.addObserver(instrumentation, propertyKey);
                            }
                        }
                        else {
                            newValue = proxy_handler_1.ObjectProxyHandler.create(value, instrumentation, propertyKey);
                        }
                    }
                    this.instrumentation.notify(newValue, oldValue, 'set', [propertyKey], [(value) => {
                            if (oldValue && oldValue.isProxy) {
                                oldValue.proxyHandler.removeObserver(instrumentation);
                            }
                            originalDescriptor.value = value;
                        }, this]);
                },
                enumerable: originalDescriptor.enumerable,
                configurable: originalDescriptor.configurable
            });
            return ['writable', originalDescriptor];
        }
        else if (descriptor.set !== undefined) {
            const originalDescriptor = descriptor;
            Object.defineProperty(target, propertyKey, {
                get: originalDescriptor.get,
                set: function (value) {
                    const instrumentation = this.instrumentation;
                    let oldValue = originalDescriptor.get.call(this);
                    let newValue = value;
                    if (value instanceof Object && instrumentation.deepBy && instrumentation.deepBy.has(propertyKey)) {
                        if (value.isProxy) {
                            const ObjectProxyHandler = value.proxyHandler;
                            if (ObjectProxyHandler.observer !== instrumentation) {
                                ObjectProxyHandler.addObserver(instrumentation, propertyKey);
                            }
                        }
                        else {
                            newValue = proxy_handler_1.ObjectProxyHandler.create(value, instrumentation, propertyKey);
                        }
                    }
                    this.instrumentation.notify(newValue, oldValue, 'set', [propertyKey], [(value) => {
                            if (oldValue && oldValue.isProxy) {
                                oldValue.proxyHandler.removeObserver(instrumentation);
                            }
                            originalDescriptor.set.call(this, value);
                        }, this]);
                },
                enumerable: originalDescriptor.enumerable,
                configurable: originalDescriptor.configurable
            });
            return ['setter', originalDescriptor];
        }
        else {
            return ['none', null];
        }
    }
    instrumentOwn(propertyKey, descriptor) {
        if (this.ownInstrumented === null) {
            this.ownInstrumented = new Map();
        }
        const result = this.instrument(this.owner, propertyKey, descriptor);
        this.ownInstrumented.set(propertyKey, result);
        return result;
    }
    bindOut(expression, consumer, consumerPropertyKey, active) {
        if (this.outBinders === null) {
            this.outBinders = new Map();
        }
        let init = false;
        let expr = expression;
        if (expr.startsWith('+')) {
            init = true;
            expr = expr.substr(1);
        }
        let producerPropertyKey = expr;
        let producerPropertyKeyPath = expr;
        let producerPropertyKeyPathRegExp = null;
        let deep = false;
        if (expr.indexOf('/') >= 0) {
            deep = true;
            const indexOfSep = expr.indexOf('/');
            producerPropertyKeyPath = expr.substring(0, indexOfSep);
            producerPropertyKey = producerPropertyKeyPath;
            const regExpStr = expr.substr(indexOfSep + 1);
            const indexOfSecSep = regExpStr.indexOf('/');
            if (indexOfSecSep >= 0) {
                producerPropertyKeyPathRegExp = new RegExp(regExpStr.substring(0, indexOfSecSep), regExpStr.substr(indexOfSep + 1));
            }
            else {
                producerPropertyKeyPathRegExp = new RegExp(regExpStr);
            }
        }
        if (producerPropertyKey.indexOf('.') >= 0) {
            deep = true;
            producerPropertyKey = producerPropertyKey.substring(0, producerPropertyKey.indexOf('.'));
        }
        const producerPropertyCallTypeDetail = this.ensureIntrumentation(producerPropertyKey);
        const binder = new binder_1.Binder(this, this.owner, producerPropertyKey, producerPropertyKeyPath.split('.'), producerPropertyKeyPathRegExp, producerPropertyCallTypeDetail, consumer, consumerPropertyKey, !consumerPropertyKey ? 'none' : getPropertyCallTypeFromPrototypeFromInstance(consumer, consumerPropertyKey)[0], deep, active === undefined ? true : active);
        let bindersLocal = this.outBinders.get(producerPropertyKey);
        if (bindersLocal === undefined) {
            bindersLocal = new Set();
            this.outBinders.set(producerPropertyKey, bindersLocal);
        }
        bindersLocal.add(binder);
        if (consumerPropertyKey !== undefined && typeof consumer !== 'function') {
            consumer.instrumentation.bindIn(binder);
        }
        if (binder.deep) {
            this.addDeepBy(binder);
            switch (producerPropertyCallTypeDetail[0]) {
                case 'setter':
                    {
                        const descriptor = producerPropertyCallTypeDetail[1];
                        const value = descriptor.get.call(this.owner);
                        if (value.isProxy) {
                            const ObjectProxyHandler = value.proxyHandler;
                            if (ObjectProxyHandler.observer !== this) {
                                ObjectProxyHandler.addObserver(this, producerPropertyKey);
                            }
                        }
                        else {
                            descriptor.set.call(this.owner, proxy_handler_1.ObjectProxyHandler.create(value, this, producerPropertyKey));
                        }
                    }
                    break;
                case 'writable':
                    {
                        const descriptor = producerPropertyCallTypeDetail[1];
                        const value = descriptor.value;
                        if (value.isProxy) {
                            const ObjectProxyHandler = value.proxyHandler;
                            if (ObjectProxyHandler.observer !== this) {
                                ObjectProxyHandler.addObserver(this, producerPropertyKey);
                            }
                        }
                        else {
                            descriptor.value = proxy_handler_1.ObjectProxyHandler.create(value, this, producerPropertyKey);
                        }
                    }
                    break;
            }
        }
        if (init) {
            binder.dispatch(this.owner[producerPropertyKey], undefined, 'init', [producerPropertyKey], binder.producerPropertyPath.length === 1 ? '=' : '<');
        }
        return binder;
    }
    bindIn(binder) {
        if (this.inBinders === null) {
            this.inBinders = new Map();
        }
        let bindersLocal = this.inBinders.get(binder.consumerPropertyKey);
        if (bindersLocal === undefined) {
            bindersLocal = new Set();
            this.inBinders.set(binder.consumerPropertyKey, bindersLocal);
        }
        bindersLocal.add(binder);
        binder.consumerInstrumentation = this;
        return binder;
    }
    unbindOut(binder) {
        const bindersLocal = this.outBinders.get(binder.producerPropertyKey);
        bindersLocal.delete(binder);
        if (bindersLocal.size === 0) {
            this.outBinders.delete(binder.producerPropertyKey);
            if (this.outBinders.size === 0) {
                this.outBinders = null;
            }
        }
        if (binder.deep) {
            this.removeDeepBy(binder);
        }
    }
    unbindIn(binder) {
        const bindersLocal = this.inBinders.get(binder.consumerPropertyKey);
        bindersLocal.delete(binder);
        if (bindersLocal.size === 0) {
            this.inBinders.delete(binder.consumerPropertyKey);
            if (this.inBinders.size === 0) {
                this.inBinders = null;
            }
        }
    }
    notify(value, oldValue, operation, path, execute) {
        if (this.outBinders !== null) {
            const propertyKey = path[0].toString();
            let abortAction = false;
            const bindersByKey = this.outBinders.get(propertyKey);
            if (bindersByKey !== undefined) {
                const pathStr = path.join('.');
                const pathToMatch = path.slice(1).join('.');
                for (const binder of bindersByKey) {
                    if (binder.active) {
                        if (pathContains(binder.producerPropertyPath, path)) {
                            if (binder.dispatch(value, oldValue, operation, path, path.length === binder.producerPropertyPath.length ? '=' : '<') === exports.ABORT_ACTION) {
                                abortAction = true;
                                break;
                            }
                        }
                        else if (path.length > binder.producerPropertyPath.length &&
                            pathContains(path, binder.producerPropertyPath) &&
                            binder.producerPropertyPathRegExp &&
                            binder.producerPropertyPathRegExp.exec(path.slice(binder.producerPropertyPath.length).join('.'))) {
                            if (binder.dispatch(value, oldValue, operation, path, '>') === exports.ABORT_ACTION) {
                                abortAction = true;
                                break;
                            }
                        }
                    }
                }
            }
            if (!abortAction && !!execute) {
                return execute[0].call(execute[1], value);
            }
            else {
                return undefined;
            }
        }
        else if (!!execute) {
            return execute[0].call(execute[1], value);
        }
    }
}
exports.Instrumentation = Instrumentation;

//# sourceMappingURL=instrumentation.js.map
