<script lang="ts" setup>
/**
 * The hub's first screen: the link, the one email field that starts an invite,
 * and a line pointing at the members page.
 */
/** Collaborators already on the base, for the count in the footer. */
defineProps<{
  members: Array<{ id?: string; email?: string; display_name?: string }>
  membersLoaded?: boolean
}>()

const emit = defineEmits(['compose', 'links', 'editLink', 'manageAccess'])
</script>

<template>
  <div class="flex flex-col gap-5 px-7 pt-5 pb-7">
    <DlgShareAndCollaborateHubLinkBlock
      @edit-link="(id, isNew) => emit('editLink', id, isNew)"
      @all-links="emit('links')"
    />
    <div class="h-px bg-nc-border-gray-light" />

    <!-- Focus rather than type: the real composing happens on its own screen, so
         the hub stays one glance rather than a form. -->
    <input
      class="nc-hub-email-field w-full h-11 px-3 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-default outline-none text-bodyDefault text-nc-content-gray hover:border-nc-border-gray-dark"
      :placeholder="$t('labels.inviteByEmail')"
      data-testid="nc-hub-invite-by-email"
      readonly
      @focus="emit('compose')"
      @click="emit('compose')"
    />
    <div class="h-px bg-nc-border-gray-light" />

    <!-- Same shape as the read-only footer on the web tab: a quiet sentence and
         one link, rather than a section of its own. -->
    <div class="text-bodySm text-nc-content-gray-muted">
      <template v-if="membersLoaded">
        {{ $t('msg.info.peopleHaveAccess', { count: members.length }, members.length) }}
      </template>
      <span v-else class="inline-block w-28 h-3 rounded bg-nc-bg-gray-light align-middle" />

      <!-- An interpolated space, not a margin: Vue condenses the whitespace-only
           text node here away entirely, and a margin would leave the copied and
           screen-reader text reading "access.Manage members". -->
      {{ ' ' }}
      <button
        class="nc-hub-manage-members text-nc-content-brand hover:underline"
        data-testid="nc-hub-people-with-access"
        @click="emit('manageAccess')"
      >
        {{ $t('labels.manageMembers') }}
      </button>
    </div>
  </div>
</template>
