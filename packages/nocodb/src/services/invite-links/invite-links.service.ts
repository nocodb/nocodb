import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  INVITE_LINK_DEFAULT_EXPIRY_DAYS,
  INVITE_LINK_MAX_DOMAIN_LENGTH,
  INVITE_LINK_MAX_EXPIRY_DAYS,
  INVITE_LINK_MAX_USES,
  InviteLinkScope,
  isInviteLinkRole,
  OrderedProjectRoles,
  PluginCategory,
  ProjectRoles,
} from 'nocodb-sdk';
import type {
  InviteLinkPreviewType,
  InviteLinkReqType,
  InviteLinkRole,
  InviteLinkType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import InviteLink from '~/models/InviteLink';
import { Base, BaseUser, User } from '~/models';
import Noco from '~/Noco';
import { NcError } from '~/helpers/catchError';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { getProjectRolePower } from '~/utils/roleHelper';
import { MetaTable, RootScopes } from '~/utils/globals';

/**
 * Shareable invite links.
 *
 * Every guard here exists because a link is a *standing* grant: unlike an
 * emailed invite it is redeemable by whoever ends up holding the URL, for as
 * long as it lives. In order of how much damage they prevent:
 *
 *  1. A link can never grant Owner, and never a role above the minter's own.
 *  2. Redeeming runs the same membership and seat path as an emailed invite,
 *     so a link is never a cheaper door than the invite form.
 *  3. A domain restriction is matched on the `@domain` boundary of the address
 *     on the redeeming account -- never a bare suffix test.
 *  4. Redeem is POST and authenticated, so no crawler or prefetch can trip it.
 *     The unauthenticated route only previews.
 *  5. Redeeming never lowers a role the user already holds.
 */
@Injectable()
export class InviteLinksService {
  protected readonly logger = new Logger(InviteLinksService.name);

  constructor(protected readonly appHooksService: AppHooksService) {}

  /** What the audit trail names a link by. CE knows bases only. */
  protected async linkTarget(
    context: NcContext,
    link: InviteLink,
    ncMeta = Noco.ncMeta,
  ): Promise<{ base?: Base; workspace?: { id: string; title: string } }> {
    if (link.scope !== InviteLinkScope.BASE) return {};

    const base = await Base.get(
      { ...context, base_id: link.base_id, workspace_id: link.fk_workspace_id },
      link.base_id,
      ncMeta,
    );

    return base ? { base } : {};
  }

  /**
   * Not overridden on purpose: the role allow-list must run for every scope, so
   * `assertRolePower` is the scope-specific part subclasses override, not this.
   *
   * Whoever mints a link can grant at most their own role. The ACL floor for
   * minting at all is Editor (product decision 2026-09-19); this cap is what
   * keeps an editor from handing out creator.
   */
  protected assertRoleWithinCallerPower(
    scope: InviteLinkScope,
    role: InviteLinkRole,
    req: NcRequest,
  ) {
    if (!isInviteLinkRole(scope, role)) {
      NcError.badRequest('Invalid role for an invite link');
    }

    this.assertRolePower(scope, role, req);
  }

  /**
   * Creator+ manages every link in the scope. Below that a caller only ever
   * sees or touches links they made themselves: `list` returns tokens, so a
   * viewer who could read an owner's creator-level link would simply redeem it
   * and escape the power cap below.
   */
  protected canManageAllLinks(scope: InviteLinkScope, req: NcRequest) {
    if (scope !== InviteLinkScope.BASE) return false;

    const reverseOrdered = [...OrderedProjectRoles].reverse();

    return (
      getProjectRolePower(req.user) >=
      reverseOrdered.indexOf(ProjectRoles.CREATOR)
    );
  }

  protected assertRolePower(
    scope: InviteLinkScope,
    role: InviteLinkRole,
    req: NcRequest,
  ) {
    if (scope !== InviteLinkScope.BASE) return;

    const reverseOrdered = [...OrderedProjectRoles].reverse();

    if (
      reverseOrdered.indexOf(role as ProjectRoles) >
      getProjectRolePower(req.user)
    ) {
      NcError.forbidden(
        'Insufficient privilege to create a link with this role',
      );
    }
  }

  /** Days from now. `0` is an explicit "never expires"; undefined takes the default. */
  protected expiryFromDays(days?: number | null): Date | null {
    if (days === null || days === undefined) {
      return this.expiryFromDays(INVITE_LINK_DEFAULT_EXPIRY_DAYS);
    }

    // Straight from the request body, so anything that would reach the dateTime
    // column as an Invalid Date has to be refused here rather than 500 on insert.
    if (
      typeof days !== 'number' ||
      !Number.isInteger(days) ||
      days < 0 ||
      days > INVITE_LINK_MAX_EXPIRY_DAYS
    ) {
      NcError.badRequest(
        `expires_in_days must be a whole number between 0 and ${INVITE_LINK_MAX_EXPIRY_DAYS}`,
      );
    }

    if (days === 0) return null;

    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  /** `null` is an explicit "no cap"; anything else has to be a usable count. */
  protected normaliseMaxUses(maxUses?: number | null): number | null {
    if (maxUses === null || maxUses === undefined) return null;

    if (
      typeof maxUses !== 'number' ||
      !Number.isInteger(maxUses) ||
      maxUses < 1 ||
      maxUses > INVITE_LINK_MAX_USES
    ) {
      NcError.badRequest(
        `max_uses must be a whole number between 1 and ${INVITE_LINK_MAX_USES}`,
      );
    }

    return maxUses;
  }

  /**
   * Verification is only a meaningful gate where the instance can actually send
   * the mail. With no active email plugin nobody can ever become verified, so
   * requiring it would refuse every redeemer rather than only the unproven
   * ones -- and a domain-restricted link is now the default.
   */
  protected async canVerifyEmail(ncMeta = Noco.ncMeta) {
    const plugin = await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.PLUGIN,
      { category: PluginCategory.EMAIL, active: true },
    );

    return !!plugin;
  }

  /** `acme.io` must not be satisfied by `evil-acme.io`. */
  protected emailMatchesDomain(email: string, domain?: string | null) {
    if (!domain) return true;

    return (email || '').toLowerCase().endsWith(`@${domain.toLowerCase()}`);
  }

  protected normaliseDomain(domain?: string | null) {
    if (!domain) return null;

    const trimmed = domain.trim().toLowerCase().replace(/^@/, '');

    if (!trimmed) return null;

    // Length before shape: the regex is happy with a 300-character domain, which
    // the column is not, and the driver error is not a useful message.
    if (
      trimmed.length > INVITE_LINK_MAX_DOMAIN_LENGTH ||
      !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(trimmed)
    ) {
      NcError.badRequest('Invalid email domain');
    }

    return trimmed;
  }

  protected async assertBaseShareable(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const base = await Base.get(context, baseId, ncMeta);

    if (!base) NcError.baseNotFound(baseId);

    return base;
  }

  /**
   * `default_role: no-access` is what marks a base private -- there is no
   * `is_private` column. See isUserManagementRestricted, which reads the same
   * flag to keep member management owner-only on such a base.
   */
  protected isPrivateBase(base: Base) {
    return base.default_role === ProjectRoles.NO_ACCESS;
  }

  /**
   * On a private base only the owner may hand out a seat, matching the rule
   * user management already follows there (product decision 2026-09-19). It is
   * their base and their call; for everyone else a private base stays
   * invite-only.
   */
  protected assertMayMintOnPrivateBase(base: Base, req: NcRequest) {
    if (!this.isPrivateBase(base)) return;

    if (!req.user?.base_roles?.[ProjectRoles.OWNER]) {
      NcError.forbidden(
        'Only the base owner can create an invite link for a private base',
      );
    }
  }

  /**
   * The redeem counterpart. Blocking every redeem would make the owner's own
   * link useless, so what is checked is who minted it: a link made by someone
   * who is not (or is no longer) an owner stops working the moment the base
   * goes private, which is what locking a base down is for.
   */
  protected async assertMayRedeemOnPrivateBase(
    context: NcContext,
    base: Base,
    link: InviteLink,
    ncMeta = Noco.ncMeta,
  ) {
    if (!this.isPrivateBase(base)) return;

    const minter = link.created_by
      ? await BaseUser.get(context, base.id, link.created_by, ncMeta)
      : null;

    if (minter?.roles !== ProjectRoles.OWNER) {
      NcError.forbidden('Invite links are not available for a private base');
    }
  }

  async create(
    context: NcContext,
    param: {
      scope: InviteLinkScope;
      baseId?: string;
      workspaceId?: string;
      body: InviteLinkReqType;
      req: NcRequest;
    },
    ncMeta = Noco.ncMeta,
  ) {
    this.assertRoleWithinCallerPower(param.scope, param.body.role, param.req);

    if (param.scope === InviteLinkScope.BASE) {
      const base = await this.assertBaseShareable(
        context,
        param.baseId,
        ncMeta,
      );

      this.assertMayMintOnPrivateBase(base, param.req);
    }

    const link = await InviteLink.insert(
      {
        scope: param.scope,
        base_id: param.scope === InviteLinkScope.BASE ? param.baseId : null,
        fk_workspace_id:
          param.scope === InviteLinkScope.WORKSPACE
            ? param.workspaceId
            : context.workspace_id,
        role: param.body.role,
        email_domain: this.normaliseDomain(param.body.email_domain),
        expires_at: this.expiryFromDays(param.body.expires_in_days),
        max_uses: this.normaliseMaxUses(param.body.max_uses),
        created_by: param.req.user?.id,
      },
      ncMeta,
    );

    this.logger.log(
      `invite link created id=${link.id} scope=${param.scope} role=${param.body.role} by=${param.req.user?.id}`,
    );

    this.appHooksService.emit(AppEvents.INVITE_LINK_CREATE, {
      link: InviteLink.toResponse(link),
      ...(await this.linkTarget(context, link, ncMeta)),
      context,
      req: param.req,
    });

    return InviteLink.toResponse(link, { withToken: true });
  }

  async list(
    _context: NcContext,
    param: {
      scope: InviteLinkScope;
      baseId?: string;
      workspaceId?: string;
      req: NcRequest;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const links = await InviteLink.list(
      {
        scope: param.scope,
        base_id: param.baseId,
        fk_workspace_id: param.workspaceId,
      },
      ncMeta,
    );

    const visible = this.canManageAllLinks(param.scope, param.req)
      ? links
      : links.filter((l) => l.created_by === param.req.user?.id);

    // The token is returned here on purpose: the caller can already mint one at
    // this role, and the UI has to render a copyable URL.
    return this.withCreators(
      visible.map((l) => InviteLink.toResponse(l, { withToken: true })),
      ncMeta,
    );
  }

  /**
   * The id alone must not be enough: the link has to belong to the scope the
   * caller was authorised against, or a base creator could edit another base's.
   */
  /**
   * Resolves `created_by` for display. One lookup per distinct creator, not per
   * link -- a base's ten links are usually two or three people.
   */
  protected async withCreators(
    links: InviteLinkType[],
    ncMeta = Noco.ncMeta,
  ): Promise<InviteLinkType[]> {
    const ids = [...new Set(links.map((l) => l.created_by).filter(Boolean))];

    if (!ids.length) return links;

    const byId = new Map(
      (await Promise.all(ids.map((id) => User.get(id, ncMeta))))
        .filter(Boolean)
        .map((u) => [u.id, u]),
    );

    return links.map((l) => {
      const user = l.created_by ? byId.get(l.created_by) : undefined;

      return user
        ? {
            ...l,
            created_by_email: user.email,
            created_by_display_name: user.display_name || undefined,
          }
        : l;
    });
  }

  protected async getOwnedLink(
    param: {
      linkId: string;
      scope: InviteLinkScope;
      baseId?: string;
      workspaceId?: string;
      req?: NcRequest;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const link = await InviteLink.get(param.linkId, ncMeta);

    if (!link || link.revoked_at)
      NcError.genericNotFound('Invite link', param.linkId);

    const owned =
      param.scope === InviteLinkScope.BASE
        ? link.scope === InviteLinkScope.BASE && link.base_id === param.baseId
        : link.scope === InviteLinkScope.WORKSPACE &&
          link.fk_workspace_id === param.workspaceId;

    if (!owned) NcError.genericNotFound('Invite link', param.linkId);

    // Below creator you may only touch what you made. Not-found rather than
    // forbidden: whether someone else's link exists is not their business.
    if (
      param.req &&
      !this.canManageAllLinks(param.scope, param.req) &&
      link.created_by !== param.req.user?.id
    ) {
      NcError.genericNotFound('Invite link', param.linkId);
    }

    return link;
  }

  async update(
    context: NcContext,
    param: {
      linkId: string;
      scope: InviteLinkScope;
      baseId?: string;
      workspaceId?: string;
      body: Partial<InviteLinkReqType>;
      req: NcRequest;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const existing = await this.getOwnedLink(param, ncMeta);

    if (param.body.role !== undefined) {
      this.assertRoleWithinCallerPower(param.scope, param.body.role, param.req);
    }

    const updated = await InviteLink.update(
      param.linkId,
      {
        ...(param.body.role !== undefined ? { role: param.body.role } : {}),
        ...(param.body.email_domain !== undefined
          ? { email_domain: this.normaliseDomain(param.body.email_domain) }
          : {}),
        ...(param.body.expires_in_days !== undefined
          ? { expires_at: this.expiryFromDays(param.body.expires_in_days) }
          : {}),
        ...(param.body.max_uses !== undefined
          ? { max_uses: this.normaliseMaxUses(param.body.max_uses) }
          : {}),
      },
      ncMeta,
    );

    this.appHooksService.emit(AppEvents.INVITE_LINK_UPDATE, {
      link: InviteLink.toResponse(updated),
      oldLink: InviteLink.toResponse(existing),
      ...(await this.linkTarget(context, updated, ncMeta)),
      context,
      req: param.req,
    });

    return InviteLink.toResponse(updated, { withToken: true });
  }

  async revoke(
    context: NcContext,
    param: {
      linkId: string;
      scope: InviteLinkScope;
      baseId?: string;
      workspaceId?: string;
      req: NcRequest;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const link = await this.getOwnedLink(param, ncMeta);

    await InviteLink.revoke(link.id, ncMeta);

    this.logger.log(
      `invite link revoked id=${link.id} by=${param.req.user?.id}`,
    );

    this.appHooksService.emit(AppEvents.INVITE_LINK_REVOKE, {
      link: InviteLink.toResponse(link),
      ...(await this.linkTarget(context, link, ncMeta)),
      context,
      req: param.req,
    });

    return { msg: 'Invite link revoked' };
  }

  protected invalidMessage(reason: string) {
    switch (reason) {
      case 'expired':
        return 'This invite link has expired. Ask for a new one.';
      case 'revoked':
        return 'This invite link has been revoked. Ask for a new one.';
      case 'exhausted':
        return 'This invite link has been used the maximum number of times.';
      default:
        return 'This invite link is not valid.';
    }
  }

  protected invalidReason(link: InviteLink | null) {
    if (!link) return 'not_found' as const;
    if (link.revoked_at) return 'revoked' as const;
    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
      return 'expired' as const;
    }
    if (link.max_uses != null && (link.used_count ?? 0) >= link.max_uses) {
      return 'exhausted' as const;
    }

    return null;
  }

  /**
   * What a holder of the token may learn before signing in: the name of the
   * thing and the role on offer. Never the token, creator, or member list.
   */
  async preview(
    context: NcContext,
    param: { token: string; req?: NcRequest },
    ncMeta = Noco.ncMeta,
  ): Promise<InviteLinkPreviewType> {
    const link = await InviteLink.getByToken(param.token, ncMeta);

    // State of the link first. A revoked or expired link is revoked or expired
    // for everyone: reporting otherwise to a member, and quietly sending them
    // somewhere instead, told them the opposite of what a signed-out visitor
    // was told about the same URL -- and the opposite of what redeeming it
    // would say.
    const reason = this.invalidReason(link);

    if (reason) return { invalid_reason: reason };

    // A link can be perfectly intact and still not work: its base may have been
    // deleted, or made private since it was minted. The preview used to skip
    // this, so the join page showed a real-looking invitation with a live Join
    // button that only failed on the press.
    if (!(await this.isTargetRedeemable(context, link, ncMeta))) {
      return { invalid_reason: 'unavailable' };
    }

    // The link is usable, but a member at its role or better has nothing to
    // redeem, so send them to the thing they can already open.
    const userId = param.req?.user?.id;
    const access = userId
      ? await this.existingAccess(context, link, userId, ncMeta)
      : null;

    if (access) return { scope: link.scope, already_member: true, ...access };

    return {
      scope: link.scope,
      target_title: await this.resolveTargetTitle(context, link, ncMeta),
      role: link.role,
      email_domain: link.email_domain,
    };
  }

  /**
   * `inherit` is an indirection, not a rank: it defers to the redeemer's
   * workspace or team role, which for a base-only member is no-access.
   * OrderedProjectRoles puts it above editor, so the rank comparison below reads
   * writing it over an explicit role as an upgrade -- and it lands as a lockout.
   * Nothing a link grants may take access away, so this case is a no-op redeem.
   */
  protected replacesExplicitRoleWithInherit(
    linkRole?: string | null,
    existingRole?: string | null,
  ) {
    return (
      linkRole === ProjectRoles.INHERIT &&
      !!existingRole &&
      existingRole !== ProjectRoles.INHERIT
    );
  }

  /**
   * Where the caller lands if they already hold what the link offers. Same
   * rule as grant's no-demotion branch; CE knows only base links.
   */
  protected async existingAccess(
    context: NcContext,
    link: InviteLink,
    userId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<{ base_id?: string; workspace_id?: string } | null> {
    if (link.scope !== InviteLinkScope.BASE) return null;

    const existing = await BaseUser.get(
      { ...context, base_id: link.base_id, workspace_id: link.fk_workspace_id },
      link.base_id,
      userId,
      ncMeta,
    );

    if (!existing?.roles) return null;

    if (this.replacesExplicitRoleWithInherit(link.role, existing.roles)) {
      return { base_id: link.base_id };
    }

    const ordered = [...OrderedProjectRoles].reverse();

    if (
      ordered.indexOf(existing.roles as ProjectRoles) <
      ordered.indexOf(link.role as ProjectRoles)
    ) {
      return null;
    }

    return { base_id: link.base_id };
  }

  /**
   * Whether the thing on the other end would still accept this link. Mirrors
   * what `grant` enforces, but without a user: the private-base rule turns on
   * who minted the link, not on who is looking at it.
   */
  protected async isTargetRedeemable(
    context: NcContext,
    link: InviteLink,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    if (link.scope !== InviteLinkScope.BASE) return true;

    const base = await Base.get(
      { ...context, base_id: link.base_id, workspace_id: link.fk_workspace_id },
      link.base_id,
      ncMeta,
    );

    if (!base) return false;

    if (!this.isPrivateBase(base)) return true;

    const minter = link.created_by
      ? await BaseUser.get(
          {
            ...context,
            base_id: link.base_id,
            workspace_id: link.fk_workspace_id,
          },
          link.base_id,
          link.created_by,
          ncMeta,
        )
      : null;

    return minter?.roles === ProjectRoles.OWNER;
  }

  /** CE has no workspace concept, so only a base resolves to a name here. */
  protected async resolveTargetTitle(
    context: NcContext,
    link: InviteLink,
    ncMeta = Noco.ncMeta,
  ): Promise<string | undefined> {
    if (link.scope !== InviteLinkScope.BASE) return undefined;

    const base = await Base.get(
      { ...context, base_id: link.base_id, workspace_id: link.fk_workspace_id },
      link.base_id,
      ncMeta,
    );

    return base?.title;
  }

  async accept(
    context: NcContext,
    param: { token: string; req: NcRequest },
    ncMeta = Noco.ncMeta,
  ) {
    const link = await InviteLink.getByToken(param.token, ncMeta);
    const reason = this.invalidReason(link);

    if (reason) NcError.badRequest(this.invalidMessage(reason));

    const user = await User.get(param.req.user?.id, ncMeta);

    if (!user) NcError.unauthorized('Sign in to use an invite link');

    if (link.email_domain) {
      // An unverified address is a claim, not a fact; a domain restriction that
      // trusts it restricts nothing. Only enforceable where the instance can
      // actually verify -- see canVerifyEmail.
      if (
        !(user as any).email_verified &&
        (await this.canVerifyEmail(ncMeta))
      ) {
        NcError.forbidden(
          `Verify your email address before using a link restricted to @${link.email_domain}`,
        );
      }

      if (!this.emailMatchesDomain(user.email, link.email_domain)) {
        NcError.forbidden(
          `This invite link only accepts @${link.email_domain} addresses`,
        );
      }
    }

    // Claim the use *before* granting. `invalidReason` above only read the
    // counter, and a read-then-write cannot hold a cap under concurrency.
    if (!(await InviteLink.reserveUse(link.id, ncMeta))) {
      NcError.badRequest(this.invalidMessage('exhausted'));
    }

    let result: Awaited<ReturnType<typeof this.grant>>;

    try {
      result = await this.grant(
        context,
        { link, user, req: param.req },
        ncMeta,
      );
    } catch (e) {
      // The grant is what the use pays for; if it did not happen, give it back.
      await InviteLink.releaseUse(link.id, ncMeta);
      throw e;
    }

    // A no-op redeem must not spend a use, or anyone holding the link can
    // exhaust a capped one by posting accept repeatedly.
    if (result.already_member) await InviteLink.releaseUse(link.id, ncMeta);

    this.logger.log(`invite link redeemed id=${link.id} by=${user.id}`);

    // The membership change itself is audited by grant() through the same
    // member events an emailed invite raises; this one is the funnel signal.
    this.appHooksService.emit(AppEvents.INVITE_LINK_ACCEPT, {
      link: InviteLink.toResponse(link),
      user,
      already_member: !!result.already_member,
      ...(await this.linkTarget(context, link, ncMeta)),
      context,
      req: param.req,
    });

    return result;
  }

  /**
   * CE grants base membership directly. EE overrides to put the redeemer in the
   * workspace at no-access first, since base membership there requires it.
   */
  protected async grant(
    context: NcContext,
    param: { link: InviteLink; user: User; req: NcRequest },
    ncMeta = Noco.ncMeta,
  ): Promise<{
    base_id?: string;
    workspace_id?: string;
    already_member?: boolean;
  }> {
    const { link, user } = param;

    if (link.scope !== InviteLinkScope.BASE) {
      NcError.badRequest(
        'Workspace invite links are not available in this edition',
      );
    }

    const baseContext = {
      ...context,
      base_id: link.base_id,
      workspace_id: link.fk_workspace_id,
    };

    const base = await this.assertBaseShareable(
      baseContext,
      link.base_id,
      ncMeta,
    );

    await this.assertMayRedeemOnPrivateBase(baseContext, base, link, ncMeta);

    const existing = await BaseUser.get(
      baseContext,
      link.base_id,
      user.id,
      ncMeta,
    );
    const ordered = [...OrderedProjectRoles].reverse();

    if (existing?.roles) {
      // Never demote someone who already holds more than the link offers.
      if (
        this.replacesExplicitRoleWithInherit(link.role, existing.roles) ||
        ordered.indexOf(existing.roles as ProjectRoles) >=
          ordered.indexOf(link.role as ProjectRoles)
      ) {
        return { base_id: link.base_id, already_member: true };
      }

      await BaseUser.updateRoles(
        baseContext,
        link.base_id,
        user.id,
        link.role,
        ncMeta,
      );

      this.appHooksService.emit(AppEvents.PROJECT_USER_UPDATE, {
        base,
        user,
        baseUser: { roles: link.role as ProjectRoles },
        oldBaseUser: { roles: existing.roles as ProjectRoles },
        via: 'invite_link',
        context: baseContext,
        req: param.req,
      });

      return { base_id: link.base_id };
    }

    await BaseUser.insert(
      baseContext,
      {
        base_id: link.base_id,
        fk_user_id: user.id,
        roles: link.role,
        // Whoever minted the link is who let them in. Without this the row has
        // no provenance at all, and a leaked link leaves nothing to trace.
        invited_by: link.created_by,
      },
      ncMeta,
    );

    this.appHooksService.emit(AppEvents.PROJECT_INVITE, {
      base,
      user,
      role: link.role,
      invitedBy: param.req.user,
      via: 'invite_link',
      context: baseContext,
      req: param.req,
    });

    return { base_id: link.base_id };
  }
}
