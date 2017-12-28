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
Object.prototype['dispose'] = function () {
    if (this.isProxy) {
        this.proxyHandler.dispose();
    }
    if (this.__instrumentation !== undefined) {
        this.__instrumentation.dispose();
        this.__instrumentation = undefined;
    }
};
Object.prototype['bindOut'] = function (...params) {
    const instrumentation = this.instrumentation;
    if (params.length === 1) {
        params[0].forEach(element => {
            if (element.length === 2) {
                instrumentation.bindOut(element[0], element[1]);
            }
            if (element.length === 3) {
                if (typeof element[1] === 'function') {
                    instrumentation.bindOut(element[0], element[1], undefined, element[2]);
                }
                else {
                    instrumentation.bindOut(element[0], element[1], element[2]);
                }
            }
            else if (element.length === 4) {
                instrumentation.bindOut(element[0], element[1], element[2], element[3]);
            }
        });
    }
    else {
        instrumentation.bindOut(params[0], params[1], params[2], params[3]);
    }
    return this;
};
Object.prototype['bindIn'] = function (params) {
    params.forEach(element => {
        if (element.length === 3) {
            if (typeof element[2] === 'function') {
                element[0].bindOut(element[1], element[2]);
            }
            else {
                element[0].bindOut(element[1], this, element[2]);
            }
        }
        else if (element.length === 4) {
            if (typeof element[2] === 'function') {
                element[0].bindOut(element[1], element[2], undefined, element[3]);
            }
            else {
                element[0].bindOut(element[1], this, element[2], element[3]);
            }
        }
    });
    return this;
};
Object.prototype['toProxy'] = function () {
    if (this.isProxy) {
        return this;
    }
    else {
        return proxy_handler_1.ObjectProxyHandler.create(this);
    }
};

//# sourceMappingURL=impl.js.map
