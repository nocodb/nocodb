import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport';
import isDocker from 'is-docker'
import Noco from '../Noco'
import { packageVersion } from '../utils/packageVersion'
import { ProjectsService } from './projects.service';


@UseGuards(AuthGuard('jwt'))
@Controller()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get('/api/v1/db/meta/projects/')
  list(@Query() queryParams: Record<string, any>, @Request() req){
    return this.projectsService.list({
      user: req.user,
      query: queryParams
    });
  }

  @Get('/api/v1/db/meta/projects/:projectId/info')
  async projectInfoGet() {
    return {
      Node: process.version,
      Arch: process.arch,
      Platform: process.platform,
      Docker: isDocker(),
      RootDB: Noco.getConfig()?.meta?.db?.client,
      PackageVersion: packageVersion,
    }
  }



  @Get('/api/v1/db/meta/projects/:projectId')
   async  projectGet(
    @Param('projectId') projectId: string,
  ) {
    const project = await this.projectsService.getProjectWithInfo({
      projectId: projectId,
    });

    this.projectsService.sanitizeProject(project);

    return project;
  }


  @Patch(
  '/api/v1/db/meta/projects/:projectId',
)
   async  projectUpdate(
    @Param('projectId') projectId: string,
    @Body() body: Record<string, any>,
  ) {
    const project = await this.projectsService.projectUpdate({
      projectId,
      project: body,
    });

    return project;
  }


  @Delete(
  '/api/v1/db/meta/projects/:projectId'
)
   async  projectDelete(
     @Param('projectId') projectId: string,
     ) {
    const deleted = await this.projectsService.projectSoftDelete({
      projectId
    });

    return deleted
  }

  @Post(
  '/api/v1/db/meta/projects'
)
  async  projectCreate(@Body() projectBody: Record<string, any>, @Request() req){
    const project = await this.projectsService.projectCreate({
      project: projectBody,
      user: req['user'],
    });

    return project;
  }




}


/*
// // Project CRUD



export async function projectCost(req, res) {
  let cost = 0;
  const project = await Project.getWithInfo(req.params.projectId);

  for (const base of project.bases) {
    const sqlClient = await NcConnectionMgrv2.getSqlClient(base);
    const userCount = await ProjectUser.getUsersCount(req.query);
    const recordCount = (await sqlClient.totalRecords())?.data.TotalRecords;

    if (recordCount > 100000) {
      // 36,000 or $79/user/month
      cost = Math.max(36000, 948 * userCount);
    } else if (recordCount > 50000) {
      // $36,000 or $50/user/month
      cost = Math.max(36000, 600 * userCount);
    } else if (recordCount > 10000) {
      // $240/user/yr
      cost = Math.min(240 * userCount, 36000);
    } else if (recordCount > 1000) {
      // $120/user/yr
      cost = Math.min(120 * userCount, 36000);
    }
  }

  T.event({
    event: 'a:project:cost',
    data: {
      cost,
    },
  });

  res.json({ cost });
}

export async function hasEmptyOrNullFilters(req, res) {
  res.json(await Filter.hasEmptyOrNullFilters(req.params.projectId));
}

export default (router) => {


  router.get(
    '/api/v1/db/meta/projects/:projectId/cost',
    metaApiMetrics,
    ncMetaAclMw(projectCost, 'projectCost')
  );



  router.get(
    '/api/v1/db/meta/projects/:projectId/has-empty-or-null-filters',
    metaApiMetrics,
    ncMetaAclMw(hasEmptyOrNullFilters, 'hasEmptyOrNullFilters')
  );
};

* */



