import { Injectable } from '@nestjs/common';

import { ClickhouseService } from 'src/services/clickhouse/clickhouse.service';
import { MetaService } from 'src/meta/meta.service';

import { PagedResponseImpl } from 'src/helpers/PagedResponse';
import type { DocsPageType } from 'nocodb-sdk';

@Injectable()
export class DocsPageHistoryService {
  constructor(
    private clickhouseService: ClickhouseService,
    private metaService: MetaService,
  ) {}

  async insert(params: {
    workspaceId: string;
    oldPage: DocsPageType;
    newPage: DocsPageType;
  }) {
    const { workspaceId, oldPage, newPage } = params;
    // Define the values to insert
    const id = this.metaService.genNanoid('');
    const projectId = newPage.project_id;
    const pageId = newPage.id;
    const last_updated_by_id = newPage.last_updated_by_id;
    const last_page_updated_time = newPage.updated_at;
    const before_page_json = oldPage ? JSON.stringify(oldPage) : '{}';
    const after_page_json = newPage ? JSON.stringify(newPage) : '{}';

    // Define the SQL query to insert the row
    const query = `
  INSERT INTO page_history (id, fk_workspace_id, fk_project_id, fk_page_id, last_updated_by_id, last_page_updated_time, before_page_json, after_page_json)
  VALUES ('${id}', '${workspaceId}', '${projectId}', '${pageId}', '${last_updated_by_id}', '${last_page_updated_time}', '${before_page_json}', '${after_page_json}')
`;

    await this.clickhouseService.execute(query, true);
  }

  async list({
    projectId,
    pageId,
    offset,
    pageSize,
  }: {
    projectId: string;
    pageId: string;
    offset?: number | undefined;
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
    after_page_json
  FROM page_history
  WHERE fk_project_id = '${projectId}' AND fk_page_id = '${pageId}'
  ORDER BY last_page_updated_time DESC
`;
    if (offset) query += ` OFFSET ${offset}`;
    if (pageSize) query += ` LIMIT ${pageSize}`;

    const result = await this.clickhouseService.execute(query, true);

    console.log('result', result);

    return new PagedResponseImpl(result, {
      limit: pageSize,
      offset: offset,
    });
  }
}
