<script lang="ts" setup>
import { RoleLabels } from 'nocodb-sdk'

/** MOCK — see `useInviteLinks`. Nothing here reaches the server. */
const emit = defineEmits(['editLink'])

const { t } = useI18n()

const { links, linkUrl, createLink } = useInviteLinks()

const { copy } = useCopy()

const copiedIndex = ref(-1)

const rows = computed(() =>
  links.value.map((l, i) => {
    const label = t(`objects.roleType.${RoleLabels[l.role] ?? l.role}`).toLowerCase()

    return {
      index: i,
      id: l.id,
      role: label,
      article: /^[aeiou]/.test(label) ? 'an' : 'a',
      domainNote: !l.anyEmail && l.domain ? l.domain : '',
    }
  }),
)

async function copyAt(index: number) {
  await copy(linkUrl(links.value[index]))
  copiedIndex.value = index
  setTimeout(() => (copiedIndex.value = -1), 1600)
}

function onCreate() {
  emit('editLink', createLink())
}
</script>

<template>
  <div class="flex flex-col px-7 pt-4 pb-7">
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
      </div>

      <NcButton type="secondary" size="small" @click="copyAt(row.index)">
        {{ copiedIndex === row.index ? $t('general.copied') : $t('activity.copyLink') }}
      </NcButton>

      <NcTooltip :title="$t('activity.linkSettings')">
        <NcButton type="secondary" size="small" class="!px-0 !w-8" @click="emit('editLink', row.index)">
          <GeneralIcon icon="ncSettings" class="w-4 h-4" />
        </NcButton>
      </NcTooltip>
    </div>

    <button
      class="flex items-center gap-2 h-11 -mx-2 mt-1 px-2 rounded-lg text-bodyDefault font-semibold text-nc-content-brand hover:bg-nc-bg-gray-extralight"
      data-testid="nc-hub-create-link"
      @click="onCreate"
    >
      <GeneralIcon icon="plus" class="flex-none w-4.5 h-4.5" />
      {{ $t('activity.createNewLink') }}
    </button>
  </div>
</template>
