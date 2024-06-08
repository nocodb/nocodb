import type { NcBuilderUpgraderCtx } from '../BaseApiBuilder';

export default async function (ctx: NcBuilderUpgraderCtx) {
  const views = await ctx.xcMeta.metaList2(context.workspace_id, context.base_id, 'nc_models', {
    condition: {
      type: 'vtable',
    },
  });

  for (const view of views) {
    await ctx.xcMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
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
