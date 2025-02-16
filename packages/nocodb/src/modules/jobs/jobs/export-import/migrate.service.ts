import { Readable } from 'stream';
import debug from 'debug';
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import type { NcContext, NcRequest } from '~/interface/config';
import type { Base, Source } from '~/models';
import { ExportService } from '~/modules/jobs/jobs/export-import/export.service';

@Injectable()
export class MigrateService {
  private readonly debugLog = debug('nc:jobs:export');

  constructor(private readonly exportService: ExportService) {}

  async migrateBase({
    context,
    base,
    source,
    secret,
    instanceUrl,
  }: {
    context: NcContext;
    base: Base;
    source: Source;
    secret: string;
    instanceUrl: string;
    req: NcRequest;
  }) {
    if (!base || !source) {
      throw new Error(`Base or source not found!`);
    }

    const models = (await source.getModels(context)).filter(
      (m) => m.source_id === source.id && !m.mm && m.type === 'table',
    );

    const exportedModels = await this.exportService.serializeModels(context, {
      modelIds: models.map((m) => m.id),
      compatibilityMode: source.type !== 'pg',
    });

    if (!exportedModels) {
      throw new Error(`Export failed for source '${source.id}'`);
    }

    const exportedUsers = await this.exportService.serializeUsers(context, {
      baseId: base.id,
    });

    const stream = new Readable({
      read() {},
    });

    const pushStream = (data: any) => {
      if (data === null) {
        stream.push(null);
        return;
      }
      stream.push(JSON.stringify(data));
    };

    const axiosPromise = axios({
      method: 'post',
      url: `${instanceUrl}/api/v2/meta/duplicate/remote/${secret}`,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      data: stream,
      maxBodyLength: Infinity,
    }).catch((e) => {
      pushStream(null);
      return e;
    });

    pushStream({
      type: 'base',
      data: {
        title: base.title,
        meta: base.meta,
      },
    });

    pushStream({
      type: 'users',
      data: exportedUsers,
    });

    pushStream({
      type: 'schema',
      data: exportedModels,
    });

    let error = null;
    const handledLinks = [];

    for (const sourceModel of models) {
      if (error) break;

      const dataStream = new Readable({
        read() {},
      });

      const linkStream = new Readable({
        read() {},
      });

      this.exportService
        .streamModelDataAsCsv(context, {
          dataStream,
          linkStream,
          baseId: base.id,
          modelId: sourceModel.id,
          handledMmList: handledLinks,
        })
        .catch((e) => {
          this.debugLog(e);
          dataStream.push(null);
          linkStream.push(null);
          error = e;
        });

      const dataStreamPromise = new Promise((resolve, reject) => {
        dataStream.on('data', (data) => {
          pushStream({
            type: 'data',
            modelId: sourceModel.id,
            data,
          });
        });

        dataStream.on('end', () => {
          pushStream({
            type: 'data',
            modelId: sourceModel.id,
            data: null,
          });
          resolve(null);
        });

        dataStream.on('error', (e) => {
          reject(e);
        });
      });

      const linkStreamPromise = new Promise((resolve, reject) => {
        linkStream.on('data', (data) => {
          pushStream({
            type: 'link',
            modelId: sourceModel.id,
            data,
          });
        });

        linkStream.on('end', () => {
          pushStream({
            type: 'link',
            modelId: sourceModel.id,
            data: null,
          });
          resolve(null);
        });

        linkStream.on('error', (e) => {
          reject(e);
        });
      });

      await Promise.all([dataStreamPromise, linkStreamPromise]);
    }

    pushStream(null);

    const axiosRes = await axiosPromise;

    return axiosRes?.response?.data || axiosRes?.data;
  }
}
