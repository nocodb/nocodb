import { Injectable } from '@nestjs/common';
import { UserType } from 'nocodb-sdk';
import { NcError } from 'src/helpers/catchError';
import Page from 'src/models/Page';
import { fetchGHDocs } from './helper/import';
import { Configuration, OpenAIApi } from 'openai';
import { Project } from 'src/models';
import JSON5 from 'json5';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

@Injectable()
export class PagesService {
  async get(param: {
    fields?: string[] | string;
    projectId: string;
    id: string;
  }) {
    let fields: any = param?.fields;
    if (fields) {
      fields = Array.isArray(fields) ? fields : [fields];
    }
    const page = await Page.get({
      id: param.id,
      projectId: param?.projectId as string,
      fields: fields as string[],
    });

    if (!page) throw NcError.notFound('Page not found');

    return page;
  }

  async list(param: { projectId: string }) {
    return await Page.nestedListAll({
      projectId: param.projectId as string,
    });
  }

  async create(param: {
    attributes: Parameters<typeof Page.create>[0]['attributes'];
    projectId: string;
    user: UserType;
  }) {
    return await Page.create(param);
  }

  async update(param: {
    attributes: Parameters<typeof Page.create>[0]['attributes'];
    projectId: string;
    user: UserType;
    pageId: string;
  }) {
    return await Page.update(param);
  }

  async delete(param: { id: string; projectId: string }) {
    await Page.delete(param);

    return true;
  }

  async magicExpand(param: {
    projectId: string;
    pageId: string;
    text: string;
  }) {
    let response;

    const project = await Project.getByTitleOrId(param.projectId);
    if (!project) NcError.notFound('Project not found');

    const parentPagesTitles = (
      await Page.parents({
        pageId: param.pageId,
        projectId: param.projectId,
      })
    ).map((p) => p.title);

    const page = await Page.get({
      id: param.pageId,
      projectId: param.projectId,
    });

    const markDownText = param.text;

    try {
      response = await openai.createCompletion({
        model: 'text-davinci-003',
        prompt: `On a page named '${page.title}', with categories as '${
          project.title
        }/${parentPagesTitles.join(
          '/',
        )}', expand on the following text(given in markdown) and output(should be in markdown): '${markDownText}'`,
        temperature: 0.7,
        max_tokens: 1500,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      });

      if (response.data.choices.length === 0)
        NcError.badRequest('Could not generate data');
    } catch (e) {
      console.log(response?.data?.choices[0]?.text);
      console.log(e);
      NcError.badRequest('Could not generate data');
    }

    return { text: response.data?.choices[0]?.text };
  }

  async magicOutline(param: { projectId: string; pageId: string }) {
    let response;

    const project = await Project.getByTitleOrId(param.projectId);
    if (!project) throw new Error('Project not found');

    const parentPagesTitles = (
      await Page.parents({
        pageId: param.pageId,
        projectId: param.projectId,
      })
    ).map((p) => p.title);

    const page = await Page.get({
      id: param.pageId,
      projectId: param.projectId,
    });

    try {
      response = await openai.createCompletion({
        model: 'text-davinci-003',
        prompt: `On a page named '${page.title}', with meta data as '${
          project.title
        }/${parentPagesTitles.join(
          '/',
        )}', give page structure in markdown format without meta data, and placeholder as --content-- in where content should be added`,
        temperature: 0.7,
        max_tokens: 1500,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      });

      if (response.data.choices.length === 0)
        NcError.badRequest('Could not generate data');
    } catch (e) {
      console.log(response?.data?.choices[0]?.text);
      console.log(e);
      NcError.badRequest('Could not generate data');
    }

    return { text: response.data?.choices[0]?.text };
  }

  async pageParents(param: { pageId: string; projectId: string }) {
    const { pageId, projectId } = param;

    return await Page.parents({
      pageId,
      projectId,
    });
  }

  async handlePageJSON(
    pg: any,
    parentPageId: string | undefined,
    user: UserType,
    projectId: string,
  ) {
    const parentPage = await Page.create({
      attributes: {
        title: pg?.title,
        description: pg?.description,
        content: pg?.content || '',
        parent_page_id: parentPageId || null,
      },
      projectId,
      user: user,
    });

    if (pg.pages) {
      for (const page of pg.pages) {
        await this.handlePageJSON(page, parentPage.id, user, projectId);
      }
    }
  }

  async magicCreatePages(param: {
    projectId: string;
    pageId: string;
    title: string;
    user: UserType;
  }) {
    let response;
    const { projectId, title, user } = param;

    try {
      response = await openai.createCompletion({
        model: 'text-davinci-003',
        prompt: `list required pages and nested sub-pages for '${title}' documentation Page: { title: string, pages: Page } as { data: Array<Page> } in json:`,
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
        await this.handlePageJSON(page, undefined, user as UserType, projectId);
      }
    } catch (e) {
      console.log(response?.data?.choices[0]?.text);
      console.log(e);
      NcError.badRequest('Failed to parse schema');
    }
    return true;
  }

  async directoryImport(param: {
    projectId: string;
    body: {
      user: string;
      path: string;
      type: string;
      from: string;
      repo: string;
      branch: string;
    };
    user: UserType;
  }) {
    const { projectId } = param;
    try {
      const pages = [];

      switch (param.body.from) {
        case 'github':
          pages.push(
            ...(await fetchGHDocs(
              param.body.user,
              param.body.repo,
              param.body.branch,
              param.body.path,
              param.body.type,
            )),
          );
          break;
        default:
          NcError.badRequest('Invalid type');
      }

      for (const page of pages) {
        await this.handlePageJSON(
          page,
          undefined,
          param.user as UserType,
          projectId as string,
        );
      }
    } catch (e) {
      console.log(e);
      NcError.badRequest('Failed to parse schema');
    }
    return true;
  }
}
