import { Injectable } from '@nestjs/common';

import { ClickhouseService } from 'src/services/clickhouse/clickhouse.service';
import { MetaService } from 'src/meta/meta.service';

import { PagedResponseImpl } from 'src/helpers/PagedResponse';
import { PageDao } from 'src/daos/page.dao';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import diff from './htmlDiff';
import type {DocsPageSnapshotType, DocsPageType} from 'nocodb-sdk';

dayjs.extend(utc);

// Snap shot window 5 seconds
const SNAP_SHOT_WINDOW_SEC = 5;

@Injectable()
export class DocsPageHistoryService {
  constructor(
    private clickhouseService: ClickhouseService,
    private metaService: MetaService,
    private pageDao: PageDao,
  ) {}

  async maybeInsert(params: {
    workspaceId: string;
    oldPage: DocsPageType;
    newPage: DocsPageType;
  }) {
    const { workspaceId, oldPage, newPage } = params;

    const lastSnapshotDate =
      newPage.last_snapshot_at && dayjs.utc(newPage.last_snapshot_at);
    if (
      lastSnapshotDate &&
      dayjs().utc().unix() - lastSnapshotDate.unix() < SNAP_SHOT_WINDOW_SEC
    ) {
      return;
    }

    const snapshotType = this.getSnapshotType(newPage, oldPage);
    if(!snapshotType) return;

    // Define the values to insert
    const id = this.metaService.genNanoid('');
    const projectId = newPage.project_id;
    const pageId = newPage.id;
    const last_updated_by_id = newPage.last_updated_by_id;
    const last_page_updated_time = newPage.updated_at;
    oldPage.content = oldPage.content ? JSON.parse(oldPage.content) : undefined;
    newPage.content = newPage.content ? JSON.parse(newPage.content) : undefined;

    if (!oldPage.content_html || !newPage.content_html) return;

    // TODO: Hacky way of forcing html diff to detect empty paragraph
    const _diff = diff(oldPage.content_html, newPage.content_html)
      .replaceAll('>Empty</ins>', ' class="empty">__nc_empty__</ins>')
      .replaceAll('>Empty</del>', ' class="empty">__nc_empty__</del>')
      .replaceAll('<p #custom>Empty</p>', '<p></p>');

    // TODO: Figure to properly store html as part of json(i.e 'content_html' in before_page_json, after_page_json)
    // Issue is on frontend, JSON.parse() is not able to parse html string
    delete oldPage.content_html;
    delete newPage.content_html;

    const before_page_json = JSON.stringify(oldPage);
    const after_page_json = JSON.stringify(newPage);

    // Define the SQL query to insert the row
    const query = `
  INSERT INTO page_history (id, fk_workspace_id, fk_project_id, fk_page_id, last_updated_by_id, last_page_updated_time, before_page_json, after_page_json, diff, type)
  VALUES ('${id}', '${workspaceId}', '${projectId}', '${pageId}', '${last_updated_by_id}', '${last_page_updated_time}', '${before_page_json}', '${after_page_json}', '${_diff}', '${snapshotType}')
`;

    await this.clickhouseService.execute(query, true);
    await this.pageDao.updatePage({
      pageId,
      projectId,
      attributes: {
        last_snapshot_at: last_page_updated_time,
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
    let query = `
  SELECT
    id,
    fk_workspace_id,
    fk_project_id,
    fk_page_id,
    last_updated_by_id,
    last_page_updated_time,
    before_page_json,
    after_page_json,
    diff,
    created_at,
    type
  FROM page_history
  WHERE fk_project_id = '${projectId}' AND fk_page_id = '${pageId}'
  ORDER BY last_page_updated_time DESC
  
`;

    if (pageNumber) {
      pageNumber = Number(pageNumber);
      pageSize = Number(pageSize);

      query += `LIMIT ${pageNumber * pageSize}, ${pageSize}`;
    }

    const snapshots = await this.clickhouseService.execute(query, true) as DocsPageSnapshotType[];

    return {
      snapshots,
    };
  }

  private getSnapshotType(newPage: DocsPageType, oldPage: DocsPageType): DocsPageSnapshotType['type'] | undefined {
    if(oldPage.is_published !== newPage.is_published) {
      return newPage.is_published ? 'published' : 'unpublished';
    }

    if(newPage.title !== oldPage.title) {
      return 'title_update';
    }

    if(newPage.content !== oldPage.content) {
        return 'content_update';
    }

    return undefined;
  }
}
