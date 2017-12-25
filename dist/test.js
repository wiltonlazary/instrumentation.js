"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("./index");
class Person {
    constructor() {
        this.name = 'original name';
        this.age = 40;
    }
}
class Test {
    constructor() {
        this._obj1 = { x: { y: 1 } };
    }
    get obj1() {
        return this._obj1;
    }
    set obj1(value) {
        this._obj1 = value;
    }
    message(value) {
        console.log(`message: value=${JSON.stringify(value)}`);
    }
}
const test = new Test();
test.bindOut([
    ['obj1.x.y/.*', test, 'message'],
    ['obj1.name', test, 'message'],
    ['obj1.data/.*', (value, detail) => {
            console.log('detail:', detail);
        }]
]);
test.obj1.x.y = 10;
test.obj1 = { x: { y: {} } };
test.obj1.x.y.z = {};
delete test.obj1.x;
test.obj1 = new Person();
test.obj1.name = 'new name';
test.obj1.data = { count: 1, content: '---' };
test.obj1.data.content = { type: 'new_content' };
test.obj1 = null;

//# sourceMappingURL=test.js.map
