import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { DocsPageHistoryService } from './history/docs-page-history.service';
import type { DocsPageType, UserType } from 'nocodb-sdk';
import { MetaService } from '~/meta/meta.service';

import { PageDao } from '~/daos/page.dao';

@Injectable()
export class DocsPagesUpdateService {
  private logger = new Logger(DocsPagesUpdateService.name);
  constructor(
    @Inject(forwardRef(() => DocsPageHistoryService))
    private readonly pagesHistoryService: DocsPageHistoryService,
    private readonly meta: MetaService,
    private readonly pageDao: PageDao,
  ) {}

  async process({
    workspaceId,
    baseId,
    pageId,
    attributes,
    user,
    snapshotDisabled,
  }: {
    workspaceId: string;
    baseId: string;
    pageId: string;
    attributes: Partial<DocsPageType>;
    user: UserType;
    snapshotDisabled?: boolean;
  }) {
    const oldPage = await this.pageDao.get({ id: pageId, baseId });
    if (!oldPage) throw new Error('Page not found');

    if (oldPage.base_id !== baseId) throw new Error('Page not found');

    attributes.last_updated_by_id = user.id;

    this.sanitizeAttributes(attributes, oldPage);

    if (attributes.title) await this.generateSlug(baseId, attributes, oldPage);

    if ('is_published' in attributes) {
      attributes.last_published_date = this.meta.knex.fn.now();
      attributes.last_published_by_id = user.id;
    }

    if ('is_published' in attributes && attributes.is_published) {
      attributes.published_content = attributes.content || oldPage.content;
      attributes.nested_published_parent_id = oldPage.id;

      await this.updateChildPagesIsPublish({
        pageId,
        baseId,
        nestedParentPageId: pageId,
        isPublished: true,
      });
    }

    if ('is_published' in attributes && !attributes.is_published) {
      attributes.nested_published_parent_id = null;

      await this.updateChildPagesIsPublish({
        pageId,
        baseId,
        nestedParentPageId: pageId,
        isPublished: false,
      });
    }

    await this.pageDao.updatePage({
      pageId,
      baseId,
      attributes,
    });

    //// Post update logic

    if (attributes.order) {
      await this.reorderPage({
        baseId,
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
        await this.updateOldParentPagesIsParentFlag(baseId, oldPage);
      }

      await this.updateParentAndSlugOnCollision(pageId, attributes, baseId);

      if (attributes.parent_page_id) {
        await this.handlePagePublishWithNewParent(oldPage.id, baseId);
      }

      // If parent page is changed to null, unpublish the page
      // if the page is nested published under previous parent page
      if (
        !attributes.parent_page_id &&
        oldPage.id !== oldPage.nested_published_parent_id
      ) {
        await this.unpublishPage(oldPage.id, baseId);
      }
    }

    const updatedPage = await this.pageDao.get({ id: pageId, baseId });

    if (!snapshotDisabled) {
      this.pagesHistoryService
        .maybeInsert({
          workspaceId,
          newPage: updatedPage,
        })
        .catch((e) => {
          this.logger.error(e);
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

  async unpublishPage(pageId: string, baseId: string) {
    await this.pageDao.updatePage({
      pageId: pageId,
      baseId,
      attributes: {
        nested_published_parent_id: null,
        is_published: false,
      },
    });

    await this.updateChildPagesIsPublish({
      pageId,
      baseId,
      nestedParentPageId: pageId,
      isPublished: false,
    });
  }

  async updateChildPagesIsPublish({
    pageId,
    baseId,
    nestedParentPageId,
    isPublished,
  }: {
    pageId: string;
    baseId: string;
    nestedParentPageId: string;
    isPublished: boolean;
  }) {
    const childPages = await this.pageDao.getChildPages({
      parent_page_id: pageId,
      baseId,
    });

    for (const childPage of childPages) {
      await this.pageDao.updatePage({
        pageId: childPage.id,
        baseId,
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
        baseId,
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

    if ('base_id' in attributes) delete attributes.base_id;

    if ('content' in attributes) {
      if (typeof attributes.content !== 'string') {
        attributes.content = JSON.stringify(attributes.content);
      }
    }

    if ('published_content' in attributes) {
      if (typeof attributes.published_content !== 'string') {
        attributes.published_content = JSON.stringify(
          attributes.published_content,
        );
      }
    }

    return attributes;
  }

  async generateSlug(
    baseId: string,
    attributes: Partial<DocsPageType>,
    oldPage: DocsPageType,
  ) {
    const uniqueSlug = await this.pageDao.uniqueSlug({
      baseId,
      parent_page_id: oldPage.parent_page_id,
      title: attributes.title,
    });

    attributes.slug = uniqueSlug;
  }

  async handlePagePublishWithNewParent(pageId: string, baseId: string) {
    const page = await this.pageDao.get({ id: pageId, baseId });
    if (!page.parent_page_id) return;

    const parentPage = await this.pageDao.get({
      id: page.parent_page_id,
      baseId,
    });

    if (parentPage.is_published) {
      await this.pageDao.updatePage({
        pageId,
        baseId,
        attributes: {
          is_published: true,
          nested_published_parent_id: parentPage.nested_published_parent_id,
          last_published_date: this.meta.knex.fn.now(),
          published_content: page.content,
        },
      });

      await this.updateChildPagesIsPublish({
        pageId,
        baseId,
        nestedParentPageId: parentPage.nested_published_parent_id,
        isPublished: true,
      });
    } else {
      await this.pageDao.updatePage({
        pageId,
        baseId,
        attributes: {
          is_published: false,
          nested_published_parent_id: null,
        },
      });

      await this.updateChildPagesIsPublish({
        pageId,
        baseId,
        nestedParentPageId: pageId,
        isPublished: false,
      });
    }
  }

  async updateOldParentPagesIsParentFlag(
    baseId: string,
    oldPage: DocsPageType,
  ) {
    const previousParentChildren = await this.pageDao.getChildPages({
      parent_page_id: oldPage.parent_page_id,
      baseId,
    });
    if (previousParentChildren.length === 0) {
      await this.pageDao.updatePage({
        pageId: oldPage.parent_page_id,
        baseId,
        attributes: {
          is_parent: false,
        },
      });
    }
  }

  async updateParentAndSlugOnCollision(
    pageId: string,
    attributes: Partial<DocsPageType>,
    baseId: string,
  ) {
    if (attributes.parent_page_id) {
      await this.pageDao.updatePage({
        pageId: attributes.parent_page_id,
        baseId,
        attributes: {
          is_parent: true,
        },
      });
    }

    const currentPage = await this.pageDao.get({ id: pageId, baseId });

    // Since there can be slug collision, when page is moved to a new parent
    const uniqueSlug = await this.pageDao.uniqueSlug({
      baseId,
      parent_page_id: attributes.parent_page_id,
      title: currentPage.title,
    });
    if (uniqueSlug !== currentPage.slug) {
      await this.pageDao.updatePage({
        pageId,
        baseId,
        attributes: {
          slug: uniqueSlug,
        },
      });
    }
  }

  async reorderPage({
    parent_page_id,
    keepPageId,
    baseId,
  }: {
    baseId: string;
    parent_page_id?: string;
    keepPageId?: string;
  }) {
    const pages = await this.pageDao.list({ parent_page_id, baseId });

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
        baseId,
        attributes: {
          order: b.order,
        },
      });
    }
  }
}
