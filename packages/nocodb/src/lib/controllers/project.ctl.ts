import type { Request, Response } from 'express';
import type { ProjectType } from 'nocodb-sdk';
import Project from '../models/Project';
import type { ProjectListType } from 'nocodb-sdk';
import { packageVersion } from '../utils/packageVersion';
import { T } from 'nc-help';
import { PagedResponseImpl } from '../meta/helpers/PagedResponse';
import NcConnectionMgrv2 from '../utils/common/NcConnectionMgrv2';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import ProjectUser from '../models/ProjectUser';
import Noco from '../Noco';
import isDocker from 'is-docker';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import Filter from '../models/Filter';

import { projectService } from '../services';

// // Project CRUD

export async function projectGet(
  req: Request<any, any, any>,
  res: Response<Project>
) {
  const project = await projectService.getProjectWithInfo({
    projectId: req.params.projectId,
  });

  projectService.sanitizeProject(project);

  res.json(project);
}

export async function projectUpdate(
  req: Request<any, any, any>,
  res: Response<ProjectListType>
) {
  const project = await projectService.projectUpdate({
    projectId: req.params.projectId,
    project: req.body,
  });

  res.json(project);
}

export async function projectList(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response<ProjectListType>
) {
  const projects = await projectService.projectList({
    user: req.user,
    query: req.query,
  });

  res.json(
    new PagedResponseImpl(projects as ProjectType[], {
      count: projects.length,
      limit: projects.length,
    })
  );
}

export async function projectDelete(req: Request<any>, res: Response<boolean>) {
  const deleted = await projectService.projectSoftDelete({
    projectId: req.params.projectId,
  });

  res.json(deleted);
}

async function projectCreate(req: Request<any, any>, res) {
  const project = await projectService.projectCreate({
    project: req.body,
    user: req['user'],
  });

  res.json(project);
}

export async function projectInfoGet(_req, res) {
  res.json({
    Node: process.version,
    Arch: process.arch,
    Platform: process.platform,
    Docker: isDocker(),
    RootDB: Noco.getConfig()?.meta?.db?.client,
    PackageVersion: packageVersion,
  });
}

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
    '/api/v1/db/meta/projects/:projectId/info',
    metaApiMetrics,
    ncMetaAclMw(projectInfoGet, 'projectInfoGet')
  );
  router.get(
    '/api/v1/db/meta/projects/:projectId',
    metaApiMetrics,
    ncMetaAclMw(projectGet, 'projectGet')
  );
  router.patch(
    '/api/v1/db/meta/projects/:projectId',
    metaApiMetrics,
    ncMetaAclMw(projectUpdate, 'projectUpdate')
  );
  router.get(
    '/api/v1/db/meta/projects/:projectId/cost',
    metaApiMetrics,
    ncMetaAclMw(projectCost, 'projectCost')
  );
  router.delete(
    '/api/v1/db/meta/projects/:projectId',
    metaApiMetrics,
    ncMetaAclMw(projectDelete, 'projectDelete')
  );
  router.post(
    '/api/v1/db/meta/projects',
    metaApiMetrics,
    ncMetaAclMw(projectCreate, 'projectCreate')
  );
  router.get(
    '/api/v1/db/meta/projects',
    metaApiMetrics,
    ncMetaAclMw(projectList, 'projectList')
  );
  router.get(
    '/api/v1/db/meta/projects/:projectId/has-empty-or-null-filters',
    metaApiMetrics,
    ncMetaAclMw(hasEmptyOrNullFilters, 'hasEmptyOrNullFilters')
  );
};
