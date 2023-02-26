// // services/project.service.ts
// import { OrgUserRoles, ProjectType } from 'nocodb-sdk'
// import Project from '../models/Project'
// import ProjectUser from '../models/ProjectUser'
// import { customAlphabet } from 'nanoid'
// import { NcError } from './helpers/catchError'
//
// const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz_', 4)
//
// export async function getProjectWithInfo(projectId: string) {
//   const project = await Project.getWithInfo(projectId)
//   return project
// }
//
// export function sanitizeProject(project: any) {
//   const sanitizedProject = { ...project }
//   sanitizedProject.bases?.forEach((b: any) => {
//     ['config'].forEach((k) => delete b[k])
//   })
//   return sanitizedProject
// }
//
// export async function updateProject(projectId: string, data: Partial<ProjectType>) {
//   const project = await Project.getWithInfo(projectId)
//   if (data?.title && project.title !== data.title && (await Project.getByTitle(data.title))) {
//     NcError.badRequest('Project title already in use')
//   }
//   const result = await Project.update(projectId, data)
//   return result
// }
//
// export async function listProjects(user: any) {
//   const projects = user?.roles?.includes(OrgUserRoles.SUPER_ADMIN)
//     ? await Project.list()
//     : await ProjectUser.getProjectsList(user.id)
//   return projects as ProjectType[]
// }
//
// export async function softDeleteProject(projectId: string) {
//   const result = await Project.softDelete(projectId)
//   return result
// }
