import { Inject, Injectable, Logger } from '@nestjs/common';
import { Sandbox } from '@e2b/code-interpreter';
import { ButtonActionsType } from 'nocodb-sdk';
import type { Job } from 'bull';
import type { ExecuteActionJobData, HandleWebhookJobData } from '~/interface/Jobs';
import { JobsLogService } from '~/modules/jobs/jobs/jobs-log.service';
import { JobTypes } from '~/interface/Jobs';
import { ButtonColumn, Model, View, Hook, Script } from '~/models';
import { DatasService } from '~/services/datas.service';
import { NcError } from '~/helpers/ncError';
import { getBaseSchema } from '~/helpers/scriptHelper';
import { createSandboxCode } from '~/helpers/generateCode';
import { parseSandboxOutputToWorkerMessage } from '~/helpers/sandboxParser';
import { WebhookHandlerProcessor } from './webhook-handler/webhook-handler.processor';

const BATCH_SIZE = 1000;

@Injectable()
export class ActionExecutionProcessor {
  private readonly logger = new Logger(ActionExecutionProcessor.name);
  
  constructor(
    private readonly jobsLogService: JobsLogService,
    private readonly datasService: DatasService,
    private readonly webhookHandlerProcessor: WebhookHandlerProcessor,
  ) {}

  async job(job: Job<ExecuteActionJobData>) {
    const { context, req, buttonId, tableId, viewId } = job.data;

    const sendLog = (log: string) => {
      this.jobsLogService.sendLog(job, { message: log });
    };

    try {
      const buttonColumn = await ButtonColumn.read(context, buttonId);
      if (!buttonColumn) {
        NcError.notFound('Button column not found');
      }

      const model = await Model.get(context, tableId);
      if (!model) {
        NcError.notFound('Model not found');
      }

      const view = await View.get(context, viewId);
      if (!view) {
        NcError.notFound('View not found');
      }
      if (buttonColumn.type === ButtonActionsType.Webhook) {
        await this.processWebhookActionStream(context, buttonColumn, model, view, req, sendLog);
      } else if (buttonColumn.type === ButtonActionsType.Script) {
        await this.processScriptActionStream(context, buttonColumn, model, view, req, sendLog);
      } else {
        sendLog(`Unsupported action type: ${buttonColumn.type}`);
        return;
      }
    } catch (error) {
      sendLog(`Action execution failed: ${error.message}`);
      this.logger.error('Action execution failed:', error);
      throw error;
    }
  }

  private async processBatchedRecords<T>(
    context: any,
    model: Model,
    view: View,
    sendLog: (log: string) => void,
    processRecord: (record: any, recordIndex: number, pk: string) => Promise<T>,
  ): Promise<number> {
    let offset = 0;
    let totalProcessed = 0;
    let hasMoreRecords = true;

    while (hasMoreRecords) {
      const recordsData = await this.datasService.dataList(context, {
        model,
        view,
        query: {
          limit: BATCH_SIZE,
          offset,
        },
      });

      const records = recordsData.list || [];
      
      if (records.length === 0) {
        hasMoreRecords = false;
        break;
      }

      for (let i = 0; i < records.length; i++) {
        const record = records[i];

        // Extract Pk of the Record
       //  const pk = record[model.pk];
       const pk  = 'pk'
        
        try {
          await processRecord(record, i, pk);
        } catch (error) {
          this.logger.error(`Record processing failed for record ${totalProcessed + i + 1}:`, error);
        }
      }

      totalProcessed += records.length;
      offset += BATCH_SIZE;
      
      // Check if we have more records
      if (records.length < BATCH_SIZE) {
        hasMoreRecords = false;
      }
    }

    return totalProcessed;
  }

  private async processWebhookActionStream(
    context: any,
    buttonColumn: ButtonColumn,
    model: Model,
    view: View,
    req: any,
    sendLog: (log: string) => void,
  ) {
    if (!buttonColumn.fk_webhook_id) {
      sendLog('No webhook configured for this button');
      return;
    }

    const hook = await Hook.get(context, buttonColumn.fk_webhook_id);
    if (!hook) {
      sendLog(`Webhook ${buttonColumn.fk_webhook_id} not found`);
      return;
    }

    await this.processBatchedRecords(
      context,
      model,
      view,
      sendLog,
      async (record, recordIndex) => {
        const webhookJobData: HandleWebhookJobData = {
          jobName: JobTypes.HandleWebhook,
          context,
          user: req.user,
          hookId: buttonColumn.fk_webhook_id,
          modelId: model.id,
          viewId: view.id,
          hookName: 'manual.trigger',
          prevData: null,
          newData: record,
        };

        const mockJob = {
          data: webhookJobData,
          id: `action-webhook-${Date.now()}-${recordIndex}`,
        } as Job<HandleWebhookJobData>;

        await this.webhookHandlerProcessor.job(mockJob);
      },
    );
  }

  private async processScriptActionStream(
    context: any,
    buttonColumn: ButtonColumn,
    model: Model,
    view: View,
    req: any,
    sendLog: (log: string) => void,
  ) {

    if (!process.env.E2B_API_KEY) {
      sendLog('E2B_API_KEY is not set');
      return;
    }

    if (!process.env.E2B_TEMPLATE_ID) {
      sendLog('E2B_TEMPLATE_ID is not set');
      return;
    }

    const script = await Script.get(context, buttonColumn.fk_script_id);
    if (!script) {
      return;
    }

    let sandbox: Sandbox;
    try {
      const templateID = process.env.E2B_TEMPLATE_ID;
      sandbox = await Sandbox.create(templateID, {
        apiKey: process.env.E2B_API_KEY,
      });
    } catch (error) {
      this.logger.error('Sandbox creation failed:', error);
      return;
    }

    try {
      const baseSchema = await getBaseSchema(context);
      
      const totalProcessed = await this.processBatchedRecords(
        context,
        model,
        view,
        sendLog,
        async (record, recordIndex, totalProcessed) => {
          // Create sandbox code for this specific record
          const sandboxCode = createSandboxCode(
            script.script,
            baseSchema,
            req.user,
            req,
            record.id || record.Id, // Handle different ID formats
            model.id,
            view.id,
          );

          // Execute the script for this record using the shared sandbox
          await sandbox.runCode(sandboxCode, {
            language: 'javascript',
            onError: (error) => {
              sendLog(`Script error for record ${totalProcessed + recordIndex + 1}: ${error}`);
              this.logger.error(`Script execution error for record ${totalProcessed + recordIndex + 1}:`, error);
            },
            onStdout: (data) => {
              const parsedMessage = parseSandboxOutputToWorkerMessage(data);
              sendLog(`Record ${totalProcessed + recordIndex + 1} output: ${JSON.stringify(parsedMessage)}`);
            },
            onStderr: (data) => {
              const parsedMessage = parseSandboxOutputToWorkerMessage(data);
              sendLog(`Record ${totalProcessed + recordIndex + 1} error: ${JSON.stringify(parsedMessage)}`);
            },
          });
        },
        ' in shared sandbox',
      );

      sendLog(`Script processing completed for all ${totalProcessed} records`);
    } finally {
      // Note: Sandbox cleanup is handled automatically by E2B
      sendLog('Script execution completed, sandbox will be cleaned up automatically');
    }
  }
}
