import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  NocoSDK,
  WorkflowNodeCategory,
  WorkflowNodeIntegration,
} from '@noco-integrations/core';
import type {
  AiIntegration,
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';

interface GenerateTextActionConfig extends WorkflowNodeConfig {
  prompt: string;
  integrationId: string;
  model?: string;
  temperature?: number;
}

export class GenerateTextAction extends WorkflowNodeIntegration<GenerateTextActionConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    return {
      id: 'core.action.generate-text',
      title: 'Generate text',
      description: 'Generate text content using AI models',
      icon: 'openai',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form: [
        {
          type: FormBuilderInputType.WorkflowInput,
          label: 'Prompt',
          model: 'config.prompt',
          placeholder: 'Enter your prompt here...',
          plugins: ['multiline'],
          span: 24,
          validators: [
            {
              type: FormBuilderValidatorType.Required,
              message: 'Prompt is required',
            },
          ],
        },
        {
          type: FormBuilderInputType.SelectIntegration,
          label: 'AI Integration',
          model: 'config.integrationId',
          placeholder: 'Select AI integration',
          integrationFilter: {
            type: 'ai',
          },
          span: 24,
          validators: [
            {
              type: FormBuilderValidatorType.Required,
              message: 'AI Integration is required',
            },
          ],
        },
        {
          type: FormBuilderInputType.Select,
          label: 'Model',
          model: 'config.model',
          placeholder: 'Select model',
          span: 24,
          selectMode: 'singleWithInput',
          fetchOptionsKey: 'models',
        },
        {
          type: FormBuilderInputType.Number,
          label: 'Temperature (Randomness)',
          model: 'config.temperature',
          placeholder: '0.5',
          span: 24,
          group: 'moreOptions',
          groupCollapsible: true,
          groupLabel: 'More options',
          groupDefaultCollapsed: true,
        },
      ],
      keywords: ['ai', 'generate', 'text', 'gpt', 'claude', 'llm', 'openai'],
    };
  }

  public async validate(config: GenerateTextActionConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.prompt || config.prompt.trim() === '') {
      errors.push({
        path: 'config.prompt',
        message: 'Prompt is required',
      });
    }

    if (!config.integrationId) {
      errors.push({
        path: 'config.integrationId',
        message: 'AI Integration is required',
      });
    }

    if (
      config.temperature !== undefined &&
      (config.temperature < 0 || config.temperature > 1)
    ) {
      errors.push({
        path: 'config.temperature',
        message: 'Temperature must be between 0 and 1',
      });
    }

    return { valid: errors.length === 0, errors };
  }

  public async fetchOptions(key: string): Promise<unknown> {
    if (key === 'models' && this.config.integrationId) {
      try {
        const aiIntegration = await this.getIntegration<AiIntegration>(
          this.config.integrationId,
        );

        return aiIntegration.availableModels().map((model: any) => ({
          label: model.label,
          value: model.value,
          ncItemDisabled: !model.capabilities?.includes('text'),
          ncItemTooltip: !model.capabilities?.includes('text')
            ? 'Model does not support text generation'
            : '',
        }));
      } catch {
        return [];
      }
    }

    return [];
  }

  public async run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const { config } = ctx.inputs;

      logs.push({
        level: 'info',
        message: 'Generating text with AI...',
        ts: Date.now(),
        data: {
          promptLength: config.prompt?.length,
          model: config.model,
          temperature: config.temperature,
        },
      });

      // Load the AI integration
      const aiIntegration = await this.getIntegration<AiIntegration>(
        config.integrationId,
      );

      let model = config.model;
      model = Array.isArray(model) ? model[0] : model;

      const result = await aiIntegration.generateText({
        prompt: config.prompt,
        system: config.system,
        customModel: model,
        ...(config.temperature !== undefined && {
          temperature: config.temperature,
        }),
      });

      logs.push({
        level: 'info',
        message: 'Text generated successfully',
        ts: Date.now(),
        data: {
          outputLength: result.data?.length,
          tokensUsed: result.usage?.total_tokens,
        },
      });

      const executionTime = Date.now() - startTime;

      return {
        outputs: {
          text: result.data,
          usage: {
            inputTokens: result.usage?.input_tokens || 0,
            outputTokens: result.usage?.output_tokens || 0,
            totalTokens: result.usage?.total_tokens || 0,
            model: result.usage?.model,
          },
        },
        status: 'success',
        logs,
        metrics: {
          executionTimeMs: executionTime,
          inputTokens: result.usage?.input_tokens || 0,
          outputTokens: result.usage?.output_tokens || 0,
          totalTokens: result.usage?.total_tokens || 0,
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'error',
        message: `Text generation failed: ${error.message}`,
        ts: Date.now(),
        data: error.stack,
      });

      return {
        outputs: {
          text: '',
          error: error.message,
        },
        status: 'error',
        error: {
          message: error.message || 'Text generation failed',
          code: error.code,
        },
        logs,
        metrics: {
          executionTimeMs: executionTime,
        },
      };
    }
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    return [
      {
        key: 'config.prompt',
        type: NocoSDK.VariableType.String,
        name: 'Prompt',
        extra: {
          icon: 'ncMessageSquare',
        },
      },
      {
        key: 'config.model',
        type: NocoSDK.VariableType.String,
        name: 'Model',
        extra: {
          icon: 'ncSparkle',
        },
      },
      ...(this.config.temperature !== undefined
        ? [
            {
              key: 'config.temperature',
              type: NocoSDK.VariableType.Number,
              name: 'Temperature',
              extra: {
                icon: 'ncSliders',
              },
            },
          ]
        : []),
    ];
  }

  public async generateOutputVariables(): Promise<
    NocoSDK.VariableDefinition[]
  > {
    return [
      {
        key: 'text',
        type: NocoSDK.VariableType.String,
        name: 'Generated Text',
        extra: {
          icon: 'cellText',
        },
      },
      {
        key: 'usage',
        type: NocoSDK.VariableType.Object,
        name: 'Token Usage',
        extra: {
          icon: 'ncInfo',
        },
        children: [
          {
            key: 'usage.inputTokens',
            type: NocoSDK.VariableType.Number,
            name: 'Input Tokens',
          },
          {
            key: 'usage.outputTokens',
            type: NocoSDK.VariableType.Number,
            name: 'Output Tokens',
          },
          {
            key: 'usage.totalTokens',
            type: NocoSDK.VariableType.Number,
            name: 'Total Tokens',
          },
          {
            key: 'usage.model',
            type: NocoSDK.VariableType.String,
            name: 'Model Used',
          },
        ],
      },
    ];
  }
}
