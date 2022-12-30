
import { BookType, ProjectType, UserType } from "nocodb-sdk";
import Book from "../../../src/lib/models/Book";

const createBook = async ({attributes, user, project}:{attributes?: Partial<BookType>, user: UserType, project: ProjectType}): Promise<BookType> => {
  return await Book.create({
    attributes: {
      title: 'Test Book',
      description: 'Test Description',
      ...attributes
    },
    projectId: project.id!,
    user,
  });
}

const getBook = async ({id, user, project}:{id: string, user: UserType, project: ProjectType}): Promise<BookType> => {
  return await Book.get({
    id,
    projectId: project.id!,
  });
}

const booksCount = async ({user, project}:{user: UserType, project: ProjectType}): Promise<number> => {
  return await Book.count({
    projectId: project.id!,
  });
}

const listBooks = async ({user, project}:{user: UserType, project: ProjectType}): Promise<BookType[]> => {
  return await Book.list({
    projectId: project.id!,
  });
}

const deleteBook = async ({id, user, project}:{id: string, user: UserType, project: ProjectType}): Promise<void> => {
  return await Book.delete({
    id,
    projectId: project.id!,
  });
}

export { createBook, getBook, booksCount, listBooks, deleteBook }