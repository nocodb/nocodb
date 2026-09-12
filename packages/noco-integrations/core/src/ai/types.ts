import {
  generateText as sdkGenerateText,
  Output,
  wrapLanguageModel,
  defaultSettingsMiddleware,
} from 'ai';
import { devToolsMiddleware } from '@ai-sdk/devtools';
import { IntegrationWrapper } from '../integration';
import { maskSecret } from '../auth/sensitive';
import type { EmbeddingModel, ModelMessage, ToolSet } from 'ai';
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

/**
 * System AI activity — lets an integration route different activities to
 * different models (the NocoDB-managed integration maps these via its
 * `activities` config; every other provider ignores them).
 *
 * NOTE: features where the user explicitly picks an integration AND a model
 * (AI fields, AI buttons, workflow AI nodes) do NOT use a use case — they pass
 * `customModel` instead. So this enum only enumerates no-human-in-the-loop
 * activities served by the default/global integration.
 */
export enum AiUseCase {
  /** Chat turn triage — picks the specialist agent. */
  ChatRouter = 'chat_router',
  /** Schema/structure building specialist agent. */
  ChatBuilder = 'chat_builder',
  /** Data Q&A + record CRUD specialist agent (merged qa + record). */
  ChatData = 'chat_data',
  /** Product support specialist agent. */
  ChatSupport = 'chat_support',
  /** Pages/dashboard authoring specialist agent. */
  ChatPages = 'chat_pages',
  /** Session title generation from the first user message. */
  ChatTitle = 'chat_title',
  /** History compaction — summarizing older messages to fit the token budget. */
  ChatCompaction = 'chat_compaction',
  /** End-of-turn summary written for future turns' context. */
  ChatSummarize = 'chat_summarize',
  /** Prompt-chip generation: empty-state suggestions and post-turn follow-ups. */
  ChatSuggestions = 'chat_suggestions',
  /** Schema/table/view/filter generation from a prompt. */
  Schema = 'schema',
  /** Field-type / select-option / next-field / next-table / next-button prediction. */
  FieldSuggestions = 'field_suggestions',
  /** Formula generation, repair, and next-formula prediction. */
  Formula = 'formula',
  /** Row auto-fill and extract-from-input (no per-field integration). */
  Data = 'data',
  /** Document authoring/editing: write, continue, improve. */
  DocsWrite = 'docs_write',
  /** Document summarization. */
  DocsSummarize = 'docs_summarize',
  /** Document translation. */
  DocsTranslate = 'docs_translate',
  /** Workflow send-email body: write, rewrite selection, suggestion chips. */
  WorkflowEmailCompose = 'workflow_email_compose',
  /** Script/code completion. */
  Completion = 'completion',
  /** App builder turn — Claude Code in a sandbox, sub-agents inherit the model. */
  AppBuild = 'app_build',
  /**
   * In-app assistant turn — the widget a PUBLISHED app serves to its end users.
   * Distinct from every `chat_*` case: those run in the console against a base
   * role, this one runs on the app origin with the app's own actions as its
   * only tools.
   */
  AppAgent = 'app_agent',
  /** Text embeddings — agent knowledge indexing and retrieval. */
  Embedding = 'embedding',
  /** Fallback when no specific use case applies. */
  Default = 'default',
}

export interface ModelInfo {
  value: string;
  label: string;
  capabilities: ModelCapability[];
}

/** The AI-SDK usage fields billing needs, in either SDK spelling. */
export interface AiSdkUsageLike {
  inputTokens?: number;
  outputTokens?: number;
  /** @deprecated SDK alias for cacheRead ONLY — never includes cache writes. */
  cachedInputTokens?: number;
  inputTokenDetails?: {
    noCacheTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  };
}

/** The same usage in the provider-level (`LanguageModelV3`) nested spelling. */
export interface AiSdkNestedUsageLike {
  inputTokens?: {
    total?: number;
    noCache?: number;
    cacheRead?: number;
    cacheWrite?: number;
  };
  outputTokens?: { total?: number };
}

/** Token counts split into the buckets billing prices separately. */
export interface AiUsageBuckets {
  /** TOTAL input, recomputed as `noCache + cacheRead + cacheWrite` so the
   *  buckets always re-sum — billing subtracts from this. */
  inputTokens: number;
  /** Input EXCLUDING both cache buckets: what the full input rate applies to. */
  noCacheTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  /** The provider's OWN reported total, untouched — `undefined` when it didn't
   *  report one. Differs from `inputTokens` only if the provider contradicts
   *  the SDK invariant; kept so that can be asserted on rather than absorbed. */
  reportedInputTokens?: number;
}

