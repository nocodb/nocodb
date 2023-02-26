//
// import { Request, Response } from 'express';
// import { extractPropsAndSanitize } from '../meta/helpers/extractProps';
// import { projectService } from '../services';
//
// export async function getProject(req: Request<any, any, any>, res: Response<any>) {
//   const projectId = req.params.projectId;
//   const project = await projectService.getProjectWithInfo(projectId);
//   const sanitizedProject = projectService.sanitizeProject(project);
//   res.json(sanitizedProject);
// }
//
// export async function updateProject(req: Request<any, any, any>, res: Response<any>) {
//   const projectId = req.params.projectId;
//   const data = extractPropsAndSanitize(req?.body, ['title', 'meta', 'color']);
//   const result = await projectService.updateProject(projectId, data);
//   res.json(result);
// }
//
// export async function listProjects(req: Request<any, any, any>, res: Response<any>) {
//   const user = req.user;
//   const projects = await projectService.listProjects(user);
//   const pagedResponse = new PagedResponse(projects, projects.length, projects.length);
//   res.json(pagedResponse);
// }
//
// export async function deleteProject(req: Request<any, any, any>, res: Response<any>) {
//   const projectId = req.params.projectId;
//   const result = await projectService.softDeleteProject(projectId);
//   res.json(result);
// }
