import type { IntegrationCredentialMode } from '~/lib/integration-credential';
import type { PlanTitles } from '~/lib/payment';

/**
 * The app-connection read surface — what `appConnectionList` returns and what a
 * client caches.
 *
 * Shared because the backend composes it and the frontend both renders it and
 * patches it from realtime; it lived twice, once per repo half, and the two
 * drifted (the frontend's copy never declared `connected`, so nothing
 * client-side could resolve `boundTitle`).
 */

/**
 * A connection this VIEWER may bind. Per-user: `Integration.list` hides another
 * user's private integrations, which is why this never travels on a broadcast.
 */
export interface AppConnectionCandidate {
  id: string;
  title: string;
  type: string;
  sub_type: string | undefined;
  granted: boolean;
}

/** A slot as the owner's screen and the building agent both read it. */
export interface AppConnectionSlotView {
  slot: string;
  sub_type: string;
  title: string;
  purpose: string | null;
  required_credential_mode: IntegrationCredentialMode | null;
  optional: boolean;
  integrationId: string | null;
  /** Resolved against the viewer's own `connected`, so it is absent from the
   *  realtime payload and filled in client-side. */
  boundTitle: string | null;
}

/** Available to declare, whether or not anything is connected to it. */
export interface AppConnectionCatalogEntry {
  subType: string;
  title: string;
  description?: string;
  /** How many capabilities the package serves, and how many this plan reaches. */
  capabilities: number;
  available: number;
  /** The cheapest tier that unlocks anything here, when the plan reaches none. */
  requiredPlan?: PlanTitles;
  /** True when this plan can run none of them — declarable, but not runnable. */
  locked: boolean;
  perUserCapable: boolean;
  connected: number;
}

export interface AppConnectionView {
  slots: AppConnectionSlotView[];
  connected: AppConnectionCandidate[];
  catalog: AppConnectionCatalogEntry[];
}
