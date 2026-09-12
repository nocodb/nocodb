import { Readable } from 'stream';
import debug from 'debug';
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { OperationSource } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { Base, Model, Source } from '~/models';
import { getFilteredAgents } from '~/utils/ssrf';
import { NcError } from '~/helpers/ncError';
import { assertNotSandbox } from '~/helpers/sandboxGuards';
import { ExportService } from '~/modules/jobs/jobs/export-import/export.service';

@Injectable()
export class MigrateService {
  private readonly debugLog = debug('nc:jobs:export');

  constructor(private readonly exportService: ExportService) {}

  /**
   * Base configuration that none of the fixed steps below carry: extra typed
   * messages to stream, plus human-readable notes replayed into the target's
   * import log.
   *
   * CE has nothing to add. EE overrides this — see the RLS handling there.
   */
  protected async collectMigrationExtras(
    _context: NcContext,
    _param: { models: Model[]; idMap: Map<string, string> },
  ): Promise<{
    messages: { type: string; data: any }[];
    warnings: string[];
  }> {
    return { messages: [], warnings: [] };
  }

  async migrateBase({
    context,
    base,
    source,
    secret,
    instanceUrl,
    req,
  }: {
    context: NcContext;
    base: Base;
    source: Source;
    secret: string;
    instanceUrl: string;
    req: NcRequest;
  }) {
    await assertNotSandbox(
      context,
      'Migrating a base is not allowed from a sandbox. Run the migration on the production base.',
    );

    if (!base) {
      NcError.get(context).baseNotFound('Base not found!');
    }

    if (!source) {
      NcError.get(context).sourceNotFound('Source not found!');
    }

    const models = (await source.getModels(context)).filter(
      (m) => m.source_id === source.id && !m.mm && m.type === 'table',
    );

    const { serializedModels: exportedModels, idMap: exportModelMap } =
      await this.exportService.serializeModels(context, {
        modelIds: models.map((m) => m.id),
        // The target is a different instance, so permission subjects have to
        // resolve by email there — their user ids mean nothing.
        includeSubjectEmails: true,
        compatibilityMode: source.type !== 'pg',
      });

    if (!exportedModels) {
      NcError.get(context).baseError('Export failed for source ' + source.id);
    }

    const exportedUsers = await this.exportService.serializeUsers(context, {
      baseId: base.id,
    });

    const exportedScripts = await this.exportService.serializeScripts(context);

    const exportedWorkflows = await this.exportService.serializeWorkflows(
      context,
      { idMap: exportModelMap },
      req,
    );

    const exportedDocuments = await this.exportService.serializeDocuments(
      context,
    );

    const exportedDashboards = await this.exportService.serializeDashboards(
      context,
      { idMap: exportModelMap },
      req,
    );

    const exportedInterfaces = await this.exportService.serializeInterfaces(
      context,
      { idMap: exportModelMap, req },
    );

    // Gathered here with the other serializers, above the stream: everything
    // below this line is live, and `migrateBase` has no try/catch, so a
    // rejection past this point would skip the `pushStream(null)` terminator
    // and leave the receiver holding an open request.
    const extras = await this.collectMigrationExtras(context, {
      models,
      idMap: exportModelMap,
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

    const targetUrl = `${instanceUrl}/api/v2/meta/duplicate/remote/${secret}`;

    const axiosPromise = axios({
      method: 'post',
      url: targetUrl,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      ...getFilteredAgents({
        url: targetUrl,
        source: OperationSource.MIGRATION,
      }),
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

    // Pushed straight after the schema: the notes reach the receiver's log while
    // the migration is still starting, and the extra messages queue behind the
    // schema import that their ids resolve against.
    if (extras.warnings.length) {
      pushStream({
        type: 'warnings',
        data: extras.warnings,
      });
    }

    for (const message of extras.messages) {
      pushStream(message);
    }

    // Ordering below mirrors duplicate.processor: scripts → documents →
    // dashboards → workflows → interfaces. Dashboards and workflows resolve
    // aliases through the id map, and interface page configs reference models,
    // columns and views, so interfaces stay last.
    if (exportedScripts?.length) {
      pushStream({
        type: 'scripts',
        data: exportedScripts,
      });
    }

    if (exportedDocuments?.length) {
      pushStream({
        type: 'documents',
        data: exportedDocuments,
      });
    }

    if (exportedDashboards?.length) {
      pushStream({
        type: 'dashboards',
        data: exportedDashboards,
      });
    }

    if (exportedWorkflows?.length) {
      pushStream({
        type: 'workflows',
        data: exportedWorkflows,
      });
    }

    if (exportedInterfaces?.length) {
      pushStream({
        type: 'interfaces',
        data: exportedInterfaces,
      });
    }

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
