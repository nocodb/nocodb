import { Injectable, Logger } from '@nestjs/common';
import { Sandbox } from '@e2b/code-interpreter';
import type { Job } from 'bull';
import type { ExecuteActionJobData } from '~/interface/Jobs';
import { JobsLogService } from '~/modules/jobs/jobs/jobs-log.service';
import { Model, Script, View } from '~/models';
import { DatasService } from '~/services/datas.service';
import { NcError } from '~/helpers/ncError';
import { getBaseSchema } from '~/helpers/scriptHelper';
import { createSandboxCode } from '~/helpers/generateCode';
import { parseSandboxOutputToWorkerMessage } from '~/helpers/sandboxParser';
import { dataWrapper, getCompositePkValue } from '~/helpers/dbHelpers';
import { DataV3Service } from '~/services/v3/data-v3.service';

const BATCH_SIZE = 1000;
const CONCURRENCY_LIMIT = 5;

@Injectable()
export class ActionExecutionProcessor {
  private readonly logger = new Logger(ActionExecutionProcessor.name);

  constructor(
    private readonly jobsLogService: JobsLogService,
    private readonly datasService: DatasService,
    private readonly datasV3Service: DataV3Service,
  ) {}

  async job(job: Job<ExecuteActionJobData>) {
    const { context, req, scriptId, records, modelId, viewId } = job.data;

    const sendLog = (log: string) =>
      this.jobsLogService.sendLog(job, { message: log });
    const sendMessage = (message: any) =>
      this.jobsLogService.sendLog(job, { message: JSON.stringify(message) });

    const model = await Model.get(context, modelId);

    await model.getColumns(context);

    let recordsV3;

    if (records?.length) {
      recordsV3 = await this.datasV3Service.transformRecordsToV3Format({
        context,
        records,
        primaryKey: model.primaryKey,
        primaryKeys: model.primaryKeys,
      });
    }

    try {
      await this.triggerScript(
        context,
        req,
        { scriptId, records: recordsV3, model, viewId },
        { sendLog, sendMessage },
      );
    } catch (error) {
      sendLog(`Script execution failed: ${error.message}`);
      this.logger.error('Script execution failed:', error);
      throw error;
    }
  }

  async triggerScript(
    context: any,
    req: any,
    options: {
      scriptId: string;
      records?: any[];
      model?: Model;
      viewId?: string;
    },
    callbacks: {
      sendLog: (log: string) => void;
      sendMessage: (message: any) => void;
    },
  ) {
    // Get script
    const script = await Script.get(context, options.scriptId);
    if (!script) {
      NcError.notFound('Script not found');
    }

    // Get model and view if needed
    let model: Model | null = null;
    let view: View | null = null;

    if (options.model) {
      model = options.model;
    }

    if (options.viewId) {
      view = await View.get(context, options.viewId);
      if (!view || view.fk_model_id !== model?.id) {
        NcError.notFound('View not found');
      }
    }

    // Validate dependencies
    if (options.records?.length && !options.model) {
      throw new Error('model is required when records are provided');
    }

    const sandbox = await this.createSandbox();

    try {
      if (options.records?.length) {
        await this.executeForRecords({
          context,
          req,
          script,
          model: model,
          view,
          records: options.records,
          sandbox,
          sendMessage: callbacks.sendMessage,
        });
      } else if (model) {
        await this.executeForAllRecords({
          context,
          req,
          script,
          model,
          view,
          sandbox,
          sendMessage: callbacks.sendMessage,
        });
      } else {
        await this.executeStandalone({
          context,
          req,
          script,
          sandbox,
          sendMessage: callbacks.sendMessage,
        });
      }
    } finally {
      await this.cleanupSandbox(sandbox);
    }
  }

  async executeStandalone(params: {
    context: any;
    req: any;
    script: Script;
    sandbox: Sandbox;
    sendMessage: (message: any) => void;
  }) {
    const { context, req, script, sandbox, sendMessage } = params;
    const executionId = `standalone-${script.id}-${Date.now()}`;

    sendMessage({
      type: 'ACTION_EXECUTION_START',
      executionId,
      payload: {
        scriptId: script.id,
        scriptName: script.title || 'Script',
        startTime: new Date().toISOString(),
      },
    });

    await this.runScript({
      context,
      req,
      script,
      record: null,
      model: null,
      view: null,
      recordId: null,
      executionId,
      sandbox,
      sendMessage,
    });
  }