/**
 * Split an AI-SDK usage into the buckets billing prices separately.
 *
 * `usage.inputTokens` is the TOTAL — the SDK's invariant is
 * `total = noCache + cacheRead + cacheWrite`. The cached parts MUST come off before
 * the remainder is billed at the full input rate, or every cached token is charged
 * twice.
 *
 * `cachedInputTokens` is deprecated AND covers cacheRead only, so
 * `inputTokenDetails` is read first: relying on the deprecated field alone bills
 * cache writes as plain input today, and bills EVERYTHING at full price the day the
 * SDK drops it.
 *
 * One implementation on purpose — this arithmetic decides what customers pay.
 */
export function splitAiUsage(usage?: AiSdkUsageLike | null): AiUsageBuckets {
  const details = usage?.inputTokenDetails;
  const cacheReadTokens =
    details?.cacheReadTokens ?? usage?.cachedInputTokens ?? 0;
  const cacheWriteTokens = details?.cacheWriteTokens ?? 0;
  const total = usage?.inputTokens ?? 0;
  // Prefer the provider's own non-cached count; otherwise net the buckets off.
  const noCacheTokens =
    details?.noCacheTokens ??
    Math.max(0, total - cacheReadTokens - cacheWriteTokens);

  return {
    inputTokens: noCacheTokens + cacheReadTokens + cacheWriteTokens,
    noCacheTokens,
    cacheReadTokens,
    cacheWriteTokens,
    outputTokens: usage?.outputTokens ?? 0,
    reportedInputTokens: usage?.inputTokens,
  };
}

/**
 * `splitAiUsage` for the provider-level nested shape (`LanguageModelV3Usage`),
 * which `doGenerate`/`doStream` return. Normalises and delegates so the netting
 * itself has exactly one implementation — the gateway paths bill from this.
 */
