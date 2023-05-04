
import { DocsPageType, ProjectType, UserType } from "nocodb-sdk";
import Page from "../../../src/lib/models/Page";

const createPage = async ({attributes, user, project}:{attributes?: Partial<DocsPageType>, user: UserType, project: ProjectType}): Promise<DocsPageType> => {
  return await Page.create({
    attributes: {
      title: 'Test Page',
      description: 'Test Description',
      content: 'Test Content',
      ...attributes
    } as any,
    projectId: project.id!,
    
    user,
  });
}

const getPage = async ({id, user, project}:{id: string, user: UserType, project: ProjectType}): Promise<DocsPageType> => {
  return await Page.get({
    id,
    projectId: project.id!,
    
  });
}

const booksCount = async ({user, project}:{user: UserType, project: ProjectType}): Promise<number> => {
  return await Page.count({
    projectId: project.id!,
    
  });
}

const listPages = async ({user, project}:{user: UserType, project: ProjectType}): Promise<DocsPageType[]> => {
  return await Page.list({
    projectId: project.id!,
    
  });
}

const updatePage = async ({id, attributes, user, project}:{id: string, attributes: Partial<DocsPageType>, user: UserType, project: ProjectType}): Promise<DocsPageType> => {
  return await Page.update({
    pageId: id,
    attributes,
    projectId: project.id!,
    
    user,
  });
}

export { createPage, getPage, booksCount, listPages, updatePage }