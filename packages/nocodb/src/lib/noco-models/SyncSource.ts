// import Noco from '../noco/Noco';
// import NocoCache from '../noco-cache/NocoCache';
// import {
//   CacheDelDirection,
//   CacheGetType,
//   CacheScope,
//   MetaTable
// } from '../utils/globals';
// // import Filter from './Filter';
// import Model from './Model';
// import HookFilter from './HookFilter';
//
// export default class SyncSource {
//   id?: string;
//   title?: string;
//   type?: string;
//   details?: string;
//   deleted?: boolean;
//   order?: number;
//   project_id?: number;
//
//   constructor(syncSource: Partial<SyncSource>) {
//     Object.assign(this, syncSource);
//   }
//
//   public static async get(syncSourceId: string, ncMeta = Noco.ncMeta) {
//     const hook = await ncMeta.metaGet2(
//       null,
//       null,
//       MetaTable.HOOKS,
//       syncSourceId
//     );
//     return hook && new SyncSource(hook);
//   }
//
//   static async list(ncMeta = Noco.ncMeta) {
//     let hooks = await NocoCache.getList(CacheScope.HOOK, [param.fk_model_id]);
//     if (!hooks.length) {
//       hooks = await ncMeta.metaList(null, null, MetaTable.HOOKS, {
//         condition: {
//           fk_model_id: param.fk_model_id
//           // ...(param.event ? { event: param.event?.toLowerCase?.() } : {}),
//           // ...(param.operation
//           //   ? { operation: param.operation?.toLowerCase?.() }
//           //   : {})
//         },
//         orderBy: {
//           created_at: 'asc'
//         }
//       });
//       await NocoCache.setList(CacheScope.HOOK, [param.fk_model_id], hooks);
//     }
//     // filter event & operation
//     if (param.event) {
//       hooks = hooks.filter(
//         h => h.event?.toLowerCase() === param.event?.toLowerCase()
//       );
//     }
//     if (param.operation) {
//       hooks = hooks.filter(
//         h => h.operation?.toLowerCase() === param.operation?.toLowerCase()
//       );
//     }
//     return hooks?.map(h => new Hook(h));
//   }
//
//   public static async insert(
//     hook: Partial<
//       Hook & {
//         created_at?;
//         updated_at?;
//       }
//     >,
//     ncMeta = Noco.ncMeta
//   ) {
//     const insertObj = {
//       fk_model_id: hook.fk_model_id,
//       title: hook.title,
//       description: hook.description,
//       env: hook.env,
//       type: hook.type,
//       event: hook.event?.toLowerCase?.(),
//       operation: hook.operation?.toLowerCase?.(),
//       async: hook.async,
//       payload: !!hook.payload,
//       url: hook.url,
//       headers: hook.headers,
//       condition: hook.condition,
//       notification:
//         hook.notification && typeof hook.notification === 'object'
//           ? JSON.stringify(hook.notification)
//           : hook.notification,
//       retries: hook.retries,
//       retry_interval: hook.retry_interval,
//       timeout: hook.timeout,
//       active: hook.active,
//       project_id: hook.project_id,
//       base_id: hook.base_id,
//       created_at: hook.created_at,
//       updated_at: hook.updated_at
//     };
//
//     if (!(hook.project_id && hook.base_id)) {
//       const model = await Model.getByIdOrName({ id: hook.fk_model_id }, ncMeta);
//       insertObj.project_id = model.project_id;
//       insertObj.base_id = model.base_id;
//     }
//
//     const { id } = await ncMeta.metaInsert2(
//       null,
//       null,
//       MetaTable.HOOKS,
//       insertObj
//     );
//
//     await NocoCache.appendToList(
//       CacheScope.HOOK,
//       [hook.fk_model_id],
//       `${CacheScope.HOOK}:${id}`
//     );
//
//     return this.get(id, ncMeta);
//   }
//
//   public static async update(
//     hookId: string,
//     hook: Partial<Hook>,
//     ncMeta = Noco.ncMeta
//   ) {
//     const updateObj = {
//       title: hook.title,
//       description: hook.description,
//       env: hook.env,
//       type: hook.type,
//       event: hook.event?.toLowerCase?.(),
//       operation: hook.operation?.toLowerCase?.(),
//       async: hook.async,
//       payload: !!hook.payload,
//       url: hook.url,
//       headers: hook.headers,
//       condition: !!hook.condition,
//       notification:
//         hook.notification && typeof hook.notification === 'object'
//           ? JSON.stringify(hook.notification)
//           : hook.notification,
//       retries: hook.retries,
//       retry_interval: hook.retry_interval,
//       timeout: hook.timeout,
//       active: hook.active
//     };
//
//     // get existing cache
//     const key = `${CacheScope.HOOK}:${hookId}`;
//     let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
//     if (o) {
//       // update data
//       o = { ...o, ...updateObj };
//       o.notification = updateObj.notification;
//       // set cache
//       await NocoCache.set(key, o);
//     }
//     // set meta
//     await ncMeta.metaUpdate(null, null, MetaTable.HOOKS, updateObj, hookId);
//
//     return this.get(hookId, ncMeta);
//   }
//
//   static async delete(hookId: any, ncMeta = Noco.ncMeta) {
//     // Delete Hook Filters
//     const filterList = await ncMeta.metaList2(
//       null,
//       null,
//       MetaTable.FILTER_EXP,
//       {
//         condition: { fk_hook_id: hookId }
//       }
//     );
//     for (const filter of filterList) {
//       await NocoCache.deepDel(
//         CacheScope.FILTER_EXP,
//         `${CacheScope.FILTER_EXP}:${filter.id}`,
//         CacheDelDirection.CHILD_TO_PARENT
//       );
//       await HookFilter.delete(filter.id);
//     }
//     // Delete Hook
//     await NocoCache.deepDel(
//       CacheScope.HOOK,
//       `${CacheScope.HOOK}:${hookId}`,
//       CacheDelDirection.CHILD_TO_PARENT
//     );
//     return await ncMeta.metaDelete(null, null, MetaTable.HOOKS, hookId);
//   }
// }
