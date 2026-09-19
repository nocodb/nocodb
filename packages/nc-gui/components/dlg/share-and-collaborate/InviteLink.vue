<script lang="ts" setup>
/**
 * Private invite link; rendered per the design but inert.
 *
 * There is no shareable join link in the backend: `invite_token` is minted per
 * invited email, expires in 24h and is consumed at signup. A "Copy link" that
 * grants nothing would be a lie to whoever pastes it, so the row copies nothing
 * and says so. See `.claude/branches/invite-ux/plan.md`.
 */
</script>

<template>
  <div
    class="nc-invite-link-row flex items-center gap-3 rounded-lg border-1 border-dashed border-nc-border-gray-medium px-3 py-2.5"
    data-testid="nc-private-invite-link"
  >
    <GeneralIcon icon="link2" class="flex-none w-4 h-4 text-nc-content-gray-muted" />

    <div class="flex-1 min-w-0 flex flex-col">
      <div class="flex items-center gap-2">
        <span class="text-bodyDefaultSm text-nc-content-gray-muted">{{ $t('labels.privateInviteLink') }}</span>
        <NcBadgeComingSoon />
      </div>
      <span class="text-captionSm text-nc-content-gray-muted truncate">
        {{ $t('msg.info.privateInviteLinkSoon') }}
      </span>
    </div>

    <NcButton type="secondary" size="small" disabled>
      {{ $t('activity.copyLink') }}
    </NcButton>
  </div>
</template>
