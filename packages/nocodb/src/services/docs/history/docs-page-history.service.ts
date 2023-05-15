import { forwardRef, Inject, Injectable } from '@nestjs/common';
import HTMLParser, { JSONToHTML } from 'html-to-json-parser';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { PageSnapshotDao } from '../../../daos/page-snapshot.dao';
import { PageDao } from '../../../daos/page.dao';
import { DocsPagesUpdateService } from '../docs-page-update.service';
import diff from './htmlDiff';
import type { JSONContent } from 'html-to-json-parser/dist/types';
import type { DocsPageSnapshotType, DocsPageType } from 'nocodb-sdk';

dayjs.extend(utc);

// Snap shot window default 5 minutes
const SNAP_SHOT_WINDOW_SEC = process.env.NC_SNAPSHOT_WINDOW_SEC
  ? Number(process.env.NC_SNAPSHOT_WINDOW_SEC)
  : 5 * 60;

const selfClosingHtmlTags = [
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
];

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
    if (!snapshot) throw new Error('Snapshot not found');

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

    const snap = await this.pageSnapshotDao.create({
      workspaceId,
      projectId,
      pageId,
      type: 'restored',
      oldPage: oldPage,
      newPage: newPage,
      diffHtml,
    });

    await this.pageDao.addSnapshot({
      pageId,
      projectId,
      lastSnapshotAt: newPage.updated_at,
      snapshot: snap,
    });
  }

  async snapshotTimeWindowExpired(params: {
    page: DocsPageType;
  }): Promise<boolean> {
    const { page } = params;

    const lastSnapshotDate =
      page.last_snapshot_at && dayjs.utc(page.last_snapshot_at);

    if (
      lastSnapshotDate &&
      dayjs().utc().unix() - lastSnapshotDate.unix() < SNAP_SHOT_WINDOW_SEC
    ) {
      return false;
    }

    return true;
  }

  async maybeInsert(params: {
    workspaceId: string;
    newPage: DocsPageType;
    snapshotType?: DocsPageSnapshotType['type'];
  }) {
    const { workspaceId, newPage, snapshotType: _snapshotType } = params;
    const projectId = newPage.project_id;

    const _oldSnapshotFromPage = this.pageDao.deserializeSnapshot({
      page: newPage,
    });
    const oldSnapshot = _oldSnapshotFromPage
      ? this.pageSnapshotDao.deserializeSnapshot(
          this.pageDao.deserializeSnapshot({ page: newPage }),
        )
      : undefined;

    // If this is the first snapshot, create a snapshot with old page as new page
    const oldPage: DocsPageType = oldSnapshot?.after_page || newPage;

    // Handle the case where there is no last snapshot page
    // And if there is one, only create a snapshot if the page has been updated, published or unpublished
    const snapshotType: DocsPageSnapshotType['type'] = oldSnapshot
      ? this.getSnapshotType(newPage, oldPage)
      : _snapshotType ?? 'updated';
    if (!snapshotType) return;

    const lastSnapshotDate =
      newPage.last_snapshot_at && dayjs.utc(newPage.last_snapshot_at);

    if (
      snapshotType === 'updated' &&
      lastSnapshotDate &&
      dayjs().utc().unix() - lastSnapshotDate.unix() < SNAP_SHOT_WINDOW_SEC
    ) {
      return;
    }

    const pageId = newPage.id;

    oldPage.content = oldPage.content
      ? typeof oldPage.content === 'string'
        ? JSON.parse(oldPage.content)
        : oldPage.content
      : undefined;
    newPage.content = newPage.content
      ? typeof newPage.content === 'string'
        ? JSON.parse(newPage.content)
        : newPage.content
      : undefined;

    if (!oldPage.content_html || !newPage.content_html) return;
    if (
      oldSnapshot &&
      snapshotType === 'updated' &&
      oldPage.content_html === newPage.content_html &&
      oldPage.title === newPage.title &&
      oldPage.icon === newPage.icon &&
      oldPage.description === newPage.description
    ) {
      return;
    }

    const diffHtml =
      oldPage.content === newPage.content
        ? newPage.content_html
        : await this.getDiff(newPage, oldPage);

    const snap = await this.pageSnapshotDao.create({
      workspaceId,
      projectId,
      pageId,
      type: snapshotType,
      oldPage,
      newPage,
      diffHtml,
    });

    await this.pageDao.addSnapshot({
      pageId,
      projectId,
      lastSnapshotAt: newPage.updated_at,
      snapshot: snap,
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
    return await this.pageSnapshotDao.list({
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

    let updated = false;
    if (oldPage.title !== newPage.title) updated = true;
    if (oldPage.content !== newPage.content) updated = true;
    if (oldPage.icon !== newPage.icon) updated = true;

    if (updated) return 'updated';

    return undefined;
  }

  private async getDiff(newPage: DocsPageType, oldPage: DocsPageType) {
    // Remove img tags from content_html as diff will tag the img for diffs
    // But we remove img tag before our post processing as self closing tags seems to trip
    // up the html parser
    const oldHtml = oldPage.content_html
      .replace(/<p><\/p>/g, '<p #custom>Empty</p>')
      .replaceAll(/<img[^>]*src="([^"]*)"[^>]*>/g, '');

    const newHtml = newPage.content_html
      .replaceAll(/<p><\/p>/g, '<p #custom>Empty</p>')
      .replaceAll(/<img[^>]*src="([^"]*)"[^>]*>/g, '');

    // TODO: Hacky way of forcing html diff to detect empty paragraph
    let _diffHtml = diff(oldHtml, newHtml);
    _diffHtml = _diffHtml
      .replaceAll('>Empty</ins>', ' class="empty">Empty</ins>')
      .replaceAll('>Empty</del>', ' class="empty">Empty</del>')
      .replaceAll('<p #custom>Empty</p>', '<p></p>')
      .replaceAll('<p #custom', '<p');

    const htmlParse = (HTMLParser as any).default as typeof HTMLParser;

    const domJson = (await htmlParse(
      `<html>${_diffHtml}</html>`,
    )) as JSONContent;

    // domJson will have 'section' element, which should only have one child
    // If it has more than one child, then remove that child and create a new 'section' element
    // with that child
    const formatNode = (node: JSONContent) => {
      if (node.attributes?.['data-type'] === 'image') {
        // Add back img tags which we removed earlier
        node.content = [
          {
            type: 'img',
            attributes: {
              src: node.attributes?.['data-src'],
              alt: node.attributes?.['data-alt'],
            },
          } as JSONContent,
        ];
        return node;
      }

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

    const processedJson = formatNode(domJson);
    let processedDiff = ((await JSONToHTML(processedJson, true)) as string)
      // Remove the <html> and </html> tags
      .slice(6, -7);

    // Process self-closing tags as JSONToHTML doesn't handle them properly
    for (const tag of selfClosingHtmlTags) {
      processedDiff = processedDiff.replaceAll(`></${tag}>`, `>`);
    }

    return processedDiff;
  }
}
