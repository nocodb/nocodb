// import { nocoExecute } from '../v1-legacy-resolver/NocoExecute';
// import { Router } from 'express';
// import Model from '../../models/Model';
// import Column from '../../models/Column';
// import UITypes from '../../sqlUi/UITypes';
// import LookupColumn from '../../models/LookupColumn';
// import RollupColumn from '../../models/RollupColumn';
// import Filter from '../../models/Filter';
// import Sort from '../../models/Sort';
// import LinkToAnotherRecordColumn from '../../models/LinkToAnotherRecordColumn';
// import jsep from 'jsep';
// import jsepTreeToFormula from '../common/helpers/jsepTreeToFormula';
// import FormulaColumn from '../../models/FormulaColumn';
// import Noco from '../Noco';
// import { MetaTable } from '../../utils/globals';
//
// export default function registerRestCtrl(ctx: {
//   router: Router;
//   baseId: string;
//   dbAlias: string;
//   // baseModels2: {
//   //   [key: string]: BaseModelSqlv2;
//   // };
//   dbDriver: any;
// }) {
//   const router = Router();
//
//   router.get('/api/v2/:model_name', async (req: any, res) => {
//     try {
//       console.time('Model.get');
//       const model = await Model.getByIdOrName({
//         id: req.params.model_id,
//         tn: req.params.model_name
//       });
//       console.timeEnd('Model.get');
//
//       console.time('BaseModel.get');
//       const baseModel = await Model.getBaseModelSQL({
//         id: model.id,
//         dbDriver: ctx.dbDriver
//       });
//       console.timeEnd('BaseModel.get');
//
//       console.time('BaseModel.defaultResolverReq');
//       const requestObj = {
//         [`${model._tn}List`]: await baseModel.defaultResolverReq(req.query)
//       };
//       console.timeEnd('BaseModel.defaultResolverReq');
//
//       console.time('nocoExecute');
//       const data = await nocoExecute(
//         requestObj,
//         {
//           [`${model._tn}List`]: async args => {
//             // console.log(
//             //   JSON.stringify(
//             //     await Filter.getFilterObject({ modelId: model.id }),
//             //     null,
//             //     2
//             //   )
//             // );
//
//             return await baseModel.list(args);
//           }
//         },
//         {},
//         req.query
//       );
//       console.timeEnd('nocoExecute');
//
//       res.json(data);
//     } catch (e) {
//       console.log(e);
//       res.status(500).json({ msg: e.message });
//     }
//   });
//   router.get('/api/v2/:model_name/:id', async (req: any, res) => {
//     try {
//       const model = await Model.getByIdOrName({
//         id: req.params.model_id,
//         tn: req.params.model_name
//       });
//
//       const baseModel = await Model.getBaseModelSQL({
//         id: model.id,
//         dbDriver: ctx.dbDriver
//       });
//
//       res.json(
//         await nocoExecute(
//           {
//             [`${model._tn}Read`]: await baseModel.defaultResolverReq(req?.query)
//           },
//           {
//             [`${model._tn}Read`]: async id => {
//               return await baseModel.readByPk(id);
//               // return row ? new ctx.types[model.title](row) : null;
//             }
//           },
//           {},
//           req.params.id
//         )
//       );
//     } catch (e) {
//       console.log(e);
//       res.status(500).json({ msg: e.message });
//     }
//   });
//
//   router.post('/generateLookup', async (_req: any, res) => {
//     try {
//       let country = await Model.getByIdOrName({
//         tn: 'country'
//       });
//       let city = await Model.getByIdOrName({
//         tn: 'city'
//       });
//
//       // await Column.insert<LookupColumn>({
//       //   base_id: ctx.baseId,
//       //   db_alias: 'db',
//       //   _cn: 'addressList',
//       //   fk_model_id: country.id,
//       //   ui_data_type: UITypes.Lookup,
//       //   fk_lookup_column_id: (await city.getColumns()).find(
//       //     c => c._cn === 'City => Address'
//       //   )?.id,
//       //   fk_relation_column_id: (await country.getColumns()).find(
//       //     c => c.uidt === UITypes.LinkToAnotherRecord
//       //   )?.id
//       // });
//       //
//       // await Column.insert<LookupColumn>({
//       //   base_id: ctx.baseId,
//       //   db_alias: 'db',
//       //   _cn: 'CityNames',
//       //   fk_model_id: country.id,
//       //   ui_data_type: UITypes.Lookup,
//       //   fk_lookup_column_id: (await city.getColumns()).find(
//       //     c => c.cn === 'city'
//       //   )?.id,
//       //   fk_relation_column_id: (await country.getColumns()).find(
//       //     c => c.uidt === UITypes.LinkToAnotherRecord
//       //   )?.id
//       // });
//       //
//       // await Column.insert<LookupColumn>({
//       //   base_id: ctx.baseId,
//       //   db_alias: 'db',
//       //   fk_model_id: city.id,
//       //   ui_data_type: UITypes.Lookup,
//       //   _cn: 'Country Name',
//       //   fk_lookup_column_id: (await country.getColumns()).find(
//       //     c => c._cn === 'Country'
//       //   )?.id,
//       //   fk_relation_column_id: (await city.getColumns()).find(
//       //     c => c._cn === 'Country <= City'
//       //   )?.id
//       // });
//
//       await Model.clear({ id: city.id });
//       await Model.clear({ id: country.id });
//
//       country = await Model.getByIdOrName({
//         tn: 'country'
//       });
//       city = await Model.getByIdOrName({
//         tn: 'city'
//       });
//
//       let address = await Model.getByIdOrName({
//         tn: 'address'
//       });
//
//       await Column.insert<LookupColumn>({
//         base_id: ctx.baseId,
//         db_alias: 'db',
//         fk_model_id: address.id,
//         ui_data_type: UITypes.Lookup,
//         _cn: 'Country Name',
//         fk_lookup_column_id: (await city.getColumns()).find(
//           c => c._cn === 'Country Name'
//         )?.id,
//         fk_relation_column_id: (await address.getColumns()).find(
//           c => c._cn === 'City <= Address'
//         )?.id
//       });
//
//       // Rollup
//       await Column.insert<RollupColumn>({
//         base_id: ctx.baseId,
//         db_alias: 'db',
//         fk_model_id: country.id,
//         ui_data_type: UITypes.Rollup,
//         _cn: 'CityCount',
//         fk_rollup_column_id: (await city.getColumns()).find(
//           c => c._cn === 'CityId'
//         )?.id,
//         fk_relation_column_id: (await country.getColumns()).find(
//           c => c._cn === 'Country => City'
//         )?.id,
//         rollup_function: 'count'
//       });
//
//       await Model.clear({ id: city.id });
//       await Model.clear({ id: country.id });
//
//       country = await Model.getByIdOrName({
//         tn: 'country'
//       });
//       city = await Model.getByIdOrName({
//         tn: 'city'
//       });
//
//       // Filter
//       await Filter.insert({
//         fk_model_id: country.id,
//         logical_op: 'OR',
//         is_group: true,
//         children: [
//           {
//             fk_model_id: country.id,
//             fk_column_id: (await country.getColumns())?.find(
//               c => c._cn === 'CityCount'
//             )?.id,
//             comparison_op: 'eq',
//             value: '1'
//           }
//           // {
//           //   fk_model_id: country.id,
//           //   fk_column_id: (await country.getColumns())?.find(
//           //     c => c.alias === 'addressList'
//           //   )?.id,
//           //   comparison_op: 'like',
//           //   value: '%1836%'
//           // }
//           // {
//           //   fk_model_id: country.id,
//           //   fk_column_id: (await country.getColumns())?.find(
//           //     c => c.alias === 'Country => City'
//           //   )?.id,
//           //   comparison_op: 'like',
//           //   value: '%ban%'
//           // },
//           // {
//           //   fk_model_id: country.id,
//           //   logical_op: 'AND',
//           //   is_group: true,
//           //   children: [
//           //     {
//           //       fk_model_id: country.id,
//           //       fk_column_id: (await country.getColumns())?.find(
//           //         c => c.title === 'country'
//           //       )?.id,
//           //       comparison_op: 'like',
//           //       value: 'z%'
//           //     },
//           //     {
//           //       fk_model_id: country.id,
//           //       fk_column_id: (await country.getColumns())?.find(
//           //         c => c.title === 'country'
//           //       )?.id,
//           //       comparison_op: 'like',
//           //       value: '%a'
//           //     }
//           //   ]
//           // }
//         ]
//       });
//
//       // city - filter
//       // await Filter.insert({
//       //   fk_model_id: city.id,
//       //   logical_op: 'AND',
//       //   is_group: true,
//       //   children: [
//       //     {
//       //       fk_model_id: city.id,
//       //       fk_column_id: (await city.getColumns())?.find(
//       //         c => c.alias === 'Country <= City'
//       //       )?.id,
//       //       comparison_op: 'like',
//       //       value: '%dia%'
//       //     }
//       //   ]
//       // });
//
//       let film = await Model.getByIdOrName({
//         tn: 'film'
//       });
//       let actor = await Model.getByIdOrName({
//         tn: 'actor'
//       });
//       const category = await Model.getByIdOrName({
//         tn: 'category'
//       });
//
//       await Column.insert<LookupColumn>({
//         base_id: ctx.baseId,
//         db_alias: 'db',
//         fk_model_id: film.id,
//         ui_data_type: UITypes.Lookup,
//         _cn: 'CategoryNames',
//         fk_lookup_column_id: (await category.getColumns()).find(
//           c => c._cn === 'Name'
//         )?.id,
//         fk_relation_column_id: (await film.getColumns()).find(
//           c => c._cn === 'Film <=> Category'
//         )?.id
//       });
//       film = await Model.getByIdOrName({
//         tn: 'film'
//       });
//       await Column.insert<LookupColumn>({
//         base_id: ctx.baseId,
//         db_alias: 'db',
//         fk_model_id: actor.id,
//         ui_data_type: UITypes.Lookup,
//         _cn: 'CategoryNames',
//         fk_lookup_column_id: (await film.getColumns()).find(
//           c => c._cn === 'CategoryNames'
//         )?.id,
//         fk_relation_column_id: (await actor.getColumns()).find(
//           c => c._cn === 'Actor <=> Film'
//         )?.id
//       });
//       actor = await Model.getByIdOrName({
//         tn: 'actor'
//       });
//       // film - filter
//       await Filter.insert({
//         fk_model_id: actor.id,
//         logical_op: 'AND',
//         is_group: true,
//         children: [
//           {
//             fk_model_id: actor.id,
//             fk_column_id: (await actor.getColumns())?.find(
//               c => c._cn === 'CategoryNames'
//             )?.id,
//             comparison_op: 'eq',
//             value: 'Travel'
//           }
//         ]
//       });
//
//       await Sort.insert({
//         direction: 'desc',
//         fk_view_id: country.id,
//         fk_column_id: (await country.getColumns())?.find(
//           c => c._cn === 'CityCount'
//         )?.id
//       });
//
//       await Sort.insert({
//         direction: 'desc',
//         fk_view_id: city.id,
//         fk_column_id: (await city.getColumns())?.find(
//           c => c._cn === 'Country <= City'
//         )?.id
//       });
//
//       address = await Model.getByIdOrName({
//         tn: 'address'
//       });
//       await Sort.insert({
//         direction: 'desc',
//         fk_view_id: address.id,
//         fk_column_id: (await address.getColumns())?.find(
//           c => c._cn === 'Country Name'
//         )?.id
//       });
//
//       res.json({ msg: 'success' });
//     } catch (e) {
//       console.log(e);
//       res.status(500).json({ msg: e.message });
//     }
//   });
//
//   router.post('/generate', async (req: any, res) => {
//     try {
//       for (const body of Array.isArray(req.body) ? req.body : [req.body]) {
//         if (!body?.type) throw new Error("Missing 'type' property");
//
//         switch (body.type) {
//           case UITypes.Lookup:
//             {
//               validateParams(
//                 ['table', 'lookupColumn', 'alias', 'relationColumn'],
//                 body
//               );
//
//               const model = await Model.getByIdOrName({
//                 tn: body.table
//               });
//
//               const relationColumn = (await model.getColumns()).find(
//                 c =>
//                   (c._cn === body.relationColumn ||
//                     c.cn === body.relationColumn) &&
//                   c.uidt === UITypes.LinkToAnotherRecord
//               );
//
//               if (!relationColumn)
//                 throw new Error(
//                   `Relation column named '${body.relationColumn}' is not found`
//                 );
//
//               const relation = await relationColumn.getColOptions<
//                 LinkToAnotherRecordColumn
//               >();
//               const relatedModel = await (relation.type === 'hm'
//                 ? await relation.getChildColumn()
//                 : await relation.getParentColumn()
//               ).getModel();
//
//               const lookupColumn = (await relatedModel.getColumns()).find(
//                 c => c._cn === body.lookupColumn
//               );
//
//               await Column.insert<LookupColumn>({
//                 base_id: ctx.baseId,
//                 db_alias: 'db',
//                 _cn: body._tn,
//                 fk_model_id: model.id,
//                 ui_data_type: UITypes.Lookup,
//                 fk_lookup_column_id: lookupColumn?.id,
//                 fk_relation_column_id: relationColumn?.id
//               });
//             }
//             break;
//           case UITypes.Rollup:
//             {
//               validateParams(
//                 [
//                   'table',
//                   'rollupColumn',
//                   'relationColumn',
//                   'alias',
//                   'rollupFunction'
//                 ],
//                 body
//               );
//
//               const model = await Model.getByIdOrName({
//                 tn: body.table
//               });
//
//               const relationColumn = (await model.getColumns()).find(
//                 c =>
//                   (c._cn === body.relationColumn ||
//                     c.cn === body.relationColumn) &&
//                   c.uidt === UITypes.LinkToAnotherRecord
//               );
//
//               if (!relationColumn)
//                 throw new Error(
//                   `Relation column named '${body.relationColumn}' is not found`
//                 );
//
//               const relation = await relationColumn.getColOptions<
//                 LinkToAnotherRecordColumn
//               >();
//
//               if (relation.type === 'bt') throw new Error('');
//
//               const relatedModel = await (relation.type === 'hm'
//                 ? await relation.getChildColumn()
//                 : await relation.getParentColumn()
//               ).getModel();
//
//               const rollupColumn = (await relatedModel.getColumns()).find(
//                 c => c._cn === body.rollupColumn
//               );
//
//               await Column.insert<RollupColumn>({
//                 base_id: ctx.baseId,
//                 db_alias: 'db',
//                 _cn: body._tn,
//                 fk_model_id: model.id,
//                 ui_data_type: UITypes.Rollup,
//                 fk_relation_column_id: relationColumn.id,
//                 fk_rollup_column_id: rollupColumn.id,
//
//                 rollup_function: body.rollupFunction
//               });
//             }
//             break;
//           case UITypes.Formula:
//             {
//               validateParams(['table', 'formula', 'alias'], body);
//               const model = await Model.getByIdOrName({
//                 tn: body.table
//               });
//               const columns = await model.getColumns();
//               const substituteId = async (pt: any) => {
//                 if (pt.type === 'CallExpression') {
//                   for (const arg of pt.arguments || []) {
//                     await substituteId(arg);
//                   }
//                 } else if (pt.type === 'Literal') {
//                   return;
//                 } else if (pt.type === 'Identifier') {
//                   const colNameOrId = pt.name;
//                   const column = columns.find(
//                     c =>
//                       c.id === colNameOrId ||
//                       c.cn === colNameOrId ||
//                       c._cn === colNameOrId
//                   );
//                   pt.name = column.id;
//                 } else if (pt.type === 'BinaryExpression') {
//                   await substituteId(pt.left);
//                   await substituteId(pt.right);
//                 }
//               };
//
//               const parsedFormula = jsep(body.formula);
//               await substituteId(parsedFormula);
//               // console.log(parsedFormula);
//               const formula = jsepTreeToFormula(parsedFormula);
//
//               await Column.insert<FormulaColumn>({
//                 base_id: ctx.baseId,
//                 db_alias: 'db',
//                 _cn: body._tn,
//                 fk_model_id: model.id,
//                 ui_data_type: UITypes.Formula,
//                 formula
//               });
//             }
//
//             break;
//
//           case 'DeleteAllSort':
//             {
//               validateParams(['table'], body);
//               const model = await Model.getByIdOrName({
//                 tn: body.table
//               });
//               if (!model) {
//                 throw new Error(`Table not found - ${body.table}`);
//               }
//               await Sort.deleteAll(model.id);
//             }
//             break;
//           case 'Sort':
//             {
//               validateParams(['table', 'column', 'direction'], body);
//               const model = await Model.getByIdOrName({
//                 tn: body.table
//               });
//               if (!model) {
//                 throw new Error(`Table not found - ${body.table}`);
//               }
//
//               const columns = await model.getColumns();
//
//               const column = columns.find(
//                 c => c._cn === body.column || c.cn === body.column
//               );
//               if (!model) {
//                 throw new Error(`Column not found - ${body.column}`);
//               }
//
//               await Sort.insert({
//                 direction: body.direction || 'asc',
//                 fk_view_id: model.id,
//                 fk_column_id: column?.id
//               });
//             }
//             break;
//           case 'DeleteAllFilter':
//             {
//               validateParams(['table'], body);
//               const model = await Model.getByIdOrName({
//                 tn: body.table
//               });
//               if (!model) {
//                 throw new Error(`Table not found - ${body.table}`);
//               }
//               await Filter.deleteAll(model.id);
//             }
//             break;
//           case 'Filter':
//             {
//               validateParams(['table', 'filter'], body);
//               const model = await Model.getByIdOrName({
//                 tn: body.table
//               });
//               if (!model) {
//                 throw new Error(`Table not found - ${body.table}`);
//               }
//
//               const columns = await model.getColumns();
//
//               let filter = body.filter;
//               if (!filter.logical_op) {
//                 filter = {
//                   logical_op: 'OR',
//                   is_group: true,
//                   children: Array.isArray(filter) ? filter : [filter]
//                 };
//               }
//
//               const replaceWithId = async condition => {
//                 if (!condition) return;
//                 condition.fk_model_id = model.id;
//                 if (condition.logical_op) {
//                   condition.is_group = true;
//                   if (condition.children && !Array.isArray(condition.children))
//                     throw Error('children property should be an array');
//                   for (const con of condition.children || []) {
//                     await replaceWithId(con);
//                   }
//                 } else {
//                   const column = columns.find(
//                     c => c.cn === condition.column || c._cn === condition.column
//                   );
//                   if (!column)
//                     throw new Error(
//                       `Column with following name is not found ${condition.column}`
//                     );
//                   condition.fk_column_id = column.id;
//                   if (!('comparison_op' in condition)) {
//                     throw new Error('comparison_op not found');
//                   }
//                   if (!('value' in condition)) {
//                     throw new Error('value not found');
//                   }
//                 }
//               };
//               await replaceWithId(filter);
//               await Filter.insert(filter);
//             }
//             break;
//
//           case 'DeleteAllMetas':
//             {
//               // validateParams([''], body);
//
//               for (const model of await Model.list({
//                 project_id: ctx.baseId,
//                 base_id: ctx.dbAlias
//               })) {
//                 if (model?.id) {
//                   await Filter.deleteAll(model.id);
//                   await Sort.deleteAll(model.id);
//                 }
//               }
//               await Noco.ncMeta.metaDelete(
//                 null,
//                 null,
//                 MetaTable.COL_LOOKUP,
//                 {}
//               );
//               await Noco.ncMeta.metaDelete(
//                 null,
//                 null,
//                 MetaTable.COL_ROLLUP,
//                 {}
//               );
//               await Noco.ncMeta.metaDelete(
//                 null,
//                 null,
//                 MetaTable.COL_FORMULA,
//                 {}
//               );
//
//               await Noco.ncMeta.metaDelete(
//                 null,
//                 null,
//                 MetaTable.COLUMNS,
//                 null,
//                 {
//                   _or: [
//                     { ui_data_type: { eq: UITypes.Lookup } },
//                     { ui_data_type: { eq: UITypes.Rollup } },
//                     { ui_data_type: { eq: UITypes.Formula } }
//                   ]
//                 }
//               );
//             }
//             break;
//           default:
//             continue;
//         }
//       }
//
//       res.json({ msg: 'success' });
//     } catch (e) {
//       console.log(e);
//       res.status(500).json({ msg: e.message });
//     }
//   });
//   // args.router.use('/api/v2/:model_id', router);
//
//   ctx.router.use(router);
// }
//
// function validateParams(props: string[], body: any) {
//   for (const prop of props) {
//     if (!(prop in body))
//       throw new Error(`Missing '${prop}' property in request body`);
//   }
// }
