// import { OracleUi, SqlUiFactory, UITypes } from 'nocodb-sdk';
import request from 'supertest';
// import { dbConfig } from '../../dbConfig';

const defaultColumns = [
  {
    ai: true,
    altered: 1,
    cdf: null,
    ck: false,
    clen: null,
    column_name: 'id',
    ct: 'int(11)',
    dt: 'int',
    dtx: 'integer',
    dtxp: '11',
    dtxs: '',
    np: 11,
    nrqd: false,
    ns: 0,
    pk: true,
    rqd: true,
    title: 'Id',
    uicn: '',
    uidt: 'ID',
    uip: '',
    un: true,
  },
  {
    ai: false,
    altered: 1,
    cdf: null,
    ck: false,
    clen: 45,
    column_name: 'title',
    ct: 'varchar(45)',
    dt: 'varchar',
    dtx: 'specificType',
    dtxp: '45',
    dtxs: '',
    np: null,
    nrqd: true,
    ns: null,
    pk: false,
    rqd: false,
    title: 'Title',
    uicn: '',
    uidt: 'SingleLineText',
    uip: '',
    un: false,
  },
  {
    ai: false,
    altered: 1,
    cdf: 'CURRENT_TIMESTAMP',
    ck: false,
    clen: 45,
    column_name: 'created_at',
    ct: 'varchar(45)',
    dt: 'timestamp',
    dtx: 'specificType',
    dtxp: '',
    dtxs: '',
    np: null,
    nrqd: true,
    ns: null,
    pk: false,
    rqd: false,
    title: 'CreatedAt',
    uicn: '',
    uidt: 'DateTime',
    uip: '',
    un: false,
  },
  {
    ai: false,
    altered: 1,
    cdf: 'CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP',
    ck: false,
    clen: 45,
    column_name: 'updated_at',
    ct: 'varchar(45)',
    dt: 'timestamp',
    dtx: 'specificType',
    dtxp: '',
    dtxs: '',
    np: null,
    nrqd: true,
    ns: null,
    pk: false,
    rqd: false,
    title: 'UpdatedAt',
    uicn: '',
    uidt: 'DateTime',
    uip: '',
    un: false,
  },
];

// const sqlUI = SqlUiFactory.create({ client: dbConfig.client }) as Exclude<
//   ReturnType<typeof SqlUiFactory['create']>,
//   typeof OracleUi
// >;

// const defaultColumn = async (name, type: UITypes) => {
//   // const defaultColumnAttr = {
//   //   ai: false,
//   //   altered: 1,
//   //   cdf: null,
//   //   ck: false,
//   //   dt: sqlUI.getDataTypeForUiType({ uidt: type }),
//   //   dtxp: sqlUI.getDefaultLengthForDatatype(type),
//   //   dtxs: sqlUI.getDefaultScaleForDatatype(type),
//   //   clen: null,
//   //   nrqd: true,
//   //   np: null,
//   //   ns: null,
//   //   pk: false,
//   //   rqd: false,
//   //   uip: '',
//   //   un: false,
//   //   uicn: '',
//   // };
//   switch (type) {
//     case UITypes.Number:
//       return {
//         // ...defaultColumnAttr,
//         column_name: name,
//         ct: 'int(11)',
//         dtx: 'integer',
//         np: 11,
//         ns: 0,
//         title: 'Id',
//         uidt: type,
//       };
//     case UITypes.SingleLineText:
//       return {
//         // ...defaultColumnAttr,
//         // clen: 45,
//         column_name: 'title',
//         // ct: 'varchar(45)',
//         // dtx: 'specificType',
//         title: 'Title',
//         uidt: 'SingleLineText',
//       };
//     case UITypes.Date:
//       return {
//         ck: false,
//         clen: 45,
//         column_name: 'date',
//         ct: 'varchar(45)',
//         dtx: 'specificType',
//         title: 'Date',
//         uidt: 'DateTime',
//         un: false,
//       };
//   }
// };

const createColumn = async (context, table, columnAttr) => {
  const response = await request(context.app)
    .post(`/api/v1/db/meta/tables/${table.id}/columns`)
    .set('xc-auth', context.token)
    .send({
      ...columnAttr,
    });
  return response.body;
};

export { defaultColumns, createColumn };
