"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("./index");
class Person {
    constructor() {
        this.name = 'original name';
        this.age = 40;
    }
}
class Test extends Object {
    constructor() {
        super();
        this.arr1 = [{ a1: 'aa22' }];
        this.map1 = new Map();
        this._obj1 = { p1: 'z1z1', name: '--- wilton lazary ---' };
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
    fire(value) {
        console.log(`fire: value=${JSON.stringify(value)}`);
    }
    dispose() {
        super['dispose']();
    }
}
const test = new Test();
// Data binding
test.bindOut('obj1.x.y/.*', test, 'message');
test.bindOut([
    ['+obj1.name', test, 'message'],
    ['obj1.data/.*', (value, detail) => {
            console.log('bindOut detail content:', JSON.stringify(detail.content));
        }],
    ['+arr1.*/.*', (value, detail) => {
            console.log('bindOut detail content:', JSON.stringify(detail.content));
        }],
    ['map1.*/.*', (value, detail) => {
            console.log('bindOut detail content:', JSON.stringify(detail.content));
        }],
    ['fire', (value, detail) => {
            console.log('bindOut detail content:', JSON.stringify(detail.content));
        }]
]);
test.bindIn([
    [test, 'obj1.data/.*', (value, detail) => {
            console.log('bindIn detail content:', JSON.stringify(detail.content));
        }]
]);
//Function binding tests
test.fire('function binding test');
//------------------------------------//
// Array deep data binding tests
test.arr1.push('xxx-xxx');
test.arr1.push({ z: 1 });
test.arr1[0].name1 = 'xx';
test.arr1.length = 0;
//------------------------------------//
// Map deep data binding tests
test.map1.set('name', 'wilton lazary');
test.map1.set('data1', {});
test.map1.forEach((value, key) => {
    console.log(`key:${key} value:${value}`);
    if (value instanceof Object) {
        value.bzbz = 4;
    }
});
test.map1.delete('data1');
test.map1.clear();
//------------------------------------//
// Object deep data binding tests
test.obj1 = { x: { y: { z: 1 } } };
test.obj1.x.y.z = {};
test.obj1.x.y = 10;
delete test.obj1.x;
test.obj1 = new Person();
test.obj1.name = 'new name';
test.obj1.data = { count: 1, content: '---' };
test.obj1.data.content = { type: 'new_content' };
//------------------------------------//
// Cleanup
test.dispose();
//------------------------------------// 

//# sourceMappingURL=test.js.map
