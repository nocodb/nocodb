import { Injectable } from '@nestjs/common';
import { IntegrationCategoryType, PlanFeatureTypes } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { AiIntegration } from '@noco-local-integrations/core';
import { NcError } from '~/helpers/ncError';
import { Integration } from '~/models';
import { checkForFeature } from '~/helpers/paymentHelpers';
import {
  docAiWriteSystemMessage,
  docAiWritePrompt,
  docAiContinueSystemMessage,
  docAiContinuePrompt,
  docAiImproveSystemMessage,
  docAiImprovePrompt,
  docAiSummarizeSystemMessage,
  docAiSummarizePrompt,
  docAiTranslateSystemMessage,
  docAiTranslatePrompt,
} from '~/integrations/ai/module/prompts';
import type { ImproveMode } from '~/integrations/ai/module/prompts';

@Injectable()
export class AiDocsService {
  private async getAiWrapper(context: NcContext) {
    const integration = await Integration.getCategoryDefault(
      context,
      IntegrationCategoryType.AI,
    );

    if (!integration) {
      NcError.get(context).integrationNotFound('AI');
    }

    return { integration, wrapper: await integration.getIntegrationWrapper<AiIntegration>() };
  }

  async aiWrite(
    context: NcContext,
    params: {
      input: {
        instruction: string;
        context?: string;
        title?: string;
      };
      req?: any;
    },
  ) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_DOC_AI);

    const { instruction, context: docContext, title } = params.input;

    if (!instruction?.trim()) {
      NcError.badRequest('Instruction is required');
    }

    const { integration, wrapper } = await this.getAiWrapper(context);

    const { data, usage } = await wrapper.generateText({
      system: docAiWriteSystemMessage(),
      messages: [
        { role: 'user', content: docAiWritePrompt(instruction, docContext, title) },
      ],
    });

    await integration.storeInsert(context, params.req?.user?.id, usage);

    return { text: data };
  }

  async aiContinue(
    context: NcContext,
    params: {
      input: {
        precedingContent: string;
        title?: string;
      };
      req?: any;
    },
  ) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_DOC_AI);

    const { precedingContent, title } = params.input;

    if (!precedingContent?.trim()) {
      NcError.badRequest('Preceding content is required');
    }

    const { integration, wrapper } = await this.getAiWrapper(context);

    const { data, usage } = await wrapper.generateText({
      system: docAiContinueSystemMessage(),
      messages: [
        { role: 'user', content: docAiContinuePrompt(precedingContent, title) },
      ],
    });

    await integration.storeInsert(context, params.req?.user?.id, usage);

    return { text: data };
  }

  async aiImprove(
    context: NcContext,
    params: {
      input: {
        text: string;
        mode: ImproveMode;
      };
      req?: any;
    },
  ) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_DOC_AI);

    const { text: inputText, mode } = params.input;

    if (!inputText?.trim()) {
      NcError.badRequest('Text is required');
    }

    if (!mode) {
      NcError.badRequest('Improve mode is required');
    }

    const { integration, wrapper } = await this.getAiWrapper(context);

    const { data, usage } = await wrapper.generateText({
      system: docAiImproveSystemMessage(),
      messages: [
        { role: 'user', content: docAiImprovePrompt(inputText, mode) },
      ],
    });

    await integration.storeInsert(context, params.req?.user?.id, usage);

    return { text: data };
  }

  async aiSummarize(
    context: NcContext,
    params: {
      input: {
        text: string;
      };
      req?: any;
    },
  ) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_DOC_AI);

    const { text: inputText } = params.input;

    if (!inputText?.trim()) {
      NcError.badRequest('Text is required');
    }

    const { integration, wrapper } = await this.getAiWrapper(context);

    const { data, usage } = await wrapper.generateText({
      system: docAiSummarizeSystemMessage(),
      messages: [
        { role: 'user', content: docAiSummarizePrompt(inputText) },
      ],
    });

    await integration.storeInsert(context, params.req?.user?.id, usage);

    return { text: data };
  }

  async aiTranslate(
    context: NcContext,
    params: {
      input: {
        text: string;
        targetLanguage: string;
      };
      req?: any;
    },
  ) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_DOC_AI);

    const { text: inputText, targetLanguage } = params.input;

    if (!inputText?.trim()) {
      NcError.badRequest('Text is required');
    }

    if (!targetLanguage?.trim()) {
      NcError.badRequest('Target language is required');
    }

    const { integration, wrapper } = await this.getAiWrapper(context);

    const { data, usage } = await wrapper.generateText({
      system: docAiTranslateSystemMessage(),
      messages: [
        { role: 'user', content: docAiTranslatePrompt(inputText, targetLanguage) },
      ],
    });

    await integration.storeInsert(context, params.req?.user?.id, usage);

    return { text: data };
  }
}
