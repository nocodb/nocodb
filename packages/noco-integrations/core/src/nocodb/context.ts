import type { NocoSDK } from '../sdk';
import type {
  ICommentsService,
  IDataV3Service,
  IMailService,
  ITablesService,
} from './services';

/**
 * Bag of in-process NocoDB handles passed to integration wrappers that need
 * to call internal services (workflow nodes, internal sync, …) instead of
 * going over HTTP.
 *
 * Populated by the backend's executor and injected into the wrapper config
 * under the `_nocodb` slot. Wrappers should read it via the framework
 * getter (`this.nocodb`) rather than touching the slot directly.
 */
export interface NocoDBContext {
  context: NocoSDK.NcContext;
  dataService: IDataV3Service;
  tablesService: ITablesService;
  user: NocoSDK.UserType;
  mailService: IMailService;
  getBaseSchema: () => Promise<any>;
  getAccessToken: () => string;
  /**
   * List the collaborators of the current base (id + email + display name).
   * Used by nodes that need a user picker (e.g. the comment trigger's
   * "specific people mentioned" filter).
   */
  getBaseUsers: () => Promise<
    Array<{ id: string; email: string; display_name?: string | null }>
  >;
  /**
   * Comments service — list comments enriched with plain-text body, resolved
   * author and parsed @mentions. Used by nodes that need real comment data
   * (e.g. the comment trigger's "Test" action fetches a sample comment
   * through it).
   */
  commentsService: ICommentsService;
  /**
   * Sandboxed code execution, metered and torn down by the host.
   *
   * The host owns the lifecycle so nodes never hold provider credentials or
   * bill for themselves — call it, use the instance, then `release()`.
   */
  createCompute: (opts?: {
    timeoutMs?: number;
  }) => Promise<IComputeLease>;
}

export interface IComputeOutputMessage {
  readonly line: string;
  readonly timestamp?: number;
  readonly error?: boolean;
}

export interface IComputeExecutionError {
  name: string;
  value: string;
  traceback: string;
}

/**
 * One value an execution produced, in whichever representations the runtime
 * could render it. All optional — a plain expression yields only `text`.
 */
export interface IComputeResult {
  text?: string;
  html?: string;
  markdown?: string;
  svg?: string;
  png?: string;
  jpeg?: string;
  pdf?: string;
  latex?: string;
  json?: string;
  javascript?: string;
  chart?: unknown;
  extra?: unknown;
}

export interface IComputeExecutionResult {
  results: IComputeResult[];
  error?: IComputeExecutionError;
}

export interface IComputeRunCodeOptions {
  language?: string;
  onStdout?: (output: IComputeOutputMessage) => void;
  onStderr?: (output: IComputeOutputMessage) => void;
  onError?: (error: IComputeExecutionError) => void;
  timeoutMs?: number;
}

export interface IComputeRunCommandResult {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
}

/** A running compute instance, as a workflow node sees it. */
export interface IComputeInstance {
  /** TLS (https/wss) vs plain (http/ws) — build urls from this, don't assume. */
  readonly secure: boolean;

  runCode(
    code: string,
    opts?: IComputeRunCodeOptions,
  ): Promise<IComputeExecutionResult>;

  runCommand(
    command: string,
    opts?: { background?: boolean },
  ): Promise<IComputeRunCommandResult>;

  getHost(port: number): Promise<string>;
}

export interface IComputeLease {
  instance: IComputeInstance;
  /** Settle usage and tear down. Always call it, in a `finally`. */
  release: () => Promise<void>;
}
