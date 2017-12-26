"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const instrumentation_1 = require("./instrumentation");
let _currentBinderDispatchDetail = null;
let _bypassNextBinderDispatch = false;
function currentBinderDispatchDetail() {
    return _currentBinderDispatchDetail;
}
exports.currentBinderDispatchDetail = currentBinderDispatchDetail;
function bypassNextBinderDispatch() {
    _bypassNextBinderDispatch = true;
}
exports.bypassNextBinderDispatch = bypassNextBinderDispatch;
class Binder {
    constructor(outInstrumentation, producer, producerPropertyKey, producerPropertyPath, producerPropertyPathRegExp, producerPropertyCallTypeDetail, consumer, consumerPropertyKey, consumerPropertyCallType, deep, active) {
        this.outInstrumentation = outInstrumentation;
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
        this.inInstrumentation = null;
    }
    get outOwner() {
        return this.outInstrumentation.owner;
    }
    get inOwner() {
        return !!this.inInstrumentation ? this.inInstrumentation.owner : null;
    }
    get disposed() {
        return this._disposed;
    }
    dispatch(value, oldValue, operation, path, match) {
        let result = undefined;
        if (_bypassNextBinderDispatch) {
            _bypassNextBinderDispatch = false;
            result = instrumentation_1.ABORT_ACTION;
        }
        else {
            let valueLocal = value;
            let oldValueLocal = oldValue;
            if (match === '<') {
                const templatePath = this.producerPropertyPath.slice(path.length);
                valueLocal = instrumentation_1.valueFromPath(value, templatePath, path);
                oldValueLocal = instrumentation_1.valueFromPath(oldValue, templatePath, path);
            }
            else if (match === '>') {
                valueLocal = instrumentation_1.valueFromPath(this.outOwner, this.producerPropertyPath, path);
                oldValueLocal = undefined;
            }
            const dispatchDetail = {
                binder: this,
                content: {
                    dispatchedValue: value,
                    dispatchedOldValue: oldValue,
                    value: valueLocal,
                    oldValue: oldValueLocal,
                    operation: operation,
                    path: path,
                    match: match
                }
            };
            const savedBinderBinderDispatchDetail = _currentBinderDispatchDetail;
            _currentBinderDispatchDetail = dispatchDetail;
            try {
                if (this.consumerPropertyCallType === 'none') {
                    result = this.consumer(valueLocal, dispatchDetail);
                }
                else if (this.consumerPropertyCallType === 'function') {
                    if (this.producerPropertyCallTypeDetail[0] === 'function') {
                        result = this.consumer[this.consumerPropertyKey](...valueLocal);
                    }
                    else {
                        result = this.consumer[this.consumerPropertyKey](valueLocal);
                    }
                }
                else {
                    if (this.producerPropertyCallTypeDetail[0] === 'function') {
                        this.consumer[this.consumerPropertyKey] = valueLocal instanceof Array ? (valueLocal.length > 0 ? valueLocal[0] : undefined) : valueLocal;
                    }
                    else {
                        this.consumer[this.consumerPropertyKey] = valueLocal;
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
            this.outInstrumentation.unbindOut(this);
            if (this.inInstrumentation !== null) {
                this.inInstrumentation.unbindIn(this);
            }
        }
    }
}
exports.Binder = Binder;

//# sourceMappingURL=binder.js.map
