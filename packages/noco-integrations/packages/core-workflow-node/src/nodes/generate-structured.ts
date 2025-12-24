import {
  NocoSDK,
  WorkflowNodeCategory,
  WorkflowNodeIntegration,
} from '@noco-integrations/core';
import { z } from 'zod';
import type {
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';
import type { AiIntegration } from '@noco-integrations/core';

export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum';
  description?: string;
  items?: SchemaField;
  properties?: SchemaField[];
  enum?: string[];
  required?: boolean;
}

interface GenerateStructuredActionConfig extends WorkflowNodeConfig {
  prompt: string;
  integrationId: string;
  model?: string;
  schema: SchemaField[];
}

export class GenerateStructuredAction extends WorkflowNodeIntegration<GenerateStructuredActionConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    return {
      id: 'core.action.generate-structured',
      title: 'Generate Structured Data with AI',
      description:
        'Generate structured data using AI models with custom schema',
      icon: 'openai',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form: [],
      keywords: [
        'ai',
        'generate',
        'structured',
        'json',
        'schema',
        'gpt',
        'claude',
        'llm',
        'openai',
      ],
    };
  }

  public async validate(config: GenerateStructuredActionConfig) {
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

    if (!config.schema || config.schema.length === 0) {
      errors.push({
        path: 'config.schema',
        message: 'Output schema is required',
      });
    }

    // Validate schema fields
    if (config.schema) {
      for (let i = 0; i < config.schema.length; i++) {
        const field = config.schema[i];
        if (!field.name || field.name.trim() === '') {
          errors.push({
            path: `config.schema[${i}].name`,
            message: `Field ${i + 1} name is required`,
          });
        }
        if (field.type === 'enum' && (!field.enum || field.enum.length === 0)) {
          errors.push({
            path: `config.schema[${i}].enum`,
            message: `Field "${field.name}" must have at least one enum option`,
          });
        }
      }
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
          ncItemDisabled: !model.capabilities?.includes('tools'),
          ncItemTooltip: !model.capabilities?.includes('tools')
            ? 'Model does not support structured output'
            : '',
        }));
      } catch {
        return [];
      }
    }

    return [];
  }

  private convertSchemaToZod(fields: SchemaField[]): z.ZodObject<any> {
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const field of fields) {
      if (!field.name || field.name.trim() === '') {
        continue; // Skip fields without names
      }

      let zodType: z.ZodTypeAny;

      switch (field.type) {
        case 'string':
          zodType = z.string();
          if (field.description) {
            zodType = zodType.describe(field.description);
          }
          break;
        case 'number':
          zodType = z.number();
          if (field.description) {
            zodType = zodType.describe(field.description);
          }
          break;
        case 'boolean':
          zodType = z.boolean();
          if (field.description) {
            zodType = zodType.describe(field.description);
          }
          break;
        case 'enum':
          if (field.enum && field.enum.length > 0) {
            zodType = z.enum(field.enum as [string, ...string[]]);
            if (field.description) {
              zodType = zodType.describe(field.description);
            }
          } else {
            zodType = z.string();
          }
          break;
        case 'array':
          if (field.items) {
            if (field.items.type === 'object' && field.items.properties) {
              const nestedSchema = this.convertSchemaToZod(
                field.items.properties,
              );
              zodType = z.array(nestedSchema);
            } else {
              let itemType: z.ZodTypeAny;
              switch (field.items.type) {
                case 'string':
                  itemType = z.string();
                  break;
                case 'number':
                  itemType = z.number();
                  break;
                case 'boolean':
                  itemType = z.boolean();
                  break;
                default:
                  itemType = z.string();
              }
              zodType = z.array(itemType);
            }
          } else {
            zodType = z.array(z.string());
          }
          if (field.description) {
            zodType = zodType.describe(field.description);
          }
          break;
        case 'object':
          if (field.properties && field.properties.length > 0) {
            zodType = this.convertSchemaToZod(field.properties);
          } else {
            zodType = z.object({}).strict();
          }
          if (field.description) {
            zodType = zodType.describe(field.description);
          }
          break;
        default:
          zodType = z.string();
      }

      shape[field.name] = zodType;
    }

    return z.object(shape).strict();
  }

  public async run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const { config } = ctx.inputs;

      logs.push({
        level: 'info',
        message: 'Generating structured data with AI...',
        ts: Date.now(),
        data: {
          promptLength: config.prompt?.length,
          model: config.model,
          schemaFields: config.schema?.length,
        },
      });

      // Load the AI integration
      const aiIntegration = await this.getIntegration<AiIntegration>(
        config.integrationId,
      );

      let model = config.model;
      model = Array.isArray(model) ? model[0] : model;

      // Convert schema to Zod schema
      const zodSchema = this.convertSchemaToZod(config.schema || []);

      // Call generateObject with messages format (required by AI SDK)
      const result = await aiIntegration.generateObject({
        messages: [
          {
            role: 'user',
            content: config.prompt,
          },
        ],
        schema: zodSchema,
        customModel: model,
      });

      logs.push({
        level: 'info',
        message: 'Structured data generated successfully',
        ts: Date.now(),
        data: {
          tokensUsed: result.usage?.total_tokens,
        },
      });

      const executionTime = Date.now() - startTime;

      return {
        outputs: {
          data: result.data,
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
        message: `Structured data generation failed: ${error.message}`,
        ts: Date.now(),
        data: error.stack,
      });

      return {
        outputs: {
          data: null,
          error: error.message,
        },
        status: 'error',
        error: {
          message: error.message || 'Structured data generation failed',
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
    ];
  }

  public async generateOutputVariables(): Promise<
    NocoSDK.VariableDefinition[]
  > {
    if (!this.config.schema || this.config.schema.length === 0) {
      return [];
    }

    const convertToVariableType = (type: string): NocoSDK.VariableType => {
      switch (type) {
        case 'string':
        case 'enum':
          return NocoSDK.VariableType.String;
        case 'number':
          return NocoSDK.VariableType.Number;
        case 'boolean':
          return NocoSDK.VariableType.Boolean;
        case 'array':
          return NocoSDK.VariableType.Array;
        case 'object':
          return NocoSDK.VariableType.Object;
        default:
          return NocoSDK.VariableType.String;
      }
    };

    const getIconForType = (type: string): string => {
      switch (type) {
        case 'string':
          return 'cellText';
        case 'number':
          return 'cellNumber';
        case 'boolean':
          return 'cellCheckbox';
        case 'array':
          return 'cellJson';
        case 'object':
          return 'cellJson';
        case 'enum':
          return 'cellSingleSelect';
        default:
          return 'cellText';
      }
    };

    const convertSchemaToVariables = (
      fields: SchemaField[],
      parentKey: string = '',
    ): NocoSDK.VariableDefinition[] => {
      return fields.map((field) => {
        const fieldKey = parentKey ? `${parentKey}.${field.name}` : field.name;

        const variable: NocoSDK.VariableDefinition = {
          key: fieldKey,
          type: convertToVariableType(field.type),
          name: field.name,
          extra: {
            icon: getIconForType(field.type),
            ...(field.description && { description: field.description }),
          },
        };

        if (
          field.type === 'object' &&
          field.properties &&
          field.properties.length > 0
        ) {
          variable.children = convertSchemaToVariables(
            field.properties,
            fieldKey,
          );
        } else if (field.type === 'array' && field.items) {
          if (field.items.type === 'object' && field.items.properties) {
            variable.children = convertSchemaToVariables(
              field.items.properties,
              `${fieldKey}[0]`,
            );
          }
        }

        return variable;
      });
    };

    const schemaVariables = convertSchemaToVariables(
      this.config.schema,
      'data',
    );

    return [
      {
        key: 'data',
        type: NocoSDK.VariableType.Object,
        name: 'Generated Data',
        extra: {
          icon: 'ncCode',
        },
        children: schemaVariables,
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
            extra: {
              icon: 'cellNumber',
            },
          },
          {
            key: 'usage.outputTokens',
            type: NocoSDK.VariableType.Number,
            name: 'Output Tokens',
            extra: {
              icon: 'cellNumber',
            },
          },
          {
            key: 'usage.totalTokens',
            type: NocoSDK.VariableType.Number,
            name: 'Total Tokens',
            extra: {
              icon: 'cellNumber',
            },
          },
          {
            key: 'usage.model',
            type: NocoSDK.VariableType.String,
            name: 'Model Used',
            extra: {
              icon: 'ncSparkle',
            },
          },
        ],
      },
    ];
  }
}
