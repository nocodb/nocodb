<script setup lang="ts">

/* interface */

const props = defineProps<{
  store: ReturnType<typeof useProvideExpandedFormStore>
  isUnsavedDuplicatedRecordExist: boolean
}>()

const isUnsavedDuplicatedRecordExist = toRef(props, 'isUnsavedDuplicatedRecordExist')

/* stores */

const { audits, loadAudits, commentsDrawer, isNew, row: _row } = props.store

const { isUIAllowed } = useRoles()

/* flags */

const showRightSections = computed(() => !isNew.value && commentsDrawer.value && isUIAllowed('commentList'))

onMounted(async () => {
  await loadAudits()
})
</script>

<script lang="ts">
export default {
  name: 'ExpandedFormPresentorsDiscussion',
}
</script>

<template>
  <div class="h-full flex flex-row nc-files-mode-container">
    <div
      class="h-full overflow-clip flex flex-col"
      :class="{
        'w-full': !showRightSections,
        'flex-1': showRightSections,
      }"
    >
      <pre>{{ audits }}</pre>
    </div>
    <div
      v-if="showRightSections && !isUnsavedDuplicatedRecordExist"
      class="nc-comments-drawer border-l-1 relative border-gray-200 bg-white w-1/3 max-w-[400px] min-w-0 h-full xs:hidden rounded-br-2xl"
      :class="{
        active: commentsDrawer && isUIAllowed('commentList'),
      }"
    >
      <SmartsheetExpandedFormPresentorsFieldsMiniColumnsWrapper :store="props.store" />
    </div>
  </div>
</template>
