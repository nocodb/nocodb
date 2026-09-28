import { PlanOrder } from 'nocodb-sdk';
import { IntegrationWrapper } from '../integration';
import { IntegrationType } from '../types';
import type { IntegrationEntry, IntegrationManifest } from '../types';
import type {
  PlanTitles,
  RoutineParamField,
  RoutineValidationIssue,
} from 'nocodb-sdk';

export type CapabilityParamType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'enum'
  | 'object'
  | 'array';

export interface CapabilityParam {
  name: string;
  type: CapabilityParamType;
  description?: string;
  optional?: boolean;
  values?: string[];
  /** Element type of an `array` param. */
  items?: CapabilityParamType;
  fetchOptionsKey?: string;
  /**
   * Refuse a `ref`/`tmpl`/`arr` binding into this param at AUTHORING time — it
   * takes verbatim literals only. `http-api.request.headers` is the case that
   * needs it: a routed value there becomes an outbound request header, and one
   * of those is `Authorization`.
   */
  literalOnly?: boolean;
  /**
   * May an app installer re-point this value at their own tenant during setup?
   * Unset means the host's heuristic decides (required + scalar ⇒ collectable).
   *
   * `false` on params that ARE the action rather than a pointer into it — `sql`,
   * `method`, `headers`: rewriting one changes what the published action does.
   * `true` opts in an optional tenant pointer the heuristic would skip.
   */
  repointable?: boolean;
}

/**
 * How the host runs one call to this provider: how many at once per
 * integration, how long to wait for a slot, and the wall-clock bound on the
 * call itself.
 *
 * Declared by the package because it is a property of the backend — a Redis
 * command is milliseconds, an LLM call is a minute — and the host holds only an
 * opaque wrapper.
 */
export interface ExecutionPolicy {
  concurrency: number;
  acquireTimeoutMs: number;
  runTimeoutMs: number;
}

/**
 * A failed call, split into what the caller may see and whether it counts
 * against the circuit breaker.
 *
 * `infra` means the backend is unwell — connection, auth, transport — and the
 * error names topology (host, IP, port, user) that must never be surfaced.
 * Everything else is the caller's own request and is returned verbatim, which
 * is what lets an agent read `column "emial" does not exist` and fix its own
 * statement.
 */
export interface ClassifiedError {
  clientMessage: string;
  infra: boolean;
  /** Issue path the host reports it under. Defaults to `integration`. */
  path?: string;
  /** Issue code the host reports it under. Defaults to `call_failed`. */
  code?: string;
}

/** Field-level rejection from a provider. The host maps `issues` onto its own
 *  validation error instead of collapsing them into one opaque message. */
export class CapabilityInputError extends Error {
  constructor(readonly issues: RoutineValidationIssue[]) {
    super(issues[0]?.message ?? 'invalid capability input');
    this.name = 'CapabilityInputError';
  }
}

export interface Capability {
  id: string;
  title?: string;
  description?: string;
  // The split is the injection guard: authored is fixed at authoring time,
  // input is caller-supplied.
  authored?: CapabilityParam[];
  input?: CapabilityParam[];
  /**
   * JSON Schema for what `call()` RESOLVES TO — the value the host puts in the `data`
   * envelope of an app's public HTTP response and in its MCP tool result. Declared
   * here so the type travels with the integration instead of every app discovering it
   * by trying the call.
   *
   * Declare it when the shape is the PACKAGE's, not the provider's: the SQL and HTTP
   * envelopes are ours and fully known, as is a GraphQL operation whose document is
   * pinned here. Leave it absent where the value is a third party's raw payload — an
   * absent schema says "we do not know", which a wrong one does not. A partly-open
   * schema is the honest middle and the common case.
   *
   * `deriveActionOutput` overrides this per action when the authored values narrow it.
   */
  output?: Record<string, unknown>;

  /**
   * Calling this changes nothing on the provider's side, so the host may run it
   * to check a step rather than only to perform one. Provider-agnostic on
   * purpose: an HTTP package derives it from the verb, a client-based package
   * declares it. Absent means not read-only, which is the safe default.
   */
  readOnly?: boolean;

