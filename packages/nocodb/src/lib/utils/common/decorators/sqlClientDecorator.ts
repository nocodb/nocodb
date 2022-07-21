import schemaInspector from 'knex-schema-inspector';

export function modifyColumnList() {
  return function (_target, _key, fn: PropertyDescriptor) {
    const originalFn = fn.value;

    fn.value = function (...args) {
      const sqlClient = originalFn.call(this, ...args);
      sqlClient.columnList = getModifiedColumnListFn(
        this,
        args[0],
        sqlClient.columnList
      );
      return sqlClient;
    };
    return fn;
  };
}

function getModifiedColumnListFn(
  NcConnectionMgrv2,
  base,
  originalColumnListFn
) {
  return function (...args) {
    return originalColumnListFn.call(this, ...args).then(async (columnList) => {
      if (columnList?.data?.list) {
        const columnsSchema = await schemaInspector(
          NcConnectionMgrv2.get(base)
        ).columnInfo(args[0].tn);

        // search column in schema and reset primary key from schema
        columnList.data.list = columnList.data.list.map((column) => {
          const columnSchema = columnsSchema.find(
            (columnSchema) => columnSchema.name === column.cn
          );
          if (columnSchema) {
            column.pk = columnSchema.is_primary_key;
          }
          return column;
        });
      }
      return columnList;
    });
  };
}

export default { modifyColumnList };
