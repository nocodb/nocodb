import type { NcBuilderUpgraderCtx } from '../BaseApiBuilder';

export default async function (ctx: NcBuilderUpgraderCtx) {
  try {
    const relations = await ctx.xcMeta.metaList(
      ctx.baseId,
      ctx.dbAlias,
      'nc_relations',
    );

    const duplicates = [];

    for (const relation of relations) {
      if (relation.type !== 'real' || duplicates.includes(relation)) continue;
      const duplicateRelIndex = relations.findIndex(
        (rel) =>
          rel !== relation &&
          rel.tn === relation.tn &&
          rel.rtn === relation.rtn &&
          rel.cn === relation.cn &&
          rel.rcn === relation.rcn &&
          rel.type === 'real',
      );

      if (duplicateRelIndex > -1) duplicates.push(relations[duplicateRelIndex]);
    }

    // delete relation
    for (const dupRelation of duplicates) {
      await ctx.xcMeta.metaDelete(
        ctx.baseId,
        ctx.dbAlias,
        'nc_relations',
        dupRelation.id,
      );
      {
        const tnModel = await ctx.xcMeta.metaGet(
          ctx.baseId,
          ctx.dbAlias,
          'nc_models',
          {
            type: 'table',
            title: dupRelation.tn,
          },
        );

        const meta = JSON.parse(tnModel.meta);

        const duplicateBts = meta.belongsTo.filter(
          (bt) =>
            bt.tn === dupRelation.tn &&
            bt.rtn === dupRelation.rtn &&
            bt.cn === dupRelation.cn &&
            bt.rcn === dupRelation.rcn &&
            bt.type === 'real',
        );

        if (duplicateBts?.length > 1) {
          meta.belongsTo.splice(meta.belongsTo.indexOf(duplicateBts[1]), 1);
        }

        await ctx.xcMeta.metaUpdate(
          ctx.baseId,
          ctx.dbAlias,
          'nc_models',
          { meta: JSON.stringify(meta) },
          {
            type: 'table',
            title: dupRelation.tn,
          },
        );
      }
      {
        const rtnModel = await ctx.xcMeta.metaGet(
          ctx.baseId,
          ctx.dbAlias,
          'nc_models',
          {
            type: 'table',
            title: dupRelation.rtn,
          },
        );

        const meta = JSON.parse(rtnModel.meta);

        const duplicateHms = meta.hasMany.filter(
          (bt) =>
            bt.tn === dupRelation.tn &&
            bt.rtn === dupRelation.rtn &&
            bt.cn === dupRelation.cn &&
            bt.rcn === dupRelation.rcn &&
            bt.type === 'real',
        );

        if (duplicateHms?.length > 1) {
          meta.hasMany.splice(meta.hasMany.indexOf(duplicateHms[1]), 1);
        }
        await ctx.xcMeta.metaUpdate(
          ctx.baseId,
          ctx.dbAlias,
          'nc_models',
          { meta: JSON.stringify(meta) },
          {
            type: 'table',
            title: dupRelation.rtn,
          },
        );
      }
    }
  } catch (e) {
    console.log(e);
  }
}
