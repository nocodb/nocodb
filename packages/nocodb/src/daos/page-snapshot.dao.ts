import { Injectable } from '@nestjs/common';
import { ClickhouseService } from '../services/clickhouse/clickhouse.service';
import { MetaService } from '../meta/meta.service';
import type { DocsPageSnapshotType, DocsPageType } from 'nocodb-sdk';

@Injectable()
export class PageSnapshotDao {
  constructor(
    private meta: MetaService,
    private clickhouseService: ClickhouseService,
  ) {}

  async create({
    workspaceId,
    projectId,
    pageId,
    newPage,
    oldPage,
    type,
    diffHtml,
  }: {
    workspaceId: string;
    projectId: string;
    pageId: string;
    newPage: DocsPageType;
    oldPage: DocsPageType;
    diffHtml;
    type: DocsPageSnapshotType['type'];
  }): Promise<string> {
    const id = this.meta.genNanoid('');

    const lastUpdatedById = newPage.last_updated_by_id;
    const lastPageUpdatedTime = newPage.updated_at;

    const oldPageBase64 = Buffer.from(JSON.stringify(oldPage)).toString(
      'base64',
    );
    const newPageBase64 = Buffer.from(JSON.stringify(newPage)).toString(
      'base64',
    );

    const before_page_json = JSON.stringify(oldPageBase64);
    const after_page_json = JSON.stringify(newPageBase64);

    const query = `
    INSERT INTO page_snapshot (id, fk_workspace_id, fk_project_id, fk_page_id, last_updated_by_id, last_page_updated_time, before_page_json, after_page_json, diff, type)
    VALUES ('${id}', '${workspaceId}', '${projectId}', '${pageId}', '${lastUpdatedById}', '${lastPageUpdatedTime}', '${before_page_json}', '${after_page_json}', '${diffHtml}', '${type}')
  `;

    await this.clickhouseService.execute(query, true);

    return id;
  }

  private deserializeSnapshot(snapshot: DocsPageSnapshotType) {
    snapshot.before_page_json = Buffer.from(
      snapshot.before_page_json,
      'base64',
    ).toString('utf-8');
    snapshot.before_page = JSON.parse(snapshot.before_page_json);

    snapshot.after_page_json = Buffer.from(
      snapshot.after_page_json,
      'base64',
    ).toString('utf-8');
    snapshot.after_page = JSON.parse(snapshot.after_page_json);

    return snapshot;
  }

  async get({ id }: { id: string }): Promise<DocsPageSnapshotType | undefined> {
    let snapshot = (
      await this.clickhouseService.execute(
        `SELECT * FROM page_snapshot WHERE id = '${id}'`,
      )
    )[0] as DocsPageSnapshotType;

    if (!snapshot) return undefined;

    snapshot = this.deserializeSnapshot(snapshot);

    return snapshot;
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
  FROM page_snapshot
  WHERE fk_project_id = '${projectId}' AND fk_page_id = '${pageId}'
  ORDER BY last_page_updated_time DESC
  
`;

    if (pageNumber) {
      pageNumber = Number(pageNumber);
      pageSize = Number(pageSize);

      query += `LIMIT ${pageNumber * pageSize}, ${pageSize}`;
    }

    const snapshots = (
      (await this.clickhouseService.execute(
        query,
        true,
      )) as DocsPageSnapshotType[]
    ).map((snapshot) => this.deserializeSnapshot(snapshot));

    return {
      snapshots,
    };
  }
}
