import { forwardRef, Inject, Injectable } from '@nestjs/common';
import HTMLParser, { JSONToHTML } from 'html-to-json-parser';

import { PageDao } from 'src/daos/page.dao';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { PageSnapshotDao } from 'src/daos/pageSnapshot.dao';
import { DocsPagesUpdateService } from '../docs-page-update.service';
import diff from './htmlDiff';
import type { JSONContent } from 'html-to-json-parser/dist/types';
import type { DocsPageSnapshotType, DocsPageType } from 'nocodb-sdk';

dayjs.extend(utc);

// Snap shot window 5 seconds
const SNAP_SHOT_WINDOW_SEC = 5;

@Injectable()
export class DocsPageHistoryService {
  constructor(
    private pageDao: PageDao,
    @Inject(forwardRef(() => DocsPagesUpdateService))
    private readonly pageUpdateService: DocsPagesUpdateService,
    private readonly pageSnapshotDao: PageSnapshotDao,
  ) {}

  async restore(params: {
    workspaceId: string;
    projectId: string;
    pageId: string;
    snapshotId: string;
    user: any;
  }) {
    const { workspaceId, projectId, pageId, snapshotId, user } = params;

    const snapshot = await this.pageSnapshotDao.get({ id: snapshotId });

    const snapshotAfterPage = snapshot.after_page;

    let updateAttrs: Partial<DocsPageType> = {};
    if (snapshot.type === 'updated') {
      updateAttrs = snapshotAfterPage;
    } else if (
      snapshot.type === 'published' ||
      snapshot.type === 'unpublished'
    ) {
      updateAttrs = {
        is_published: snapshotAfterPage.is_published,
      };
    } else if (snapshot.type === 'restored') {
      const beforePage = snapshot.before_page;

      updateAttrs = beforePage;
    }

    const oldPage = await this.pageDao.get({ id: pageId, projectId });

    const service = this.pageUpdateService;
    await service.process({
      workspaceId,
      projectId,
      pageId,
      attributes: updateAttrs,
      user,
      snapshotDisabled: true,
    });

    const newPage = await this.pageDao.get({ id: pageId, projectId });
    const diffHtml = await this.getDiff(newPage, oldPage);

    const snapId = await this.pageSnapshotDao.create({
      workspaceId,
      projectId,
      pageId,
      type: 'restored',
      oldPage: oldPage,
      newPage: newPage,
      diffHtml,
    });

    await this.pageDao.updatePage({
      pageId,
      projectId,
      attributes: {
        last_snapshot_at: newPage.updated_at,
        last_snapshot_id: snapId,
      },
    });
  }

  async maybeInsert(params: {
    workspaceId: string;
    oldPage: DocsPageType;
    newPage: DocsPageType;
  }) {
    const { workspaceId, oldPage: _oldPage, newPage } = params;
    let oldPage = _oldPage;

    const lastSnapshotDate =
      newPage.last_snapshot_at && dayjs.utc(newPage.last_snapshot_at);
    if (
      lastSnapshotDate &&
      dayjs().utc().unix() - lastSnapshotDate.unix() < SNAP_SHOT_WINDOW_SEC
    ) {
      return;
    }

    oldPage.content = oldPage.content ? JSON.parse(oldPage.content) : undefined;
    newPage.content = newPage.content ? JSON.parse(newPage.content) : undefined;

    if (newPage.last_snapshot_id) {
      const lastSnapshot = await this.pageSnapshotDao.get({
        id: newPage.last_snapshot_id,
      });
      if (lastSnapshot && lastSnapshot.after_page) {
        oldPage = lastSnapshot.after_page;
      }
    }

    const snapshotType = this.getSnapshotType(newPage, oldPage);
    if (!snapshotType) return;

    const projectId = newPage.project_id;
    const pageId = newPage.id;
    const last_page_updated_time = newPage.updated_at;

    if (!oldPage.content_html || !newPage.content_html) return;

    const diffHtml =
      oldPage.content === newPage.content
        ? newPage.content_html
        : await this.getDiff(newPage, oldPage);

    const snapId = await this.pageSnapshotDao.create({
      workspaceId,
      projectId,
      pageId,
      type: snapshotType,
      oldPage: oldPage,
      newPage: newPage,
      diffHtml,
    });

    await this.pageDao.updatePage({
      pageId,
      projectId,
      attributes: {
        last_snapshot_at: last_page_updated_time,
        last_snapshot_id: snapId,
      },
    });
  }

  async list({
    projectId,
    pageId,
    pageNumber,
    pageSize,
  }: {
    projectId: string;
    pageId: string;
    pageNumber?: number | undefined;
    pageSize?: number | undefined;
  }) {
    return this.pageSnapshotDao.list({
      projectId,
      pageId,
      pageNumber,
      pageSize,
    });
  }

  private getSnapshotType(
    newPage: DocsPageType,
    oldPage: DocsPageType,
  ): DocsPageSnapshotType['type'] | undefined {
    if (oldPage.is_published !== newPage.is_published) {
      return newPage.is_published ? 'published' : 'unpublished';
    }

    return 'updated';
  }

  private async getDiff(newPage: DocsPageType, oldPage: DocsPageType) {
    // TODO: Hacky way of forcing html diff to detect empty paragraph
    const _diffHtml = diff(oldPage.content_html, newPage.content_html)
      .replaceAll('>Empty</ins>', ' class="empty">__nc_empty__</ins>')
      .replaceAll('>Empty</del>', ' class="empty">__nc_empty__</del>')
      .replaceAll('<p #custom>Empty</p>', '<p></p>');

    const htmlParse = (HTMLParser as any).default as typeof HTMLParser;
    const domJson = (await htmlParse(
      `<html>${_diffHtml}</html>`,
    )) as JSONContent;

    // domJson will have 'section' element, which should only have one child
    // If it has more than one child, then remove that child and create a new 'section' element
    // with that child
    const formatNode = (node: JSONContent) => {
      if (!node.content) return node;

      if (node.type !== 'section' || node.content.length <= 1) {
        node.content = node.content.map(formatNode).flat();
        return node;
      }

      const newNode = {
        type: 'section',
        content: [node.content[0]].map(formatNode),
      };
      const remainingNodes = node.content.slice(1);

      return [newNode].concat(
        remainingNodes.map((node) => ({ type: 'section', content: [node] })),
      );
    };

    const processJson = formatNode(domJson);
    const processedDiff = ((await JSONToHTML(processJson, true)) as string)
      // Remove the <html> and </html> tags
      .slice(6, -7)
      .replaceAll('<br></br>', '<br>');

    return processedDiff;
  }
}
