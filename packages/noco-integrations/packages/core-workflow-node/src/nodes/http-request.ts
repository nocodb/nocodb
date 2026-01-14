import {
  NocoSDK,
  WorkflowNodeCategory,
  WorkflowNodeIntegration,
} from '@noco-integrations/core';
import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import type { AxiosError, AxiosRequestConfig } from 'axios';
import type {
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';

const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'];

type HttpMethod = (typeof httpMethods)[number];

const bodyTypes = ['none', 'json', 'form', 'text', 'xml'];

type BodyType = (typeof bodyTypes)[number];

interface HttpHeader {
  key: string;
  value: string;
}

interface HttpQueryParam {
  key: string;
  value: string;
}

interface HttpRequestConfig extends WorkflowNodeConfig {
  method: HttpMethod;
  url: string;
  headers?: HttpHeader[];
  queryParams?: HttpQueryParam[];
  bodyType?: BodyType;
  body?: string;
  timeout?: number;
  followRedirects?: boolean;
  validateStatus?: boolean;
}

export class HttpRequest extends WorkflowNodeIntegration<HttpRequestConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    return {
      id: 'core.action.http',
      title: 'HTTP Request',
      description: 'Make an HTTP request to an external API or service',
      icon: 'ncGlobe',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      documentation:
        'https://nocodb.com/docs/workflows/nodes/action-nodes/http-request',
      form: [],
      keywords: [
        'http',
        'request',
        'api',
        'rest',
        'get',
        'post',
        'put',
        'delete',
        'patch',
        'webhook',
        'fetch',
        'call',
        'endpoint',
      ],
    };
  }

  public async validate(config: HttpRequestConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.method) {
      errors.push({
        path: 'config.method',
        message: 'HTTP method is required',
      });
    }

    if (config.method && !httpMethods.includes(config.method.toUpperCase())) {
      errors.push({
        path: 'config.method',
        message: 'Invalid HTTP method',
      });
    }
    if (!config.url || config.url.trim() === '') {
      errors.push({
        path: 'config.url',
        message: 'URL is required',
      });
    } else {
      const isDynamic = config.url.includes('$(');

      if (!isDynamic) {
        try {
          new URL(config.url);
        } catch {
          errors.push({
            path: 'config.url',
            message: 'Please provide a valid URL',
          });
        }
      }
    }

    if (config.bodyType) {
      if (!bodyTypes.includes(config.bodyType)) {
        errors.push({
          path: 'config.bodyType',
          message: 'Invalid body type',
        });
      }
    }

    if (config.bodyType === 'json' && config.body) {
      const isDynamic = config.body.includes('$(');
      if (!isDynamic) {
        try {
          JSON.parse(config.body);
        } catch {
          errors.push({
            path: 'config.body',
            message: 'Body must be valid JSON',
          });
        }
      }
    }

    if (config.timeout !== undefined && config.timeout <= 0) {
      errors.push({
        path: 'config.timeout',
        message: 'Timeout must be a positive number',
      });
    }

    return { valid: errors.length === 0, errors };
  }

  public async run(
    ctx: WorkflowNodeRunContext<HttpRequestConfig>,
  ): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const { config } = ctx.inputs;

      logs.push({
        level: 'info',
        message: `Making ${config.method} request to ${config.url}`,
        ts: Date.now(),
        data: { method: config.method, url: config.url },
      });

      const axiosConfig: AxiosRequestConfig = {
        method: config.method,
        url: config.url,
        timeout: config.timeout || 30000,
        maxRedirects: config.followRedirects === false ? 0 : 5,
        httpAgent: useAgent(config.url),
        httpsAgent: useAgent(config.url),
        validateStatus:
          config.validateStatus === false
            ? () => true
            : (status) => status >= 200 && status < 400,
      };

      const headers: Record<string, string> = {};

      if (config.headers) {
        const headersList = this.parseKeyValuePairs(config.headers);
        for (const header of headersList) {
          if (header.key && header.value) {
            headers[header.key] = header.value;
          }
        }
      }

      if (config.queryParams) {
        const queryList = this.parseKeyValuePairs(config.queryParams);
        if (queryList.length > 0) {
          const urlObj = new URL(axiosConfig.url as string);
          for (const param of queryList) {
            if (param.key && param.value !== undefined) {
              urlObj.searchParams.set(param.key, param.value);
            }
          }
          axiosConfig.url = urlObj.toString();
        }
      }

      if (
        config.body &&
        config.bodyType &&
        config.bodyType !== 'none' &&
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method)
      ) {
        switch (config.bodyType) {
          case 'json':
            headers['Content-Type'] =
              headers['Content-Type'] || 'application/json';
            try {
              axiosConfig.data = JSON.parse(config.body);
            } catch {
              axiosConfig.data = config.body;
            }
            break;
          case 'form':
            headers['Content-Type'] =
              headers['Content-Type'] || 'application/x-www-form-urlencoded';
            try {
              const formData = JSON.parse(config.body);
              if (Array.isArray(formData)) {
                const params = new URLSearchParams();
                for (const item of formData) {
                  if (item.key && item.value !== undefined) {
                    params.append(item.key, item.value);
                  }
                }
                axiosConfig.data = params.toString();
              } else if (typeof formData === 'object') {
                const params = new URLSearchParams();
                for (const [key, value] of Object.entries(formData)) {
                  params.append(key, String(value));
                }
                axiosConfig.data = params.toString();
              } else {
                axiosConfig.data = config.body;
              }
            } catch {
              axiosConfig.data = config.body;
            }
            break;
          case 'text':
            headers['Content-Type'] = headers['Content-Type'] || 'text/plain';
            axiosConfig.data = config.body;
            break;
          case 'xml':
            headers['Content-Type'] =
              headers['Content-Type'] || 'application/xml';
            axiosConfig.data = config.body;
            break;
        }
      }

      axiosConfig.headers = headers;

      logs.push({
        level: 'info',
        message: 'Request configured',
        ts: Date.now(),
        data: {
          method: axiosConfig.method,
          url: axiosConfig.url,
          headers,
          hasBody: !!axiosConfig.data,
        },
      });

      // Make the request
      const response = await axios(axiosConfig);

      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'info',
        message: `Request completed with status ${response.status}`,
        ts: Date.now(),
        data: {
          status: response.status,
          statusText: response.statusText,
        },
      });

      // Parse response headers
      const responseHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(response.headers)) {
        responseHeaders[key] = String(value);
      }

      // Determine if response is JSON
      let responseBody = response.data;
      const contentType = response.headers['content-type'] || '';
      const isJson = contentType.includes('application/json');

      return {
        outputs: {
          statusCode: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: responseBody,
          isJson,
          success: response.status >= 200 && response.status < 400,
        },
        status: 'success',
        logs,
        metrics: {
          executionTimeMs: executionTime,
          statusCode: response.status,
        },
      };
    } catch (error: unknown) {
      const executionTime = Date.now() - startTime;

      // Handle axios errors
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;

        if (axiosError.response) {
          // Server responded with error status
          const response = axiosError.response;

          logs.push({
            level: 'error',
            message: `Request failed with status ${response.status}`,
            ts: Date.now(),
            data: {
              status: response.status,
              statusText: response.statusText,
              data: response.data,
            },
          });

          // Parse response headers
          const responseHeaders: Record<string, string> = {};
          for (const [key, value] of Object.entries(response.headers)) {
            responseHeaders[key] = String(value);
          }

          return {
            outputs: {
              statusCode: response.status,
              statusText: response.statusText,
              headers: responseHeaders,
              body: response.data,
              isJson: (response.headers['content-type'] || '').includes(
                'application/json',
              ),
              success: false,
            },
            status: 'error',
            error: {
              message: `HTTP ${response.status}: ${response.statusText}`,
              code: `HTTP_${response.status}`,
              data: response.data,
            },
            logs,
            metrics: {
              executionTimeMs: executionTime,
              statusCode: response.status,
            },
          };
        } else if (axiosError.request) {
          logs.push({
            level: 'error',
            message: `No response received: ${axiosError.message}`,
            ts: Date.now(),
            data: { code: axiosError.code },
          });

          return {
            outputs: {
              success: false,
            },
            status: 'error',
            error: {
              message: axiosError.message || 'No response received from server',
              code: axiosError.code || 'NO_RESPONSE',
            },
            logs,
            metrics: {
              executionTimeMs: executionTime,
            },
          };
        }
      }

      const err = error as Error;
      logs.push({
        level: 'error',
        message: `Request failed: ${err.message}`,
        ts: Date.now(),
        data: err.stack,
      });

      return {
        outputs: { success: false },
        status: 'error',
        error: {
          message: err.message || 'HTTP request failed',
          code: 'REQUEST_ERROR',
        },
        logs,
        metrics: {
          executionTimeMs: executionTime,
        },
      };
    }
  }

  /**
   * Parse key-value pairs from various formats
   */
  private parseKeyValuePairs(
    input: unknown,
  ): Array<{ key: string; value: string }> {
    if (!input) return [];

    // If already an array, return as-is
    if (Array.isArray(input)) {
      return input.filter(
        (item) => item && typeof item === 'object' && 'key' in item,
      );
    }

    // If string, try to parse as JSON
    if (typeof input === 'string') {
      try {
        const parsed = JSON.parse(input);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (item) => item && typeof item === 'object' && 'key' in item,
          );
        }
        // If it's an object, convert to key-value pairs
        if (typeof parsed === 'object' && parsed !== null) {
          return Object.entries(parsed).map(([key, value]) => ({
            key,
            value: String(value),
          }));
        }
      } catch {
        // Not valid JSON, return empty
        return [];
      }
    }

    // If object, convert to array
    if (typeof input === 'object') {
      return Object.entries(input).map(([key, value]) => ({
        key,
        value: String(value),
      }));
    }

    return [];
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    const variables: NocoSDK.VariableDefinition[] = [
      {
        key: 'config.method',
        type: NocoSDK.VariableType.String,
        name: 'Method',
        extra: {
          icon: 'ncCode',
          description: 'HTTP method (GET, POST, PUT, PATCH, DELETE, HEAD)',
        },
      },
      {
        key: 'config.url',
        type: NocoSDK.VariableType.String,
        name: 'URL',
        extra: {
          icon: 'ncLink',
          description: 'Request URL',
        },
      },
    ];

    if (this.config.headers) {
      variables.push({
        key: 'config.headers',
        type: NocoSDK.VariableType.Array,
        name: 'Headers',
        extra: {
          itemSchema: [
            {
              key: 'key',
              name: 'Header name',
              type: NocoSDK.VariableType.String,
            },
            {
              key: 'value',
              name: 'Header value',
              type: NocoSDK.VariableType.String,
            },
          ],
          icon: 'ncList',
          description: 'Request headers',
        },
      });
    }

    if (this.config.queryParams) {
      variables.push({
        key: 'config.queryParams',
        type: NocoSDK.VariableType.Array,
        name: 'Query Parameters',
        extra: {
          itemSchema: [
            {
              key: 'key',
              name: 'Query Name',
              type: NocoSDK.VariableType.String,
            },
            {
              key: 'value',
              name: 'Value',
              type: NocoSDK.VariableType.String,
            },
          ],
          icon: 'ncSearch',
          description: 'URL query parameters',
        },
      });
    }

    if (this.config.body && this.config.bodyType !== 'none') {
      variables.push({
        key: 'config.body',
        type: NocoSDK.VariableType.String,
        name: 'Body',
        extra: {
          icon: 'cellJson',
          description: 'Request body',
        },
      });
    }

    return variables;
  }

  public async generateOutputVariables(
    context: NocoSDK.VariableGeneratorContext,
    runtimeInputs?: any,
  ): Promise<NocoSDK.VariableDefinition[]> {
    const staticVariables: NocoSDK.VariableDefinition[] = [
      {
        key: 'statusCode',
        type: NocoSDK.VariableType.Number,
        name: 'Status Code',
        extra: {
          icon: 'cellNumber',
          description: 'HTTP response status code (e.g., 200, 404, 500)',
        },
      },
      {
        key: 'statusText',
        type: NocoSDK.VariableType.String,
        name: 'Status Text',
        extra: {
          icon: 'cellText',
          description: 'HTTP response status text (e.g., "OK", "Not Found")',
        },
      },
      {
        key: 'headers',
        type: NocoSDK.VariableType.Object,
        name: 'Response Headers',
        extra: {
          icon: 'ncList',
          description: 'HTTP response headers',
        },
      },
      {
        key: 'success',
        type: NocoSDK.VariableType.Boolean,
        name: 'Success',
        extra: {
          icon: 'cellCheckbox',
          description: 'Whether the request was successful (2xx or 3xx status)',
        },
      },
    ];

    const bodyVariables = NocoSDK.genGeneralVariables(
      runtimeInputs?.output?.body,
      'body',
    );

    return [
      ...staticVariables,
      {
        key: 'body',
        type: NocoSDK.VariableType.Object,
        name: 'Response Body',
        children: bodyVariables,
        extra: {
          icon: 'cellJson',
          description: 'HTTP response body (parsed as JSON if applicable)',
        },
      },
    ];
  }
}
