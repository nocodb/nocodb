import type { NcUpgraderCtx } from './NcUpgrader';

export default async function (ctx: NcUpgraderCtx) {
  const projects = await ctx.ncMeta.projectList();

  for (const project of projects) {
    const projectConfig = JSON.parse(project.config);

    const envVal = projectConfig.envs?.dev;
    projectConfig.workingEnv = '_noco';

    if (envVal) {
      projectConfig.envs._noco = envVal;
      delete projectConfig.envs.dev;
    }
    await ctx.ncMeta.projectUpdate(project?.id, projectConfig);
  }
}
