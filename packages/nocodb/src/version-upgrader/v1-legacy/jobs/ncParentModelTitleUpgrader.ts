import type { NcBuilderUpgraderCtx } from '../BaseApiBuilder';

export default async function (ctx: NcBuilderUpgraderCtx) {
  const views = await ctx.xcMeta.metaList(
    ctx.baseId,
    ctx.dbAlias,
    'nc_models',
    {
      condition: {
        type: 'vtable',
      },
    },
  );

  for (const view of views) {
    await ctx.xcMeta.metaUpdate(
      ctx.baseId,
      ctx.dbAlias,
      'nc_disabled_models_for_role',
      {
        parent_model_title: view.parent_model_title,
      },
      {
        type: 'vtable',
        title: view.title,
      },
    );
  }
}
