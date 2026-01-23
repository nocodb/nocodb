import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  IntegrationType,
  WorkflowNodeIntegration,
} from '@noco-integrations/core';
import type {
  FormBuilderElement,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeValidationResult,
} from '@noco-integrations/core';
import type { HubspotAuthIntegration } from '@noco-integrations/hubspot-auth';
import type { AxiosInstance } from 'axios';
import type { HubspotNodeConfig } from '../utils/types';

export abstract class HubspotNodeBase<
  TConfig extends HubspotNodeConfig = HubspotNodeConfig,
> extends WorkflowNodeIntegration<TConfig> {
  /**
   * Get the common auth integration form field
   */
  protected getAuthFormField(): FormBuilderElement {
    return {
      type: FormBuilderInputType.SelectIntegration,
      label: 'HubSpot Account',
      model: 'config.authIntegrationId',
      integrationFilter: { type: IntegrationType.Auth, sub_type: 'hubspot' },
      validators: [
        {
          type: FormBuilderValidatorType.Required,
          message: 'HubSpot Account is required',
        },
      ],
    };
  }

  /**
   * Execute a callback with the authenticated HubSpot client
   */
  protected async useHubspot<T>(
    callback: (client: AxiosInstance) => Promise<T>,
  ): Promise<T> {
    const auth = await this.getIntegration<HubspotAuthIntegration>(
      this.config.authIntegrationId,
    );
    return auth.use(callback);
  }

  /**
   * Validate that auth integration is configured
   */
  public async validate(
    config: TConfig,
  ): Promise<WorkflowNodeValidationResult> {
    const errors: { path: string; message: string }[] = [];

    if (!config.authIntegrationId) {
      errors.push({
        path: 'config.authIntegrationId',
        message: 'HubSpot Account is required',
      });
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Handle errors consistently
   */
  protected handleError(
    error: unknown,
    logs: WorkflowNodeLog[],
    startTime: number,
  ): WorkflowNodeResult {
    const err = error as {
      response?: {
        data?: { message?: string; category?: string };
        status?: number;
      };
      message?: string;
    };

    const errorMessage =
      err.response?.data?.message || err.message || 'Unknown error';
    const errorCode =
      err.response?.data?.category ||
      String(err.response?.status) ||
      'UNKNOWN_ERROR';

    logs.push({
      level: 'error',
      message: errorMessage,
      ts: Date.now(),
      data: err.response?.data,
    });

    return {
      outputs: { success: false },
      status: 'error',
      error: {
        message: errorMessage,
        code: errorCode,
        data: err.response?.data,
      },
      logs,
      metrics: {
        executionTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Create a success result
   */
  protected createSuccessResult(
    outputs: Record<string, unknown>,
    logs: WorkflowNodeLog[],
    startTime: number,
  ): WorkflowNodeResult {
    return {
      outputs: {
        ...outputs,
        success: true,
      },
      status: 'success',
      logs,
      metrics: {
        executionTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Create an error result for validation failures
   */
  protected createValidationError(
    message: string,
    code: string,
    logs: WorkflowNodeLog[],
    startTime: number,
  ): WorkflowNodeResult {
    logs.push({
      level: 'error',
      message,
      ts: Date.now(),
    });

    return {
      outputs: { success: false },
      status: 'error',
      error: {
        message,
        code,
      },
      logs,
      metrics: {
        executionTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Log an info message
   */
  protected logInfo(
    logs: WorkflowNodeLog[],
    message: string,
    data?: unknown,
  ): void {
    logs.push({
      level: 'info',
      message,
      ts: Date.now(),
      data,
    });
  }
}