  async executeForRecords(params: {
    context: any;
    req: any;
    script: Script;
    model: Model;
    view: View | null;
    records: Record<string, any>[];
    sandbox: Sandbox;
    sendMessage: (message: any) => void;
  }) {
    const { context, req, script, model, view, records, sandbox, sendMessage } =
      params;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const recordId = getCompositePkValue(model.primaryKeys, record);
      const executionId = `${recordId}-${script.id}-${Date.now()}-${i}`;

      try {
        const displayValue = this.getDisplayValue(record, model);

        sendMessage({
          type: 'ACTION_EXECUTION_START',
          executionId,
          payload: {
            recordId,
            displayValue,
            scriptId: script.id,
            scriptName: script.title || 'Script',
            startTime: new Date().toISOString(),
          },
        });

        await this.runScript({
          context,
          req,
          script,
          record,
          model,
          view,
          recordId,
          executionId,
          sandbox,
          sendMessage,
        });
      } catch (error) {
        this.logger.error(`Record ${recordId} failed`);
        this.logger.error(error);
        sendMessage({
          type: 'ACTION_EXECUTION_COMPLETE',
          executionId,
          status: 'error',
          payload: { recordId, error: error.message },
        });
      }
    }
  }

  async executeForAllRecords(params: {
    context: any;
    req: any;
    script: Script;
    model: Model;
    view: View | null;
    sandbox: Sandbox;
    sendMessage: (message: any) => void;
  }) {
    const { context, req, script, model, view, sandbox, sendMessage } = params;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const recordsData = await this.datasService.dataList(context, {
        model,
        view,
        query: { limit: BATCH_SIZE, offset },
      });

      const records = recordsData.list || [];
      if (records.length === 0) break;

      // Process records with concurrency
      await this.processConcurrently({
        context,
        req,
        script,
        model,
        records,
        baseIndex: offset,
        sandbox,
        sendMessage,
      });

      offset += BATCH_SIZE;
      hasMore = records.length === BATCH_SIZE;
    }
  }

  private async processConcurrently(params: {
    context: any;
    req: any;
    script: Script;
    model: Model;
    records: any[];
    baseIndex: number;
    sandbox: Sandbox;
    sendMessage: (message: any) => void;
  }) {
    const {
      context,
      req,
      script,
      model,
      records,
      baseIndex,
      sandbox,
      sendMessage,
    } = params;
    const semaphore = new Array(CONCURRENCY_LIMIT).fill(null);
    let currentIndex = 0;

    const processNext = async () => {
      while (currentIndex < records.length) {
        const recordIndex = currentIndex++;
        const record = records[recordIndex];
        const globalIndex = baseIndex + recordIndex;
        const pk = dataWrapper(record).extractPksValue(model, true);
        const executionId = `${pk}-${script.id}-${Date.now()}-${globalIndex}`;

        try {
          const displayValue = this.getDisplayValue(record, model);

          sendMessage({
            type: 'ACTION_EXECUTION_START',
            executionId,
            payload: {
              recordId: pk,
              displayValue,
              scriptId: script.id,
              scriptName: script.title || 'Script',
              startTime: new Date().toISOString(),
            },
          });

          await this.runScript({
            context,
            req,
            script,
            record,
            model,
            view: null,
            recordId: pk,
            executionId,
            sandbox,
            sendMessage,
          });
        } catch (error) {
          this.logger.error(`Record ${globalIndex + 1} failed:`, error);
          sendMessage({
            type: 'ACTION_EXECUTION_COMPLETE',
            executionId,
            status: 'error',
            payload: { recordId: pk, error: error.message },
          });
        }
      }
    };

    await Promise.all(semaphore.map(() => processNext()));
  }

  private async runScript(params: {
    context: any;
    req: any;
    script: Script;
    record: any | null;
    model: Model | null;
    view: View | null;
    recordId: string | null;
    executionId: string;
    sandbox: Sandbox;
    sendMessage: (message: any) => void;
  }) {
    const {
      context,
      req,
      script,
      model,
      view,
      recordId,
      record,
      executionId,
      sandbox,
      sendMessage,
    } = params;

    try {
      const baseSchema = await getBaseSchema(context);
      const code = createSandboxCode(
        context,
        script.script,
        baseSchema,
        req.user,
        req,
        record,
        model?.id || null,
        view?.id || null,
        executionId,
      );

      await sandbox.runCode(code, {
        language: 'javascript',
        onError: (error) => {
          sendMessage({
            type: 'ACTION_EXECUTION_ERROR',
            executionId,
            payload: {
              recordId,
              error:
                (error as any)?.message ||
                error?.toString() ||
                'Script execution error',
            },
          });
        },
        onStdout: (data) => {
          const parsedMessage = parseSandboxOutputToWorkerMessage(data);
          if (parsedMessage) {
            sendMessage({
              type: 'ACTION_EXECUTION_MESSAGE',
              executionId,
              payload: { recordId, message: parsedMessage },
            });
          }
        },
        onStderr: (data) => {
          const parsedMessage = parseSandboxOutputToWorkerMessage(data);
          if (parsedMessage) {
            sendMessage({
              type: 'ACTION_EXECUTION_MESSAGE',
              executionId,
              payload: { recordId, message: parsedMessage },
            });
          }
        },
      });

      sendMessage({
        type: 'ACTION_EXECUTION_COMPLETE',
        executionId,
        status: 'success',
        payload: { recordId, message: 'Script executed successfully' },
      });
    } catch (error) {
      sendMessage({
        type: 'ACTION_EXECUTION_COMPLETE',
        executionId,
        status: 'error',
        payload: {
          recordId,
          error: error.message || 'Script execution failed',
        },
      });
      throw error;
    }
  }

  private async createSandbox(): Promise<Sandbox> {
    if (!process.env.E2B_API_KEY || !process.env.E2B_TEMPLATE_ID) {
      throw new Error('E2B_API_KEY and E2B_TEMPLATE_ID must be set');
    }

    try {
      return await Sandbox.create(process.env.E2B_TEMPLATE_ID, {
        apiKey: process.env.E2B_API_KEY,
      });
    } catch (error) {
      this.logger.error('Sandbox creation failed:', error);
      throw new Error(`Sandbox creation failed: ${error.message}`);
    }
  }

  private async cleanupSandbox(sandbox: Sandbox) {
    try {
      await sandbox.kill();
    } catch (error) {
      this.logger.warn('Failed to close sandbox:', error);
    }
  }

  private getDisplayValue(record: any, model: Model): string {
    const displayField =
      model.columns?.find((col) => col.pv) ||
      model.columns?.find((col) => col.pk);
    return displayField?.title in record
      ? record[displayField.title]
      : 'Record';
  }
}
