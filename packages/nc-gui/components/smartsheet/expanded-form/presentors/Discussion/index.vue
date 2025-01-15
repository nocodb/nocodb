<script setup lang="ts">
/* interface */

const props = defineProps<{
  isUnsavedDuplicatedRecordExist: boolean
}>()

const isUnsavedDuplicatedRecordExist = toRef(props, 'isUnsavedDuplicatedRecordExist')

/* stores */

const { saveComment, loadAudits, commentsDrawer, isNew, auditCommentGroups } = useExpandedFormStoreOrThrow()

const { isUIAllowed } = useRoles()

/* flags */

const showRightSections = computed(() => !isNew.value && commentsDrawer.value && isUIAllowed('commentList'))

onMounted(async () => {
  await loadAudits()
})

/* new comment */

const newCommentText = ref('')

function handleCreatingNewComment() {
  saveComment(newCommentText.value)
  newCommentText.value = ''
}
</script>

<script lang="ts">
export default {
  name: 'ExpandedFormPresentorsDiscussion',
}
</script>

<template>
  <div class="h-full flex flex-row nc-files-mode-container">
    <div
      class="h-full overflow-y-auto nc-scrollbar-thin"
      :class="{
        'w-full': !showRightSections,
        'flex-1': showRightSections,
      }"
    >
      <div class="max-w-[660px] mx-auto pb-4">
        <div v-for="group in auditCommentGroups" :key="group.created_at" class="w-full mx-6">
          <template v-if="group.type === 'audit'">
            <SmartsheetExpandedFormPresentorsDiscussionEntryAudit :audit-group="group" />
          </template>
          <template v-else>
            <SmartsheetExpandedFormPresentorsDiscussionEntryComment :comment="group" />
          </template>
        </div>
        <div class="w-full border-t border-gray-200 px-6">
          <div class="font-bold my-3">Add a comment</div>
          <SmartsheetExpandedFormRichComment
            :key="auditCommentGroups.length"
            v-model:value="newCommentText"
            :hide-options="false"
            placeholder="Comment..."
            class="expanded-form-comment-input !py-2 !px-2 cursor-text border-1 rounded-lg !text-gray-800 !text-small !leading-18px !max-h-[240px] bg-white !w-auto"
            data-testid="expanded-form-comment-input"
            @keydown.stop
            @save="handleCreatingNewComment"
            @keydown.enter.exact.prevent="handleCreatingNewComment"
          />
        </div>
      </div>
    </div>
    <div
      v-if="showRightSections && !isUnsavedDuplicatedRecordExist"
      class="nc-comments-drawer border-l-1 relative border-gray-200 bg-white w-1/3 max-w-[400px] min-w-0 h-full xs:hidden rounded-br-2xl"
      :class="{
        active: commentsDrawer && isUIAllowed('commentList'),
      }"
    >
      <SmartsheetExpandedFormPresentorsFieldsMiniColumnsWrapper />
    </div>
  </div>
</template>

<style scoped lang="scss">
:deep(.expanded-form-comment-input) {
  @apply transition-all duration-150 min-h-8;
  box-shadow: none;
  &:focus,
  &:focus-within {
    @apply min-h-16 !bg-white border-brand-500;
    box-shadow: 0px 0px 0px 2px rgba(51, 102, 255, 0.24);
  }
  &::placeholder {
    @apply !text-gray-400;
  }
}
</style>
