import { Project as ProjectCE } from 'src/models';
import { ProjectTypes } from 'nocodb-sdk';
import DashboardProjectDBProject from '~/models/DashboardProjectDBProject';
import Noco from '~/Noco';

export default class Project extends ProjectCE {
  async getLinkedDbProjects(ncMeta = Noco.ncMeta): Promise<Project[]> {
    return (this.linked_db_projects =
      await DashboardProjectDBProject.getDbProjectsList(
        {
          dashboard_project_id: this.id,
        },
        ncMeta,
      ));
  }

  static async getWithInfo(
    projectId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Project | ProjectCE> {
    let project: Project | ProjectCE = await super.get(projectId, ncMeta);
    if (project && project.type === ProjectTypes.DASHBOARD) {
      project = new Project(project);
      await (project as Project).getLinkedDbProjects(ncMeta);
    }

    return project;
  }
}
