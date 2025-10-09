import { Injectable } from '@nestjs/common';
import { CompletionCopilot } from 'monacopilot';
import { IntegrationCategoryType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { AiIntegration } from '@noco-local-integrations/core';
import { Integration } from '~/models';
import { NcError } from '~/helpers/catchError';
import { predictScriptCompletion } from '~/integrations/ai/module/prompts';

@Injectable()
export class AiCompletionService {
  async aiCompletion(
    context: NcContext,
    req: NcRequest,
  ): Promise<{
    completion: string | null;
    error?: string;
    raw?: unknown;
  }> {
    const baseSchema = req.body?.schema;

    if (!baseSchema) {
      NcError.badRequest(`Please provide base Schema for completion`);
    }

    const integration = await Integration.getCategoryDefault(
      context,
      IntegrationCategoryType.AI,
    );

    if (!integration) {
      NcError.get(context).integrationNotFound('AI');
    }

    const wrapper = integration.getIntegrationWrapper<AiIntegration>();

    const copilot = new CompletionCopilot(undefined, {
      model: async () => {
        const customPrompt = predictScriptCompletion(
          req.body.completionMetadata,
          baseSchema,
        );
        const { usage, data } = await wrapper.generateText({
          system: customPrompt.context,
          messages: [
            {
              role: 'user',
              content: `${customPrompt.instruction}\n\n${customPrompt.fileContent}`,
            },
          ],
        });

        await integration.storeInsert(context, req?.user?.id, usage);

        return {
          text: data,
        };
      },
    });

    return await copilot.complete({
      body: req.body,
    });
  }
}
