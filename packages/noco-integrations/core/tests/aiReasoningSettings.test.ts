import { describe, it, expect } from 'vitest';
import { generateText } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { AiIntegration } from '../src/ai/types';
import type { AiReasoningEffort, AiReasoningSettings } from '../src/ai/types';

function mockModel() {
  return new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: 'text', text: 'ok' }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        inputTokens: {
          total: 1,
          noCache: 1,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
      warnings: [],
    },
  });
}

class TestAi extends AiIntegration {
  protected supportedModels = [];
  readonly mock = mockModel();

  protected createProvider() {
    return () => this.mock;
  }

  protected reasoningSettings(effort: AiReasoningEffort): AiReasoningSettings {
    return {
      reasoning: effort === 'off' ? 'none' : effort,
      providerOptions: { test: { budget: 100 } },
    };
  }
}

function integration() {
  return new TestAi({ models: ['m'] }, {});
}

describe('AiIntegration reasoning settings', () => {
  it('sends the integration reasoning and provider options', async () => {
    const ai = integration();
    await generateText({
      model: ai.getModel({ reasoningEffort: 'low' }),
      prompt: 'hi',
    });

    const call = ai.mock.doGenerateCalls[0];
    expect(call.reasoning).toBe('low');
    expect(call.providerOptions).toEqual({ test: { budget: 100 } });
  });

  it('lets per-call values win, merging per provider namespace', async () => {
    const ai = integration();
    await generateText({
      model: ai.getModel({ reasoningEffort: 'low' }),
      prompt: 'hi',
      reasoning: 'high',
      providerOptions: { test: { extra: true } },
    });

    const call = ai.mock.doGenerateCalls[0];
    expect(call.reasoning).toBe('high');
    expect(call.providerOptions).toEqual({
      test: { budget: 100, extra: true },
    });
  });

  it('sends nothing without a requested effort', async () => {
    const ai = integration();
    await generateText({ model: ai.getModel(), prompt: 'hi' });

    const call = ai.mock.doGenerateCalls[0];
    expect(call.reasoning).toBeUndefined();
    expect(call.providerOptions).toBeUndefined();
  });
});
