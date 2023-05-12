import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { MetaService } from 'src/meta/meta.service';

import { PageDao } from 'src/daos/page.dao';
import { DocsPageHistoryService } from './history/docs-page-history.service';
import type { DocsPageType, UserType } from 'nocodb-sdk';

@Injectable()
export class DocsPagesUpdateService {
  constructor(
    @Inject(forwardRef(() => DocsPageHistoryService))
    private readonly pagesHistoryService: DocsPageHistoryService,
    private readonly meta: MetaService,
    private readonly pageDao: PageDao,
  ) {}

  async process({
    workspaceId,
    projectId,
    pageId,
    attributes,
    user,
    snapshotDisabled,
  }: {
    workspaceId: string;
    projectId: string;
    pageId: string;
    attributes: Partial<DocsPageType>;
    user: UserType;
    snapshotDisabled?: boolean;
  }) {
    const oldPage = await this.pageDao.get({ id: pageId, projectId });
    if (!oldPage) throw new Error('Page not found');

    if (oldPage.project_id !== projectId) throw new Error('Page not found');

    attributes.last_updated_by_id = user.id;

    this.sanitizeAttributes(attributes, oldPage);

    if (attributes.title)
      await this.generateSlug(projectId, attributes, oldPage);

    if ('is_published' in attributes) {
      attributes.last_published_date = this.meta.knex.fn.now();
      attributes.last_published_by_id = user.id;
    }

    if ('is_published' in attributes && attributes.is_published) {
      attributes.published_content = attributes.content || oldPage.content;
      attributes.nested_published_parent_id = oldPage.id;

      await this.updateChildPagesIsPublish({
        pageId,
        projectId,
        nestedParentPageId: pageId,
        isPublished: true,
      });
    }

    if ('is_published' in attributes && !attributes.is_published) {
      attributes.nested_published_parent_id = null;

      await this.updateChildPagesIsPublish({
        pageId,
        projectId,
        nestedParentPageId: pageId,
        isPublished: false,
      });
    }

    await this.pageDao.updatePage({
      pageId,
      projectId,
      attributes,
    });

    //// Post update logic

    if (attributes.order) {
      await this.reorderPage({
        projectId,
        parent_page_id: attributes.parent_page_id,
        keepPageId: pageId,
      });
    }

    // Handle parent page change
    if (
      'parent_page_id' in attributes &&
      attributes.parent_page_id !== oldPage.parent_page_id
    ) {
      if (oldPage.parent_page_id) {
        await this.updateOldParentPagesIsParentFlag(projectId, oldPage);
      }

      await this.updateParentAndSlugOnCollision(pageId, attributes, projectId);

      if (attributes.parent_page_id) {
        await this.handlePagePublishWithNewParent(oldPage.id, projectId);
      }

      // If parent page is changed to null, unpublish the page
      // if the page is nested published under previous parent page
      if (
        !attributes.parent_page_id &&
        oldPage.id !== oldPage.nested_published_parent_id
      ) {
        await this.unpublishPage(oldPage.id, projectId);
      }
    }

    const updatedPage = await this.pageDao.get({ id: pageId, projectId });

    if (!snapshotDisabled) {
      this.pagesHistoryService.maybeInsert({
        workspaceId,
        oldPage,
        newPage: updatedPage,
      });
    }

    return updatedPage;
  }

  /**
   *
   *
   * Helpers
   *
   *
   * */

  async unpublishPage(pageId: string, projectId: string) {
    await this.pageDao.updatePage({
      pageId: pageId,
      projectId,
      attributes: {
        nested_published_parent_id: null,
        is_published: false,
      },
    });

    await this.updateChildPagesIsPublish({
      pageId,
      projectId,
      nestedParentPageId: pageId,
      isPublished: false,
    });
  }

