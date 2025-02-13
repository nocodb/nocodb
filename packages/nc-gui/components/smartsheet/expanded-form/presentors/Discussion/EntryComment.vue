<script setup lang="ts">
import { type CommentType } from 'nocodb-sdk'

/* interface */

const props = defineProps<{
  comment: any
}>()

const { user } = useGlobal()

const { copy } = useCopy()

const { dashboardUrl } = useDashboard()

const route = useRoute()

const meta = inject(MetaInj, ref())

/* stores */

const { loadComments, resolveComment, updateComment, deleteComment, primaryKey } = useRowCommentsOrThrow()

const { isUIAllowed } = useRoles()

/* flags */

const hasEditPermission = computed(() => isUIAllowed('commentEdit'))

/* formatting */

const createdBy = (
  comment: CommentType & {
    created_display_name?: string
  },
) => {
  if (comment.created_by === user.value?.id) {
    return 'You'
  } else if (comment.created_display_name?.trim()) {
    return comment.created_display_name || 'Shared source'
  } else if (comment.created_by_email) {
    return comment.created_by_email
  } else {
    return 'Shared source'
  }
}

const isCreatedByYou = computed(() => {
  return createdBy(props.comment) === 'You'
})

const editedAt = (comment: CommentType) => {
  if (comment.updated_at !== comment.created_at && comment.updated_at) {
    const str = timeAgo(comment.updated_at).replace(' ', '_')
    return `[(edited)](a~~~###~~~Edited_${str}) `
  }
  return ''
}

/* actions */

const isEditing = ref(false)
const editCommentValue = ref<CommentType>()

function editComment(comment: CommentType) {
  editCommentValue.value = {
    ...comment,
  }
  isEditing.value = true
}

function onCancel(e: KeyboardEvent) {
  if (!isEditing.value) return
  e.preventDefault()
  e.stopPropagation()
  editCommentValue.value = undefined
  loadComments()
  isEditing.value = false
  editCommentValue.value = undefined
}

const value = computed({
  get() {
    return editCommentValue.value?.comment || ''
  },
  set(val) {
    if (!editCommentValue.value) return
    editCommentValue.value.comment = val
  },
})

async function onEditComment() {
  if (!isEditing.value || !editCommentValue.value?.comment) return

  while (editCommentValue.value.comment.endsWith('<br />') || editCommentValue.value.comment.endsWith('\n')) {
    if (editCommentValue.value.comment.endsWith('<br />')) {
      editCommentValue.value.comment = editCommentValue.value.comment.slice(0, -6)
    } else {
      editCommentValue.value.comment = editCommentValue.value.comment.slice(0, -2)
    }
  }

  // isCommentMode.value = true

  const tempCom = {
    ...editCommentValue.value,
  }

  isEditing.value = false
  editCommentValue.value = undefined
  await updateComment(tempCom.id!, {
    comment: tempCom.comment,
  })
  loadComments()
}

function onCommentBlur() {
  isEditing.value = false
  editCommentValue.value = undefined
}

async function copyComment(comment: CommentType) {
  await copy(
    encodeURI(
      `${dashboardUrl?.value}#/${route.params.typeOrId}/${route.params.baseId}/${meta.value?.id}?rowId=${primaryKey.value}&commentId=${comment.id}`,
    ),
  )
}
</script>

