<script lang="ts" setup>
/**
 * Private invite link, rendered per the design but inert.
 *
 * There is no shareable join link in the backend: `invite_token` is minted per
 * invited email, expires in 24h and is consumed at signup. A "Copy link" that
 * grants nothing would be a lie to whoever pastes it, so this copies nothing
 * and the tooltip says why. See `.claude/branches/invite-ux/plan.md`.
 */
</script>

<template>
  <div class="nc-invite-link-row flex items-center gap-1.5" data-testid="nc-private-invite-link">
    <!-- Dashed on purpose: it is a placeholder for a control that does not exist
         yet, and should not read as something you can press today. -->
    <button
      class="nc-invite-link-btn flex items-center gap-2 h-8 px-2.5 rounded-lg border-1 border-dashed border-nc-border-gray-medium text-nc-content-gray-muted cursor-not-allowed"
      disabled
    >
      <GeneralIcon icon="link2" class="flex-none w-4 h-4" />
      <span class="text-bodyDefaultSm">{{ $t('labels.copyPrivateInviteLink') }}</span>
    </button>

    <NcTooltip :title="$t('msg.info.privateInviteLinkSoon')" placement="top">
      <GeneralIcon icon="info" class="flex-none w-3.5 h-3.5 text-nc-content-gray-muted" />
    </NcTooltip>
  </div>
</template>
