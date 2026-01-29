<script lang="ts" setup>
type SectionType = 'starred' | 'private' | 'owned' | 'default'

const props = defineProps<{
  type: SectionType
  bases: NcProject[]
}>()

const emit = defineEmits<{
  select: [base: NcProject]
}>()

const { t } = useI18n()

const sectionConfig = computed(() => {
  switch (props.type) {
    case 'starred':
      return {
        icon: 'star',
        label: t('general.starred'),
      }
    case 'private':
      return {
        icon: 'lock',
        label: t('general.private'),
      }
    case 'owned':
      return {
        icon: 'account',
        label: t('activity.ownedByMe'),
      }
    default:
      return {
        icon: 'ncFolder',
        label: t('objects.projects'),
      }
  }
})

const onSelectBase = (base: NcProject) => {
  emit('select', base)
}
</script>

<template>
  <div v-if="bases.length" class="nc-bases-section mb-4">
    <div class="flex items-center gap-2 mb-2 text-xs font-medium text-nc-content-gray-muted uppercase tracking-wide">
      <GeneralIcon :icon="sectionConfig.icon" class="w-3.5 h-3.5" />
      <span>{{ sectionConfig.label }}</span>
    </div>
    <div class="grid grid-cols-3 gap-3">
      <WorkspaceBaseListModalBaseNode
        v-for="base in bases"
        :key="base.id"
        :base="base"
        :is-starred="type === 'starred'"
        :is-private="type === 'private'"
        @select="onSelectBase"
      />
    </div>
  </div>
</template>