<template>
  <div class="bg-white rounded-lg border !border-gray-200 border-1 relative group my-4 nc-audit-comment-block">
    <div
      class="flex items-center gap-2 bg-gray-50 px-4 py-1.9 border-b border-gray-200 rounded-t-lg"
      :class="{
        '!bg-[#F0F3FF]': isCreatedByYou,
      }"
    >
      <GeneralUserIcon
        :user="{
          email: props.comment.user,
          display_name: props.comment.displayName,
          meta: props.comment.created_by_meta,
        }"
        class="w-[24px] aspect-square"
      />

      <span class="font-medium text-sm" :class="{ 'text-brand-600': isCreatedByYou }">
        {{ createdBy(props.comment) }}
      </span>
      <span class="text-xs text-gray-500">
        <NcTooltip>
          <template #title>{{ parseStringDateTime(props.comment.created_at) }}</template>
          {{ timeAgo(props.comment.created_at) }}
        </NcTooltip>
      </span>

      <div class="flex-1" />

      <div v-if="!editCommentValue" class="flex items-center gap-2">
        <NcTooltip
          v-if="user && props.comment.created_by_email === user.email && hasEditPermission"
          class="opacity-0 transition !duration-150 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
        >
          <NcButton
            class="!w-7 !h-7 !bg-transparent !hover:bg-gray-200"
            size="xsmall"
            type="text"
            @click="editComment(props.comment)"
          >
            <GeneralIcon class="text-md" icon="pencil" />
          </NcButton>
          <template #title>Click to edit</template>
        </NcTooltip>

        <NcTooltip
          v-if="!props.comment.resolved_by && hasEditPermission"
          class="opacity-0 transition !duration-150 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
        >
          <NcButton
            class="!w-7 !h-7 !bg-transparent !hover:bg-gray-200"
            size="xsmall"
            type="text"
            @click="resolveComment(props.comment.id)"
          >
            <GeneralIcon class="text-md" icon="checkCircle" />
          </NcButton>
          <template #title>Click to resolve</template>
        </NcTooltip>
        <NcTooltip v-else-if="props.comment.resolved_by">
          <template #title>{{ `Resolved by ${props.comment.resolved_display_name}` }}</template>
          <NcButton
            class="!h-7 !w-7 !bg-transparent !hover:bg-gray-200 text-semibold"
            size="xsmall"
            type="text"
            @click="resolveComment(props.comment.id!)"
          >
            <GeneralIcon class="text-md rounded-full bg-[#17803D] text-white" icon="checkFill" />
          </NcButton>
        </NcTooltip>

        <NcDropdown
          v-if="!editCommentValue"
          class="opacity-0 transition !duration-150 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
          overlay-class-name="!min-w-[160px]"
          placement="bottomRight"
        >
          <NcButton class="!w-7 !h-7 !bg-transparent !hover:bg-gray-200" size="xsmall" type="text">
            <GeneralIcon class="text-md" icon="threeDotVertical" />
          </NcButton>
          <template #overlay>
            <NcMenu variant="small">
              <NcMenuItem v-e="['c:comment-expand:comment:copy']" @click="copyComment(props.comment)">
                <div class="flex gap-2 items-center">
                  <component :is="iconMap.copy" class="cursor-pointer" />
                  {{ $t('general.copy') }} URL
                </div>
              </NcMenuItem>
              <template v-if="user && props.comment.created_by_email === user.email && hasEditPermission">
                <NcDivider />
                <NcMenuItem
                  v-e="['c:row-expand:comment:delete']"
                  class="!text-red-500 !hover:bg-red-50"
                  @click="deleteComment(props.comment.id!)"
                >
                  <div class="flex gap-2 items-center">
                    <component :is="iconMap.delete" class="cursor-pointer" />
                    {{ $t('general.delete') }}
                  </div>
                </NcMenuItem>
              </template>
            </NcMenu>
          </template>
        </NcDropdown>
      </div>
    </div>
    <SmartsheetExpandedFormRichComment
      v-if="props.comment.id === editCommentValue?.id && hasEditPermission"
      v-model:value="value"
      autofocus
      autofocus-to-end
      :hide-options="false"
      class="cursor-text expanded-form-comment-input !py-3 !px-4 !pr-3 !m-0 w-full !border-1 !border-gray-200 !rounded-lg !bg-white !text-gray-800 !text-small !leading-18px !max-h-[240px]"
      data-testid="expanded-form-comment-input"
      sync-value-change
      @save="onEditComment"
      @keydown.esc="onCancel"
      @blur="onCommentBlur"
      @keydown.enter.exact.prevent="onEditComment"
    />
    <SmartsheetExpandedFormRichComment
      v-else
      :value="`${props.comment.comment}  ${editedAt(props.comment)}`"
      class="!text-small !leading-18px !text-gray-800 px-4 py-3"
      read-only
      sync-value-change
    />
  </div>
</template>

<style scoped lang="scss">
.nc-audit-comment-block::before {
  content: '';
  @apply absolute -top-4.5 left-6.75 h-4.5 border-l-1 border-gray-300;
}
.nc-audit-comment-block::after {
  content: '';
  @apply absolute -bottom-4.5 left-6.75 h-4.5 border-l-1 border-gray-300;
}
</style>
