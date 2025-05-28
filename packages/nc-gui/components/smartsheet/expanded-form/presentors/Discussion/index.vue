<script setup lang="ts">
/* interface */

const props = defineProps<{
  isUnsavedDuplicatedRecordExist: boolean
}>()

const isUnsavedDuplicatedRecordExist = toRef(props, 'isUnsavedDuplicatedRecordExist')

/* stores */

const {
  saveComment,
  loadAudits,
  commentsDrawer,
  isNew,
  audits,
  comments,
  auditCommentGroups,
  mightHaveMoreAudits,
  loadMoreAudits,
} = useExpandedFormStoreOrThrow()

const { isUIAllowed } = useRoles()

const { isExpandedFormCommentMode } = storeToRefs(useConfigStore())

/* flags */

const showRightSections = computed(() => !isNew.value && commentsDrawer.value && isUIAllowed('commentList'))

onMounted(async () => {
  await loadAudits()
  scrollToBottom()
})

/* comments */

const refAuditsEnd = useTemplateRef('refAuditsEnd')
const refRichComment = useTemplateRef('refRichComment')
const newCommentText = ref('')
const shouldSkipAuditsScroll = ref(false)

function handleCreatingNewComment() {
  saveComment(newCommentText.value)
  newCommentText.value = ''

  refRichComment?.value?.setEditorContent('', true)
}

function initLoadMoreAudits() {
  shouldSkipAuditsScroll.value = true
  loadMoreAudits()
}

const auditsLength = computed(() => audits.value.length)
const commentsLength = computed(() => comments.value.length)

watch([newCommentText, auditsLength, commentsLength], () => {
  scrollToBottom()
})

function scrollToBottom() {
  setTimeout(() => {
    if (shouldSkipAuditsScroll.value) {
      shouldSkipAuditsScroll.value = false
      return
    }
    refAuditsEnd.value?.scrollIntoView({
      behavior: 'smooth',
    })
  }, 200)
}
</script>

<script lang="ts">
export default {
  name: 'ExpandedFormPresentorsDiscussion',
}
</script>

<template>
  <div class="h-full flex flex-row nc-discussion-mode-container">
    <div
      class="relative h-full overflow-y-auto nc-scrollbar-thin flex flex-col items-center justify-start overflow-x-hidden"
      :class="{
        'w-full': !showRightSections,
        'flex-1': showRightSections,
      }"
    >
      <div class="w-[680px] max-w-full flex-grow flex flex-col px-6">
        <div class="w-full h-0 flex-grow ml-15.8 border-l-1 border-gray-300" />
      </div>
      <div v-if="mightHaveMoreAudits" class="w-[680px] max-w-full fflex-grow-0 flex-shrink-0 flex flex-col px-6">
        <div class="w-full h-15 flex-grow-0 flex-shrink-0 ml-15.8 border-l-1 border-gray-300 relative">
          <NcButton
            size="small"
            type="secondary"
            class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
            @click="initLoadMoreAudits()"
          >
            Load more
          </NcButton>
        </div>
      </div>
      <div class="w-[680px] max-w-full pb-4">
        <div v-for="group in auditCommentGroups" :key="group.created_at" class="w-full px-6">
          <template v-if="group.type === 'audit'">
            <SmartsheetExpandedFormPresentorsDiscussionEntryAudit :audit-group="group" />
          </template>
          <template v-else>
            <SmartsheetExpandedFormPresentorsDiscussionEntryComment :comment="group" />
          </template>
        </div>
        <div
          v-if="isUIAllowed('commentEdit')"
          class="w-full border-t border-gray-200 px-6 sticky bottom-0 pb-4 -mb-4 bg-white z-10"
        >
          <div class="font-bold my-3">Add a comment</div>
          <SmartsheetExpandedFormRichComment
            ref="refRichComment"
            v-model:value="newCommentText"
            :hide-options="false"
            placeholder="Comment..."
            class="expanded-form-comment-input !py-2 !px-2 cursor-text border-1 rounded-lg !text-gray-800 !text-small !leading-18px !max-h-[240px] bg-white !w-auto"
            data-testid="expanded-form-comment-input"
            :autofocus="isExpandedFormCommentMode"
            @focus="isExpandedFormCommentMode = false"
            @update:value="scrollToBottom()"
            @keydown.stop
            @save="handleCreatingNewComment"
            @keydown.enter.exact.prevent="handleCreatingNewComment"
          />
        </div>
        <div v-else class="w-full px-6">
          <div class="w-full h-4 flex-grow ml-15.8 -mb-4 border-l-1 border-gray-300" />
        </div>

        <div ref="refAuditsEnd" />
      </div>
    </div>
    <div
      v-if="showRightSections && !isUnsavedDuplicatedRecordExist"
      class="nc-comments-drawer border-l-1 relative border-gray-200 bg-white w-1/3 max-w-[400px] min-w-[250px] h-full xs:hidden rounded-br-2xl"
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
