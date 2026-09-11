import { IntegrationWrapper } from '../integration';
import type { Readable } from 'stream';
import type { AuthIntegration } from '../auth';

/** What a platform can do — the dispatcher degrades to the weakest option. */
export interface ChannelCapabilities {
  /**
   * Partial output can be shown as it arrives. `native` streams chunks;
   * `edit` posts a placeholder and rewrites it on a throttle; `none` waits for
   * the finished answer.
   */
  streaming: 'native' | 'edit' | 'none';
  /** Replies can be threaded under the incoming message. */
  threads: boolean;
  /** A "working on it" affordance exists (typing indicator, reaction). */
  typing: boolean;
  /**
   * The platform can be *told* its delivery URL over its own API, so creating
   * a channel is enough to start receiving. False where the endpoint is
   * configured by hand in the platform's dashboard (Slack event subscriptions,
   * Twilio console) — the caller then has to surface the URL for copy-paste
   * instead of pretending the channel is live.
   */
  selfRegisteringWebhook: boolean;
}

/**
 * Handed to {@link ChannelIntegration["onActivateHook"]}. Mirrors a workflow
 * trigger's `WorkflowActivationContext`.
 */
export interface ChannelActivationContext {
  /** The URL the platform should deliver to. Carries no secret of its own. */
  webhookUrl: string;
  /**
   * The channel's verification secret, handed over separately so an adapter can
   * use whatever transport its platform actually supports — a signed header
   * where one exists, a query parameter only as a last resort. A URL is copied,
   * logged and proxied; a header is not.
   */
  channelSecret?: string;
  channelId: string;
  agentId: string;
}

/**
 * Whatever an adapter needs to undo its own activation — a remote webhook id,
 * the URL it claimed. Persisted opaquely on the channel.
 */
export type ChannelActivationState = Record<string, any>;

/** One inbound message, normalised out of a platform's webhook payload. */
export interface ChannelInboundMessage {
  /** Platform message id — used to drop redeliveries. */
  externalId: string;
  /** Room the message arrived in (Slack channel, Discord channel, Telegram chat, repo). */
  roomId: string;
  /**
   * Conversation this belongs to. A platform thread id where one exists, else
   * the room — this is what maps to an AgentSession, so a thread keeps context.
   */
  threadId: string;
  /** Message text, with bot mentions already stripped. */
  text: string;
  /** Who sent it, for display and for the agent's own loop guard. */
  author: { id: string; name?: string; isBot?: boolean };
  /** True when the bot was explicitly addressed. */
  mentionsBot: boolean;
  /** Anything the adapter needs on the way back out (reply ids, tokens). */
  meta?: Record<string, any>;
  /** Files on the message, not yet fetched — see {@link ChannelInboundAttachmentRef}. */
  attachments?: ChannelInboundAttachmentRef[];
}

/**
 * A file attached to an inbound message, referenced but not fetched — a
 * platform-opaque pointer (Telegram's `file_id`, ...). `receive()` builds
 * this without touching any credential; resolving it into bytes is a
 * separate step, see {@link ChannelIntegration.resolveAttachment}.
 */
export interface ChannelInboundAttachmentRef {
  ref: string;
  title: string;
  mimetype?: string;
  size?: number;
}

/**
 * What {@link ChannelIntegration.resolveAttachment} hands back for one ref —
 * a URL the caller can download directly (Telegram's file URLs embed the bot
 * token themselves, so no header is needed), or a stream for a platform with
 * no such URL. Never a buffer: an attachment is fetched and re-delivered
 * without ever holding the whole file in memory at once.
 */
export type ChannelResolvedAttachment =
  | { downloadUrl: string }
  | { stream: Readable; mimetype: string };

/** A file to attach to an outbound reply, streamed rather than buffered. */
export interface ChannelOutboundAttachment {
  title: string;
  mimetype: string;
  stream: Readable;
}

/** Where a reply goes. Mirrors the inbound message's addressing. */
export interface ChannelTarget {
  roomId: string;
  threadId?: string;
  meta?: Record<string, any>;
}

/** A handle to a message being written, so streaming can revise it. */
export interface ChannelDelivery {
  /** Replace the message body. Called repeatedly while streaming. */
  update(text: string): Promise<void>;
  /** Final text. After this the handle is spent. */
  finish(text: string): Promise<void>;
}

/**
 * Result of handing a raw webhook to an adapter. `challenge` short-circuits the
 * platform's verification handshake (Slack's url_verification, GitHub's ping)
 * without opening a run.
 */
export type ChannelInbound =
  | { kind: 'message'; message: ChannelInboundMessage }
  | { kind: 'challenge'; status: number; body: any }
  | { kind: 'ignore'; reason: string };

