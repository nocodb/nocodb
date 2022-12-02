import { MetaTableV1 } from '../../globals';
import { NcBuilderUpgraderCtx } from '../BaseApiBuilder';

export default async function (ctx: NcBuilderUpgraderCtx) {
  const models = await ctx.xcMeta.metaList(
    ctx.projectId,
    ctx.dbAlias,
    MetaTableV1.MODELS,
    {
      xcCondition: {
        _or: [{ type: { eq: 'table' } }, { type: { eq: 'view' } }],
      },
    }
  );
  let order = 0;
  for (const model of models) {
    await ctx.xcMeta.metaUpdate(
      ctx.projectId,
      ctx.dbAlias,
      MetaTableV1.MODELS,
      {
        order: ++order,
        view_order: 1,
      },
      model.id
    );

    const views = await ctx.xcMeta.metaList(
      ctx.projectId,
      ctx.dbAlias,
      MetaTableV1.MODELS,
      {
        condition: { parent_model_title: model.title },
      }
    );
    let view_order = 1;
    for (const view of views) {
      await ctx.xcMeta.metaUpdate(
        ctx.projectId,
        ctx.dbAlias,
        MetaTableV1.MODELS,
        {
          view_order: ++view_order,
        },
        view.id
      );
    }
  }
}
