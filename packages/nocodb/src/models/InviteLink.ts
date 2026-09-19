import { createHash, randomBytes } from 'crypto';
import {
  INVITE_LINK_MAX_PER_SCOPE,
  InviteLinkScope,
  isInviteLinkRole,
} from 'nocodb-sdk';
import type { InviteLinkRole, InviteLinkType } from 'nocodb-sdk';
import { MetaTable, RootScopes } from '~/utils/globals';
import Noco from '~/Noco';
import { NcError } from '~/helpers/catchError';

/** 256 bits. Anything less invites offline guessing of a standing grant. */
const TOKEN_BYTES = 32;

const newToken = () => randomBytes(TOKEN_BYTES).toString('base64url');

/**
 * The redeem path's only lookup key. sha256 rather than bcrypt on purpose: the
 * input is 256 random bits, not a human-chosen password, so there is nothing for
 * a work factor to buy — and the redeem has to be a single indexed equality
 * check so it cannot be probed by prefix or timed.
 */
const hashToken = (token: string) =>
  createHash('sha256').update(token, 'utf8').digest('hex');

export default class InviteLink implements InviteLinkType {
  id?: string;
  scope?: InviteLinkScope;
  base_id?: string | null;
  fk_workspace_id?: string | null;
  role?: InviteLinkRole;
  email_domain?: string | null;
  expires_at?: string | null;
  max_uses?: number | null;
  used_count?: number;
  revoked_at?: string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  /**
   * Kept in clear beside its hash BY DESIGN (product decision, 2026-09-18): a
   * link must be copyable again later, as shared-view links are and unlike API
   * tokens, which are shown once. Hash-only storage was weighed and rejected for
   * that reason. The hash still keeps the redeem lookup a single indexed
   * equality; it is not a defence against a database read, and is not meant as one.
   */
  token?: string;
  token_hash?: string;

  constructor(data: Partial<InviteLink | InviteLinkType>) {
    Object.assign(this, data);
  }

  /**
   * Every response goes through here. `token_hash` is an internal lookup index
   * and is never anyone's business outside this class.
   */
  static toResponse(
    link: InviteLink,
    { withToken = false }: { withToken?: boolean } = {},
  ): InviteLinkType {
    const { token_hash: _hash, token, ...rest } = link as any;

    return (withToken ? { ...rest, token } : rest) as InviteLinkType;
  }

  private static hydrate(row: any): InviteLink | null {
    if (!row) return null;

    return new InviteLink(row);
  }

  /** Mints a link and returns it with its token. */
  public static async insert(
    param: {
      scope: InviteLinkScope;
      base_id?: string | null;
      fk_workspace_id?: string | null;
      role: InviteLinkRole;
      email_domain?: string | null;
      expires_at?: Date | null;
      max_uses?: number | null;
      created_by: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<InviteLink> {
    if (!isInviteLinkRole(param.scope, param.role)) {
      NcError.badRequest('Invalid role for an invite link');
    }

    const live = await this.list(
      {
        scope: param.scope,
        base_id: param.base_id,
        fk_workspace_id: param.fk_workspace_id,
      },
      ncMeta,
    );

    if (live.length >= INVITE_LINK_MAX_PER_SCOPE) {
      NcError.badRequest(
        `An invite link limit of ${INVITE_LINK_MAX_PER_SCOPE} has been reached. Revoke one before creating another.`,
      );
    }

    const token = newToken();

    const { id } = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.INVITE_LINKS,
      {
        scope: param.scope,
        base_id: param.base_id ?? null,
        fk_workspace_id: param.fk_workspace_id ?? null,
        token_hash: hashToken(token),
        token,
        role: param.role,
        email_domain: param.email_domain ?? null,
        expires_at: param.expires_at ?? null,
        max_uses: param.max_uses ?? null,
        used_count: 0,
        created_by: param.created_by,
      },
    );

    return this.get(id, ncMeta);
  }

  public static async get(
    id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<InviteLink | null> {
    const row = await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.INVITE_LINKS,
      id,
    );

    return this.hydrate(row);
  }

  /** The redeem lookup. One indexed equality check on the hash, nothing else. */
  public static async getByToken(
    token: string,
    ncMeta = Noco.ncMeta,
  ): Promise<InviteLink | null> {
    if (!token) return null;

    const row = await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.INVITE_LINKS,
      { token_hash: hashToken(token) },
    );

    return this.hydrate(row);
  }

  public static async list(
    param: {
      scope: InviteLinkScope;
      base_id?: string | null;
      fk_workspace_id?: string | null;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<InviteLink[]> {
    const condition: Record<string, any> = { scope: param.scope };

    if (param.scope === InviteLinkScope.BASE) condition.base_id = param.base_id;
    else condition.fk_workspace_id = param.fk_workspace_id;

    const rows = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.INVITE_LINKS,
      // id breaks the tie: links minted in the same second would otherwise come
      // back in an arbitrary order, which the UI renders as a reshuffling list.
      { condition, orderBy: { created_at: 'asc', id: 'asc' } },
    );

    // Revoked links stay in the table for the audit trail but are not listed.
    return rows
      .filter((r: any) => !r.revoked_at)
      .map((r: any) => this.hydrate(r));
  }

  public static async update(
    id: string,
    patch: {
      role?: InviteLinkRole;
      email_domain?: string | null;
      expires_at?: Date | null;
      max_uses?: number | null;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj: Record<string, any> = {};

    if (patch.role !== undefined) {
      const existing = await this.get(id, ncMeta);

      if (!existing) NcError.genericNotFound('Invite link', id);

      // Mirrors insert: a role outside the allow-list must not reach the row,
      // whichever path is writing it.
      if (!isInviteLinkRole(existing.scope, patch.role)) {
        NcError.badRequest('Invalid role for an invite link');
      }

      updateObj.role = patch.role;
    }

    if (patch.email_domain !== undefined)
      updateObj.email_domain = patch.email_domain;
    if (patch.expires_at !== undefined) updateObj.expires_at = patch.expires_at;
    if (patch.max_uses !== undefined) updateObj.max_uses = patch.max_uses;

    if (!Object.keys(updateObj).length) return this.get(id, ncMeta);

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.INVITE_LINKS,
      updateObj,
      id,
    );

    return this.get(id, ncMeta);
  }

  /** Revocation is a tombstone, not a delete: the audit trail outlives the grant. */
  public static async revoke(id: string, ncMeta = Noco.ncMeta) {
    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.INVITE_LINKS,
      { revoked_at: ncMeta.now() },
      id,
    );
  }

  public static async recordUse(id: string, ncMeta = Noco.ncMeta) {
    await ncMeta
      .knexConnection(MetaTable.INVITE_LINKS)
      .where('id', id)
      .increment('used_count', 1);
  }
}
