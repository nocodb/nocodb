import {
  NocoSDK,
  WorkflowNodeCategory,
  WorkflowNodeIntegration,
} from '@noco-integrations/core';
import { Sandbox } from '@e2b/code-interpreter';
import { createScriptExecutionCode, ScriptActionType } from './codeGenerator';
import type {
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';

interface ScriptVariable {
  name: string;
  value: any;
}

interface RunScriptNodeConfig extends WorkflowNodeConfig {
  script: string;
  variables: ScriptVariable[];
}

export class RunScriptNode extends WorkflowNodeIntegration<RunScriptNodeConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    return {
      id: 'nocodb.run_script',
      title: 'Run script',
      description:
        'Execute custom script with access to Base, Table, View, Field, Record, and Collaborators',
      icon: 'ncScript',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form: [],
      hidden: true,
      keywords: ['script', 'code', 'javascript', 'custom', 'execute'],
    };
  }

  public async validate(config: RunScriptNodeConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.script || config.script.trim() === '') {
      errors.push({
        path: 'config.script',
        message: 'Script code is required',
      });
    }

    if (config.variables && !Array.isArray(config.variables)) {
      errors.push({
        path: 'config.variables',
        message: 'Variables must be an array',
      });
    }

    return { valid: errors.length === 0, errors };
  }

  public async run(
    ctx: WorkflowNodeRunContext<RunScriptNodeConfig>,
  ): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    let sandbox: Sandbox | null = null;

    try {
      const { script, variables = [] } = ctx.inputs.config;

      logs.push({
        level: 'info',
        message: 'Starting script execution',
        ts: Date.now(),
      });

      const variableContext: Record<string, any> = {};
      variables.forEach((v) => {
        if (v.name) {
          variableContext[v.name] = v.value;
        }
      });

      const baseSchema = await this.nocodb.getBaseSchema();

      sandbox = await this.createSandbox();

      logs.push({
        level: 'info',
        message: 'Sandbox created successfully',
        ts: Date.now(),
      });

      const executableCode = createScriptExecutionCode(
        script,
        variableContext,
        {
          ncSiteUrl: this.nocodb.context.nc_site_url!,
          token: this.nocodb.getAccessToken(),
          baseSchema,
        },
      );

      const scriptOutputs: Record<string, any> = {};
      const scriptLogs: WorkflowNodeLog[] = [];
      let scriptError: { message: string; data?: any } | null = null;

      await sandbox.runCode(executableCode, {
        language: 'javascript',
        onStdout: (output) => {
          const error = this.parseScriptOutput(
            output.line,
            scriptLogs,
            scriptOutputs,
          );
          if (error) {
            scriptError = error;
          }
        },
        onStderr: (output) => {
          const error = this.parseScriptOutput(
            output.line,
            scriptLogs,
            scriptOutputs,
          );
          if (error) {
            scriptError = error;
          }
        },
        onError: (error) => {
          logs.push({
            level: 'error',
            message: error?.toString() || 'Script execution error',
            ts: Date.now(),
          });
        },
      });

      const executionTime = Date.now() - startTime;

      if (scriptError) {
        logs.push({
          level: 'error',
          message: 'Script execution failed',
          ts: Date.now(),
        });

        return {
          outputs: scriptOutputs,
          status: 'error',
          error: scriptError,
          logs: [...logs, ...scriptLogs],
          metrics: {
            executionTimeMs: executionTime,
          },
        };
      }

      logs.push({
        level: 'info',
        message: 'Script executed successfully',
        ts: Date.now(),
      });

      return {
        outputs: scriptOutputs,
        status: 'success',
        logs: [...logs, ...scriptLogs],
        metrics: {
          executionTimeMs: executionTime,
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'error',
        message: `Script execution failed: ${error.message}`,
        ts: Date.now(),
        data: error.stack,
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Script execution failed',
          code: error.code,
          data: error.response?.data,
        },
        logs,
        metrics: {
          executionTimeMs: executionTime,
        },
      };
    } finally {
      if (sandbox) {
        try {
          await sandbox.kill();
        } catch (error) {
          console.warn('Failed to close sandbox:', error);
        }
      }
    }
  }

  private async createSandbox(): Promise<Sandbox> {
    if (!process.env.E2B_API_KEY || !process.env.E2B_TEMPLATE_ID) {
      throw new Error('E2B_API_KEY and E2B_TEMPLATE_ID must be set');
    }

    try {
      return await Sandbox.create(process.env.E2B_TEMPLATE_ID, {
        apiKey: process.env.E2B_API_KEY,
        timeoutMs: 180 * 1000, // 180 seconds
      });
    } catch (error: any) {
      throw new Error(`Sandbox creation failed: ${error.message}`);
    }
  }

  private parseScriptOutput(
    output: string,
    logs: WorkflowNodeLog[],
    outputs: Record<string, any>,
  ): { message: string; data?: any } | null {
    try {
      const parsed = JSON.parse(output);

      if (parsed.type === ScriptActionType.LOG) {
        logs.push({
          level: 'info',
          message: JSON.stringify(parsed.payload?.args || parsed.payload),
          ts: parsed.timestamp || Date.now(),
        });
      } else if (parsed.type === ScriptActionType.ERROR) {
        logs.push({
          level: 'error',
          message: JSON.stringify(parsed.payload?.args || parsed.payload),
          ts: parsed.timestamp || Date.now(),
        });
      } else if (parsed.type === ScriptActionType.WARN) {
        logs.push({
          level: 'warn',
          message: JSON.stringify(parsed.payload?.args || parsed.payload),
          ts: parsed.timestamp || Date.now(),
        });
      } else if (parsed.type === ScriptActionType.OUTPUT_SET) {
        const { key, value } = parsed.payload;
        if (key) {
          outputs[key] = value;
        }
      } else if (parsed.type === ScriptActionType.DONE) {
        if (parsed.payload?.outputs) {
          Object.assign(outputs, parsed.payload.outputs);
        }

        // Check if script reported an error
        if (parsed.payload?.error) {
          return {
            message: parsed.payload?.error_message || 'Script execution failed',
            data: parsed.payload?.data,
          };
        }
      }
    } catch {
      logs.push({
        level: 'info',
        message: output,
        ts: Date.now(),
      });
    }

    return null;
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    const variables: NocoSDK.VariableDefinition[] = [];

    variables.push({
      key: 'config.variables',
      name: 'Variables',
      type: NocoSDK.VariableType.Array,
      groupKey: NocoSDK.VariableGroupKey.Fields,
      extra: {
        icon: 'cellJson',
        description: 'Input variables for the script',
        itemSchema: [
          {
            key: 'name',
            name: 'Name',
            type: NocoSDK.VariableType.String,
            groupKey: NocoSDK.VariableGroupKey.Fields,
            extra: {
              icon: 'cellText',
              description: 'Variable name',
            },
          },
          {
            key: 'value',
            name: 'Value',
            type: NocoSDK.VariableType.String,
            groupKey: NocoSDK.VariableGroupKey.Fields,
            extra: {
              icon: 'cellText',
              description: 'Variable value',
            },
          },
        ],
      },
    });

    return variables;
  }

  public async generateOutputVariables(
    context: NocoSDK.VariableGeneratorContext,
    runtimeInputs?: any,
  ): Promise<NocoSDK.VariableDefinition[]> {
    // Look at runtimeInputs.output (the actual output from the script execution)
    return NocoSDK.genGeneralVariables(runtimeInputs.output, '');
  }
}
