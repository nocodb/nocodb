<script lang="ts" setup>
import { RoleLabels } from 'nocodb-sdk'

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

const { t } = useI18n()

const { links, linkUrl, isLoading, isLoaded, createLink } = useInviteLinks()

const { copy } = useCopy()

const copied = ref(false)

const isCreating = ref(false)

const primary = computed(() => links.value[0])

const primaryRole = computed(() => {
  if (!primary.value) return { label: '', article: 'a' }

  const label = t(`objects.roleType.${RoleLabels[primary.value.role] ?? primary.value.role}`).toLowerCase()

  return {
    label,
    article: /^[aeiou]/.test(label) ? 'an' : 'a',
  }
})

/**
 * No link is minted just because someone opened this modal: a link is a
 * standing grant, so it only exists once somebody asks for one.
 */
async function onCreateLink() {
  isCreating.value = true

  const link = await createLink()

  isCreating.value = false

  if (link) emit('editLink', link.id)
}

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

async function copyPrimary() {
  if (!primary.value) return

  await copy(linkUrl(primary.value))
  copied.value = true
  setTimeout(() => (copied.value = false), 1600)
}
</script>

<template>
  <div class="flex flex-col gap-5 px-7 pt-5 pb-7">
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
      <div class="text-bodyDefaultSm font-semibold text-nc-content-gray-subtle2">{{ $t('labels.peopleWithAccess') }}</div>

      <button
        class="flex items-center gap-3 min-h-10 -mx-2 px-2 rounded-lg text-nc-content-gray hover:bg-nc-bg-gray-extralight"
        data-testid="nc-hub-people-with-access"
        @click="emit('manageAccess')"
      >
        <div class="flex">
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

    <div class="h-px bg-nc-border-gray-light" />

    <div class="flex flex-col gap-2">
      <div class="text-bodyDefaultSm font-semibold text-nc-content-gray-subtle2">{{ $t('labels.inviteViaLink') }}</div>

      <div v-if="!isLoaded && isLoading" class="flex items-center gap-2">
        <span class="flex-1 h-10 rounded-lg bg-nc-bg-gray-extralight" />
      </div>

      <template v-else-if="primary">
        <div class="flex items-center gap-2">
          <div
            class="flex-1 min-w-0 h-10 flex items-center px-3 rounded-lg bg-nc-bg-gray-extralight text-nc-content-gray-subtle truncate nc-hub-link-url"
          >
            {{ linkUrl(primary) }}
          </div>
          <NcButton type="primary" size="medium" data-testid="nc-hub-copy-link" @click="copyPrimary">
            {{ copied ? $t('general.copied') : $t('activity.copyLink') }}
          </NcButton>
          <NcTooltip :title="$t('activity.linkSettings')">
            <NcButton
              type="secondary"
              size="medium"
              class="!px-0 !w-10"
              data-testid="nc-hub-link-settings"
              @click="emit('editLink', primary.id)"
            >
              <GeneralIcon icon="ncSettings" class="w-4 h-4" />
            </NcButton>
          </NcTooltip>
        </div>

        <div class="text-bodyDefaultSm text-nc-content-gray-subtle2">
          {{ $t('msg.info.anyoneCanAccessAs', { article: primaryRole.article, role: '' }) }}
          <b class="font-semibold text-nc-content-gray">{{ primaryRole.label }}</b>
          <template v-if="primary.email_domain">
            · {{ $t('msg.info.domainOnlyNote', { domain: primary.email_domain }) }}</template
          >
        </div>

        <button
          class="flex items-center gap-2 min-h-9 -mx-2 px-2 rounded-lg text-bodyDefault font-semibold text-nc-content-gray hover:bg-nc-bg-gray-extralight"
          data-testid="nc-hub-all-links"
          @click="emit('links')"
        >
          <GeneralIcon icon="link2" class="flex-none w-4.5 h-4.5" />
          <span class="flex-1 text-left">{{ $t('msg.info.inviteLinkCount', { count: links.length }, links.length) }}</span>
          <GeneralIcon icon="ncChevronRight" class="flex-none w-5 h-5 text-nc-content-gray-subtle" />
        </button>
      </template>

      <template v-else>
        <div class="text-bodyDefaultSm text-nc-content-gray-subtle2">{{ $t('msg.info.noInviteLinkYet') }}</div>

        <NcButton
          type="secondary"
          size="medium"
          class="!w-full"
          data-testid="nc-hub-create-first-link"
          :loading="isCreating"
          @click="onCreateLink"
        >
          <span class="flex w-full items-center justify-center gap-2">
            <GeneralIcon icon="link2" class="flex-none w-4.5 h-4.5" />
            {{ $t('activity.createInviteLink') }}
          </span>
        </NcButton>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-hub-link-url {
  @apply text-captionSm;
  font-family: 'DM Mono', monospace;
}
</style>
