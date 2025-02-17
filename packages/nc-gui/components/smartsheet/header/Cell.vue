<script setup lang="ts">
import { type ColumnReqType, type ColumnType, partialUpdateAllowedTypes, readonlyMetaAllowedTypes } from 'nocodb-sdk'
import { UITypes, UITypesName } from 'nocodb-sdk'

interface Props {
  column: ColumnType
  required?: boolean | number
  hideMenu?: boolean
  hideIcon?: boolean
  isHiddenCol?: boolean
}

const props = defineProps<Props>()

const { isMobileMode } = useGlobal()

const hideMenu = toRef(props, 'hideMenu')

const isGrid = inject(IsGridInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const isLocked = inject(IsLockedInj, ref(false))

const isSurveyForm = inject(IsSurveyFormInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

const isExpandedBulkUpdateForm = inject(IsExpandedBulkUpdateFormOpenInj, ref(false))

const isDropDownOpen = ref(false)

const isPublic = inject(IsPublicInj, ref(false))

const column = toRef(props, 'column')

const { isUIAllowed, isMetaReadOnly } = useRoles()

provide(ColumnInj, column)

const editColumnDropdown = ref(false)

const columnOrder = ref<Pick<ColumnReqType, 'column_order'> | null>(null)

const columnTypeName = computed(() => {
  if (column.value.uidt === UITypes.LongText) {
    if (parseProp(column.value?.meta)?.richMode) {
      return UITypesName.RichText
    }

    if (parseProp(column.value?.meta)?.[LongTextAiMetaProp]) {
      return UITypesName.AIPrompt
    }
  }

  return column.value.uidt ? UITypesName[column.value.uidt] : ''
})

const addField = async (payload: any) => {
  columnOrder.value = payload
  editColumnDropdown.value = true
}

const editOrAddProviderRef = ref()

const enableDescription = ref(false)

watch(editColumnDropdown, (val) => {
  if (!val) {
    enableDescription.value = false
  }
})

const closeAddColumnDropdown = () => {
  columnOrder.value = null
  editColumnDropdown.value = false
}

const isColumnEditAllowed = computed(() => {
  if (
    isMetaReadOnly.value &&
    !readonlyMetaAllowedTypes.includes(column.value?.uidt) &&
    !partialUpdateAllowedTypes.includes(column.value?.uidt)
  )
    return false
  return true
})

const openHeaderMenu = (e?: MouseEvent, description = false) => {
  if (isLocked.value || (isExpandedForm.value && e?.type === 'dblclick') || isExpandedBulkUpdateForm.value) return

  if (!isForm.value && isUIAllowed('fieldEdit') && !isMobileMode.value && (isColumnEditAllowed.value || description)) {
    if (description) {
      enableDescription.value = true
    }
    editColumnDropdown.value = true
  }
}

const openDropDown = (e: Event) => {
  if (isLocked.value) return

  if (isForm.value || (!isUIAllowed('fieldEdit') && !isMobileMode.value)) return

  e.preventDefault()
  e.stopPropagation()

  isDropDownOpen.value = !isDropDownOpen.value
}

const onVisibleChange = () => {
  editColumnDropdown.value = true
  if (!editOrAddProviderRef.value?.shouldKeepModalOpen()) {
    editColumnDropdown.value = false
    enableDescription.value = false
  }
}

const onClick = (e: Event) => {
  if (isMobileMode.value || !isUIAllowed('fieldEdit') || isLocked.value) return

  if (isDropDownOpen.value) {
    e.preventDefault()
    e.stopPropagation()
  } else {
    if (isExpandedForm.value && !editColumnDropdown.value && !isExpandedBulkUpdateForm.value) {
      isDropDownOpen.value = true
      return
    }
  }

  isDropDownOpen.value = false
}
</script>

<template>
  <div
    class="flex items-center w-full text-xs text-gray-500 font-weight-medium group"
    :class="{
      'h-full': column,
      'flex-col !items-start justify-center pt-0.5': isExpandedForm && !isMobileMode && !isExpandedBulkUpdateForm,
      'nc-cell-expanded-form-header cursor-pointer hover:bg-gray-100':
        isExpandedForm && !isMobileMode && isUIAllowed('fieldEdit') && !isExpandedBulkUpdateForm,
      'bg-gray-100': isExpandedForm && !isExpandedBulkUpdateForm ? editColumnDropdown || isDropDownOpen : false,
    }"
    @dblclick="openHeaderMenu($event, false)"
    @click.right="openDropDown"
    @click="onClick"
  >
    <div
      class="nc-cell-name-wrapper flex-1 flex items-center"
      :class="{
        'max-w-[calc(100%_-_23px)]': !isExpandedForm && !column.description?.length,
        'max-w-[calc(100%_-_44px)]': !isExpandedForm && column.description?.length,
        'max-w-full': isExpandedForm && !isExpandedBulkUpdateForm,
      }"
    >
      <template v-if="column && !props.hideIcon">
        <NcTooltip
          v-if="isGrid"
          class="flex items-center"
          placement="bottom"
          :disabled="isExpandedForm && !isExpandedBulkUpdateForm ? editColumnDropdown || isDropDownOpen : false"
        >
          <template #title> {{ columnTypeName }} </template>
          <SmartsheetHeaderCellIcon
            :class="{
              'self-start': isForm || isSurveyForm,
            }"
          />
        </NcTooltip>
        <SmartsheetHeaderCellIcon
          v-else
          :class="{
            'self-start': isForm || isSurveyForm,
          }"
        />
      </template>
      <NcTooltip
        v-if="column"
        :class="{
          'cursor-pointer': !isForm && isUIAllowed('fieldEdit') && !hideMenu,
          'cursor-default': isForm || !isUIAllowed('fieldEdit') || hideMenu,
          'truncate': !isForm,
        }"
        class="name pl-1 max-w-full"
        placement="bottom"
        show-on-truncate-only
        :disabled="isExpandedForm && !isExpandedBulkUpdateForm ? editColumnDropdown || isDropDownOpen : false"
      >
        <template #title> {{ column.title }} </template>

        <span
          :data-test-id="column.title"
          :class="{
            'select-none': isExpandedForm && !isExpandedBulkUpdateForm,
          }"
        >
          {{ column.title }}
        </span>
      </NcTooltip>

      <span v-if="(column.rqd && !column.cdf) || required" class="text-red-500">&nbsp;*</span>

      <GeneralIcon
        v-if="isExpandedForm && !isExpandedBulkUpdateForm && !isMobileMode && isUIAllowed('fieldEdit') && !isLocked"
        icon="arrowDown"
        class="flex-none cursor-pointer ml-1 group-hover:visible w-4 h-4"
        :class="{
          visible: editColumnDropdown || isDropDownOpen,
          invisible: !(editColumnDropdown || isDropDownOpen),
        }"
      />
    </div>
    <NcTooltip v-if="column.description?.length && isPublic && isGrid && !isExpandedForm && !hideMenu">
      <template #title>
        {{ column.description }}
      </template>
      <GeneralIcon icon="info" class="group-hover:opacity-100 !w-3.5 !h-3.5 !text-gray-500 flex-none" />
    </NcTooltip>

    <template v-if="!hideMenu">
      <div v-if="!isExpandedForm" class="flex-1" />
      <LazySmartsheetHeaderMenu
        v-if="!isForm && isUIAllowed('fieldEdit')"
        v-model:is-open="isDropDownOpen"
        :is-hidden-col="isHiddenCol"
        @add-column="addField"
        @edit="openHeaderMenu"
      />
    </template>

    <a-dropdown
      v-model:visible="editColumnDropdown"
      class="h-full"
      :trigger="['click']"
      :placement="isExpandedForm && !isExpandedBulkUpdateForm ? 'bottomLeft' : 'bottomRight'"
      :overlay-class-name="`nc-dropdown-edit-column ${editColumnDropdown ? 'active' : ''}`"
      @visible-change="onVisibleChange"
    >
      <div v-if="isExpandedForm && !isExpandedBulkUpdateForm" class="h-[1px]" @dblclick.stop>&nbsp;</div>
      <div v-else />

      <template #overlay>
        <div class="nc-edit-or-add-provider-wrapper">
          <LazySmartsheetColumnEditOrAddProvider
            v-if="editColumnDropdown"
            ref="editOrAddProviderRef"
            :column="columnOrder ? null : column"
            :column-position="columnOrder"
            class="w-full"
            :edit-description="enableDescription"
            @submit="closeAddColumnDropdown"
            @cancel="closeAddColumnDropdown"
            @click.stop
            @keydown.stop
          />
        </div>
      </template>
    </a-dropdown>
  </div>
</template>

<style scoped>
.name {
  max-width: calc(100% - 10px);
  word-break: break-word;
  white-space: pre-line;
}
</style>
