import { Injectable, Logger } from '@nestjs/common';
import { Sandbox } from '@e2b/code-interpreter';
import { ButtonActionsType } from 'nocodb-sdk';
import { WebhookHandlerProcessor } from './webhook-handler/webhook-handler.processor';
import type { Job } from 'bull';
import type {
  ExecuteActionJobData,
  HandleWebhookJobData,
} from '~/interface/Jobs';
import { JobsLogService } from '~/modules/jobs/jobs/jobs-log.service';
import { JobTypes } from '~/interface/Jobs';
import { ButtonColumn, Hook, Model, Script, View } from '~/models';
import { DatasService } from '~/services/datas.service';
import { NcError } from '~/helpers/ncError';
import { getBaseSchema } from '~/helpers/scriptHelper';
import { createSandboxCode } from '~/helpers/generateCode';
import { parseSandboxOutputToWorkerMessage } from '~/helpers/sandboxParser';
import { dataWrapper } from '~/helpers/dbHelpers';

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

    const sendActionMessage = (message: any) => {
      this.jobsLogService.sendLog(job, { message: JSON.stringify(message) });
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
        await this.processWebhookActionStream(
          context,
          buttonColumn,
          model,
          view,
          req,
          sendLog,
          sendActionMessage,
        );
      } else if (buttonColumn.type === ButtonActionsType.Script) {
        await this.processScriptActionStream(
          context,
          buttonColumn,
          model,
          view,
          req,
          sendLog,
          sendActionMessage,
        );
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
    sendActionMessage: (message: any) => void,
    buttonColumn: ButtonColumn,
    req: any,
    processRecord: (
      record: any,
      recordIndex: number,
      pk: string,
      executionId: string,
    ) => Promise<T>,
  ): Promise<number> {
    let offset = 0;
    let totalProcessed = 0;
    let hasMoreRecords = true;
    await model.getColumns(context);

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

      if (records?.length === 0) {
        hasMoreRecords = false;
        break;
      }

      for (let i = 0; i < records.length; i++) {
        const record = records[i];

        const pk = dataWrapper(record).extractPksValue(model, true);
        const executionId = `${pk}-${buttonColumn.id}-${Date.now()}-${
          totalProcessed + i
        }`;

        const displayValue = this.getRecordDisplayValue(record, model);

        sendActionMessage({
          type: 'ACTION_EXECUTION_START',
          executionId,
          payload: {
            recordId: pk,
            displayValue,
            scriptId: buttonColumn.fk_script_id,
            scriptName:
              buttonColumn.type === ButtonActionsType.Script
                ? buttonColumn.label || 'Script Action'
                : buttonColumn.label || 'Webhook Action',
            buttonFieldName: buttonColumn.label || 'Button',
            startTime: new Date().toISOString(),
          },
        });

        try {
          await processRecord(record, totalProcessed + i, pk, executionId);
        } catch (error) {
          this.logger.error(
            `Record processing failed for record ${totalProcessed + i + 1}:`,
            error,
          );

          sendActionMessage({
            type: 'ACTION_EXECUTION_COMPLETE',
            executionId,
            status: 'error',
            payload: {
              recordId: pk,
              error: error.message || 'Processing failed',
            },
          });
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
    sendActionMessage: (message: any) => void,
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
      sendActionMessage,
      buttonColumn,
      req,
      async (record, recordIndex, pk, executionId) => {
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
          id: `action-webhook-${Date.now()}-${recordIndex}-${pk}`,
        } as Job<HandleWebhookJobData>;

        try {
          await this.webhookHandlerProcessor.job(mockJob);

          // Send completion message
          sendActionMessage({
            type: 'ACTION_EXECUTION_COMPLETE',
            executionId,
            status: 'success',
            payload: {
              recordId: pk,
              message: 'Webhook executed successfully',
            },
          });
        } catch (error) {
          // Send error message
          sendActionMessage({
            type: 'ACTION_EXECUTION_COMPLETE',
            executionId,
            status: 'error',
            payload: {
              recordId: pk,
              error: error.message || 'Webhook execution failed',
            },
          });
          throw error;
        }
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
    sendActionMessage: (message: any) => void,
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
      sendLog(`Script ${buttonColumn.fk_script_id} not found`);
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
      sendLog(`Sandbox creation failed: ${error.message}`);
      return;
    }

    try {
      const baseSchema = await getBaseSchema(context);

      await this.processBatchedRecords(
        context,
        model,
        view,
        sendLog,
        sendActionMessage,
        buttonColumn,
        req,
        async (record, recordIndex, pk, executionId) => {
          const sandboxCode = createSandboxCode(
            script.script,
            baseSchema,
            req.user,
            req,
            pk,
            model.id,
            view.id,
          );

          try {
            await sandbox.runCode(sandboxCode, {
              language: 'javascript',
              onError: (error) => {
                sendActionMessage({
                  type: 'ACTION_EXECUTION_ERROR',
                  executionId,
                  payload: {
                    recordId: pk,
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
                  sendActionMessage({
                    type: 'ACTION_EXECUTION_MESSAGE',
                    executionId,
                    payload: {
                      recordId: pk,
                      message: parsedMessage,
                    },
                  });
                }
              },
              onStderr: (data) => {
                const parsedMessage = parseSandboxOutputToWorkerMessage(data);
                if (parsedMessage) {
                  sendActionMessage({
                    type: 'ACTION_EXECUTION_MESSAGE',
                    executionId,
                    payload: {
                      recordId: pk,
                      message: parsedMessage,
                    },
                  });
                }
              },
            });

            sendActionMessage({
              type: 'ACTION_EXECUTION_COMPLETE',
              executionId,
              status: 'success',
              payload: {
                recordId: pk,
                message: 'Script executed successfully',
              },
            });
          } catch (error) {
            sendActionMessage({
              type: 'ACTION_EXECUTION_COMPLETE',
              executionId,
              status: 'error',
              payload: {
                recordId: pk,
                error: error.message || 'Script execution failed',
              },
            });
            throw error;
          }
        },
      );
    } catch (error) {
      this.logger.error('Script execution failed:', error);
      sendLog(`Script execution failed: ${error.message}`);
    } finally {
      if (sandbox) {
        try {
          await sandbox.kill();
        } catch (error) {
          this.logger.warn('Failed to close sandbox:', error);
        }
      }
    }
  }

  private getRecordDisplayValue(record: any, model: Model): string {
    const displayField =
      model.columns?.find((col) => col.pv) ||
      model.columns?.find((col) => col.pk);

    return displayField?.title in record
      ? record[displayField.title]
      : 'Record';
  }
}
