import { CircularRefContext } from './CircularRefContext';

const cweriu64Ax = {
  id: 'cweriu64Ax',
  title: 'col1',
  table: 'Table1',
};
const cx8sfE9AQz = {
  id: 'cx8sfE9AQz',
  title: 'col2',
  table: 'Table2',
};
const cleJBgyg1N = {
  id: 'cleJBgyg1N',
  title: 'col3',
  table: 'Table3',
};

const cpg4Ym5nl8 = {
  id: 'cpg4Ym5nl8',
  title: 'col4',
  table: 'Table4',
};

describe('CircularRefContext', () => {
  it(`will add refs without triggering circular issue`, () => {
    const refs = [cweriu64Ax, cx8sfE9AQz, cleJBgyg1N];
    const refContext = CircularRefContext.make();
    for (const each of refs) {
      refContext.add(each);
    }
    expect(refContext.refs.size).toBe(3);
  });
  it(`will add refs and triggering circular issue`, () => {
    const refs = [cweriu64Ax, cx8sfE9AQz, cleJBgyg1N, cx8sfE9AQz];
    expect(() => {
      const refContext = CircularRefContext.make();
      for (const each of refs) {
        refContext.add(each);
      }
    }).toThrow(
      `Detected circular ref for column '${cx8sfE9AQz.table}.${cx8sfE9AQz.title}', when evaluate column '${cweriu64Ax.table}.${cweriu64Ax.title}'`
    );
  });
  it(`will add refs and triggering circular issue when continuing refs`, () => {
    const refs = [cweriu64Ax, cx8sfE9AQz, cleJBgyg1N];
    const refs2 = [cpg4Ym5nl8, cx8sfE9AQz];

    expect(() => {
      const refContext = CircularRefContext.make();
      for (const each of refs) {
        refContext.add(each);
      }
      const refContext2 = CircularRefContext.make(refContext);
      for (const each of refs2) {
        refContext2.add(each);
      }
    }).toThrow(
      `Detected circular ref for column '${cx8sfE9AQz.table}.${cx8sfE9AQz.title}', when evaluate column '${cweriu64Ax.table}.${cweriu64Ax.title}'`
    );
  });
});