  async updateChildPagesIsPublish({
    pageId,
    projectId,
    nestedParentPageId,
    isPublished,
  }: {
    pageId: string;
    projectId: string;
    nestedParentPageId: string;
    isPublished: boolean;
  }) {
    const childPages = await this.pageDao.getChildPages({
      parent_page_id: pageId,
      projectId,
    });

    for (const childPage of childPages) {
      await this.pageDao.updatePage({
        pageId: childPage.id,
        projectId,
        attributes: {
          is_published: isPublished,
          nested_published_parent_id: isPublished ? nestedParentPageId : null,
          last_published_date: this.meta.knex.fn.now(),
          published_content: childPage.content,
        },
      });
      await this.updateChildPagesIsPublish({
        pageId: childPage.id,
        nestedParentPageId: nestedParentPageId,
        projectId,
        isPublished,
      });
    }
  }

  private sanitizeAttributes(
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

  async generateSlug(
    projectId: string,
    attributes: Partial<DocsPageType>,
    oldPage: DocsPageType,
  ) {
    const uniqueSlug = await this.pageDao.uniqueSlug({
      projectId,
      parent_page_id: oldPage.parent_page_id,
      title: attributes.title,
    });

    attributes.slug = uniqueSlug;
  }

  async handlePagePublishWithNewParent(pageId: string, projectId: string) {
    const page = await this.pageDao.get({ id: pageId, projectId });
    if (!page.parent_page_id) return;

    const parentPage = await this.pageDao.get({
      id: page.parent_page_id,
      projectId,
    });

    if (parentPage.is_published) {
      await this.pageDao.updatePage({
        pageId,
        projectId,
        attributes: {
          is_published: true,
          nested_published_parent_id: parentPage.nested_published_parent_id,
          last_published_date: this.meta.knex.fn.now(),
          published_content: page.content,
        },
      });

      await this.updateChildPagesIsPublish({
        pageId,
        projectId,
        nestedParentPageId: parentPage.nested_published_parent_id,
        isPublished: true,
      });
    } else {
      await this.pageDao.updatePage({
        pageId,
        projectId,
        attributes: {
          is_published: false,
          nested_published_parent_id: null,
        },
      });

      await this.updateChildPagesIsPublish({
        pageId,
        projectId,
        nestedParentPageId: pageId,
        isPublished: false,
      });
    }
  }

  async updateOldParentPagesIsParentFlag(
    projectId: string,
    oldPage: DocsPageType,
  ) {
    const previousParentChildren = await this.pageDao.getChildPages({
      parent_page_id: oldPage.parent_page_id,
      projectId,
    });
    if (previousParentChildren.length === 0) {
      await this.pageDao.updatePage({
        pageId: oldPage.parent_page_id,
        projectId,
        attributes: {
          is_parent: false,
        },
      });
    }
  }

  async updateParentAndSlugOnCollision(
    pageId: string,
    attributes: Partial<DocsPageType>,
    projectId: string,
  ) {
    if (attributes.parent_page_id) {
      await this.pageDao.updatePage({
        pageId: attributes.parent_page_id,
        projectId,
        attributes: {
          is_parent: true,
        },
      });
    }

    const currentPage = await this.pageDao.get({ id: pageId, projectId });

    // Since there can be slug collision, when page is moved to a new parent
    const uniqueSlug = await this.pageDao.uniqueSlug({
      projectId,
      parent_page_id: attributes.parent_page_id,
      title: currentPage.title,
    });
    if (uniqueSlug !== currentPage.slug) {
      await this.pageDao.updatePage({
        pageId,
        projectId,
        attributes: {
          slug: uniqueSlug,
        },
      });
    }
  }

  async reorderPage({
    parent_page_id,
    keepPageId,
    projectId,
  }: {
    projectId: string;
    parent_page_id?: string;
    keepPageId?: string;
  }) {
    const pages = await this.pageDao.list({ parent_page_id, projectId });

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

      await this.pageDao.updatePage({
        pageId: b.id,
        projectId,
        attributes: {
          order: b.order,
        },
      });
    }
  }
}
