import { Request, Response, Router } from 'express';
import ncMetaAclMw from '../../helpers/ncMetaAclMw';
import apiMetrics from '../../helpers/apiMetrics';
import Page from '../../../models/Page';
import { UserType } from 'nocodb-sdk';
import { NcError } from '../../helpers/catchError';
import Project from '../../../models/Project';
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

async function getBySlug(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    const page = await Page.getBySlug({
      nestedSlug: req.query?.nestedSlug as string,
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
    const pages = await Page.nestedList({
      bookId: req.query?.bookId as string,
      projectId: req.query?.projectId as string,
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

async function drafts(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    const drafts = await Page.drafts({
      bookId: req.query?.bookId as string,
      projectId: req.query?.projectId as string,
    });

    res // todo: pagination
      .json(drafts);
  } catch (e) {
    console.log(e);
    next(e);
  }
}

async function batchPublish(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    if (!req.body?.pageIds) throw new Error('pageIds is required');
    // verify pageIds are an array
    if (!Array.isArray(req.body.pageIds)) {
      throw new Error('pageIds must be an array');
    }

    const user = (req as any)?.session?.passport?.user as UserType;
    const { projectId, bookId } = req.body;

    for (const pageId of req.body.pageIds) {
      await Page.publish({
        pageId,
        projectId,
        bookId,
        userId: user.id,
      });
    }
    res.json({});
  } catch (e) {
    console.log(e);
    next(e);
  }
}

async function magicExpand(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    let response;

    const project = await Project.getByTitleOrId(req.body.projectId);
    if (!project) throw new Error('Project not found');

    const parentPagesTitles = (
      await Page.parents({
        pageId: req.body.pageId,
        projectId: req.body.projectId,
        bookId: req.body.bookId,
      })
    ).map((p) => p.title);

    const page = await Page.get({
      id: req.body.pageId,
      projectId: req.body.projectId,
      bookId: req.body.bookId,
    });

    const markDownText = req.body.text;

    try {
      response = await openai.createCompletion({
        model: 'text-davinci-003',
        prompt: `On a page named '${page.title}', with categories as '${
          project.title
        }/${parentPagesTitles.join(
          '/'
        )}', expand on the following text(given in markdown) and output(should be in markdown): '${markDownText}'`,
        temperature: 0.7,
        max_tokens: 1500,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      });

      if (response.data.choices.length === 0)
        NcError.badRequest('Could not generate data');

      res.json({ text: response.data?.choices[0]?.text });
    } catch (e) {
      console.log(response?.data?.choices[0]?.text);
      console.log(e);
      NcError.badRequest('Could not generate data');
    }
  } catch (e) {
    console.log(e);
    next(e);
  }
}

async function magicOutline(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    let response;

    const project = await Project.getByTitleOrId(req.body.projectId);
    if (!project) throw new Error('Project not found');

    const parentPagesTitles = (
      await Page.parents({
        pageId: req.body.pageId,
        projectId: req.body.projectId,
        bookId: req.body.bookId,
      })
    ).map((p) => p.title);

    const page = await Page.get({
      id: req.body.pageId,
      projectId: req.body.projectId,
      bookId: req.body.bookId,
    });

    try {
      response = await openai.createCompletion({
        model: 'text-davinci-003',
        prompt: `On a page named '${page.title}', with meta data as '${
          project.title
        }/${parentPagesTitles.join(
          '/'
        )}', give initial page structure in markdown format`,
        temperature: 0.7,
        max_tokens: 1500,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      });

      if (response.data.choices.length === 0)
        NcError.badRequest('Could not generate data');

      console.log(response);

      res.json({ text: response.data?.choices[0]?.text });
    } catch (e) {
      console.log(response?.data?.choices[0]?.text);
      console.log(e);
      NcError.badRequest('Could not generate data');
    }
  } catch (e) {
    console.log(e);
    next(e);
  }
}

async function paginate(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    const {
      projectId,
      bookId,
      pageNumber,
      perPage,
      filterField,
      filterFieldValue,
      sortField,
      sortOrder,
    } = req.query as Record<string, string | undefined>;

    if (sortOrder && sortOrder !== 'asc' && sortOrder !== 'desc')
      throw new Error('sortOrder must be asc or desc');

    const data = await Page.paginate({
      projectId,
      bookId,
      pageNumber: parseInt(pageNumber, 10),
      perPage: parseInt(perPage, 10),
      condition: filterField ? { [filterField]: filterFieldValue } : {},
      order: sortOrder as any,
      orderBy: sortField,
    });

    res.json(data);
  } catch (e) {
    console.log(e);
    next(e);
  }
}

async function pageParents(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response,
  next
) {
  try {
    const { pageId, projectId, bookId } = req.query as Record<string, string>;

    const data = await Page.parents({
      pageId,
      projectId,
      bookId,
    });

    res.json(data);
  } catch (e) {
    console.log(e);
    next(e);
  }
}

const router = Router({ mergeParams: true });

// table data crud apis
router.get('/api/v1/docs/page/:id', apiMetrics, ncMetaAclMw(get, 'pageList'));
router.get(
  '/api/v1/docs/page-slug',
  apiMetrics,
  ncMetaAclMw(getBySlug, 'pageListBySlug')
);
router.get(
  '/api/v1/docs/page-parents',
  apiMetrics,
  ncMetaAclMw(pageParents, 'pageParents')
);
router.get('/api/v1/docs/pages', apiMetrics, ncMetaAclMw(list, 'pageList'));
router.get(
  '/api/v1/docs/page-drafts',
  apiMetrics,
  ncMetaAclMw(drafts, 'pageDraftsList')
);

router.post('/api/v1/docs/page', apiMetrics, ncMetaAclMw(create, 'pageCreate'));
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
router.post(
  '/api/v1/docs/page/batch-publish',
  apiMetrics,
  ncMetaAclMw(batchPublish, 'pageBatchPublish')
);
router.post(
  '/api/v1/docs/page/magic-expand',
  apiMetrics,
  ncMetaAclMw(magicExpand, 'pageMagicExpand')
);
router.post(
  '/api/v1/docs/page/magic-outline',
  apiMetrics,
  ncMetaAclMw(magicOutline, 'pageMagicOutline')
);
router.get(
  '/api/v1/docs/pages/paginate',
  apiMetrics,
  ncMetaAclMw(paginate, 'paginate')
);

export default router;
