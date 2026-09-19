<script lang="ts" setup>
import { RoleLabels } from 'nocodb-sdk'

const emit = defineEmits(['editLink'])

const { t } = useI18n()

const { links, linkUrl, isLoading, isLoaded } = useInviteLinks()

const { copy } = useCopy()

const { $e } = useNuxtApp()

const copiedId = ref('')

let copiedTimer: ReturnType<typeof setTimeout>

const rows = computed(() =>
  links.value.map((l) => {
    const label = t(`objects.roleType.${RoleLabels[l.role] ?? l.role}`).toLowerCase()

    return {
      id: l.id,
      role: label,
      article: /^[aeiou]/.test(label) ? 'an' : 'a',
      domainNote: l.email_domain || '',
      uses: l.max_uses ? `${l.used_count ?? 0}/${l.max_uses}` : '',
    }
  }),
)

async function copyRow(id: string) {
  const link = links.value.find((l) => l.id === id)
  if (!link) return

  try {
    // useCopy throws when the clipboard refuses; without this the press would
    // do nothing at all and look like a dead button. Same as LinkBlock.
    await copy(linkUrl(link))

    $e('c:share:link:copy', { from: 'list', restricted: !!link.email_domain })

    copiedId.value = id
    // One shared timer: copying a second row must not let the first row's
    // timeout blank the new "Copied" label early.
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copiedId.value = ''), 1600)
  } catch (e: any) {
    message.error(e?.message || t('msg.error.copyToClipboardError'))
  }
}

/**
 * Opens an unsaved draft. Creating here instead would mean a link the user
 * never confirmed -- Cancel had nothing to undo, and the screen offers no
 * Delete while the link is new.
 */
function onCreate() {
  emit('editLink', '', true)
}

onBeforeUnmount(() => clearTimeout(copiedTimer))
</script>

<template>
  <div class="flex flex-col px-7 pt-4 pb-7">
    <div v-if="!isLoaded && isLoading" class="flex flex-col gap-2 py-3">
      <span v-for="i in 2" :key="i" class="h-8 rounded-lg bg-nc-bg-gray-extralight" />
    </div>

    <!-- The list is the only part that grows, so it is the only part that
         scrolls: the header stays put and "Create new link" stays reachable
         without scrolling to the bottom. A clipping ancestor cannot go any
         higher up than this -- the invite form's org-user picker is absolutely
         positioned and the members dialog keeps its overflow visible for it.

         `nc-scrollbar-visible`, not `-thin`: the thin variant leaves the bar to
         the OS, which on macOS means it only appears mid-scroll, so a cut-off
         list looks like the whole list. This one reserves the lane and paints
         its own bar, which is the only standing hint that there is more.

         The negative margin puts that bar in the modal's own right padding and
         hands the width back to the rows: 16 of the 28px, which leaves the bar
         clear of the buttons on one side and off the modal's edge on the other. -->
    <div class="nc-hub-link-list max-h-[45vh] overflow-y-auto nc-scrollbar-visible -mr-4 pr-4">
      <div
        v-for="row in rows"
        :key="row.id"
        class="flex items-center gap-2 min-h-14 border-b-1 border-nc-border-gray-light"
        data-testid="nc-hub-link-row"
      >
        <div class="flex-1 text-bodyDefault text-nc-content-gray-subtle2">
          {{ $t('msg.info.anyoneCanAccessAs', { article: row.article, role: '' }) }}
          <b class="font-semibold text-nc-content-gray">{{ row.role }}</b>
          <template v-if="row.domainNote"> · {{ $t('msg.info.domainOnlyNote', { domain: row.domainNote }) }}</template>
          <template v-if="row.uses"> · {{ $t('msg.info.linkUsesCount', { uses: row.uses }) }}</template>
        </div>

        <NcButton type="secondary" size="small" class="!text-small" @click="copyRow(row.id)">
          {{ copiedId === row.id ? $t('general.copied') : $t('activity.copyLink') }}
        </NcButton>

        <NcTooltip :title="$t('activity.linkSettings')">
          <NcButton
            v-e="['c:share:link:settings']"
            type="secondary"
            size="small"
            class="!px-0 !w-8"
            @click="emit('editLink', row.id)"
          >
            <GeneralIcon icon="ncSettings" class="w-4 h-4" />
          </NcButton>
        </NcTooltip>
      </div>
    </div>

    <button
      class="flex items-center gap-2 h-11 -mx-2 mt-1 px-2 rounded-lg text-bodyDefault font-semibold text-nc-content-brand hover:bg-nc-bg-gray-extralight disabled:opacity-50"
      data-testid="nc-hub-create-link"
      @click="onCreate"
    >
      <GeneralIcon icon="plus" class="flex-none w-4.5 h-4.5" />
      {{ $t('activity.createNewLink') }}
    </button>
  </div>
</template>
