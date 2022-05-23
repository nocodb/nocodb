// import chai from 'chai';
// import chaiAsPromised from 'chai-as-promised';
// const expect = chai.expect;
//
// chai.use(chaiAsPromised);
// import 'mocha';
// import NcConfigFactory from '../lib/utils/NcConfigFactory';
// import express from 'express';
// import Noco from '../lib';
// import UITypes from '../lib/sqlUi/UITypes';
// import { Api } from 'nc-common';
//
// const knex = require('knex');
//
// process.env.NODE_ENV = 'test';
// process.env.TEST = 'test';
// const dbName = `test_meta`;
// process.env[`DATABASE_URL`] = `mysql2://root:password@localhost:3306/${dbName}`;
// // process.env[`DATABASE_URL`] = `pg://postgres:password@localhost:5432/${dbName}`;
// // process.env[
// //   `DATABASE_URL`
// // ] = `mssql://sa:Password123.@localhost:1433/${dbName}`;
//
// const dbConfig = NcConfigFactory.urlToDbConfig(
//   NcConfigFactory.extractXcUrlFromJdbc(
//     // 'sqlite:////Users/pranavc/xgene/nc/packages/nocodb/tests/sqlite-dump/sakila.db')
//     process.env[`DATABASE_URL`]
//   )
// );
//
// describe('Noco v2 Tests', function() {
//   const api = new Api({
//     baseURL: 'http://localhost:8080'
//   });
//
//   // Called once before any of the tests in this block begin.
//   before(async function() {
//     this.timeout(200000);
//     try {
//       await knex(dbConfig).raw(`DROP DATABASE test_db_12345`);
//     } catch {}
//     try {
//       await knex(dbConfig).raw(`DROP DATABASE test_meta`);
//     } catch {}
//
//     const server = express();
//     server.use(await Noco.init());
//     server.listen('8080');
//   });
//
//   after(done => {
//     done();
//     process.exit();
//   });
//
//   describe('Meta API Tests', function() {
//     this.timeout(10000);
//
//     it('Project create - existing external DB', async function() {
//       this.timeout(120000);
//
//       const { data: project } = await api.meta.projectCreate({
//         title: 'test',
//         bases: [
//           {
//             type: 'mysql2',
//             host: 'localhost',
//             port: 3306,
//             username: 'root',
//             password: 'password',
//             database: 'sakila'
//           }
//         ]
//       });
//
//       const {
//         data: {
//           tables: { list: tablesList }
//         }
//       } = await api.meta.tableList({
//         projectId: project.id,
//         baseId: project.bases[0].id
//       });
//       const filmTableId = tablesList.find(t => t.tn === 'film')?.id;
//       const countryTableId = tablesList.find(t => t.tn === 'country')?.id;
//
//       const { data: filmData } = await api.data.list(filmTableId);
//
//       expect(filmData).length.gt(0);
//
//       const { data: countryData } = await api.data.list(countryTableId);
//
//       expect(countryData).length.gt(0);
//     });
//
//     it('Project create & table create - v2', async function() {
//       this.timeout(120000);
//
//       const projectRes = await api.meta.projectCreate({
//         title: 'test',
//         bases: [
//           {
//             type: 'mysql2',
//             host: 'localhost',
//             port: 3306,
//             username: 'root',
//             password: 'password',
//             database: 'test_db_12345'
//           }
//         ]
//       });
//
//       // const projectId = projectRes.data.id;
//       // const baseId = projectRes.data.bases[0].id;
//
//       const tableRes = await api.meta.tableCreate(
//         projectRes.data.id,
//         projectRes.data.bases[0].id,
//         {
//           tn: 'abc',
//           _tn: 'Abc',
//           columns: [
//             {
//              column_name:'id',
//               _cn: 'Id',
//               dt: 'int',
//               dtx: 'integer',
//               ct: 'int(11)',
//               nrqd: false,
//               rqd: true,
//               ck: false,
//               pk: true,
//               un: false,
//               ai: true,
//               cdf: null,
//               clen: null,
//               np: null,
//               ns: 0,
//               dtxp: '',
//               dtxs: '',
//               altered: 1,
//               uidt: 'ID',
//               uip: '',
//               uicn: ''
//             },
//             {
//              column_name:'title',
//               _cn: 'Title',
//               dt: 'varchar',
//               dtx: 'specificType',
//               ct: 'varchar(45)',
//               nrqd: true,
//               rqd: false,
//               ck: false,
//               pk: false,
//               un: false,
//               ai: false,
//               cdf: null,
//               clen: 45,
//               np: null,
//               ns: null,
//               dtxp: '45',
//               dtxs: '',
//               altered: 1,
//               uidt: 'SingleLineText',
//               uip: '',
//               uicn: ''
//             }
//           ]
//         }
//       );
//
//       console.log(projectRes.data, tableRes.data);
//
//       const tableId = tableRes.data.id;
//
//       const data = await api.data.list(tableId);
//       console.log(data.data);
//       expect(data.data).to.have.length(0);
//
//       const createData = await api.data.create(tableId, {
//         Title: 'test'
//       });
//
//       console.log(createData.data);
//       const listData = await api.data.list(tableId);
//       expect(listData.data).to.have.length(1);
//
//       const readData = await api.data.read(tableId, createData.data.Id);
//
//       console.log(readData.data);
//
//       await api.data.update(tableId, createData.data.Id, {
//         Title: 'new val'
//       });
//
//       const updatedData = await api.data.read(tableId, createData.data.Id);
//
//       console.log(updatedData.data);
//
//       expect(updatedData.data);
//
//       await api.data.delete(tableId, createData.data.Id);
//
//       const listData1 = await api.data.list(tableId);
//       expect(listData1.data).to.have.length(0);
//       const tableDelRes = await api.meta.tableDelete(tableId);
//       await expect(
//         api.data.list(tableId)
//         // @ts-ignore
//       ).to.be.rejectedWith(Error);
//
//       console.log(tableDelRes.data);
//     });
//
//     it('Table update - column add', async function() {
//       this.timeout(120000);
//
//       const projectRes = await api.meta.projectCreate({
//         title: 'test',
//         bases: [
//           {
//             type: 'mysql2',
//             host: 'localhost',
//             port: 3306,
//             username: 'root',
//             password: 'password',
//             database: 'test_db_12345'
//           }
//         ]
//       });
//
//       const projectId = projectRes.data.id;
//       const baseId = projectRes.data.bases[0].id;
//
//       const { data: table } = await api.meta.tableCreate(projectId, baseId, {
//         tn: 'abc',
//         _tn: 'Abc',
//         columns: [
//           {
//            column_name:'id',
//             _cn: 'Id',
//             dt: 'int',
//             dtx: 'integer',
//             ct: 'int(11)',
//             nrqd: false,
//             rqd: true,
//             ck: false,
//             pk: true,
//             un: false,
//             ai: true,
//             cdf: null,
//             clen: null,
//             np: null,
//             ns: 0,
//             dtxp: '',
//             dtxs: '',
//             altered: 1,
//             uidt: 'ID',
//             uip: '',
//             uicn: ''
//           }
//         ]
//       });
//
//       const { data: tableMeta }: any = await api.meta.columnCreate(table.id, {
//        column_name:'title1',
//         _cn: 'Title1',
//         dt: 'varchar',
//         dtxp: '45',
//         uidt: UITypes.SingleLineText
//       });
//
//       await api.data.create(tableMeta.id, {
//         Title1: 'test'
//       });
//       await api.data.create(tableMeta.id, {
//         Title1: 'test1'
//       });
//
//       console.log(tableMeta);
//
//       const { data: tableFormulaMeta }: any = await api.meta.columnCreate(
//         table.id,
//         {
//           _cn: 'formula',
//           uidt: UITypes.Formula,
//           formula: 'Id + 1'
//         } as any
//       );
//
//       console.log(tableFormulaMeta);
//
//       const { data: listData } = await api.data.list(tableMeta.id);
//
//       console.log(listData);
//
//       const { data: tableMetaAfterUpdate } = await api.meta.columnUpdate(
//         table.id,
//         tableMeta.columns.find(c => c.cn === 'title1')?.id,
//         {
//          column_name:'title1',
//           _cn: 'Title1',
//           dt: 'text',
//           dtxp: '',
//           uidt: UITypes.LongText
//         }
//       );
//
//       console.log(tableMetaAfterUpdate);
//
//       // delete column
//       const { data: tableMetaAfterDel } = await api.meta.columnDelete(
//         table.id,
//         tableMeta.columns.find(c => c.cn === 'title1')?.id
//       );
//
//       console.log(tableMetaAfterDel);
//     });
//   });
//
//   it('Table relation create', async function() {
//     this.timeout(120000);
//
//     const projectRes = await api.meta.projectCreate({
//       title: 'test',
//       bases: [
//         {
//           type: 'mysql2',
//           host: 'localhost',
//           port: 3306,
//           username: 'root',
//           password: 'password',
//           database: 'test_db_12345'
//         }
//       ]
//     });
//
//     const projectId = projectRes.data.id;
//     const baseId = projectRes.data.bases[0].id;
//
//     const { data: table1 } = await api.meta.tableCreate(projectId, baseId, {
//       tn: 'abc',
//       _tn: 'Abc',
//       columns: [
//         {
//          column_name:'id',
//           _cn: 'Id',
//           dt: 'int',
//           dtx: 'integer',
//           ct: 'int(11)',
//           nrqd: false,
//           rqd: true,
//           ck: false,
//           pk: true,
//           un: false,
//           ai: true,
//           cdf: null,
//           clen: null,
//           np: null,
//           ns: 0,
//           dtxp: '',
//           dtxs: '',
//           altered: 1,
//           uidt: 'ID',
//           uip: '',
//           uicn: ''
//         }
//       ]
//     });
//     const { data: table2 } = await api.meta.tableCreate(projectId, baseId, {
//       tn: 'def',
//       _tn: 'Def',
//       columns: [
//         {
//          column_name:'id',
//           _cn: 'Id',
//           dt: 'int',
//           dtx: 'integer',
//           ct: 'int(11)',
//           nrqd: false,
//           rqd: true,
//           ck: false,
//           pk: true,
//           un: false,
//           ai: true,
//           cdf: null,
//           clen: null,
//           np: null,
//           ns: 0,
//           dtxp: '',
//           dtxs: '',
//           altered: 1,
//           uidt: 'ID',
//           uip: '',
//           uicn: ''
//         }
//       ]
//     });
//
//     const { data: res } = await api.meta.columnCreate(table1.id, {
//       uidt: UITypes.LinkToAnotherRecord,
//       parentId: table1.id,
//       childId: table2.id,
//       type: 'hm',
//       _cn: 'test'
//     } as any);
//     console.log(res);
//   });
//
//   it('Table relation(mm) create', async function() {
//     this.timeout(120000);
//
//     const projectRes = await api.meta.projectCreate({
//       title: 'test',
//       bases: [
//         {
//           type: 'mysql2',
//           host: 'localhost',
//           port: 3306,
//           username: 'root',
//           password: 'password',
//           database: 'test_db_12345'
//         }
//       ]
//     });
//
//     const projectId = projectRes.data.id;
//     const baseId = projectRes.data.bases[0].id;
//
//     const { data: table1 } = await api.meta.tableCreate(projectId, baseId, {
//       tn: 'abc',
//       _tn: 'Abc',
//       columns: [
//         {
//          column_name:'id',
//           _cn: 'Id',
//           dt: 'int',
//           dtx: 'integer',
//           ct: 'int(11)',
//           nrqd: false,
//           rqd: true,
//           ck: false,
//           pk: true,
//           un: false,
//           ai: true,
//           cdf: null,
//           clen: null,
//           np: null,
//           ns: 0,
//           dtxp: '',
//           dtxs: '',
//           altered: 1,
//           uidt: 'ID',
//           uip: '',
//           uicn: ''
//         }
//       ]
//     });
//     const { data: table2 } = await api.meta.tableCreate(projectId, baseId, {
//       tn: 'def',
//       _tn: 'Def',
//       columns: [
//         {
//          column_name:'id',
//           _cn: 'Id',
//           dt: 'int',
//           dtx: 'integer',
//           ct: 'int(11)',
//           nrqd: false,
//           rqd: true,
//           ck: false,
//           pk: true,
//           un: false,
//           ai: true,
//           cdf: null,
//           clen: null,
//           np: null,
//           ns: 0,
//           dtxp: '',
//           dtxs: '',
//           altered: 1,
//           uidt: 'ID',
//           uip: '',
//           uicn: ''
//         }
//       ]
//     });
//
//     const { data: res } = await api.meta.columnCreate(table1.id, {
//       uidt: UITypes.LinkToAnotherRecord,
//       parentId: table1.id,
//       childId: table2.id,
//       type: 'mm',
//       _cn: 'test'
//     } as any);
//
//     console.log(res);
//
//     await api.data.create(table1.id, {
//       Title1: 'test1'
//     });
//     await api.data.create(table1.id, {
//       Title1: 'test2'
//     });
//     await api.data.create(table2.id, {
//       Title1: 'test3'
//     });
//
//     const { data } = await api.data.list(table1.id);
//     console.log(data);
//   });
// });
// /**
//  * @copyright Copyright (c) 2021, Xgene Cloud Ltd
//  *
//  * @author Naveen MR <oof1lab@gmail.com>
//  * @author Pranav C Balan <pranavxc@gmail.com>
//  *
//  * @license GNU AGPL version 3 or any later version
//  *
//  * This program is free software: you can redistribute it and/or modify
//  * it under the terms of the GNU Affero General Public License as
//  * published by the Free Software Foundation, either version 3 of the
//  * License, or (at your option) any later version.
//  *
//  * This program is distributed in the hope that it will be useful,
//  * but WITHOUT ANY WARRANTY; without even the implied warranty of
//  * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  * GNU Affero General Public License for more details.
//  *
//  * You should have received a copy of the GNU Affero General Public License
//  * along with this program. If not, see <http://www.gnu.org/licenses/>.
//  *
//  */
