import {
  generateText as sdkGenerateText,
  Output,
  wrapLanguageModel,
  defaultSettingsMiddleware,
} from 'ai';
import { devToolsMiddleware } from '@ai-sdk/devtools';
import { IntegrationWrapper } from '../integration';
import type { ModelMessage, ToolSet } from 'ai';
import type { LanguageModelV3 as LanguageModel } from '@ai-sdk/provider';

/**
 * AI SDK DevTools — opt-in via NC_AI_DEVTOOLS=true. The watch:run* scripts in
 * packages/nocodb default it to false; flip it to true locally when you need to
 * inspect AI calls (never set in production). Applied centrally in
 * getModel() so it captures EVERY AI call — chat agents and the schema / docs /
 * completion / utils / data services all route through getModel(). Runs/steps/
 * tool-calls are written to `.devtools/generations.json` (under the backend cwd);
 * inspect with `npx @ai-sdk/devtools` → http://localhost:4983.
 *
 * Dormant in production: the middleware is built only when the env flag is set,
 * and getModel() leaves the model untouched otherwise. @ai-sdk/devtools is a
 * regular dependency (not dev-only) because this module is loaded at boot with a
 * static import and prod prunes devDependencies.
 */
const devToolsMw =
  process.env.NC_AI_DEVTOOLS === 'true' ? devToolsMiddleware() : null;
if (devToolsMw) {
  // eslint-disable-next-line no-console
  console.log(
    '[AI DevTools] enabled — run `npx @ai-sdk/devtools` → http://localhost:4983',
  );
}

export type ModelCapability = 'text' | 'vision' | 'tools' | 'image-generation';

export interface ModelInfo {
  value: string;
  label: string;
  capabilities: ModelCapability[];
}

/**
 * Normalized, provider-agnostic reasoning intensity.
 *
 * Every supported provider exposes reasoning differently (OpenAI `reasoningEffort`,
 * Anthropic `effort`/`thinking`, Google `thinkingConfig`, Bedrock `reasoningConfig`,
 * …). Callers speak this single vocabulary; each integration translates it onto its
 * own provider knob via {@link AiIntegration.reasoningProviderOptions}.
 *
 *   off → disable reasoning where the provider allows it
 *   max → the provider's strongest reasoning setting
 */
export type AiReasoningEffort =
  | 'off'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'max';

type AiJsonValue =
  | null
  | string
  | number
  | boolean
  | { [key: string]: AiJsonValue }
  | AiJsonValue[];

/**
 * Provider-namespaced options bag, e.g. `{ openai: { reasoningEffort: 'minimal' } }`.
 * Structurally mirrors the AI SDK's `SharedV2ProviderOptions`.
 */
export type AiReasoningProviderOptions = Record<
  string,
  Record<string, AiJsonValue>
>;

/**
 * The provider's OWN reasoning value for each normalized {@link AiReasoningEffort}.
 * Reasoning knobs differ per provider AND per model (OpenAI: none/minimal/low/
 * medium/high/xhigh — but 'none' is GPT-5.1-only, 'minimal' is gpt-5-only, o-series
 * has neither; Groq: low/medium/high, 'none' model-dependent; …). So we don't
 * guess — we look up the exact value. **Omit an effort key** when the model has no
 * valid value for it → no reasoning options are emitted for that effort.
 */
export type ReasoningEffortMap = Partial<Record<AiReasoningEffort, string>>;

/**
 * Ordered (model-pattern → effort map) table for one provider. First match wins.
 * A model that matches **no** entry has no reasoning support → emit nothing.
 */
export type ReasoningModelTable = Array<{
  match: RegExp;
  efforts: ReasoningEffortMap;
}>;

/**
 * Resolve the provider's reasoning value for `(modelId, effort)` from a table, or
 * `undefined` when the model isn't in the table or has no value mapped for that
 * effort. The provider id prefix (gateway form `vendor/model`) is stripped first.
 */
export function resolveReasoningEffort(
  table: ReasoningModelTable,
  modelId: string | undefined,
  effort: AiReasoningEffort,
): string | undefined {
  const id = (modelId ?? '').split('/').pop() ?? '';
  return table.find((e) => e.match.test(id))?.efforts[effort];
}

