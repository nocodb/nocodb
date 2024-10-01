import path from 'path';
import { type CoreMessage, generateObject, type LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import OpenAI from 'openai';
import { type Schema } from 'zod';
import { Logger } from '@nestjs/common';
import type { ThreadCreateParams } from 'openai/resources/beta/threads/threads';
import AiIntegration from '~/integrations/ai/ai.interface';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { getPathFromUrl } from '~/helpers/attachmentHelpers';

const logger = new Logger('OpenAiIntegration');

export default class OpenAiIntegration extends AiIntegration {
  model: LanguageModel;

  public async generateObject<T>(args: {
    messages: CoreMessage[];
    schema: Schema;
    customModel?: string;
  }): Promise<{
    usage: {
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
      model: string;
    };
    data: T;
  }> {
    const { messages, schema } = args;

    if (!this.model || args.customModel) {
      const config = this.getConfig();

      const model = args.customModel || config?.models?.[0];

      if (!model) {
        throw new Error('Integration not configured properly');
      }

      const apiKey = config.apiKey;

      if (!apiKey) {
        throw new Error('Integration not configured properly');
      }

      const customOpenAi = createOpenAI({
        apiKey: apiKey,
        compatibility: 'strict',
      });

      this.model = customOpenAi(model);
    }

    const response = await generateObject<T>({
      model: this.model,
      schema,
      messages,
      temperature: 0.5,
    });

    return {
      usage: {
        input_tokens: response.usage.promptTokens,
        output_tokens: response.usage.completionTokens,
        total_tokens: response.usage.totalTokens,
        model: this.model.modelId,
      },
      data: response.object,
    };
  }

  public availableModels(): string[] {
    return this.getConfig().models;
  }

  public async fileSearch(args: {
    messages: (ThreadCreateParams.Message & {
      attachments: { file_id: string; tools: { type: 'file_search' }[] }[];
    })[];
    schema?: Schema;
    attachments: {
      path?: string;
      url?: string;
    }[];
    extractFields?: string[];
    customModel?: string;
  }) {
    const { messages, attachments, extractFields } = args;

    const config = this.getConfig();

    const model = args.customModel || config?.models?.[0];

    if (!model) {
      throw new Error('Integration not configured properly');
    }

    const apiKey = config.apiKey;

    if (!apiKey) {
      throw new Error('Integration not configured properly');
    }

    const openai = new OpenAI({
      apiKey,
    });

    /*
    const assistants = await openai.beta.assistants.list();

    const vectorStores = await openai.beta.vectorStores.list();

    // remove all assistants
    for (const assistant of assistants.data) {
      await openai.beta.assistants.del(assistant.id);
    }

    // remove all vector stores
    for (const vectorStore of vectorStores.data) {
      logger.log('deleting vector store', vectorStore.id);
      await openai.beta.vectorStores.del(vectorStore.id);
    }
    */

    const assistant = await openai.beta.assistants.create({
      name: 'Data Analyst Assistant',
      instructions: '',
      model,
      tools: [{ type: 'file_search' }],
    });

    const tempVectorStores = [];

    let rawResponse;

    try {
      const storageAdapter = await NcPluginMgrv2.storageAdapter();

      let relativePath;

      const aiAttachments = [];

      for (const attachment of attachments) {
        if (attachment.path) {
          relativePath = path.join(
            'nc',
            'uploads',
            attachment.path.replace(/^download[/\\]/i, ''),
          );
        } else if (attachment.url) {
          relativePath = getPathFromUrl(attachment.url).replace(/^\/+/, '');
        }

        const fileStream = await storageAdapter.fileReadByStream(relativePath);

        const uploadToAI = await openai.files.create({
          file: fileStream as any,
          purpose: 'assistants',
        });

        aiAttachments.push({
          file_id: uploadToAI.id,
          tools: [{ type: 'file_search' as const }],
        });
      }

      const thread = await openai.beta.threads.create({
        messages: messages.map((message) => ({
          ...message,
          content: `${
            message.content
          }\nOnly output extracted or prompted info\nMake sure to extract at least these: ${
            extractFields?.join(', ') || ''
          }`,
          attachments: aiAttachments,
        })),
      });

      if (thread.tool_resources?.file_search?.vector_store_ids?.length) {
        tempVectorStores.push(
          ...(thread.tool_resources?.file_search?.vector_store_ids || []),
        );
      }

      const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
        assistant_id: assistant.id,
      });

      rawResponse = await openai.beta.threads.messages.list(thread.id, {
        run_id: run.id,
      });
    } catch (e) {
      logger.log(e);
    } finally {
      const clearAssistant = async () => {
        for (const vectorStore of tempVectorStores) {
          await openai.beta.vectorStores.del(vectorStore);
        }

        await openai.beta.assistants.del(assistant.id);
      };

      clearAssistant().catch((e) => {
        logger.log('There was an error cleaning up the assistant', e);
      });
    }

    let response;

    try {
      response = (rawResponse.data[0].content[0] as any).text.value;

      logger.log(response);
    } catch (e) {
      logger.error(e);
    }

    if (args.schema) {
      return this.generateObject({
        messages: [
          {
            role: 'system',
            content: `
            You are a data analyst. You are given a response from a file search.
            You need to extract the data from the response and return it in a structured format.
            If value is not found, return null.
            `,
          },
          {
            role: 'user',
            content: response,
          },
        ],
        schema: args.schema,
        customModel: model,
      });
    }

    return response;
  }

  /*
    Uses assistant & thread to keep track of messages and responses
    Proof of concept - not production ready
  */
  public async dataExtractor(args: {
    messages: ThreadCreateParams.Message[];
    schema: Schema;
    instructions: string;
    customModel?: string;
  }) {
    const { messages, instructions } = args;

    const config = this.getConfig();

    const model = args.customModel || config?.models?.[0];

    if (!model) {
      throw new Error('Integration not configured properly');
    }

    const apiKey = config.apiKey;

    if (!apiKey) {
      throw new Error('Integration not configured properly');
    }

    const openai = new OpenAI({
      apiKey,
    });

    const assistant = await openai.beta.assistants.create({
      name: 'Data Extract Assistant',
      instructions: `All data will be in same format, so make sure to use same format for all messages.\n${instructions}`,
      model: 'gpt-4o-mini',
      response_format: zodResponseFormat(args.schema, 'rows'),
    });

    const responses = [];
    const usage = {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      model: assistant.model,
    };

    try {
      const thread = await openai.beta.threads.create();

      for (const message of messages) {
        await openai.beta.threads.messages.create(thread.id, message);

        const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
          assistant_id: assistant.id,
        });

        usage.input_tokens += run.usage.prompt_tokens;
        usage.output_tokens += run.usage.completion_tokens;
        usage.total_tokens += run.usage.total_tokens
          ? run.usage.total_tokens
          : run.usage.prompt_tokens + run.usage.completion_tokens;
      }

      const rawResponse = await openai.beta.threads.messages.list(thread.id);

      for (const message of rawResponse.data) {
        if (message.role !== 'assistant') continue;

        if ((message.content[0] as any).text?.value) {
          try {
            responses.push(JSON.parse((message.content[0] as any).text.value));
          } catch (e) {
            logger.error(e);
          }
        }
      }
    } catch (e) {
      logger.log(e);
    } finally {
      const clearAssistant = async () => {
        await openai.beta.assistants.del(assistant.id);
      };

      clearAssistant().catch((e) => {
        logger.log('There was an error cleaning up the assistant', e);
      });
    }

    return {
      data: responses,
      usage,
    };
  }
}
