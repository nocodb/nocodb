<script lang="ts" setup>
import { RoleLabels } from 'nocodb-sdk'

/**
 * The "Invite via link" block. Lives here rather than inside Main so the
 * workspace invite dialog can show the same thing without a second copy.
 */
const emit = defineEmits(['editLink', 'allLinks'])

const { t } = useI18n()

const { links, linkUrl, isLoading, isLoaded, createLink } = useInviteLinks()

const { copy } = useCopy()

const copied = ref(false)

const isCreating = ref(false)

const primary = computed(() => links.value[0])

const primaryRole = computed(() => {
  if (!primary.value) return { label: '', article: 'a' }

  const label = t(`objects.roleType.${RoleLabels[primary.value.role] ?? primary.value.role}`).toLowerCase()

  return { label, article: /^[aeiou]/.test(label) ? 'an' : 'a' }
})

async function copyPrimary() {
  if (!primary.value) return

  await copy(linkUrl(primary.value))
  copied.value = true
  setTimeout(() => (copied.value = false), 1600)
}

/**
 * No link is minted just because a modal opened: a link is a standing grant,
 * so it only exists once somebody asks for one.
 */
async function onCreateLink() {
  isCreating.value = true

  const link = await createLink()

  isCreating.value = false

  if (link) emit('editLink', link.id)
}
</script>

<template>
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
        <template v-if="primary.email_domain"> · {{ $t('msg.info.domainOnlyNote', { domain: primary.email_domain }) }}</template>
      </div>

      <button
        class="flex items-center gap-2 min-h-9 -mx-2 px-2 rounded-lg text-bodyDefault font-semibold text-nc-content-gray hover:bg-nc-bg-gray-extralight"
        data-testid="nc-hub-all-links"
        @click="emit('allLinks')"
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
</template>

<style lang="scss" scoped>
.nc-hub-link-url {
  @apply text-captionSm;
  font-family: 'DM Mono', monospace;
}
</style>
