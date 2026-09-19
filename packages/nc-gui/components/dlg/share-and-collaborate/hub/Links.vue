<script lang="ts" setup>
import { RoleLabels } from 'nocodb-sdk'

const emit = defineEmits(['editLink'])

const { t } = useI18n()

const { links, linkUrl, isLoading, isLoaded, createLink } = useInviteLinks()

const { copy } = useCopy()

const { $e } = useNuxtApp()

const copiedId = ref('')

const isCreating = ref(false)

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

  await copy(linkUrl(link))
  $e('c:share:link:copy', { from: 'list', restricted: !!link.email_domain })
  copiedId.value = id
  setTimeout(() => (copiedId.value = ''), 1600)
}

async function onCreate() {
  isCreating.value = true

  const link = await createLink()

  isCreating.value = false

  if (link) {
    $e('a:share:link:create', { role: link.role, restricted: !!link.email_domain, from: 'list' })
    emit('editLink', link.id, true)
  }
}
</script>

<template>
  <div class="flex flex-col px-7 pt-4 pb-7">
    <div v-if="!isLoaded && isLoading" class="flex flex-col gap-2 py-3">
      <span v-for="i in 2" :key="i" class="h-8 rounded-lg bg-nc-bg-gray-extralight" />
    </div>

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

      <NcButton type="secondary" size="small" @click="copyRow(row.id)">
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

    <button
      class="flex items-center gap-2 h-11 -mx-2 mt-1 px-2 rounded-lg text-bodyDefault font-semibold text-nc-content-brand hover:bg-nc-bg-gray-extralight disabled:opacity-50"
      data-testid="nc-hub-create-link"
      :disabled="isCreating"
      @click="onCreate"
    >
      <GeneralIcon icon="plus" class="flex-none w-4.5 h-4.5" />
      {{ $t('activity.createNewLink') }}
    </button>
  </div>
</template>