  /** Minimum plan tier required to run this capability. Declared here so the
   *  tier travels with the integration instead of a host-side map. Enforcement
   *  is the host contract's: every adapter that dispatches a capability calls
   *  `assertActionAllowedForPlan` before doing so. */
  plan?: PlanTitles;
  /**
   * Ids of **retired workflow nodes** this capability took over, unqualified
   * exactly like `id` — `action.create_event` for the node that shipped as
   * `google_calendar.action.create_event`. Published app actions store the
   * qualified form in `source_ref.action`, so dispatch has to keep resolving it
   * after the node package is gone.
   *
   * Retired node ids only. This is not a rename mechanism: an id that was never
   * a shipped node id does not belong here, or aliasing becomes permanent.
   */
  legacy?: string[];
}

const CAPABILITY_ID = /^[a-z0-9]+(?:[._][a-z0-9]+)*$/;

/** Keys the host's `source_ref` owns. An authored param of the same name is
 *  undeliverable, so it is refused here rather than silently arriving unset.
 *  `connection` is the publish stamp — one reserved name covers every fact it
 *  carries, which is why the stamp is a nested block and not loose keys. */
export const RESERVED_AUTHORED_PARAMS = [
  'integrationId',
  'action',
  'subType',
  'connection',
] as const;

const RESERVED = new Set<string>(RESERVED_AUTHORED_PARAMS);

function validateParams(
  id: string,
  kind: 'authored' | 'input',
  params: CapabilityParam[],
) {
  const seen = new Set<string>();

  for (const param of params) {
    if (!param.name) {
      throw new Error(`Capability "${id}" has an ${kind} param with no name`);
    }

    if (kind === 'authored' && RESERVED.has(param.name)) {
      throw new Error(
        `Capability "${id}" declares authored param "${param.name}", a name reserved by source_ref`,
      );
    }

    if (seen.has(param.name)) {
      throw new Error(
        `Capability "${id}" declares ${kind} param "${param.name}" twice`,
      );
    }
    seen.add(param.name);

    if (param.type === 'enum' && !param.values?.length) {
      throw new Error(
        `Capability "${id}" declares ${kind} param "${param.name}" as enum without values`,
      );
    }
  }
}

export function validateCapability(capability: Capability): void {
  const id = capability?.id;

  if (!id || !CAPABILITY_ID.test(id)) {
    throw new Error(
      `Invalid capability id "${id}": expected lowercase resource-first segments, e.g. "issue.create"`,
    );
  }

  // An unrecognised tier scores `PlanOrder[x] ?? 0` on the host — i.e. free —
  // so a typo would silently unlock a paid capability.
  if (
    capability.plan &&
    !Object.prototype.hasOwnProperty.call(PlanOrder, capability.plan)
  ) {
    throw new Error(
      `Capability "${id}" declares unknown plan "${capability.plan}"`,
    );
  }

  if (
    capability.output !== undefined &&
    (capability.output === null ||
      typeof capability.output !== 'object' ||
      Array.isArray(capability.output))
  ) {
    throw new Error(
      `Capability "${id}" declares an output that is not a JSON Schema object`,
    );
  }

  const authored = capability.authored ?? [];
  const input = capability.input ?? [];

  validateParams(id, 'authored', authored);
  validateParams(id, 'input', input);

  const authoredNames = new Set(authored.map((param) => param.name));
  const clash = input.find((param) => authoredNames.has(param.name));

  if (clash) {
    throw new Error(
      `Capability "${id}" declares "${clash.name}" as both authored and input`,
    );
  }

  const legacySeen = new Set<string>();

  for (const legacy of capability.legacy ?? []) {
    if (!legacy || !CAPABILITY_ID.test(legacy)) {
      throw new Error(
        `Capability "${id}" declares legacy id "${legacy}": expected the retired node id unqualified, e.g. "action.create_event"`,
      );
    }
    if (legacy === id) {
      throw new Error(`Capability "${id}" declares its own id as legacy`);
    }
    if (legacySeen.has(legacy)) {
      throw new Error(
        `Capability "${id}" declares legacy id "${legacy}" twice`,
      );
    }
    legacySeen.add(legacy);
  }
}

