<script lang="ts" setup>
import { RelationTypes, UITypes, isVirtualCol } from 'nocodb-sdk'
import { computed, useSharedFormStoreOrThrow, useStepper } from '#imports'

const { v$, formState, formColumns } = useSharedFormStoreOrThrow()

function isRequired(_columnObj: Record<string, any>, required = false) {
  let columnObj = _columnObj
  if (
    columnObj.uidt === UITypes.LinkToAnotherRecord &&
    columnObj.colOptions &&
    columnObj.colOptions.type === RelationTypes.BELONGS_TO
  ) {
    columnObj = formColumns.value?.find((c) => c.id === columnObj.colOptions.fk_child_column_id) as Record<string, any>
  }

  return !!(required || (columnObj && columnObj.rqd && !columnObj.cdf))
}

const steps = computed(() => {
  if (!formColumns.value) return []
  return formColumns.value.reduce((acc, column) => {
    acc.push((column as any).label || column.title)

    return acc
  }, [] as string[])
})

const { index, goToPrevious, goToNext, isFirst, isLast } = useStepper(steps)

const field = computed(() => formColumns.value?.[index.value])
</script>

<template>
  <div
    class="bg-white relative flex flex-col justify-center gap-2 w-full lg:max-w-1/2 max-w-500px m-auto px-8 py-4 md:(rounded-lg border-1 border-gray-200 shadow-xl)"
  >
    <div v-if="field" class="flex flex-col my-6 gap-2">
      <div class="flex nc-form-column-label">
        <SmartsheetHeaderVirtualCell
          v-if="isVirtualCol(field)"
          :column="{ ...field, title: field.label || field.title }"
          :required="isRequired(field, field.required)"
          :hide-menu="true"
        />

        <SmartsheetHeaderCell
          v-else
          :column="{ ...field, title: field.label || field.title }"
          :required="isRequired(field, field.required)"
          :hide-menu="true"
        />
      </div>

      <div v-if="isVirtualCol(field)" class="mt-0">
        <SmartsheetVirtualCell
          class="mt-0 nc-input"
          :class="`nc-form-input-${field.title.replaceAll(' ', '')}`"
          :column="field"
        />

        <div v-if="field.description" class="text-gray-500 text-[10px] mb-2 ml-1">{{ field.description }}</div>

        <template v-if="v$.virtual.$dirty && v$.virtual?.[field.title]">
          <div v-for="error of v$.virtual[field.title].$errors" :key="error" class="text-xs text-red-500">
            {{ error.$message }}
          </div>
        </template>
      </div>

      <div v-else class="mt-0">
        <SmartsheetCell
          v-model="formState[field.title]"
          class="nc-input"
          :class="`nc-form-input-${field.title.replaceAll(' ', '')}`"
          :column="field"
          :edit-enabled="true"
        />

        <div v-if="field.description" class="text-gray-500 text-[10px] mb-2 ml-1">{{ field.description }}</div>

        <template v-if="v$.localState.$dirty && v$.localState?.[field.title]">
          <div v-for="error of v$.localState[field.title].$errors" :key="error" class="text-xs text-red-500">
            {{ error.$message }}
          </div>
        </template>
      </div>
    </div>

    <div v-if="!isFirst || !isLast" class="flex w-full text-lg">
      <a-tooltip v-if="!isFirst" title="Go to previous" :mouse-enter-delay="1" :mouse-leave-delay="0">
        <button class="group color-transition transform hover:scale-110" @click="goToPrevious">
          <MdiChevronLeft class="group-hover:text-accent" />
        </button>
      </a-tooltip>

      <div class="flex-1" />

      <a-tooltip v-if="!isLast" title="Go to next" :mouse-enter-delay="1" :mouse-leave-delay="0">
        <button class="group color-transition transform hover:scale-110" @click="goToNext">
          <MdiChevronRight class="group-hover:text-accent" />
        </button>
      </a-tooltip>
    </div>
  </div>
</template>