export function splitLanguageModelUsage(
  usage?: AiSdkNestedUsageLike | null,
): AiUsageBuckets {
  return splitAiUsage({
    inputTokens: usage?.inputTokens?.total,
    outputTokens: usage?.outputTokens?.total,
    inputTokenDetails: {
      noCacheTokens: usage?.inputTokens?.noCache,
      cacheReadTokens: usage?.inputTokens?.cacheRead,
      cacheWriteTokens: usage?.inputTokens?.cacheWrite,
    },
  });
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
 *   gpt-5.6 (sol/terra/luna): none | low | medium | high | xhigh | max (no minimal) —
 *     adds a genuine ceiling above xhigh, so `max` claims it and `high` shifts to xhigh
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
    // GPT-5.6 (Sol/Terra/Luna): adds a genuine ceiling above xhigh.
    match: /^gpt-5\.6/,
    efforts: {
      off: 'none',
      minimal: 'low',
      low: 'low',
      medium: 'medium',
      high: 'xhigh',
      max: 'max',
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
   * The config keys holding THIS provider's credentials. Override where the
   * credential shape differs (e.g. Bedrock's access keys); a provider whose
   * only secret is `apiKey` — nearly all of them — needs nothing.
   */
  protected secretConfigKeys: string[] = ['apiKey'];

  /**
   * Response-safe config view — replaces {@link secretConfigKeys} with
   * CREDENTIAL_MASK. Unlike auth integrations (where the credential shape is
   * per-provider and masking is abstract), an AI provider's credential is a
   * plain top-level key, so this default covers every package but the
   * NocoDB-managed aggregator. Hosts run configs through this before
   * serialising them into any API response and restore echoed sentinels from
   * the stored config on update — never persist the result.
   */
  public maskConfig(config: T = this.config): Partial<T> {
    if (!config || typeof config !== 'object') return config;
    const masked: any = { ...config };
    for (const key of this.secretConfigKeys) {
      if (masked[key]) masked[key] = maskSecret(masked[key]);
    }
    return masked;
  }

  /**
   * Build the provider-bound model factory — validates credentials and constructs
   * the underlying `@ai-sdk/*` provider. This is the only mandatory provider hook.
   */
  protected abstract createProvider(): (modelId: string) => LanguageModel;

  /**
   * Resolve a user-facing model selector to a concrete provider model id.
   * Default: the selector itself, falling back to the first configured model.
   * Override when a selector isn't already a concrete provider model id.
   */
  protected resolveModelId(input?: string): string {
    const modelId = input || this.config.models?.[0];
    if (!modelId) {
      throw new Error('Integration not configured properly');
    }
    return modelId;
  }

  /**
   * Resolve the full model-selection args to a concrete provider model id.
   * Default ignores `useCase` and delegates to {@link resolveModelId} — only
   * integrations that route activities to different models (the NocoDB-managed
   * integration) override this.
   */
  protected resolveModel(args?: AiGetModelArgs): string {
    return this.resolveModelId(args?.customModel);
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
   * `null` when the provider has none (e.g. Anthropic) — callers must treat that
   * as "keyword search only", never as an error.
   */
  public getEmbeddingModel(_args?: {
    useCase?: AiUseCase;
  }): EmbeddingModel | null {
    return null;
  }

  /**
   * The embedding model id {@link getEmbeddingModel} would use — for storing
   * alongside vectors so stale embeddings are detectable after a model change.
   */
  public getEmbeddingModelRef(_args?: { useCase?: AiUseCase }): string | null {
    return null;
  }

  /**
   * The model reference this integration would resolve `args` to, as it should be
   * *reported* — not necessarily what the provider is handed.
   *
   * These differ for the NocoDB-managed integration: it resolves `<provider>/<modelId>`
   * and then hands the delegate only the bare `<modelId>`, so `LanguageModel.modelId`
   * loses the namespace. Billing keys its rate table on the qualified ref, so usage must
   * be reported from here rather than off the returned model.
   */
  public resolveModelRef(args?: AiGetModelArgs): string {
    return this.resolveModel(args);
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
    const modelId = this.resolveModel(args);
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
    const model = this.getModel({
      customModel: args.customModel,
      useCase: args.useCase,
    });
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

    // Cache reads/writes split out of input so billing prices each bucket at
    // its own rate; reasoning is already inside outputTokens.
    const buckets = splitAiUsage(response.usage);
    const reasoning = response.usage.outputTokenDetails?.reasoningTokens ?? 0;

    return {
      usage: {
        input_tokens: buckets.noCacheTokens,
        cache_read_tokens: buckets.cacheReadTokens,
        cache_write_tokens: buckets.cacheWriteTokens,
        output_tokens: response.usage.outputTokens,
        reasoning_tokens: reasoning,
        total_tokens: response.usage.totalTokens,
        // Qualified ref, not `model.modelId` — see `resolveModelRef` and AiUsage.
        model: this.resolveModelRef({
          customModel: args.customModel,
          useCase: args.useCase,
        }),
      },
      data: response.text,
    };
  }

  public async generateObject<T = any>(
    args: AiGenerateObjectArgs,
  ): Promise<AiGenerateObjectResponse<T>> {
    const model = this.getModel({
      customModel: args.customModel,
      useCase: args.useCase,
    });
    const tools = args.websearch ? this.webSearchTool() : undefined;

    const response = await sdkGenerateText({
      model,
      output: Output.object({ schema: args.schema }),
      messages: args.messages,
      temperature: this.temperature,
      ...(tools ? { tools } : {}),
    });

    // Cache reads/writes split out of input so billing prices each bucket at
    // its own rate; reasoning is already inside outputTokens.
    const buckets = splitAiUsage(response.usage);
    const reasoning = response.usage.outputTokenDetails?.reasoningTokens ?? 0;

    return {
      usage: {
        input_tokens: buckets.noCacheTokens,
        cache_read_tokens: buckets.cacheReadTokens,
        cache_write_tokens: buckets.cacheWriteTokens,
        output_tokens: response.usage.outputTokens,
        reasoning_tokens: reasoning,
        total_tokens: response.usage.totalTokens,
        // Qualified ref, not `model.modelId` — see `resolveModelRef` and AiUsage.
        model: this.resolveModelRef({
          customModel: args.customModel,
          useCase: args.useCase,
        }),
      },
      data: response.output as T,
    };
  }

  /**
   * An unlisted model is assumed capable, so a stale catalogue never cripples a
   * newly-released id. A listed one is trusted, turning "image to a text-only
   * model" into a fallback here rather than a provider error.
   */
  public supportsCapability(
    capability: ModelCapability,
    args?: AiGetModelArgs,
  ): boolean {
    let modelId: string;
    try {
      modelId = this.resolveModel(args);
    } catch {
      return false;
    }

    const known = this.supportedModels.find((m) => m.value === modelId);
    return known ? known.capabilities.includes(capability) : true;
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
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
  total_tokens?: number;
  /**
   * The resolved `<provider>/<modelId>` ref, NOT the provider's bare model id.
   *
   * The managed integration resolves a namespaced ref and then hands the
   * delegate only the bare id, so `LanguageModel.modelId` loses the namespace.
   * Billing keys its rate table on the qualified form; reporting the bare id
   * misses every entry and silently prices at the most expensive fallback.
   * BYO integrations are unaffected — they resolve to a bare id either way.
   */
  model: string;
}

export interface AiGenerateObjectArgs {
  messages: ModelMessage[];
  schema: any;
  customModel?: string;
  /** System activity — only activity-routing integrations map this to a model. */
  useCase?: AiUseCase;
  websearch?: boolean;
}

interface AiGenerateObjectResponse<T> {
  usage: AiUsage;
  data: T;
}

export type AiGenerateTextArgs = {
  system: string;
  customModel?: string;
  /** System activity — only activity-routing integrations map this to a model. */
  useCase?: AiUseCase;
  websearch?: boolean;
} & ({ prompt: string } | { messages: ModelMessage[] });

interface AiGenerateTextResponse {
  usage: AiUsage;
  data: string;
}

export interface AiGetModelArgs {
  /** Explicit model id chosen by the user (AI fields/buttons/workflow nodes). */
  customModel?: string;
  /** System activity — only activity-routing integrations map this to a model. */
  useCase?: AiUseCase;
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
