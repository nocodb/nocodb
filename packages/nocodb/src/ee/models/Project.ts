import { Project as ProjectCE } from 'src/models';
import { ProjectTypes } from 'nocodb-sdk';
import DashboardProjectDBProject from '~/models/DashboardProjectDBProject';
import Noco from '~/Noco';

export default class Project extends ProjectCE {
  extended = {
    getLinkedDbProjects: async (ncMeta = Noco.ncMeta) => {
      const dbProjects = DashboardProjectDBProject.getDbProjectsList(
        {
          dashboard_project_id: this.id,
        },
        ncMeta,
      );

      return dbProjects;
    },
  };

  static async getWithInfo(
    projectId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ProjectCE> {
    let project: ProjectCE = await super.getWithInfo(projectId, ncMeta);

    if (project && project.type === ProjectTypes.DASHBOARD) {
      project = new Project(project);
      await project.extended.getLinkedDbProjects(ncMeta);
    }

    return project;
  }
}
