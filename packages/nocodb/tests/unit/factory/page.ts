
import { BookType, DocsPageType, ProjectType, UserType } from "nocodb-sdk";
import Page from "../../../src/lib/models/Page";

const createPage = async ({attributes, user, project, book}:{attributes?: Partial<DocsPageType>, user: UserType, project: ProjectType; book: BookType}): Promise<DocsPageType> => {
  return await Page.create({
    attributes: {
      title: 'Test Page',
      description: 'Test Description',
      content: 'Test Content',
      ...attributes
    } as any,
    projectId: project.id!,
    bookId: book.id!,
    user,
  });
}

const getPage = async ({id, user, project, book}:{id: string, user: UserType, project: ProjectType, book: BookType}): Promise<DocsPageType> => {
  return await Page.get({
    id,
    projectId: project.id!,
    bookId: book.id!,
  });
}

const booksCount = async ({user, project, book}:{user: UserType, project: ProjectType, book: BookType}): Promise<number> => {
  return await Page.count({
    projectId: project.id!,
    bookId: book.id!,
  });
}

const listPages = async ({user, project, book}:{user: UserType, project: ProjectType, book: BookType}): Promise<DocsPageType[]> => {
  return await Page.list({
    projectId: project.id!,
    bookId: book.id!,
  });
}

const updatePage = async ({id, attributes, user, project, book}:{id: string, attributes: Partial<DocsPageType>, user: UserType, project: ProjectType, book: BookType}): Promise<DocsPageType> => {
  return await Page.update({
    pageId: id,
    attributes,
    projectId: project.id!,
    bookId: book.id!,
    user,
  });
}

export { createPage, getPage, booksCount, listPages, updatePage }