export interface ChannelRequest {
  headers: Record<string, string | string[] | undefined>;
  /** Parsed JSON body. */
  body: any;
  /** Exact bytes as received — signature schemes sign the raw payload. */
  rawBody?: string;
  query?: Record<string, any>;
  /**
   * The binding's own secret, for platforms that sign nothing.
   *
   * A channel id is not a credential — it ships in the page source of every
   * embed — so a channel with no signature scheme of its own has only this
   * between it and anyone who reads the HTML.
   */
  channelSecret?: string;
}

/**
 * One chat platform an agent can be reached on.
 *
 * Deliberately two halves. `receive` turns a webhook into a normalised message
 * (or refuses it); `open` turns an answer into whatever the platform accepts.
 * Everything above this — which agent, whether it should answer, what tools it
 * may use — is the dispatcher's job, so an adapter never makes policy.
 */
export abstract class ChannelIntegration<
  T extends { authIntegrationId?: string } = any,
  TAuth extends AuthIntegration = AuthIntegration,
> extends IntegrationWrapper<T> {
  abstract readonly capabilities: ChannelCapabilities;

  /**
   * The auth integration supplying this channel's credentials.
   *
   * Channels never hold a token of their own: the platform connection is an
   * `auth` integration, shared with whatever else talks to that platform, and
   * the caller resolves it and hands the authenticated wrapper in. What stays
   * on the channel is webhook-endpoint config — the verification secret is
   * per-endpoint, not a client credential.
   */
  get authIntegrationId(): string | undefined {
    return this.config.authIntegrationId;
  }

  /**
   * Hand over the resolved auth integration's own config, for an adapter that
   * needs something off it besides the authenticated client (e.g. Telegram's
   * bot username, to detect an @mention). Optional — most adapters never
   * touch anything on the auth side beyond `authenticate()`.
   */
  useAuthConfig?(config: Record<string, any>): void;

  /**
   * Verify and normalise an inbound webhook. Must reject anything whose
   * signature does not check out — this endpoint is public by construction.
   *
   * Takes no auth: verification uses the channel's own secret, so a delivery
   * is rejected before any credential is touched.
   */
  abstract receive(req: ChannelRequest): Promise<ChannelInbound>;

  /** Begin a reply. The handle is revised while streaming and then finished. */
  abstract open(target: ChannelTarget, auth: TAuth): Promise<ChannelDelivery>;

  /** Post a complete message without streaming. */
  async send(target: ChannelTarget, auth: TAuth, text: string): Promise<void> {
    const delivery = await this.open(target, auth);
    await delivery.finish(text);
  }

  /**
   * Turn one {@link ChannelInboundMessage.attachments} ref into fetchable
   * bytes. Only ever called on a ref taken from an already-verified
   * `receive()` result, so this is the one other place besides `open`/`send`
   * that touches a real credential.
   */
  async resolveAttachment?(
    ref: ChannelInboundAttachmentRef,
    auth: TAuth,
  ): Promise<ChannelResolvedAttachment>;

  /** Send a file as its own message. Omit where the platform has no way to carry one. */
  async sendAttachment?(
    target: ChannelTarget,
    auth: TAuth,
    attachment: ChannelOutboundAttachment,
  ): Promise<void>;

  /** Acknowledge receipt where the platform has an affordance for it. */
  async indicateTyping(_target: ChannelTarget, _auth: TAuth): Promise<void> {}

  /** Credentials are usable. Surfaced by the integration test button. */
  abstract testConnection(auth: TAuth): Promise<{
    success: boolean;
    message?: string;
  }>;

  /**
   * Subscribe the platform to this channel's endpoint, mirroring a workflow
   * trigger node's `onActivateHook`.
   *
   * Whatever is returned is persisted and handed back to
   * {@link onDeactivateHook}, so a platform that hands out a subscription id
   * (GitHub-style, many hooks per resource) can later remove *that* hook rather
   * than clearing everything. Return nothing when there is no handle to keep.
   *
   * Only called when `capabilities.selfRegisteringWebhook`. Must be idempotent:
   * every save re-activates.
   */
  async onActivateHook?(
    _context: ChannelActivationContext,
    _auth: TAuth,
  ): Promise<ChannelActivationState | void>;

  /**
   * Undo {@link onActivateHook}, given back the state it returned.
   *
   * Use that state to scope the removal. Without it an adapter can only reach
   * for the blunt platform-wide call, which on a single-slot platform such as
   * Telegram would also cut off anything else sharing the same credentials.
   */
  async onDeactivateHook?(
    _context: ChannelActivationContext,
    _auth: TAuth,
    _state?: ChannelActivationState,
  ): Promise<void>;
}
