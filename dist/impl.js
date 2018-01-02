"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const proxy_handler_1 = require("./proxy_handler");
const binder_1 = require("./binder");
const instrumentation_1 = require("./instrumentation");
if (!global) {
    if (self) {
        self['global'] = self;
    }
    else {
        window['global'] = window;
    }
}
global.ABORT_ACTION = instrumentation_1.ABORT_ACTION;
global.ObjectProxyHandler = proxy_handler_1.ObjectProxyHandler;
global.abortNextBinderDispatch = binder_1.abortNextBinderDispatch;
global.bypassNextBinderDispatch = binder_1.bypassNextBinderDispatch;
global.currentBinderDispatchDetail = binder_1.currentBinderDispatchDetail;
global.getHeadPrototype = instrumentation_1.getHeadPrototype;
global.getHeadPrototypeFromInstance = instrumentation_1.getHeadPrototypeFromInstance;
global.getPropertyDescriptorPrototype = instrumentation_1.getPropertyDescriptorPrototype;
global.getPropertyDescriptorPrototypeFromInstance = instrumentation_1.getPropertyDescriptorPrototypeFromInstance;
if (Object.getOwnPropertyDescriptor(Object.prototype, 'instrumentation') === undefined) {
    Object.defineProperty(Object.prototype, 'instrumentation', {
        enumerable: false,
        configurable: false,
        get: function () {
            if (Object.getOwnPropertyDescriptor(this, '__instrumentation') === undefined) {
                let __instrumentation = new instrumentation_1.Instrumentation(this);
                Object.defineProperty(this, '__instrumentation', {
                    enumerable: false,
                    configurable: false,
                    get: function () {
                        return __instrumentation;
                    },
                    set: function (value) {
                        __instrumentation = value;
                    }
                });
            }
            return this.__instrumentation;
        },
        set: function (value) {
            this.__instrumentation = value;
        }
    });
}
function defineObjectMethod(name, value) {
    Object.defineProperty(Object.prototype, name, {
        enumerable: false,
        configurable: false,
        value: value
    });
}
defineObjectMethod('dispose', function () {
    if (this.isProxy) {
        this.proxyHandler.dispose();
    }
    if (this.__instrumentation !== undefined) {
        this.__instrumentation.dispose();
        this.__instrumentation = undefined;
    }
});
defineObjectMethod('bindOut', function (...params) {
    const instrumentation = this.instrumentation;
    let result = null;
    if (params.length === 1) {
        const arr = params[0];
        result = [];
        if (arr.length > 0) {
            if (arr[0] instanceof Array) {
                arr.forEach((element) => {
                    if (element.length === 2) {
                        result.push(instrumentation.bindOut(element[0], element[1]));
                    }
                    if (element.length === 3) {
                        if (typeof element[1] === 'function') {
                            result.push(instrumentation.bindOut(element[0], element[1], undefined, element[2]));
                        }
                        else {
                            result.push(instrumentation.bindOut(element[0], element[1], element[2]));
                        }
                    }
                    else if (element.length === 4) {
                        result.push(instrumentation.bindOut(element[0], element[1], element[2], element[3]));
                    }
                });
            }
            else {
                result.push(instrumentation.bindOut(arr[0], arr[1], arr[2], arr[3]));
            }
        }
    }
    else if (params.length > 1) {
        result = instrumentation.bindOut(params[0], params[1], params[2], params[3]);
    }
    return result;
});
function bindInProcessor(self, element, storage) {
    let result = undefined;
    if (element.length === 3) {
        if (typeof element[2] === 'function') {
            result = element[0].bindOut(element[1], element[2]);
        }
        else {
            result = element[0].bindOut(element[1], self, element[2]);
        }
    }
    else if (element.length === 4) {
        if (typeof element[2] === 'function') {
            result = element[0].bindOut(element[1], element[2], undefined, element[3]);
        }
        else {
            result = element[0].bindOut(element[1], self, element[2], element[3]);
        }
    }
    if (storage && result) {
        storage.push(result);
    }
    return result;
}
defineObjectMethod('bindIn', function (...params) {
    let result = null;
    if (params.length === 1) {
        const arr = params[0];
        result = [];
        if (arr.length > 0) {
            if (arr[0] instanceof Array) {
                arr.forEach((element) => {
                    bindInProcessor(this, element, result);
                });
            }
            else {
                bindInProcessor(this, arr, result);
            }
        }
    }
    else if (params.length > 1) {
        result = bindInProcessor(this, params);
    }
    return this;
});
defineObjectMethod('toProxy', function () {
    if (this.isProxy) {
        return this;
    }
    else {
        return proxy_handler_1.ObjectProxyHandler.create(this);
    }
});
defineObjectMethod('stringify', function () {
    return JSON.stringify(this);
});

//# sourceMappingURL=impl.js.map
