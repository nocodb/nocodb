import { Injectable } from '@nestjs/common';
import { Configuration, OpenAIApi } from 'openai';
import JSON5 from 'json5';
import axios from 'axios';
import listContent from 'list-github-dir-content';
import { marked } from 'marked';

import { PageDao } from '../../daos/page.dao';
import { DocsPagesUpdateService } from './docs-page-update.service';
import type { DocsPageType, UserType } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import { Base } from '~/models';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

@Injectable()
export class DocsPagesService {
  constructor(
    private readonly pagesDao: PageDao,
    private readonly pageUpdateService: DocsPagesUpdateService,
  ) {}

  async get(param: { fields?: string[] | string; baseId: string; id: string }) {
    let fields: any = param?.fields;
    if (fields) {
      fields = Array.isArray(fields) ? fields : [fields];
    }
    const page = await this.pagesDao.get({
      id: param.id,
      baseId: param?.baseId as string,
      fields: fields as string[],
    });

    if (!page) throw NcError.notFound('Page not found');

    return page;
  }

  async list(param: { baseId: string }) {
    return await this.pagesDao.nestedListAll({
      baseId: param.baseId as string,
    });
  }

  async create(param: {
    attributes: Partial<DocsPageType>;
    baseId: string;
    user: UserType;
  }) {
    return await this.pagesDao.create(param);
  }

  async update({
    attributes,
    baseId,
    user,
    pageId,
    workspaceId,
  }: {
    attributes: Partial<DocsPageType>;
    baseId: string;
    user: UserType;
    pageId: string;
    workspaceId: string;
  }) {
    const service = this.pageUpdateService;
    return await service.process({
      pageId,
      baseId,
      attributes,
      user,
      workspaceId,
    });
  }

  async delete(param: { id: string; baseId: string }) {
    await this.pagesDao.delete(param);

    return true;
  }

  async magicExpand(param: {
    baseId: string;
    pageId: string;
    promptText: string;
    selectedPageText: string;
    response: any;
  }) {
    const response = param.response;
    const base = await Base.getByTitleOrId(param.baseId);
    if (!base) NcError.notFound('Base not found');

    const { promptText, selectedPageText } = param;

    const page = await this.pagesDao.get({
      id: param.pageId,
      baseId: param.baseId,
    });
    const parentPage = page.parent_page_id
      ? await this.pagesDao.get({
          id: page.parent_page_id,
          baseId: param.baseId,
        })
      : null;

    const pageParentInfo = `which is under a '${
      parentPage ? `parent page '${parentPage.title} and ` : ''
    }' base '${base.title}'`;

    let prompt;
    if (selectedPageText) {
      prompt = `On a page named '${page.title}', ${pageParentInfo}, 
      
      Output should be in markdown format.
      ${promptText} is given as prompt input.
      As an expert concise writer, what will you write which should convey the following information: 
      '${selectedPageText}'`;
    } else {
      prompt = `On a page named '${page.title}', ${pageParentInfo}, 
      
      Output should be in markdown format.
      ${promptText} is given as prompt input.
      Expand on this. `;
    }

    try {
      const aiRes: any = await openai.createCompletion(
        {
          model: 'text-davinci-003',
          prompt: prompt,
          temperature: 0.7,
          max_tokens: 1500,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
          stream: true,
        },
        {
          responseType: 'stream',
        },
      );

      new Promise((resolve) => {
        aiRes.data.on('end', () => {
          resolve(true);
        });

        aiRes.data.on('data', (chunk) => {
          if (chunk === '[DONE]') {
            resolve(true); // Stream finished
          }

          chunk = chunk.toString();
          response.write(chunk);
        });
      }).then(() => {
        response.end();
      });
    } catch (e) {
      console.log(e);
      NcError.badRequest('Could not generate data');
    }

