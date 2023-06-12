import type { NcUpgraderCtx } from './NcUpgrader';

export default async function (ctx: NcUpgraderCtx) {
  const projects = await ctx.ncMeta.projectList();

  for (const project of projects) {
    const projectConfig = JSON.parse(project.config);
    projectConfig.env = '_noco';
    await ctx.ncMeta.projectUpdate(project?.id, projectConfig);
  }
}
