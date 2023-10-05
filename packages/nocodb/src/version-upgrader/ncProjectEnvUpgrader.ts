import type { NcUpgraderCtx } from './NcUpgrader';

export default async function (ctx: NcUpgraderCtx) {
  const bases = await ctx.ncMeta.baseList();

  for (const base of bases) {
    const baseConfig = JSON.parse(base.config);

    const envVal = baseConfig.envs?.dev;
    baseConfig.workingEnv = '_noco';

    if (envVal) {
      baseConfig.envs._noco = envVal;
      delete baseConfig.envs.dev;
    }
    await ctx.ncMeta.baseUpdate(base?.id, baseConfig);
  }
}
