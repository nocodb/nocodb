<script lang="ts" setup>
/**
 * The hub's first screen: the link, the one email field that starts an invite,
 * and a line pointing at the members page.
 */
/** Just the size of the base, for the footer line. */
const props = withDefaults(defineProps<{ memberCount?: number; membersLoaded?: boolean }>(), {
  memberCount: 0,
})

const emit = defineEmits(['compose', 'links', 'editLink', 'manageAccess'])

const { defaultEmailDomain } = useInviteLinks()

const { isUIAllowed } = useRoles()

/** Minting a link is viewer+ (capped server-side at the caller's own role); inviting by email is editor+. */
const canCreateInviteLink = computed(() => isUIAllowed('baseInviteLinkCreate'))

/** Email invites are editor+; the link is open to viewer+. */
const canInviteByEmail = computed(() => isUIAllowed('userInvite'))

/** Their own domain makes the example read as their team, not a stock address. */
const emailPlaceholder = computed(() =>
  defaultEmailDomain.value
    ? `name1@${defaultEmailDomain.value}, name2@${defaultEmailDomain.value}`
    : 'name@example.com, another@example.com',
)
</script>

<template>
  <div class="flex flex-col gap-5 px-7 pt-5 pb-7">
    <template v-if="canCreateInviteLink">
      <DlgShareAndCollaborateHubLinkBlock @manage="emit('links')" />
      <div class="h-px bg-nc-border-gray-light" />
    </template>

    <div v-if="canInviteByEmail" class="flex flex-col gap-2">
      <div class="text-bodyDefault font-semibold text-nc-content-gray">{{ $t('labels.inviteSpecificPeople') }}</div>

      <!-- Focus rather than type: the real composing happens on its own screen, so
           the hub stays one glance rather than a form. -->
      <input
        class="nc-hub-email-field w-full h-11 px-3 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-default outline-none text-bodyDefault text-nc-content-gray hover:border-nc-border-gray-dark"
        :placeholder="emailPlaceholder"
        data-testid="nc-hub-invite-by-email"
        readonly
        @focus="emit('compose')"
        @click="emit('compose')"
      />
    </div>
    <div class="h-px bg-nc-border-gray-light" />

    <!-- Same shape as the read-only footer on the web tab: a quiet sentence and
         one link, rather than a section of its own. -->
    <div class="text-bodySm text-nc-content-gray-muted">
      <template v-if="membersLoaded">
        {{ $t('msg.info.peopleHaveAccess', { count: props.memberCount }, props.memberCount) }}
      </template>
      <span v-else class="inline-block w-28 h-3 rounded bg-nc-bg-gray-light align-middle" />

      <!-- An interpolated space, not a margin: Vue condenses the whitespace-only
           text node here away entirely, and a margin would leave the copied and
           screen-reader text reading "access.Manage members". -->
      {{ ' ' }}
      <button class="nc-hub-manage-members" data-testid="nc-hub-people-with-access" @click="emit('manageAccess')">
        {{ $t('labels.manageMembers') }}
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// Reads as part of the sentence: same ink as the text around it, with a dotted
// rule to mark it as the one thing you can press.
.nc-hub-manage-members {
  color: var(--nc-content-gray-muted);
  text-decoration: underline dotted;
  text-underline-offset: 3px;

  &:hover {
    color: var(--nc-content-gray);
  }
}
</style>
