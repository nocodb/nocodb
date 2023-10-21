import type { NcUpgraderCtx } from './NcUpgrader';

export default async function (ctx: NcUpgraderCtx) {
  const bases = await ctx.ncMeta.baseList();

  for (const base of bases) {
    const baseConfig = JSON.parse(base.config);
    baseConfig.env = '_noco';
    await ctx.ncMeta.baseUpdate(base?.id, baseConfig);
  }
}
