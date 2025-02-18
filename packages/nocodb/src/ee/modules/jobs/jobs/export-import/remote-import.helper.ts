import { Readable } from 'stream';
import PQueue from 'p-queue';
import { Logger } from '@nestjs/common';
import type { ImportService } from '~/modules/jobs/jobs/export-import/import.service';
import type { NcContext, NcRequest } from '~/interface/config';
import type { Base, Source, User } from '~/models';
import { Model } from '~/models';
import { findWithIdentifier } from '~/helpers/exportImportHelpers';
import { RemoteImportService } from '~/modules/jobs/jobs/export-import/remote-import.service';

interface MessagePayload {
  type: string;
  data: any;
  modelId?: string;
}

export class RemoteImportHandler {
  private queue = new PQueue({ concurrency: 1, autoStart: false });
  private idMap = null;
  private handledLinks: string[] = [];
  private schemaImported = false;
  private usersImported = false;
  private initPromises: Promise<void>[] = [];
  private importPromises: Promise<void>[] = [];
  private modelsMap = new Map<string, Model>();
  private dataStreamMap = new Map<string, Readable>();
  private linkStreamMap = new Map<string, Readable>();
  private _error: Error | null = null;
  private _baseProps: {
    title?: string;
    meta?: any;
  };
  private _workspaceProgress: {
    current: number;
    total: number;
  };

  private handlers: Map<string, (payload: MessagePayload) => void>;
  private logger = new Logger('RemoteImportHandler');

  constructor(
    private context: NcContext,
    private remoteImportService: RemoteImportService,
    private importService: ImportService,
    private user: User,
    private base: Base,
    private source: Source,
    private req: NcRequest,
    // Used for sending real-time updates to the client
    private log: (message: string) => void,
  ) {
    this.handlers = new Map<string, (payload: MessagePayload) => void>([
      ['schema', this.handleSchema.bind(this)],
      ['users', this.handleUsers.bind(this)],
      ['base', this.handleBase.bind(this)],
      ['data', this.handleData.bind(this)],
      ['link', this.handleLink.bind(this)],
      ['workspaceProgress', this.handleWorkspaceProgress.bind(this)],
    ]);
  }

  public get initPromise() {
    return Promise.all(this.initPromises);
  }

  public get endPromise() {
    return this.queue.onIdle();
  }

  public get importPromise() {
    return Promise.all(this.importPromises);
  }

  public get error() {
    return this._error;
  }

  public get baseProps() {
    return this._baseProps;
  }

  public get workspaceProgress() {
    return this._workspaceProgress;
  }

  private handleQueueStart() {
    // Start the queue only after schema and users are imported successfully
    if (this.schemaImported && this.usersImported) {
      this.queue.start();
    }
  }

  private enqueueTask(task: () => Promise<void>) {
    this.queue.add(async () => {
      try {
        await task();
      } catch (err) {
        this.logger.error(err);
        this._error = err;
      }
    });
  }

  private handleSchema(payload: MessagePayload) {
    this.log(`Importing schema`);

    const promise = this.importService
      .importModels(this.context, {
        user: this.user,
        baseId: this.base.id,
        sourceId: this.source.id,
        data: payload.data,
        req: this.req,
      })
      .then((map) => {
        this.schemaImported = true;
        this.idMap = map;
        this.handleQueueStart();
      })
      .catch((err) => {
        this._error = err;
        this.queue.clear();
      });

    this.initPromises.push(promise);
  }

  private handleUsers(payload: MessagePayload) {
    this.log(`Importing users`);

    const promise = this.remoteImportService.importUsers(this.context, {
      users: payload.data,
      req: this.req,
    })
      .then(() => {
        this.usersImported = true;
        this.handleQueueStart();
      })
      .catch((err) => {
        this._error = err;
        this.queue.clear();
      });

    this.initPromises.push(promise);
  }

  private handleBase(payload: MessagePayload) {
    this._baseProps = payload.data;
  }

  private handleData(payload: MessagePayload) {
    const { modelId, data } = payload;

    if (!modelId) return;

    this.enqueueTask(async () => {
      // If the model data stream is initialized, push the data
      if (this.modelsMap.has(modelId)) {
        this.dataStreamMap.get(modelId)!.push(data);
        if (data === null) this.dataStreamMap.delete(modelId);
        return;
      }

      // If the model data stream is not initialized, initialize it and push the data

      const modelIdentifier = findWithIdentifier(this.idMap, modelId);
      const model = await Model.get(this.context, modelIdentifier);

      this.log(`Importing data for model ${model.title}`);

      const dataStream = new Readable({ read() {} });

      this.dataStreamMap.set(modelId, dataStream);
      this.modelsMap.set(modelId, model);

      dataStream.push(data);

      const p = this.importService
        .importDataFromCsvStream(this.context, {
          idMap: this.idMap,
          dataStream,
          destProject: this.base,
          destBase: this.source,
          destModel: model,
          req: this.req,
        })
        .catch((err) => {
          this.logger.error(err);
          this._error = err;
        });

      this.importPromises.push(p);
    });
  }

  private handleLink(payload: MessagePayload) {
    const { modelId, data } = payload;

    if (!modelId) return;

    this.enqueueTask(async () => {
      // If the model link stream is initialized, push the data
      if (this.linkStreamMap.has(modelId)) {
        this.linkStreamMap.get(modelId)!.push(data);
        if (data === null) this.linkStreamMap.delete(modelId);
        return;
      }

      // If the model link stream is not initialized, initialize it and push the data

      if (this.handledLinks.includes(modelId)) return;

      const linkStream = new Readable({ read() {} });
      this.linkStreamMap.set(modelId, linkStream);
      this.handledLinks.push(modelId);
      linkStream.push(data);

      const p = this.importService
        .importLinkFromCsvStream(this.context, {
          idMap: this.idMap,
          linkStream,
          destProject: this.base,
          destBase: this.source,
          handledLinks: this.handledLinks,
        })
        .then((links) => {
          this.handledLinks = links;
        })
        .catch((err) => {
          this.logger.error(err);
          this._error = err;
        });

      this.importPromises.push(p);
    });
  }

  private handleWorkspaceProgress(payload: MessagePayload) {
    this._workspaceProgress = payload.data;
  }

  public handleMessage(payload: MessagePayload) {
    if (this._error) return;

    try {
      const handler = this.handlers.get(payload.type);
      if (handler) {
        handler(payload);
      } else {
        this.logger.warn(`No handler found for message type "${payload.type}"`);
      }
    } catch (err) {
      this.logger.error(err);
      this._error = err;
    }
  }
}