/**
 * OpenAI Responses-API `reasoning.effort` values per model — verified against the
 * per-model "supported values" from OpenAI's model pages. The valid set differs by
 * model, so we look up the exact value (first match wins). A model that matches no
 * entry, or whose matched entry has no value for the requested effort, gets NO
 * reasoning options. Shared by every `openai`-namespace integration (OpenAI,
 * OpenAI-compatible, NocoDB-managed).
 *
 * Confirmed sets (off/minimal map to each model's lowest supported value):
 *   gpt-5.x "-pro"      : medium | high | xhigh           (no none/low)
 *   gpt-5.x "-codex"    : low | medium | high | xhigh      (no none/minimal)
 *   gpt-5.x "-instant"/"-thinking": no data → omitted (no reasoning)
 *   gpt-5.1             : none | low | medium | high       (no minimal/xhigh)
 *   gpt-5.2/5.3/5.4/5.5 (+ -mini/-nano): none | low | medium | high | xhigh (no minimal)
 *   gpt-5 (Aug-2025)    : minimal | low | medium | high     (no none/xhigh)
 *   gpt-5-mini/-nano, o-series, gpt-4o/4.1: no configurable effort → omitted
 */
export const OPENAI_REASONING_TABLE: ReasoningModelTable = [
  {
    // GPT-5.x Pro: medium | high | xhigh only.
    match: /^gpt-5\.\d.*pro/,
    efforts: {
      off: 'medium',
      minimal: 'medium',
      low: 'medium',
      medium: 'medium',
      high: 'high',
      max: 'xhigh',
    },
  },
  {
    // GPT-5.x Codex: low | medium | high | xhigh (no none/minimal).
    match: /^gpt-5\.\d.*codex/,
    efforts: {
      off: 'low',
      minimal: 'low',
      low: 'low',
      medium: 'medium',
      high: 'high',
      max: 'xhigh',
    },
  },
  {
    // GPT-5.x Instant / Thinking: no verified effort data → emit nothing.
    match: /^gpt-5\.\d.*(?:instant|thinking)/,
    efforts: {},
  },
  {
    // GPT-5.1: none | low | medium | high (no minimal, no xhigh).
    match: /^gpt-5\.1(?:[-.]|$)/,
    efforts: {
      off: 'none',
      minimal: 'low',
      low: 'low',
      medium: 'medium',
      high: 'high',
      max: 'high',
    },
  },
  {
    // GPT-5.2 / 5.3 / 5.4 / 5.5 (incl. -mini / -nano): none|low|medium|high|xhigh, no minimal.
    match: /^gpt-5\.\d/,
    efforts: {
      off: 'none',
      minimal: 'low',
      low: 'low',
      medium: 'medium',
      high: 'high',
      max: 'xhigh',
    },
  },
  {
    // GPT-5 base snapshots only (gpt-5, gpt-5-YYYY-MM-DD): minimal|low|medium|high.
    // Excludes gpt-5-mini / gpt-5-nano (no configurable effort) → they match nothing.
    match: /^gpt-5(?:-\d{4}-\d{2}-\d{2})?$/,
    efforts: {
      off: 'minimal',
      minimal: 'minimal',
      low: 'low',
      medium: 'medium',
      high: 'high',
      max: 'high',
    },
  },
];

export abstract class AiIntegration<
  T extends { models: string[] } = any,
