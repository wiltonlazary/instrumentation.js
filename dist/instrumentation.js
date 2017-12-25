"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const binder_1 = require("./binder");
const proxy_handler_1 = require("./proxy_handler");
const prototypeInstrumented = new Map();
const propertyCallTypeFromPrototypeCache = new Map();
const binderInstrumented = new Map();
exports.ABORT_ACTION = { toString: () => 'ABORT_ACTION' };
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
function valueFromPath(object, path) {
    if (object instanceof Object) {
        let current = object;
        path.forEach((element, index) => {
            current = current[element];
            if (!(current instanceof Object)) {
                if (index < path.length - 1) {
                    current = undefined;
                }
                return;
            }
        });
        return current;
    }
    else {
        return undefined;
    }
}
exports.valueFromPath = valueFromPath;
class Instrumentation {
    constructor(owner) {
        this.owner = owner;
        this.deepBy = null;
        this.ownInstrumented = null;
        this.outBinders = null;
        this.inBinders = null;
    }
    clear() {
        if (this.outBinders !== null) {
            this.outBinders.forEach(element => {
                element.forEach(binder => {
                    binder.dispose();
                });
                element.clear();
            });
        }
        if (this.inBinders !== null) {
            this.inBinders.forEach(element => {
                element.forEach(binder => {
                    binder.dispose();
                });
                element.clear();
            });
        }
    }
    dispose() {
        this.clear();
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
    defineOwnProperty(propertyKey) {
        let backingProperty = this.owner[propertyKey];
        delete this.owner[propertyKey];
        const backingPropertyDescriptor = {
            get: function () {
                return backingProperty;
            },
            set: function (value) {
                backingProperty = value;
            },
            enumerable: false,
            configurable: false
        };
        Object.defineProperty(this.owner, propertyKey, {
            get: function () {
                return backingProperty;
            },
            set: function (value) {
                const instrumentation = this.instrumentation;
                let newValue = value;
                if (value instanceof Object && instrumentation.deepBy && instrumentation.deepBy.has(propertyKey)) {
                    if (value.isProxy) {
                        if (value.observer !== instrumentation) {
                            value.addObserver(instrumentation, propertyKey);
                        }
                    }
                    else {
                        newValue = proxy_handler_1.ProxyHandler.create(value, instrumentation, propertyKey);
                    }
                }
                this.instrumentation.notify(newValue, backingProperty, 'set', [propertyKey], [(value) => { backingProperty = value; }, this]);
            },
            enumerable: true,
            configurable: false
        });
        return ['ownSetter', backingPropertyDescriptor];
    }
    ensureIntrumentation(propertyKey) {
        const ownerPrototype = this.owner.constructor.prototype;
        let result = ['none', null];
        if (this.ownInstrumented !== null && this.ownInstrumented.has(propertyKey)) {
            result = this.ownInstrumented.get(propertyKey);
        }
        else if (!binderInstrumented.has(ownerPrototype) || !binderInstrumented.get(ownerPrototype).has(propertyKey)) {
            if (Object.getOwnPropertyDescriptor(this.owner, propertyKey) !== undefined) {
                result = this.defineOwnProperty(propertyKey);
                if (this.ownInstrumented === null) {
                    this.ownInstrumented = new Map();
                }
                this.ownInstrumented.set(propertyKey, result);
            }
            else {
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
                    result = this.observed(propertyDescriptorPrototype);
                    prototypeRegisteredMap.set(propertyKey, result);
                }
                else {
                    result = prototypeInstrumented.get(propertyDescriptorPrototype.prototype).get(propertyKey);
                }
                binderRegisteredMap.set(propertyKey, result);
            }
        }
        else {
            result = binderInstrumented.get(ownerPrototype).get(propertyKey);
        }
        return result;
    }
    observed(propertyDescriptorPrototype) {
        if (typeof propertyDescriptorPrototype.descriptor.value === 'function') {
            const originalMethod = propertyDescriptorPrototype.descriptor.value;
            delete propertyDescriptorPrototype.prototype[propertyDescriptorPrototype.propertyKey];
            propertyDescriptorPrototype.prototype[propertyDescriptorPrototype.propertyKey] = function () {
                const value = arguments;
                this.instrumentation.notify(value, undefined, 'call', [propertyDescriptorPrototype.propertyKey], [(value) => { return originalMethod.apply(this, value); }, this]);
            };
            return ['function', originalMethod];
        }
        else if (propertyDescriptorPrototype.descriptor.set !== undefined) {
            const originalDescriptor = propertyDescriptorPrototype.descriptor;
            Object.defineProperty(propertyDescriptorPrototype.prototype, propertyDescriptorPrototype.propertyKey, {
                get: originalDescriptor.get,
                set: function (value) {
                    const instrumentation = this.instrumentation;
                    let newValue = value;
                    if (value instanceof Object && instrumentation.deepBy && instrumentation.deepBy.has(propertyDescriptorPrototype.propertyKey)) {
                        if (value.isProxy) {
                            if (value.observer !== instrumentation) {
                                value.addObserver(instrumentation, propertyDescriptorPrototype.propertyKey);
                            }
                        }
                        else {
                            newValue = proxy_handler_1.ProxyHandler.create(value, instrumentation, propertyDescriptorPrototype.propertyKey);
                        }
                    }
                    this.instrumentation.notify(newValue, originalDescriptor.get(), 'set', [propertyDescriptorPrototype.propertyKey], [(value) => { originalDescriptor.set.call(this, value); }, this]);
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
    bindOut(key, consumer, consumerPropertyKey, active) {
        if (this.outBinders === null) {
            this.outBinders = new Map();
        }
        let producerPropertyKey = key;
        let producerPropertyKeyPath = key;
        let producerPropertyKeyPathRegExp = null;
        let deep = false;
        if (key.indexOf('/') >= 0) {
            deep = true;
            const indexOfSep = key.indexOf('/');
            producerPropertyKeyPath = key.substring(0, indexOfSep);
            producerPropertyKey = producerPropertyKeyPath;
            const regExpStr = key.substr(indexOfSep + 1);
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
        const binder = new binder_1.Binder(this, this.owner, producerPropertyKey, producerPropertyKeyPath, producerPropertyKeyPath.split('.'), producerPropertyKeyPathRegExp, producerPropertyCallTypeDetail, consumer, consumerPropertyKey, !consumerPropertyKey ? 'none' : getPropertyCallTypeFromPrototypeFromInstance(consumer, consumerPropertyKey)[0], deep, active === undefined ? true : active);
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
                case 'ownSetter':
                    {
                        const descriptor = producerPropertyCallTypeDetail[1];
                        const value = descriptor.get();
                        if (value.isProxy) {
                            if (value.observer !== this) {
                                value.addObserver(this, producerPropertyKey);
                            }
                        }
                        else {
                            descriptor.set(proxy_handler_1.ProxyHandler.create(value, this, producerPropertyKey));
                        }
                    }
                    break;
                case 'setter':
                    {
                        const descriptor = producerPropertyCallTypeDetail[1];
                        const value = descriptor.get.call(this.owner);
                        if (value.isProxy) {
                            if (value.observer !== this) {
                                value.addObserver(this, producerPropertyKey);
                            }
                        }
                        else {
                            descriptor.set.call(this.owner, proxy_handler_1.ProxyHandler.create(value, this, producerPropertyKey));
                        }
                    }
                    break;
            }
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
        binder.inInstrumentation = this;
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
                bindersByKey.forEach(binder => {
                    if (binder.active) {
                        if (binder.producerPropertyKeyPath == pathStr) {
                            if (binder.dispatch(value, oldValue, operation, path, '=') === exports.ABORT_ACTION) {
                                abortAction = true;
                                return;
                            }
                        }
                        else if (binder.producerPropertyKeyPathParts.slice(0, binder.producerPropertyKeyPathParts.length - 1).join('.').startsWith(pathStr)) {
                            if (binder.dispatch(value, oldValue, operation, path, '<') === exports.ABORT_ACTION) {
                                abortAction = true;
                                return;
                            }
                        }
                        else if (path.length > binder.producerPropertyKeyPathParts.length &&
                            binder.producerPropertyKeyPathRegExp &&
                            binder.producerPropertyKeyPathRegExp.exec(path.slice(binder.producerPropertyKeyPathParts.length).join('.'))) {
                            if (binder.dispatch(value, oldValue, operation, path, '>') === exports.ABORT_ACTION) {
                                abortAction = true;
                                return;
                            }
                        }
                    }
                });
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