export function validateCapabilities(capabilities: Capability[]): void {
  const seen = new Set<string>();

  for (const capability of capabilities) {
    validateCapability(capability);

    if (seen.has(capability.id)) {
      throw new Error(`Duplicate capability id "${capability.id}"`);
    }
    seen.add(capability.id);
  }

  // A legacy id resolves like a real one, so an id claimed twice — or claimed
  // alongside a live capability — makes dispatch depend on declaration order.
  const claimed = new Map<string, string>();

  for (const capability of capabilities) {
    for (const legacy of capability.legacy ?? []) {
      if (seen.has(legacy)) {
        throw new Error(
          `Capability "${capability.id}" claims legacy id "${legacy}", which is a live capability id`,
        );
      }
      const owner = claimed.get(legacy);
      if (owner) {
        throw new Error(
          `Capabilities "${owner}" and "${capability.id}" both claim legacy id "${legacy}"`,
        );
      }
      claimed.set(legacy, capability.id);
    }
  }
}

/** A capability by its own id, or by a retired node id it declares. Shared so
 *  dispatch and the plan lookup can never disagree about what an id resolves
 *  to. */
export function findCapability(
  capabilities: Capability[],
  id: string,
): Capability | undefined {
  return (
    capabilities.find((c) => c.id === id) ??
    capabilities.find((c) => c.legacy?.includes(id))
  );
}

export function qualifyCapability(
  requiresAuth: string,
  capability: Capability,
): string {
  validateCapability(capability);

  const { id } = capability;

  if (
    id === requiresAuth ||
    id.startsWith(`${requiresAuth}.`) ||
    id.startsWith(`${requiresAuth}_`)
  ) {
    throw new Error(
      `Capability id "${id}" must not include the provider "${requiresAuth}" — qualification prepends it`,
    );
  }

  return `${requiresAuth}.${id}`;
}

// Extends IntegrationWrapper only so a subclass satisfies
// `IntegrationEntry.wrapper`. An actions integration owns no config — auth is
// resolved by the host and handed to `call()` per invoke.
export abstract class ActionsIntegration<
  TAuth = any,
> extends IntegrationWrapper<Record<string, unknown>> {
  abstract readonly requiresAuth: string;

  /**
   * Pricing class. True = a backend the customer brings (a database, a raw HTTP
   * API, a keyspace), whose invocations bill against LIMIT_APP_ROUTINE_RUN and
   * require FEATURE_APP_EXTERNAL_DATA. False/absent = a SaaS provider.
   *
   * Declared here because it is a property of what the backend IS; the host only
   * enforces it.
   */
  readonly externalData?: boolean;

  abstract capabilities(): Capability[];

  abstract call(
    auth: TAuth,
    capabilityId: string,
    authored: Record<string, unknown>,
    input: Record<string, unknown>,
  ): Promise<unknown>;

  fetchOptions?(
    auth: TAuth,
    key: string,
  ): Promise<{ label: string; value: string }[]>;

  /**
   * Per-backend execution bounds. The host applies its own generic defaults for
   * a package that declares none, so this is only worth implementing where the
   * backend's timings differ from a plain API call.
   */
  executionPolicy?(): ExecutionPolicy;

  /**
   * Split a driver error into a caller-safe message and an infra verdict.
   * Without it the host classifies by HTTP status alone, which reads every
   * non-HTTP failure — a SQLSTATE, a Redis reply error — as infra.
   */
  classifyError?(e: unknown): ClassifiedError;

  /**
   * What this source CONTAINS, for an agent authoring against it: a database's
   * schema, a keyspace's op catalog. Distinct from `capabilities()`, which is
   * what the source can DO.
   */
  describeSource?(auth: TAuth): Promise<unknown>;

  /** Non-mutating reachability probe. Throws when the backend is unreachable. */
  probe?(auth: TAuth): Promise<void>;

  /**
   * Reject caller input before the host opens a connection. `call()` validates
   * from the same catalog anyway — this only moves the rejection ahead of the
   * connection, so bad input costs no slot and no round trip.
   */
  validateInput?(capabilityId: string, input: Record<string, unknown>): void;

  /**
   * Caller-facing params for a thinly-authored action, when they cannot be read
   * off the capability's own `input` list. SQL is the case: its params are the
   * `:named` binds inside the authored statement, so only the authored values
   * know them.
   *
   * Absence is the normal case — the host derives identity params from `input`.
   */
  deriveActionParams?(
    capabilityId: string,
    authored: Record<string, unknown>,
  ): RoutineParamField[];

  /**
   * The response shape for a thinly-authored action, when the AUTHORED values
   * know it more precisely than `capability.output` can. SQL is the case again:
   * `select id, name from t` names its own columns, so the row shape is
   * derivable from the statement the author wrote.
   *
   * Returning undefined falls back to `capability.output`. Never guess here —
   * an undeclared response is honest, a wrong one is not.
   */
  deriveActionOutput?(
    capabilityId: string,
    authored: Record<string, unknown>,
  ): Record<string, unknown> | undefined;

  // The host constructs these with no `saveConfig`, so the inherited
  // implementation would discard the write.
  saveVars(_variable: any): Promise<void> {
    throw new Error(
      `Actions integration "${this.requiresAuth}" owns no persisted config — saveVars would be discarded`,
    );
  }
}

