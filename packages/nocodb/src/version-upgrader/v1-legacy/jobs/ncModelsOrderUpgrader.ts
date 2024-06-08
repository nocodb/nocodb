import type { NcBuilderUpgraderCtx } from '../BaseApiBuilder';

export default async function (ctx: NcBuilderUpgraderCtx) {
  const models = await ctx.xcMeta.metaList2(context.workspace_id, context.base_id, 'nc_models', {
    xcCondition: {
      _or: [{ type: { eq: 'table' } }, { type: { eq: 'view' } }],
    },
  });
  let order = 0;
  for (const model of models) {
    await ctx.xcMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      'nc_models',
      {
        order: ++order,
        view_order: 1,
      },
      model.id,
    );

    const views = await ctx.xcMeta.metaList2(context.workspace_id, context.base_id, 'nc_models', {
      condition: { parent_model_title: model.title },
    });
    let view_order = 1;
    for (const view of views) {
      await ctx.xcMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        'nc_models',
        {
          view_order: ++view_order,
        },
        view.id,
      );
    }
  }
}
