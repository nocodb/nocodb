import { MetaTableV1 } from '../../globals';
import { NcBuilderUpgraderCtx } from '../BaseApiBuilder';

export default async function (ctx: NcBuilderUpgraderCtx) {
  const views = await ctx.xcMeta.metaList(
    ctx.projectId,
    ctx.dbAlias,
    MetaTableV1.MODELS,
    {
      condition: {
        type: 'vtable',
      },
    }
  );

  for (const view of views) {
    await ctx.xcMeta.metaUpdate(
      ctx.projectId,
      ctx.dbAlias,
      MetaTableV1.DISABLED_MODELS_FOR_ROLE,
      {
        parent_model_title: view.parent_model_title,
      },
      {
        type: 'vtable',
        title: view.title,
      }
    );
  }
}
