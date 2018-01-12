"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const instrumentation_1 = require("./instrumentation");
let _currentBinderDispatchDetail = null;
let _bypassNextBinderDispatch = false;
let _abortNextBinderDispatch = false;
function currentBinderDispatchDetail() {
    return _currentBinderDispatchDetail;
}
exports.currentBinderDispatchDetail = currentBinderDispatchDetail;
function bypassNextBinderDispatch() {
    _bypassNextBinderDispatch = true;
}
exports.bypassNextBinderDispatch = bypassNextBinderDispatch;
function abortNextBinderDispatch() {
    _abortNextBinderDispatch = true;
}
exports.abortNextBinderDispatch = abortNextBinderDispatch;
function checkAbortNextBinderDispatch() {
    return _abortNextBinderDispatch;
}
exports.checkAbortNextBinderDispatch = checkAbortNextBinderDispatch;
function cleanAbortNextBinderDispatch() {
    _abortNextBinderDispatch = false;
}
exports.cleanAbortNextBinderDispatch = cleanAbortNextBinderDispatch;
class Binder {
    constructor(producerInstrumentation, producer, producerPropertyKey, producerPropertyPath, producerPropertyPathRegExp, producerPropertyCallTypeDetail, consumer, consumerPropertyKey, consumerPropertyCallType, deep, active) {
        this.producerInstrumentation = producerInstrumentation;
        this.producer = producer;
        this.producerPropertyKey = producerPropertyKey;
        this.producerPropertyPath = producerPropertyPath;
        this.producerPropertyPathRegExp = producerPropertyPathRegExp;
        this.producerPropertyCallTypeDetail = producerPropertyCallTypeDetail;
        this.consumer = consumer;
        this.consumerPropertyKey = consumerPropertyKey;
        this.consumerPropertyCallType = consumerPropertyCallType;
        this.deep = deep;
        this.active = active;
        this._disposed = false;
        this.consumerInstrumentation = null;
    }
    get producerOwner() {
        return this.producerInstrumentation.owner;
    }
    get consumerOwner() {
        return !!this.consumerInstrumentation ? this.consumerInstrumentation.owner : null;
    }
    get disposed() {
        return this._disposed;
    }
    dispatch(carrier, operation, path, match) {
        let result = undefined;
        if (_abortNextBinderDispatch) {
            _abortNextBinderDispatch = false;
            _bypassNextBinderDispatch = false;
            result = instrumentation_1.ABORT_ACTION;
        }
        else if (_bypassNextBinderDispatch) {
            _abortNextBinderDispatch = false;
            _bypassNextBinderDispatch = false;
        }
        else {
            const value = carrier.value;
            const oldValue = carrier.oldValue;
            let slicedValue = value;
            let slicedOldValue = oldValue;
            if (match === '<') {
                const templatePath = this.producerPropertyPath.slice(path.length);
                const basePath = path.slice(1);
                slicedValue = instrumentation_1.valueFromPath(value, templatePath, basePath);
                slicedOldValue = instrumentation_1.valueFromPath(oldValue, templatePath, basePath);
            }
            else if (match === '>') {
                slicedOldValue = instrumentation_1.valueFromPath(this.producerOwner, this.producerPropertyPath, path);
                //?is not possible to do a deep object clone and replace parts without compromises the immutability and relations?
                slicedValue = undefined;
            }
            const dispatchDetail = {
                binder: this,
                carrier: carrier,
                content: {
                    value: value,
                    oldValue: oldValue,
                    slicedValue: slicedValue,
                    slicedOldValue: slicedOldValue,
                    operation: operation,
                    path: path,
                    match: match,
                    changed: value != oldValue
                }
            };
            const savedBinderBinderDispatchDetail = _currentBinderDispatchDetail;
            _currentBinderDispatchDetail = dispatchDetail;
            try {
                if (this.consumerPropertyCallType === 'none') {
                    result = this.consumer(slicedValue, dispatchDetail);
                }
                else if (this.consumerPropertyCallType === 'function') {
                    if (this.producerPropertyCallTypeDetail[0] === 'function') {
                        result = this.consumer[this.consumerPropertyKey](...slicedValue);
                    }
                    else {
                        result = this.consumer[this.consumerPropertyKey](slicedValue);
                    }
                }
                else {
                    if (this.producerPropertyCallTypeDetail[0] === 'function') {
                        this.consumer[this.consumerPropertyKey] = slicedValue instanceof Array ? (slicedValue.length > 0 ? slicedValue[0] : undefined) : slicedValue;
                    }
                    else {
                        this.consumer[this.consumerPropertyKey] = slicedValue;
                    }
                }
            }
            finally {
                _currentBinderDispatchDetail = savedBinderBinderDispatchDetail;
            }
        }
        return result;
    }
    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            this.producerInstrumentation.unbindOut(this);
            if (this.consumerInstrumentation !== null) {
                this.consumerInstrumentation.unbindIn(this);
            }
        }
    }
}
exports.Binder = Binder;

//# sourceMappingURL=binder.js.map
