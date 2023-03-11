import Page from '../../models/Page';
import Noco from '../..';
import type { DocsPageType, UserType } from 'nocodb-sdk';

export const updatePageService = async (
  {
    projectId,
    pageId,
    attributes,
    user,
  }: {
    projectId: string;
    pageId: string;
    attributes: Partial<DocsPageType>;
    user: UserType;
  },
  ncMeta = Noco.ncMeta
) => {
  const oldPage = await Page.get({ id: pageId, projectId });
  if (!oldPage) throw new Error('Page not found');

  attributes.last_updated_by_id = user.id;

  sanitizeAttributes(attributes, oldPage);

  if (attributes.title) await generateSlug(projectId, attributes, oldPage);

  if ('is_published' in attributes && attributes.is_published) {
    attributes.last_published_date = ncMeta.knex.fn.now();
    attributes.last_published_by_id = user.id;
    attributes.published_content = attributes.content || oldPage.content;

    await publishChildPages({
      pageId,
      projectId,
      ncMeta,
      nestedParentPageId: pageId,
    });
  }

  await Page._updatePage(
    {
      pageId,
      projectId,
      attributes,
    },
    ncMeta
  );

  // Post update logic

  if (attributes.order) {
    await Page.reorder({
      projectId,
      parent_page_id: attributes.parent_page_id,
      keepPageId: pageId,
    });
  }

  // if old parent page is changed, update is_parent flag of previous parent page
  if (
    'parent_page_id' in attributes &&
    oldPage.parent_page_id &&
    attributes.parent_page_id !== oldPage.parent_page_id
  ) {
    await updateOldParentPagesIsParentFlag(projectId, oldPage, ncMeta);
  }

  if (attributes.parent_page_id) {
    await changeParentPage(pageId, attributes, projectId, ncMeta);
  }

  return await Page.get({ id: pageId, projectId });
};

/**
 *
 *
 * Helpers
 *
 *
 * */

async function publishChildPages({
  pageId,
  projectId,
  nestedParentPageId,
  ncMeta,
}: {
  pageId: string;
  projectId: string;
  nestedParentPageId: string;
  ncMeta?: any;
}) {
  const childPages = await Page.getChildPages({
    parent_page_id: pageId,
    projectId,
  });

  for (const childPage of childPages) {
    await Page._updatePage(
      {
        pageId: childPage.id,
        projectId,
        attributes: {
          is_published: true,
          nested_published_parent_id: nestedParentPageId,
          last_published_date: ncMeta.knex.fn.now(),
          published_content: childPage.content,
        },
      },
      ncMeta
    );
    await publishChildPages({
      pageId: childPage.id,
      nestedParentPageId: nestedParentPageId,
      projectId,
      ncMeta,
    });
  }
}

function sanitizeAttributes(
  attributes: Partial<DocsPageType>,
  oldPage: DocsPageType
) {
  if (attributes.title && attributes.title.length === 0) {
    throw new Error('Title cannot be empty');
  }

  if (attributes.title === oldPage.title) delete attributes.title;

  return attributes;
}

async function generateSlug(
  projectId: string,
  attributes: Partial<DocsPageType>,
  oldPage: DocsPageType
) {
  const uniqueSlug = await Page.uniqueSlug({
    projectId,
    parent_page_id: oldPage.parent_page_id,
    title: attributes.title,
  });

  attributes.slug = uniqueSlug;
}

async function updateOldParentPagesIsParentFlag(
  projectId: string,
  oldPage: DocsPageType,
  ncMeta
) {
  const previousParentChildren = await Page.getChildPages({
    parent_page_id: oldPage.parent_page_id,
    projectId,
  });
  if (previousParentChildren.length === 0) {
    await Page._updatePage(
      {
        pageId: oldPage.parent_page_id,
        projectId,
        attributes: {
          is_parent: false,
        },
      },
      ncMeta
    );
  }
}

async function changeParentPage(
  pageId: string,
  attributes: Partial<DocsPageType>,
  projectId: string,
  ncMeta
) {
  await Page._updatePage(
    {
      pageId: attributes.parent_page_id,
      projectId,
      attributes: {
        is_parent: true,
      },
    },
    ncMeta
  );
  const currentPage = await Page.get({ id: pageId, projectId });

  // Since there can be slug collision, when page is moved to a new parent
  const uniqueSlug = await Page.uniqueSlug(
    {
      projectId,
      parent_page_id: attributes.parent_page_id,
      title: currentPage.title,
    },
    ncMeta
  );
  if (uniqueSlug !== currentPage.slug) {
    await Page._updatePage(
      {
        pageId,
        projectId,
        attributes: {
          slug: uniqueSlug,
        },
      },
      ncMeta
    );
  }
}
