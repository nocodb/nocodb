<script setup lang="ts">
import type { ColumnReqType, ColumnType } from 'nocodb-sdk'
import { ColumnInj, IsExpandedFormOpenInj, IsFormInj, IsKanbanInj, inject, provide, ref, toRef, useRoles } from '#imports'

interface Props {
  column: ColumnType
  required?: boolean | number
  hideMenu?: boolean
  hideIcon?: boolean
}

const props = defineProps<Props>()

const { isMobileMode } = useGlobal()

const hideMenu = toRef(props, 'hideMenu')

const isForm = inject(IsFormInj, ref(false))

const isSurveyForm = inject(IsSurveyFormInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

const isDropDownOpen = ref(false)

const isKanban = inject(IsKanbanInj, ref(false))

const column = toRef(props, 'column')

const { isUIAllowed } = useRoles()

provide(ColumnInj, column)

const editColumnDropdown = ref(false)

const columnOrder = ref<Pick<ColumnReqType, 'column_order'> | null>(null)

const addField = async (payload: any) => {
  columnOrder.value = payload
  editColumnDropdown.value = true
}

const closeAddColumnDropdown = () => {
  columnOrder.value = null
  editColumnDropdown.value = false
}

const openHeaderMenu = () => {
  if (!isForm.value && !isExpandedForm.value && isUIAllowed('fieldEdit') && !isMobileMode.value) {
    editColumnDropdown.value = true
  }
}

const openDropDown = (e: Event) => {
  if (isForm.value || isExpandedForm.value || (!isUIAllowed('fieldEdit') && !isMobileMode.value)) return

  e.preventDefault()
  e.stopPropagation()

  isDropDownOpen.value = !isDropDownOpen.value
}

const onClick = (e: Event) => {
  if (isDropDownOpen.value) {
    e.preventDefault()
    e.stopPropagation()
  }

  isDropDownOpen.value = false
}
</script>

<template>
  <div
    class="flex items-center w-full text-xs text-gray-500 font-weight-medium"
    :class="{ 'h-full': column, '!text-gray-400': isKanban }"
    @dblclick="openHeaderMenu"
    @click.right="openDropDown"
    @click="onClick"
  >
    <SmartsheetHeaderCellIcon
      v-if="column && !props.hideIcon"
      :class="{
        'self-start': isForm || isSurveyForm,
      }"
    />
    <div
      v-if="column"
      class="name pl-1"
      :class="{
        'cursor-pointer pt-0.25': !isForm && isUIAllowed('fieldEdit') && !hideMenu && !isExpandedForm,
        'cursor-default': isForm || !isUIAllowed('fieldEdit') || hideMenu,
        '!truncate': !isForm,
      }"
      :data-test-id="column.title"
    >
      {{ column.title }}
    </div>

    <span v-if="(column.rqd && !column.cdf) || required" class="text-red-500">&nbsp;*</span>

    <template v-if="!hideMenu">
      <div class="flex-1" />
      <LazySmartsheetHeaderMenu
        v-if="!isForm && !isExpandedForm && isUIAllowed('fieldEdit')"
        v-model:is-open="isDropDownOpen"
        @add-column="addField"
        @edit="openHeaderMenu"
      />
    </template>

    <a-dropdown
      v-model:visible="editColumnDropdown"
      class="h-full"
      :trigger="['click']"
      placement="bottomRight"
      overlay-class-name="nc-dropdown-edit-column"
    >
      <div />

      <template #overlay>
        <SmartsheetColumnEditOrAddProvider
          v-if="editColumnDropdown"
          :column="columnOrder ? null : column"
          :column-position="columnOrder"
          class="w-full"
          @submit="closeAddColumnDropdown"
          @cancel="closeAddColumnDropdown"
          @click.stop
          @keydown.stop
        />
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
