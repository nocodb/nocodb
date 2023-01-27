import { Request, Response, Router } from 'express';
import ncMetaAclMw from '../../helpers/ncMetaAclMw';
import apiMetrics from '../../helpers/apiMetrics';
import Book from '../../../models/Book';
import { UserType } from 'nocodb-sdk';
import Page from '../../../models/Page';
import { NcError } from '../../helpers/catchError';
import { fetchGHDocs } from '../../helpers/docImportHelpers';
import JSON5 from 'json5';
const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

async function get(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    const page = await Book.get({
      id: req.params.id,
      projectId: req.query?.projectId as string,
    });

    res.json(page);
  } catch (e) {
    console.log(e);
    next(e);
  }
}

async function list(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    const pages = await Book.list({
      projectId: req.query?.projectId,
    });

    res // todo: pagination
      .json(pages);
  } catch (e) {
    console.log(e);
    next(e);
  }
}

async function create(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    const page = await Book.create({
      attributes: req.body.attributes,
      projectId: req.body.projectId,
      user: (req as any)?.session?.passport?.user as UserType,
    });

    res.json(page);
  } catch (e) {
    console.log(e);
    next(e);
  }
}

async function update(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    const page = await Book.update({
      id: req.params.id,
      attributes: req.body.attributes,
      user: (req as any)?.session?.passport?.user as UserType,
      projectId: req.body.projectId,
    });

    res.json(page);
  } catch (e) {
    console.log(e);
    next(e);
  }
}

async function destroy(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    await Book.delete({
      id: req.params.id,
      projectId: req.query?.projectId as string,
    });

    res.json({});
  } catch (e) {
    console.log(e);
    next(e);
  }
}

async function magic(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    let response;
    const { projectId } = req.body;

    const book = await Book.get({
      id: req.body.bookId,
      projectId,
    });

    if (!book) throw new Error('Book not found');

    try {
      response = await openai.createCompletion({
        model: 'text-davinci-003',
        prompt: `list required pages and nested sub-pages for '${req.body.title}' documentation Page: { title: string, pages: Page } as { data: Array<Page> } in json:`,
        temperature: 0.7,
        max_tokens: 4000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      });

      if (response.data.choices.length === 0) {
        NcError.badRequest('Failed to parse schema');
      }

      let pages = JSON5.parse(response.data.choices[0].text);
      pages = pages.length ? pages : pages.data;
      if (pages.length === 1) {
        // Skip the root page since it's the same as the book title
        pages = pages[0].pages;
      }

      for (const page of pages) {
        await handlePageJSON(
          page,
          book.id,
          undefined,
          (req as any)?.session?.passport?.user as UserType,
          projectId
        );
      }

      res.json(true);
    } catch (e) {
      console.log(response?.data?.choices[0]?.text);
      console.log(e);
      NcError.badRequest('Failed to parse schema');
    }
  } catch (e) {
    console.log(e);
    next(e);
  }
}

async function directoryImport(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    const { projectId } = req.body;
    try {
      const pages = [];

      const book = await Book.get({
        id: req.body.bookId,
        projectId,
      });

      if (!book) throw new Error('Book not found');

      switch (req.body.from) {
        case 'github':
          pages.push(
            ...(await fetchGHDocs(
              req.body.user,
              req.body.repo,
              req.body.branch,
              req.body.path,
              req.body.type
            ))
          );
          break;
        default:
          NcError.badRequest('Invalid type');
      }

      for (const page of pages) {
        await handlePageJSON(
          page,
          book.id,
          undefined,
          (req as any)?.session?.passport?.user as UserType,
          projectId as string
        );
      }

      res.json(true);
    } catch (e) {
      console.log(e);
      NcError.badRequest('Failed to parse schema');
    }
  } catch (e) {
    console.log(e);
    next(e);
  }
}

async function handlePageJSON(
  pg: any,
  bookId: string,
  parentPageId: string | undefined,
  user: UserType,
  projectId: string
) {
  const parentPage = await Page.create({
    attributes: {
      title: pg?.title,
      description: pg?.description,
      content: pg?.content || '',
      parent_page_id: parentPageId || null,
    },
    bookId: bookId,
    projectId,
    user: user,
  });

  if (pg.pages) {
    for (const page of pg.pages) {
      await handlePageJSON(page, bookId, parentPage.id, user, projectId);
    }
  }
}

const router = Router({ mergeParams: true });

// table data crud apis
router.get('/api/v1/docs/book/:id', apiMetrics, ncMetaAclMw(get, 'bookGet'));
router.get('/api/v1/docs/books', apiMetrics, ncMetaAclMw(list, 'bookList'));
router.post('/api/v1/docs/book', apiMetrics, ncMetaAclMw(create, 'bookCreate'));
router.put(
  '/api/v1/docs/book/:id',
  apiMetrics,
  ncMetaAclMw(update, 'bookUpdate')
);
router.delete(
  '/api/v1/docs/book/:id',
  apiMetrics,
  ncMetaAclMw(destroy, 'bookDelete')
);
router.post(
  '/api/v1/docs/book/magic',
  apiMetrics,
  ncMetaAclMw(magic, 'pageMagic')
);
router.post(
  '/api/v1/docs/book/import',
  apiMetrics,
  ncMetaAclMw(directoryImport, 'directoryImport')
);

export default router;