export type ActionsIntegrationConstructor = new (
  config: Record<string, unknown>,
  option: {
    saveConfig?(config: any): Promise<void>;
    logger?: (message: string) => void;
  },
) => ActionsIntegration;

/** The sub_type of the one workflow node that renders any capability. Lives
 *  here because both sides of the bridge need it: the node package registers
 *  under it, and the host refuses it where a node must not stand in for a
 *  capability. */
export const CAPABILITY_NODE_SUB_TYPE = 'capability.invoke';

/** A capability with the provider it belongs to, as a consumer outside the
 *  package sees it. */
export interface DefinedCapability {
  subType: string;
  /** `<subType>.<capability id>` — what `source_ref.action` stores. */
  action: string;
  /** The provider's display title, from its manifest. */
  provider: string;
  capability: Capability;
}

const definedSubTypes = new Map<
  string,
  { wrapper: ActionsIntegrationConstructor; manifest: IntegrationManifest }
>();

/**
 * Every capability this process has defined, across all actions packages.
 *
 * Read lazily, never snapshotted: packages register as they are imported, so a
 * list built at module load would hold only whichever packages happened to load
 * first. Instantiating per call matches how the host resolves a capability.
 */
export function definedCapabilities(): DefinedCapability[] {
  const all: DefinedCapability[] = [];

  for (const [subType, { wrapper, manifest }] of definedSubTypes) {
    for (const capability of new wrapper({}, {}).capabilities()) {
      all.push({
        subType,
        action: `${subType}.${capability.id}`,
        provider: manifest.title,
        capability,
      });
    }
  }

  return all;
}

export function defineActionsEntry(params: {
  sub_type: string;
  wrapper: ActionsIntegrationConstructor;
  manifest: IntegrationManifest;
}): IntegrationEntry {
  // A stale nocodb-sdk build would key the registry on `undefined-<sub_type>`.
  if (!IntegrationType.Actions) {
    throw new Error(
      'IntegrationType.Actions is undefined — rebuild nocodb-sdk (pnpm run build:ee), then reinstall noco-integrations deps',
    );
  }

  const instance = new params.wrapper({}, {});
  validateCapabilities(instance.capabilities());

  // The host resolves capabilities by the bound integration's sub_type, so a
  // package whose two names disagree 404s on every capability at runtime.
  if (instance.requiresAuth !== params.sub_type) {
    throw new Error(
      `Actions entry sub_type "${params.sub_type}" does not match its wrapper's requiresAuth "${instance.requiresAuth}"`,
    );
  }

  // Registration keys on `${type}-${sub_type}` and silently overwrites, which
  // would make the loser's capabilities unreachable with no error.
  const claimed = definedSubTypes.get(params.sub_type)?.wrapper;
  if (claimed && claimed !== params.wrapper) {
    throw new Error(
      `An actions integration for sub_type "${params.sub_type}" is already defined by another package`,
    );
  }
  definedSubTypes.set(params.sub_type, {
    wrapper: params.wrapper,
    manifest: params.manifest,
  });

  return {
    type: IntegrationType.Actions,
    sub_type: params.sub_type,
    wrapper: params.wrapper,
    form: [],
    // GET /api/v2/integrations returns every entry; actions are not addable.
    manifest: { ...params.manifest, hidden: true },
  };
}
