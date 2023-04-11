import type { DocsPageType, UserType } from 'nocodb-sdk';
import Noco from 'src/Noco';
import Page from 'src/models/Page';

import { Injectable } from '@nestjs/common';

@Injectable()
export class PagesUpdateService {
  async process(
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
    ncMeta = Noco.ncMeta,
  ) {
    const oldPage = await Page.get({ id: pageId, projectId });
    if (!oldPage) throw new Error('Page not found');

    if (oldPage.project_id !== projectId) throw new Error('Page not found');

    attributes.last_updated_by_id = user.id;

    sanitizeAttributes(attributes, oldPage);

    if (attributes.title) await generateSlug(projectId, attributes, oldPage);

    if ('is_published' in attributes) {
      attributes.last_published_date = ncMeta.knex.fn.now();
      attributes.last_published_by_id = user.id;
    }

    if ('is_published' in attributes && attributes.is_published) {
      attributes.published_content = attributes.content || oldPage.content;
      attributes.nested_published_parent_id = oldPage.id;

      await updateChildPagesIsPublish({
        pageId,
        projectId,
        ncMeta,
        nestedParentPageId: pageId,
        isPublished: true,
      });
    }

    if ('is_published' in attributes && !attributes.is_published) {
      attributes.nested_published_parent_id = null;

      await updateChildPagesIsPublish({
        pageId,
        projectId,
        ncMeta,
        nestedParentPageId: pageId,
        isPublished: false,
      });
    }

    await Page._updatePage(
      {
        pageId,
        projectId,
        attributes,
      },
      ncMeta,
    );

    //// Post update logic

    if (attributes.order) {
      await reorderPage(
        {
          projectId,
          parent_page_id: attributes.parent_page_id,
          keepPageId: pageId,
        },
        ncMeta,
      );
    }

    // Handle parent page change
    if (
      'parent_page_id' in attributes &&
      attributes.parent_page_id !== oldPage.parent_page_id
    ) {
      if (oldPage.parent_page_id) {
        await updateOldParentPagesIsParentFlag(projectId, oldPage, ncMeta);
      }

      await updateParentAndSlugOnCollision(
        pageId,
        attributes,
        projectId,
        ncMeta,
      );

      if (attributes.parent_page_id) {
        await handlePagePublishWithNewParent(oldPage.id, projectId, ncMeta);
      }

      // If parent page is changed to null, unpublish the page
      // if the page is nested published under previous parent page
      if (
        !attributes.parent_page_id &&
        oldPage.id !== oldPage.nested_published_parent_id
      ) {
        await unpublishPage(oldPage.id, projectId, ncMeta);
      }
    }

    return await Page.get({ id: pageId, projectId });
  }
}

/**
 *
 *
 * Helpers
 *
 *
 * */

async function unpublishPage(pageId: string, projectId: string, ncMeta) {
  await Page._updatePage(
    {
      pageId: pageId,
      projectId,
      attributes: {
        nested_published_parent_id: null,
        is_published: false,
      },
    },
    ncMeta,
  );

  await updateChildPagesIsPublish({
    pageId,
    projectId,
    ncMeta,
    nestedParentPageId: pageId,
    isPublished: false,
  });
}

async function updateChildPagesIsPublish({
  pageId,
  projectId,
  nestedParentPageId,
  ncMeta,
  isPublished,
}: {
  pageId: string;
  projectId: string;
  nestedParentPageId: string;
  ncMeta?: any;
  isPublished: boolean;
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
          is_published: isPublished,
          nested_published_parent_id: isPublished ? nestedParentPageId : null,
          last_published_date: ncMeta.knex.fn.now(),
          published_content: childPage.content,
        },
      },
      ncMeta,
    );
    await updateChildPagesIsPublish({
      pageId: childPage.id,
      nestedParentPageId: nestedParentPageId,
      projectId,
      ncMeta,
      isPublished,
    });
  }
}

function sanitizeAttributes(
  attributes: Partial<DocsPageType>,
  oldPage: DocsPageType,
) {
  if (attributes.title && attributes.title.length === 0) {
    throw new Error('Title cannot be empty');
  }

  if (attributes.title === oldPage.title) delete attributes.title;

  if ('project_id' in attributes) delete attributes.project_id;

  return attributes;
}

async function generateSlug(
  projectId: string,
  attributes: Partial<DocsPageType>,
  oldPage: DocsPageType,
) {
  const uniqueSlug = await Page.uniqueSlug({
    projectId,
    parent_page_id: oldPage.parent_page_id,
    title: attributes.title,
  });

  attributes.slug = uniqueSlug;
}

async function handlePagePublishWithNewParent(
  pageId: string,
  projectId: string,
  ncMeta,
) {
  const page = await Page.get({ id: pageId, projectId });
  if (!page.parent_page_id) return;

  const parentPage = await Page.get({
    id: page.parent_page_id,
    projectId,
  });

  if (parentPage.is_published) {
    await Page._updatePage(
      {
        pageId,
        projectId,
        attributes: {
          is_published: true,
          nested_published_parent_id: parentPage.nested_published_parent_id,
          last_published_date: ncMeta.knex.fn.now(),
          published_content: page.content,
        },
      },
      ncMeta,
    );

    await updateChildPagesIsPublish({
      pageId,
      projectId,
      ncMeta,
      nestedParentPageId: parentPage.nested_published_parent_id,
      isPublished: true,
    });
  } else {
    await Page._updatePage(
      {
        pageId,
        projectId,
        attributes: {
          is_published: false,
          nested_published_parent_id: null,
        },
      },
      ncMeta,
    );

    await updateChildPagesIsPublish({
      pageId,
      projectId,
      ncMeta,
      nestedParentPageId: pageId,
      isPublished: false,
    });
  }
}

async function updateOldParentPagesIsParentFlag(
  projectId: string,
  oldPage: DocsPageType,
  ncMeta,
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
      ncMeta,
    );
  }
}

async function updateParentAndSlugOnCollision(
  pageId: string,
  attributes: Partial<DocsPageType>,
  projectId: string,
  ncMeta,
) {
  if (attributes.parent_page_id) {
    await Page._updatePage(
      {
        pageId: attributes.parent_page_id,
        projectId,
        attributes: {
          is_parent: true,
        },
      },
      ncMeta,
    );
  }

  const currentPage = await Page.get({ id: pageId, projectId });

  // Since there can be slug collision, when page is moved to a new parent
  const uniqueSlug = await Page.uniqueSlug(
    {
      projectId,
      parent_page_id: attributes.parent_page_id,
      title: currentPage.title,
    },
    ncMeta,
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
      ncMeta,
    );
  }
}

async function reorderPage(
  {
    parent_page_id,
    keepPageId,
    projectId,
  }: {
    projectId: string;
    parent_page_id?: string;
    keepPageId?: string;
  },
  ncMeta,
) {
  const pages = await Page.list({ parent_page_id, projectId }, ncMeta);

  if (keepPageId) {
    const kpPage = pages.splice(
      pages.indexOf(pages.find((page) => page.id === keepPageId)),
      1,
    );
    if (kpPage.length) {
      pages.splice(kpPage[0].order - 1, 0, kpPage[0]);
    }
  }

  // update order for pages
  for (const [i, b] of Object.entries(pages)) {
    b.order = parseInt(i) + 1;

    await Page._updatePage(
      {
        pageId: b.id,
        projectId,
        attributes: {
          order: b.order,
        },
      },
      ncMeta,
    );
  }
}
