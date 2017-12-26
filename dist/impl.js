"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
global.bypassBinderDispatch = binder_1.bypassBinderDispatch;
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
    if (this.__instrumentation !== undefined) {
        this.__instrumentation.dispose();
        this.__instrumentation = undefined;
    }
};
Object.prototype['bind'] = function (expression, consumer, consumerPropertyKey, active) {
    return this.instrumentation.bindOut(expression, consumer, consumerPropertyKey, active);
};
Object.prototype['bindOut'] = function (params) {
    params.forEach(element => {
        if (element.length === 2) {
            this.bind(element[0], element[1]);
        }
        if (element.length === 3) {
            if (typeof element[1] === 'function') {
                this.bind(element[0], element[1], undefined, element[2]);
            }
            else {
                this.bind(element[0], element[1], element[2]);
            }
        }
        else if (element.length === 4) {
            this.bind(element[0], element[1], element[2], element[3]);
        }
    });
};
Object.prototype['bindIn'] = function (params) {
    params.forEach(element => {
        if (element.length === 3) {
            if (typeof element[2] === 'function') {
                element[0].bind(element[1], element[2]);
            }
            else {
                element[0].bind(element[1], this, element[2]);
            }
        }
        else if (element.length === 4) {
            if (typeof element[2] === 'function') {
                element[0].bind(element[1], element[2], undefined, element[3]);
            }
            else {
                element[0].bind(element[1], this, element[2], element[3]);
            }
        }
    });
    params.forEach(element => {
        if (typeof element[2] === 'function') {
            element[0].bind(element[1], element[2]);
        }
        else {
            element[0].bind(element[1], this, element[2]);
        }
    });
};

//# sourceMappingURL=impl.js.map
