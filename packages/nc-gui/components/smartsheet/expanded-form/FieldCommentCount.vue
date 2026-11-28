<script setup lang="ts">
/**
 * Open comment threads on one field of the expanded record; a click shows them in the comments panel.
 * With no open threads it is an add button, shown while the field row is hovered.
 * While the panel is filtered to this field it shows as selected, and a click clears the filter.
 */
const props = defineProps<{
  columnId?: string
}>()

const rowComments = useRowComments()

const expandedFormStore = useExpandedFormStore()

const { expandedFormCommentFieldId } = storeToRefs(useConfigStore())

const { isMobileMode } = useGlobal()

const { isUIAllowed } = useRoles()

const { t } = useI18n()

const { $e } = useNuxtApp()

const commentsAvailable = inject(ExpandedFormCommentsAvailableInj, ref(false))

const count = computed(() => (props.columnId ? rowComments?.openThreadsByField.value[props.columnId] ?? 0 : 0))

const canAdd = computed(() => !!props.columnId && commentsAvailable.value && !isMobileMode.value && isUIAllowed('commentEdit'))

/** A click can only filter where the comments panel is on screen. */
const canFilter = computed(() => commentsAvailable.value && !isMobileMode.value)

const isActive = computed(() => !!props.columnId && rowComments?.commentFieldId.value === props.columnId)

const countLabel = computed(() =>
  isActive.value ? t('general.showAll') : t('activity.cellComments.openThreads', { count: count.value }, count.value),
)

const addLabel = computed(() => (isActive.value ? t('general.showAll') : t('activity.cellComments.commentOnField')))

function toggleFieldComments(source: 'field-label' | 'field-label-add') {
  if (!props.columnId) return
  if (isActive.value) {
    if (rowComments) rowComments.commentFieldId.value = null
    return
  }
  if (expandedFormStore) expandedFormStore.commentsDrawer.value = true
  expandedFormCommentFieldId.value = props.columnId
  $e('c:comment:field:filter', { source })
}
</script>

<template>
  <NcTooltip v-if="count" :title="countLabel" placement="top">
    <component
      :is="canFilter ? 'button' : 'span'"
      :type="canFilter ? 'button' : undefined"
      class="nc-field-comment-count ml-1 flex-none inline-flex items-center gap-0.5 h-5 px-1.5 rounded-md text-captionSm font-semibold"
      :class="
        isActive
          ? 'bg-nc-fill-primary text-white hover:bg-nc-fill-primary-hover cursor-pointer'
          : ['bg-nc-bg-brand text-nc-content-brand', { 'hover:bg-nc-brand-100 cursor-pointer': canFilter }]
      "
      :aria-label="countLabel"
      :aria-pressed="canFilter ? isActive : undefined"
      :data-testid="`nc-field-comment-count-${columnId}`"
      @click.stop="canFilter && toggleFieldComments('field-label')"
    >
      <GeneralIcon icon="ncMessageSquare" class="h-3 w-3" />
      {{ count }}
    </component>
  </NcTooltip>
  <!-- Overlays the label's end so it takes no room from the field name -->
  <NcTooltip v-else-if="canAdd" :title="addLabel" placement="top" class="absolute right-0 top-1/2 -translate-y-1/2">
    <button
      type="button"
      class="nc-field-comment-add flex-none inline-flex items-center justify-center h-5 w-5 rounded-md cursor-pointer"
      :class="
        isActive
          ? 'nc-field-comment-add-active bg-nc-fill-primary text-white hover:bg-nc-fill-primary-hover'
          : 'bg-nc-bg-default text-nc-content-gray-muted hover:(bg-nc-bg-gray-light text-nc-content-gray)'
      "
      :aria-label="addLabel"
      :aria-pressed="isActive"
      :data-testid="`nc-field-comment-add-${columnId}`"
      @click.stop="toggleFieldComments('field-label-add')"
    >
      <GeneralIcon icon="ncMessageSquare" class="h-3.5 w-3.5" />
    </button>
  </NcTooltip>
</template>

<style lang="scss">
// Shown on row hover, keyboard focus or while selected, so labels stay quiet otherwise.
.nc-field-comment-add {
  opacity: 0;
}

.nc-expanded-form-row:hover .nc-field-comment-add,
.nc-field-comment-add:focus-visible,
.nc-field-comment-add.nc-field-comment-add-active {
  opacity: 1;
}
</style>
