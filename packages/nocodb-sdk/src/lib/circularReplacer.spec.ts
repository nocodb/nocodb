import { getTrueCircularReplacer } from './circularReplacer';

describe('CircularReplacer', () => {
  it(`will stringify objects normally`, () => {
    const obj1 = {
      foo: 'foo',
      bar: 'bar',
      baz: 'baz',
    };
    const obj2 = {
      foo2: 'foo2',
      bar2: 'bar2',
      baz2: 'baz2',
    };
    const obj3 = {
      foo3: 'foo3',
      bar3: 'bar3',
      baz3: 'baz3',
    };
    const objToStringify = {
      ...obj1,
      obj2: {
        ...obj2,
        obj3,
      },
      obj3,
    };
    const result = JSON.stringify(objToStringify, getTrueCircularReplacer(), 2);

    const expectedResult = [
      `{`,
      `  "foo": "foo",`,
      `  "bar": "bar",`,
      `  "baz": "baz",`,
      `  "obj2": {`,
      `    "foo2": "foo2",`,
      `    "bar2": "bar2",`,
      `    "baz2": "baz2",`,
      `    "obj3": {`,
      `      "foo3": "foo3",`,
      `      "bar3": "bar3",`,
      `      "baz3": "baz3"`,
      `    }`,
      `  },`,
      `  "obj3": {`,
      `    "foo3": "foo3",`,
      `    "bar3": "bar3",`,
      `    "baz3": "baz3"`,
      `  }`,
      `}`,
    ];
    expect(result).toBe(expectedResult.join('\n'));
  });
  it(`will stringify objects normally with circular reference1`, () => {
    const obj1 = {
      foo: 'foo',
      bar: 'bar',
      baz: 'baz',
    };
    const obj2 = {
      foo2: 'foo2',
      bar2: 'bar2',
      baz2: 'baz2',
    };
    const obj3 = {
      foo3: 'foo3',
      bar3: 'bar3',
      baz3: 'baz3',
    };
    (obj1 as any).obj2 = obj2;
    (obj2 as any).obj1 = obj1;
    (obj1 as any).obj1 = obj1;
    const objToStringify = {
      obj1,
      obj3,
    };
    (obj3 as any).objToStringify = objToStringify;

    const result = JSON.stringify(objToStringify, getTrueCircularReplacer(), 2);
    const expectedResult = [
      `{`,
      `  "obj1": {`,
      `    "foo": "foo",`,
      `    "bar": "bar",`,
      `    "baz": "baz",`,
      `    "obj2": {`,
      `      "foo2": "foo2",`,
      `      "bar2": "bar2",`,
      `      "baz2": "baz2"`,
      `    }`,
      `  },`,
      `  "obj3": {`,
      `    "foo3": "foo3",`,
      `    "bar3": "bar3",`,
      `    "baz3": "baz3"`,
      `  }`,
      `}`,
    ];
    expect(result).toBe(expectedResult.join('\n'));
  });
  it(`will stringify objects normally with circular reference2`, () => {
    const obj1 = {
      foo: 'foo',
      bar: 'bar',
      baz: 'baz',
    };
    const obj2 = {
      foo2: 'foo2',
      bar2: 'bar2',
      baz2: 'baz2',
    };
    const obj3 = {
      foo3: 'foo3',
      bar3: 'bar3',
      baz3: 'baz3',
    };
    (obj1 as any).obj2 = obj2;
    (obj2 as any).obj1 = obj1;
    (obj1 as any).obj1 = obj1;
    const objToStringify = {
      ...obj1,
      obj2: {
        ...obj2,
        obj3,
      },
      obj3,
    };
    (obj3 as any).objToStringify = objToStringify;

    const result = JSON.stringify(objToStringify, getTrueCircularReplacer(), 2);
    const expectedResult = [
      `{`,
      `  "foo": "foo",`,
      `  "bar": "bar",`,
      `  "baz": "baz",`,
      `  "obj2": {`,
      `    "foo2": "foo2",`,
      `    "bar2": "bar2",`,
      `    "baz2": "baz2",`,
      `    "obj1": {`,
      `      "foo": "foo",`,
      `      "bar": "bar",`,
      `      "baz": "baz",`,
      `      "obj2": {`,
      `        "foo2": "foo2",`,
      `        "bar2": "bar2",`,
      `        "baz2": "baz2"`,
      `      }`,
      `    },`,
      `    "obj3": {`,
      `      "foo3": "foo3",`,
      `      "bar3": "bar3",`,
      `      "baz3": "baz3"`,
      `    }`,
      `  },`,
      `  "obj1": {`,
      `    "foo": "foo",`,
      `    "bar": "bar",`,
      `    "baz": "baz",`,
      `    "obj2": {`,
      `      "foo2": "foo2",`,
      `      "bar2": "bar2",`,
      `      "baz2": "baz2"`,
      `    }`,
      `  },`,
      `  "obj3": {`,
      `    "foo3": "foo3",`,
      `    "bar3": "bar3",`,
      `    "baz3": "baz3"`,
      `  }`,
      `}`,
    ];
    expect(result).toBe(expectedResult.join('\n'));
  });
});
