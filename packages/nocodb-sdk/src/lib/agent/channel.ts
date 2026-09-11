/**
 * Channels — the surfaces an agent can be reached on.
 *
 * A channel is an *integration* (Slack, Discord, Telegram, GitHub, Web) bound
 * to an agent, so credentials, listing and the settings form all come from the
 * integration system rather than a parallel one. The binding carries the policy:
 * what the agent answers, and where.
 */

/** What makes the agent answer on a channel. */
export enum AgentChannelRespondMode {
  /** Every message on the channel. Sensible for a DM or a dedicated room. */
  ALL = 'all',
  /** Only when the bot is @mentioned, or a thread it is already in. */
  MENTION = 'mention',
  /** Only a slash/prefix command (`command_prefix`). */
  COMMAND = 'command',
}

export interface AgentChannelSettings {
  /** Default: MENTION — the safe one in a shared room. */
  respond_mode?: AgentChannelRespondMode;
  /** For COMMAND mode. Default `/ask`. */
  command_prefix?: string;
  /**
   * Restrict to these platform room ids (Slack channel, Discord channel,
   * Telegram chat, GitHub repo). Empty means everywhere the app is installed.
   */
  allowed_rooms?: string[];
  /**
   * Restrict to these platform sender ids (Telegram user id, Slack member id,
   * …). Empty means anyone who can reach the room/DM. A DM's `allowed_rooms`
   * entry is the same id as the sender, so this only adds a lever for shared
   * rooms and for restricting a public bot's DMs without enumerating chat ids.
   */
  allowed_users?: string[];
  /** Keep answering follow-ups in a thread the agent already replied in. */
  follow_threads?: boolean;
  /** Stream partial output where the platform supports it. */
  stream?: boolean;
  /** Ignore messages from other bots — otherwise two bots can loop. */
  ignore_bots?: boolean;
}

export interface AgentChannelType {
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_agent_id?: string;
  /** The channel integration supplying credentials and transport. */
  fk_integration_id?: string;
  /**
   * Display-only mirror of the integration's sub_type ('slack', 'telegram', …),
   * so a channel row can render an icon without loading its integration. Never
   * routed on — the backend reads sub_type off the integration itself.
   */
  channel_type?: string;
  title?: string;
  enabled?: boolean;
  settings?: AgentChannelSettings;
  /** Opaque per-channel secret for inbound verification (web widget token). */
  webhook_secret?: string;
  /**
   * Handle returned by the adapter's `onActivateHook` — a claimed webhook URL,
   * a remote subscription id. Passed back to `onDeactivateHook` so removal
   * only clears this channel's own registration, not the platform's.
   */
  activation_state?: Record<string, any>;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AgentChannelCreateReqType {
  fk_integration_id: string;
  title?: string;
  settings?: AgentChannelSettings;
}

export interface AgentChannelUpdateReqType {
  title?: string;
  enabled?: boolean;
  settings?: AgentChannelSettings;
}

/** Channel sub_types shipped in-tree. */
export const AGENT_CHANNEL_TYPES = [
  'telegram'
] as const;

export type AgentChannelSubType = (typeof AGENT_CHANNEL_TYPES)[number];

/** Trigger type a channel-borne message opens a run with. */
export const AGENT_CHANNEL_TRIGGER_TYPE = 'core.trigger.channel';
