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
    newPage: _newPage,
    oldPage: _oldPage,
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
  }): Promise<DocsPageSnapshotType> {
    const id = this.meta.genNanoid('');

    const oldPage = { ..._oldPage };
    const newPage = { ..._newPage };

    delete oldPage.last_snapshot;
    delete oldPage.last_snapshot_json;

    delete newPage.last_snapshot;
    delete newPage.last_snapshot_json;

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

    const snapshot: DocsPageSnapshotType = {
      id,
      fk_workspace_id: workspaceId,
      fk_project_id: projectId,
      fk_page_id: pageId,
      last_updated_by_id: lastUpdatedById,
      last_page_updated_time: lastPageUpdatedTime,
      before_page_json,
      after_page_json,
      diff: diffHtml,
      type,
    };

    const query = `
    INSERT INTO page_snapshot (id, fk_workspace_id, fk_project_id, fk_page_id, last_updated_by_id, last_page_updated_time, before_page_json, after_page_json, diff, type)
    VALUES ('${snapshot.id}', '${snapshot.fk_workspace_id}', '${snapshot.fk_project_id}', '${snapshot.fk_page_id}', '${snapshot.last_updated_by_id}', '${snapshot.last_page_updated_time}', '${snapshot.before_page_json}', '${snapshot.after_page_json}', '${snapshot.diff}', '${snapshot.type}')
  `;

    await this.clickhouseService.execute(query, true);

    return snapshot;
  }

  deserializeSnapshot(snapshot: DocsPageSnapshotType) {
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
