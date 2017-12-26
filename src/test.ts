import './index'

class Person {
    name: string = 'original name'
    age: number = 40
    data: any
}

class Test {
    _obj1: any = [{ p1: 'z1z1' }]

    get obj1() {
        return this._obj1
    }

    set obj1(value) {
        this._obj1 = value
    }

    message(value) {
        console.log(`message: value=${JSON.stringify(value)}`)
    }
}

const test = new Test() as any

// Data binding
test.bindOut([
    ['obj1.x.y/.*', test, 'message'],
    ['obj1.name', test, 'message'],
    ['obj1.data/.*', (value, detail) => {
        console.log('bindOut detail content:', JSON.stringify(detail.content))
    }],
    ['obj1.*/.*', (value, detail) => {
        console.log('bindOut detail content:', JSON.stringify(detail.content))
    }]
])

test.bindIn([
    [test, 'obj1.data/.*', (value, detail) => {
        console.log('bindIn detail content:', JSON.stringify(detail.content))
    }]
])

//TODO: array manipulation tests
//test.obj1.push('xxx-xxx')
test.obj1[0].name1 = 'xx'

// Object deep data binding tests
/* test.obj1 = { x: { y: { z: 1 } } }
test.obj1.x.y.z = {}
test.obj1.x.y = 10
delete test.obj1.x
test.obj1 = new Person()
test.obj1.name = 'new name'
test.obj1.data = { count: 1, content: '---' }
test.obj1.data.content = { type: 'new_content' } */