    return response;
  }

  async magicOutline(param: { baseId: string; pageId: string }) {
    let response;

    const base = await Base.getByTitleOrId(param.baseId);
    if (!base) throw new Error('Base not found');

    const parentPagesTitles = (
      await this.pagesDao.parents({
        pageId: param.pageId,
        baseId: param.baseId,
      })
    ).map((p) => p.title);

    const page = await this.pagesDao.get({
      id: param.pageId,
      baseId: param.baseId,
    });

    try {
      response = await openai.createCompletion({
        model: 'text-davinci-003',
        prompt: `On a page named '${page.title}', with meta data as '${
          base.title
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

  async handlePageJSON(
    pg: any,
    parentPageId: string | undefined,
    user: UserType,
    baseId: string,
  ) {
    const parentPage = await this.pagesDao.create({
      attributes: {
        title: pg?.title,
        description: pg?.description,
        content: pg?.content || '',
        parent_page_id: parentPageId || null,
      },
      baseId,
      user: user,
    });

    if (pg.pages) {
      for (const page of pg.pages) {
        await this.handlePageJSON(page, parentPage.id, user, baseId);
      }
    }
  }

  async magicCreatePages(param: {
    baseId: string;
    title: string;
    user: UserType;
  }) {
    let response;
    const { baseId, title, user } = param;

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
        await this.handlePageJSON(page, undefined, user as UserType, baseId);
      }
    } catch (e) {
      console.log(e);
      console.log(response?.data?.choices[0]?.text);
      NcError.badRequest('Failed to parse schema');
    }
    return true;
  }

  async directoryImport(param: {
    baseId: string;
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
    const { baseId } = param;
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
          baseId as string,
        );
      }
    } catch (e) {
      console.log(e);
      NcError.badRequest('Failed to parse schema');
    }
    return true;
  }
}

async function listDirectory(
  user: string,
  repository: string,
  ref: string,
  dir: string,
  token = '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',
) {
  const files = await listContent.viaTreesApi({
    user,
    repository,
    ref,
    directory: decodeURIComponent(dir),
    token: token,
    getFullData: true,
  });

  return files;
}

async function getMarkdownFiles(
  files: Array<{
    path: string;
    mode: string;
    type: string;
    sha: string;
    size: number;
    url: string;
  }>,
) {
  const markdownFiles = files.filter((file) => file.path.endsWith('.md'));
  return markdownFiles;
}

async function fetchMarkdownContent(
  user: string,
  repository: string,
  ref: string,
  path: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    axios(
      `https://raw.githubusercontent.com/${user}/${repository}/${ref}/${escapeFilepath(
        path,
      )}`,
    )
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        reject(error);
      });
  });
}

export async function fetchGHDocs(
  user: string,
  repository: string,
  ref: string,
  dir: string,
  type = 'md',
) {
  const files = await listDirectory(user, repository, ref, dir);
  const markdownFiles = await getMarkdownFiles(files);

  const docs = [];

  if (type === 'md') {
    for (const file of markdownFiles) {
      const relPath = file.path.replace(dir, '').replace(/^\//, '');
      const pathParts = relPath.split('/').filter((part) => part !== '');
      pathParts.pop();
      let activePath = docs;

      for (const pathPart of pathParts) {
        const fnd = activePath.find((page) => page.title === pathPart);
        if (!fnd) {
          activePath.push({
            title: pathPart,
            content: '',
            pages: [],
          });
          activePath = activePath.find((page) => page.title === pathPart).pages;
        } else {
          activePath = fnd.pages;
        }
      }

      activePath.push({
        title: file.path.split('/').pop().replace('.md', ''),
        ...processContent(
          await fetchMarkdownContent(user, repository, ref, file.path),
          type,
        ),
        pages: [],
      });

      activePath.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
    }
  } else if (type === 'nuxt') {
    for (const file of markdownFiles) {
      const processedContent = processContent(
        await fetchMarkdownContent(user, repository, ref, file.path),
        type,
      );
      if (processedContent?.category) {
        let fnd = docs.find((page) => page.title === processedContent.category);

        if (!fnd) {
          docs.push({
            title: processedContent.category,
            order: processedContent.order,
            content: '',
            pages: [],
          });
          fnd = docs.find((page) => page.title === processedContent.category);
        }

        fnd.pages.push({
          title: file.path.split('/').pop().replace('.md', ''),
          ...processedContent,
          pages: [],
        });

        fnd.pages.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
      } else {
        docs.push({
          title: file.path.split('/').pop().replace('.md', ''),
          content: '',
          order: processedContent.order,
          pages: [
            {
              title: file.path.split('/').pop().replace('.md', ''),
              ...processedContent,
              pages: [],
            },
          ],
        });
      }

      docs.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
    }
  }

  return docs;
}

function processContent(content: string, type: string): any {
  switch (type) {
    case 'nuxt': {
      const metaObj = {};
      if (content.startsWith('---')) {
        const meta = content.split('---')[1];
        meta.split('\n').forEach((line) => {
          if (!line.includes(':')) return;
          const [key, value] = line.split(':');
          metaObj[key.trim()] = value.trim();
        });
        content = content.split('---')[2];
      }
      const tempArgs = {
        category: metaObj['category']?.replace(/^["'](.+(?=["']$))["']$/, '$1'),
        content: marked(content),
        order: metaObj['position'] || null,
        description: metaObj['description']?.replace(
          /^["'](.+(?=["']$))["']$/,
          '$1',
        ),
      };

      if (metaObj['menuTitle'])
        tempArgs['title'] = metaObj['title'].replace(
          /^["'](.+(?=["']$))["']$/,
          '$1',
        );

      return tempArgs;
    }
    case 'md':
    default:
      return {
        content: marked(content),
      };
  }
}

function escapeFilepath(path) {
  return path.replaceAll('#', '%23');
}
