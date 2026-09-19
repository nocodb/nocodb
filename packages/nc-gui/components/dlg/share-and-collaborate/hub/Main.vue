<script lang="ts" setup>
/**
 * The hub's first screen: the one email field that starts an invite, who is
 * already in, and the link block.
 */
/** Collaborators already on the base, for the avatar stack and the count. */
const props = defineProps<{
  members: Array<{ id?: string; email?: string; display_name?: string }>
  membersLoaded?: boolean
}>()

const emit = defineEmits(['compose', 'links', 'editLink', 'manageAccess'])

/**
 * Raw vars rather than uno classes: the coloured-* tokens are not registered in
 * `themeVariables`, so `bg-nc-bg-coloured-purple-dark` emits no rule and the
 * avatar would come out transparent.
 */
const avatarTints = [
  { background: 'var(--nc-bg-coloured-purple-dark)', color: 'var(--nc-content-purple-dark)' },
  { background: 'var(--nc-bg-coloured-green-dark)', color: 'var(--nc-content-green-dark)' },
  { background: 'var(--nc-bg-coloured-orange-dark)', color: 'var(--nc-content-orange-dark)' },
  { background: 'var(--nc-bg-coloured-blue-dark)', color: 'var(--nc-content-blue-dark)' },
]

const avatars = computed(() =>
  (props.members || []).slice(0, 3).map((m, i) => {
    const name = (m.display_name || m.email || '').replace(/\(.*\)/, '').trim()
    const initials =
      name
        .split(/[\s._-]+/)
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || '?'

    return { key: m.id || m.email || String(i), initials, tint: avatarTints[i % avatarTints.length] }
  }),
)
</script>

<template>
  <div class="flex flex-col gap-5 px-7 pt-5 pb-7">
    <DlgShareAndCollaborateHubLinkBlock @edit-link="emit('editLink', $event)" @all-links="emit('links')" />
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

    <div class="flex flex-col gap-2">
      <div class="text-bodyDefaultSm font-semibold text-nc-content-gray-subtle2">{{ $t('labels.manageBaseMembers') }}</div>

      <button
        class="group flex items-center gap-3 min-h-10 -mx-2 px-2 rounded-lg text-nc-content-gray hover:bg-nc-bg-gray-extralight"
        data-testid="nc-hub-people-with-access"
        @click="emit('manageAccess')"
      >
        <!-- The tints are inline styles, so a filter is the only thing that can
             desaturate them without fighting specificity. -->
        <div class="flex grayscale group-hover:grayscale-0 transition-[filter] duration-150">
          <div
            v-for="(a, i) in avatars"
            :key="a.key"
            class="w-8 h-8 rounded-full flex items-center justify-center text-captionSm font-bold border-2 border-nc-bg-default box-border"
            :class="{ '-ml-2': i > 0 }"
            :style="a.tint"
          >
            {{ a.initials }}
          </div>
        </div>
        <div class="flex-1 text-left text-bodyDefault">
          <template v-if="membersLoaded">
            {{ $t('msg.info.peopleHaveAccess', { count: members.length }, members.length) }}
          </template>
          <span v-else class="inline-block w-32 h-4 rounded bg-nc-bg-gray-light" />
        </div>
        <GeneralIcon icon="ncChevronRight" class="flex-none w-5 h-5 text-nc-content-gray-subtle" />
      </button>
    </div>
  </div>
</template>
