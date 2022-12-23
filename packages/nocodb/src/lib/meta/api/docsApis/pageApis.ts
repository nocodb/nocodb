import { Request, Response, Router } from 'express';
import ncMetaAclMw from '../../helpers/ncMetaAclMw';
import apiMetrics from '../../helpers/apiMetrics';
import Page from '../../../models/Page';
import { UserType } from 'nocodb-sdk';
import { NcError } from '../../helpers/catchError';
import { fetchGHDocs } from '../../helpers/docImportHelpers';
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
    const page = await Page.get({
      id: req.params.id,
      projectId: req.query?.projectId as string,
      bookId: req.query?.bookId as string,
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
    const pages = await Page.list({
      bookId: req.query?.bookId as string,
      projectId: req.query?.projectId as string,
      parent_page_id: req.query?.parent_page_id as string,
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
    const page = await Page.create({
      attributes: req.body.attributes,
      bookId: req.body.bookId,
      projectId: req.body.projectId as string,
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
    const page = await Page.update({
      pageId: req.params.id,
      attributes: req.body.attributes,
      projectId: req.body.projectId as string,
      user: (req as any)?.session?.passport?.user as UserType,
      bookId: req.body.bookId,
    });

    res.json(page);
  } catch (e) {
    console.log(e);
    next(e);
  }
}

async function deletePage(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    await Page.delete({
      id: req.params.id,
      projectId: req.query?.projectId as string,
      bookId: req.query?.bookId,
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

      const pages = JSON.parse(response.data.choices[0].text);

      for (const page of pages.length ? pages : pages.data) {
        await handlePageJSON(
          page,
          req.body.bookId,
          undefined,
          (req as any)?.session?.passport?.user as UserType,
          req.query?.projectId as string
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
    try {
      const pages = [];
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
          req.body.bookId,
          undefined,
          (req as any)?.session?.passport?.user as UserType,
          req.query?.projectId as string
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
router.get('/api/v1/docs/page/:id', apiMetrics, ncMetaAclMw(get, 'pageList'));
router.get('/api/v1/docs/pages', apiMetrics, ncMetaAclMw(list, 'pageList'));
router.post('/api/v1/docs/page', apiMetrics, ncMetaAclMw(create, 'pageCreate'));
router.post('/api/v1/docs/magic', apiMetrics, ncMetaAclMw(magic, 'pageMagic'));
router.post(
  '/api/v1/docs/import',
  apiMetrics,
  ncMetaAclMw(directoryImport, 'directoryImport')
);
router.put(
  '/api/v1/docs/page/:id',
  apiMetrics,
  ncMetaAclMw(update, 'pageUpdate')
);
router.delete(
  '/api/v1/docs/page/:id',
  apiMetrics,
  ncMetaAclMw(deletePage, 'pageDelete')
);

export default router;
