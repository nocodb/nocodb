import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import type { DocsPageSnapshotType, DocsPageType } from 'nocodb-sdk';
import { MetaService } from '~/meta/meta.service';

dayjs.extend(utc);

@Injectable()
export class PageSnapshotDao {
  constructor(
    private meta: MetaService, // private clickhouseService: ClickhouseService,
  ) {}

  async create({
    workspaceId,
    baseId,
    pageId,
    page: _page,
    type,
    diffHtml,
  }: {
    workspaceId: string;
    baseId: string;
    pageId: string;
    page: DocsPageType;
    diffHtml;
    type: DocsPageSnapshotType['type'];
  }): Promise<DocsPageSnapshotType> {
    //   const id = this.meta.genNanoid('');
    //
    //   const page = { ..._page };
    //
    //   delete page.last_snapshot;
    //   delete page.last_snapshot_json;
    //
    //   const lastUpdatedById = page.last_updated_by_id;
    //   const lastPageUpdatedTime = dayjs.utc(page.updated_at);
    //   const pageBase64 = Buffer.from(JSON.stringify(page)).toString('base64');
    //   const page_json = JSON.stringify(pageBase64);
    //
    //   const snapshot: DocsPageSnapshotType = {
    //     id,
    //     fk_workspace_id: workspaceId,
    //     fk_project_id: baseId,
    //     fk_page_id: pageId,
    //     last_updated_by_id: lastUpdatedById,
    //     created_at: lastPageUpdatedTime.unix().toString(),
    //     page_json,
    //     diff: Buffer.from(JSON.stringify(diffHtml)).toString('base64'),
    //     type,
    //   };
    //
    //   const query = `
    //   INSERT INTO ${ClickhouseTables.PAGE_SNAPSHOT} (id, fk_workspace_id, fk_project_id, fk_page_id, last_updated_by_id, created_at, page_json, diff, type)
    //   VALUES ('${snapshot.id}', '${snapshot.fk_workspace_id}', '${snapshot.fk_project_id}', '${snapshot.fk_page_id}', '${snapshot.last_updated_by_id}', toDateTime('${snapshot.created_at}'), '${snapshot.page_json}', '${snapshot.diff}', '${snapshot.type}')
    // `;
    //
    //   await this.clickhouseService.execute(query, true);
    //
    //   return snapshot;

    return {} as DocsPageSnapshotType;
  }

  deserializeSnapshot(snapshot: DocsPageSnapshotType) {
    // snapshot.page_json = Buffer.from(snapshot.page_json, 'base64').toString(
    //   'utf-8',
    // );
    // snapshot.page = JSON.parse(snapshot.page_json);
    //
    // snapshot.diff = Buffer.from(snapshot.diff, 'base64')
    //   .toString('utf-8')
    //   // As this will be wrapped with quotes, we need to remove them
    //   .slice(1, -1)
    //   // And then escape the quotes
    //   .replaceAll('\\"', '"');

    // return snapshot;
    return {} as DocsPageSnapshotType;
  }

  async get({ id }: { id: string }): Promise<DocsPageSnapshotType | undefined> {
    // let snapshot = (
    //   await this.clickhouseService.execute(
    //     `SELECT * FROM ${ClickhouseTables.PAGE_SNAPSHOT} WHERE id = '${id}'`,
    //   )
    // )[0] as DocsPageSnapshotType;
    //
    // if (!snapshot) return undefined;
    //
    // snapshot = this.deserializeSnapshot(snapshot);

    // return snapshot;
    return {} as DocsPageSnapshotType;
  }

  async list({
    baseId,
    pageId,
    pageNumber,
    pageSize,
  }: {
    baseId: string;
    pageId: string;
    pageNumber?: number | undefined;
    pageSize?: number | undefined;
  }) {
    //     let query = `
    //   SELECT
    //     id,
    //     fk_workspace_id,
    //     fk_project_id,
    //     fk_page_id,
    //     last_updated_by_id,
    //     page_json,
    //     diff,
    //     created_at,
    //     type
    //   FROM ${ClickhouseTables.PAGE_SNAPSHOT}
    //   WHERE fk_project_id = '${baseId}' AND fk_page_id = '${pageId}'
    //   ORDER BY created_at DESC
    //
    // `;

    // if (pageNumber) {
    //   pageNumber = Number(pageNumber);
    //   pageSize = Number(pageSize);
    //
    //   query += `LIMIT ${pageNumber * pageSize}, ${pageSize}`;
    // }

    // const snapshots = (
    //   (await this.clickhouseService.execute(
    //     query,
    //     true,
    //   )) as DocsPageSnapshotType[]
    // ).map((snapshot) => this.deserializeSnapshot(snapshot));

    return {
      snapshots: [],
    } as any;
  }
}