> extends IntegrationWrapper<T> {
  /**
   * List of models supported by this AI provider with their capabilities.
   * Override this in each integration to define supported models.
   */
  protected abstract supportedModels: ModelInfo[];

  /** Default sampling temperature for generateText / generateObject. */
  protected temperature = 0.5;

  /**
   * Build the provider-bound model factory — validates credentials and constructs
   * the underlying `@ai-sdk/*` provider. This is the only mandatory provider hook.
   */
  protected abstract createProvider(): (modelId: string) => LanguageModel;

  /**
   * Resolve a user-facing model selector to a concrete provider model id.
   * Default: the selector itself, falling back to the first configured model.
   * Override for tier maps (e.g. high/medium/low → concrete model ids).
   */
  protected resolveModelId(input?: string): string {
    const modelId = input || this.config.models?.[0];
    if (!modelId) {
      throw new Error('Integration not configured properly');
    }
    return modelId;
  }

  /**
   * Translate the normalized reasoning effort into this provider's `providerOptions`
   * shape. Return `undefined` when the provider has no reasoning control (default).
   * `modelId` is supplied because some providers (e.g. Bedrock) key the shape off the
   * model family.
   */
  protected reasoningProviderOptions(
    _effort: AiReasoningEffort,
    _modelId: string,
  ): AiReasoningProviderOptions | undefined {
    return undefined;
  }

  /**
   * Provider-specific web-search tool, applied by generateText / generateObject when
   * the caller requests `websearch`. Return `undefined` if the provider has none.
   */
  protected webSearchTool(): ToolSet | undefined {
    return undefined;
  }

  /**
   * Get the underlying language model, with reasoning effort baked in when requested.
   *
   * Reasoning is applied as a model-level default via `defaultSettingsMiddleware`, so
   * the returned model carries it on every call — callers never touch provider-specific
   * `providerOptions`.
   */
  public getModel(args?: AiGetModelArgs): LanguageModel {
    const provider = this.createProvider();
    const modelId = this.resolveModelId(args?.customModel);
    let model = provider(modelId);

    if (args?.reasoningEffort) {
      const providerOptions = this.reasoningProviderOptions(
        args.reasoningEffort,
        modelId,
      );
      if (providerOptions) {
        model = wrapLanguageModel({
          model,
          middleware: defaultSettingsMiddleware({
            settings: { providerOptions },
          }),
        });
      }
    }

    // DevTools capture (no-op unless NC_AI_DEVTOOLS=true) — applied last so it
    // observes the fully-configured model used by every AI feature.
    if (devToolsMw) {
      model = wrapLanguageModel({ model, middleware: devToolsMw });
    }

    return model;
  }

  public async generateText(
    args: AiGenerateTextArgs,
  ): Promise<AiGenerateTextResponse> {
    const model = this.getModel({ customModel: args.customModel });
    const tools = args.websearch ? this.webSearchTool() : undefined;

    const response = await sdkGenerateText({
      model,
      system: args.system,
      temperature: this.temperature,
      ...('messages' in args
        ? { messages: args.messages }
        : { prompt: args.prompt }),
      ...(tools ? { tools } : {}),
    });

    return {
      usage: {
        input_tokens: response.usage.inputTokens,
        output_tokens: response.usage.outputTokens,
        total_tokens: response.usage.totalTokens,
        model: model.modelId,
      },
      data: response.text,
    };
  }

  public async generateObject<T = any>(
    args: AiGenerateObjectArgs,
  ): Promise<AiGenerateObjectResponse<T>> {
    const model = this.getModel({ customModel: args.customModel });
    const tools = args.websearch ? this.webSearchTool() : undefined;

    const response = await sdkGenerateText({
      model,
      output: Output.object({ schema: args.schema }),
      messages: args.messages,
      temperature: this.temperature,
      ...(tools ? { tools } : {}),
    });

    return {
      usage: {
        input_tokens: response.usage.inputTokens,
        output_tokens: response.usage.outputTokens,
        total_tokens: response.usage.totalTokens,
        model: model.modelId,
      },
      data: response.output as T,
    };
  }

  /**
   * Get available models based on user configuration
   * @param capability - Optional capability filter (e.g., 'text', 'vision', 'tools')
   * @returns List of models that match the criteria
   *
   * Note: Custom models (not in supportedModels) are always included,
   * assuming they support all capabilities
   */
  public async availableModels(
    capability?: ModelCapability,
  ): Promise<ModelInfo[]> {
    const results: ModelInfo[] = [];

    for (const modelId of this.config.models || []) {
      // Find model in supportedModels list
      const supportedModel = this.supportedModels.find(
        (m) => m.value === modelId,
      );

      if (supportedModel) {
        // Known model - check capabilities if specified
        if (!capability || supportedModel.capabilities.includes(capability)) {
          results.push(supportedModel);
        }
      } else {
        // Custom/unknown model - assume it supports everything
        results.push({
          value: modelId,
          label: modelId, // Use the ID as label
          capabilities: ['text', 'vision', 'tools', 'image-generation'],
        });
      }
    }

    return results;
  }

  public async fetchOptions(payload: { key: string }): Promise<unknown> {
    const { key } = payload;
    if (key === 'models') {
      return this.supportedModels;
    }
    return [];
  }

  // Optional: Only implement for providers that support image generation
  generateImage?(args: AiGenerateImageArgs): Promise<AiGenerateImageResponse>;
}

export interface AiUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  model: string;
}

export interface AiGenerateObjectArgs {
  messages: ModelMessage[];
  schema: any;
  customModel?: string;
  websearch?: boolean;
}

interface AiGenerateObjectResponse<T> {
  usage: AiUsage;
  data: T;
}

export type AiGenerateTextArgs = {
  system: string;
  customModel?: string;
  websearch?: boolean;
} & ({ prompt: string } | { messages: ModelMessage[] });

interface AiGenerateTextResponse {
  usage: AiUsage;
  data: string;
}

export interface AiGetModelArgs {
  customModel?: string;
  /**
   * Normalized reasoning intensity; translated per-provider and baked into the
   * returned model as a default. Omit for the provider's own default behaviour.
   */
  reasoningEffort?: AiReasoningEffort;
}

export interface AiGenerateImageArgs {
  prompt: string;
  customModel?: string;
  size?: string; // e.g. '1024x1024'
  n?: number;
}

export interface AiGenerateImageResponse {
  image: {
    base64: string;
    uint8Array: Uint8Array;
  };
  images: Array<{
    base64: string;
    uint8Array: Uint8Array;
  }>;
}
