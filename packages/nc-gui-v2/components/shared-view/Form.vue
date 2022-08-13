<script setup lang="ts">
import { RelationTypes, UITypes, isVirtualCol } from 'nocodb-sdk'
import { FieldsInj, MetaInj } from '~/context'

const fields = inject(FieldsInj, ref([]))
const meta = inject(MetaInj)
const { sharedView } = useSharedView()

const formState = ref(fields.value.reduce((a, v) => ({ ...a, [v.title]: undefined }), {}))

function isRequired(_columnObj: Record<string, any>, required = false) {
  let columnObj = _columnObj
  if (
    columnObj.uidt === UITypes.LinkToAnotherRecord &&
    columnObj.colOptions &&
    columnObj.colOptions.type === RelationTypes.BELONGS_TO
  ) {
    columnObj = fields.value.find((c: Record<string, any>) => c.id === columnObj.colOptions.fk_child_column_id) as Record<
      string,
      any
    >
  }

  return required || (columnObj && columnObj.rqd && !columnObj.cdf)
}

useSmartsheetStoreOrThrow()
useProvideSmartsheetRowStore(meta, formState)

const formRef = ref()

watch(
  () => formState,
  () => {
    console.log('formData', formState.value)
  },
)

console.log(fields)
</script>

<template>
  <div class="flex flex-col my-4 space-y-2 mx-32 items-center">
    <div class="flex w-2/3 flex-col mt-10">
      <div class="flex flex-col items-start px-14 py-8 bg-gray-50 rounded-md w-full">
        <a-typography-title class="border-b-1 border-gray-100 w-full pb-3" :level="1">{{
          sharedView.view.heading
        }}</a-typography-title>
        <a-typography class="pl-1 text-sm">{{ sharedView.view.subheading }}</a-typography>
      </div>

      <a-form ref="formRef" :model="formState" class="mt-8 pb-12 mb-8 px-3 bg-gray-50 rounded-md">
        <div v-for="(field, index) in fields" :key="index" class="flex flex-col mt-4 px-10 pt-6 space-y-2">
          <div class="flex">
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
          <a-form-item
            v-if="isVirtualCol(field)"
            class="ma-0 gap-0 pa-0"
            :name="field.title"
            :rules="[{ required: field.required, message: `${field.title} is required` }]"
          >
            <SmartsheetVirtualCell v-model="formState[field.title]" class="nc-input" :column="field" />
          </a-form-item>
          <a-form-item
            v-else
            class="ma-0 gap-0 pa-0"
            :name="field.title"
            :rules="[{ required: field.required, message: `${field.title} is required` }]"
          >
            <SmartsheetCell v-model="formState[field.title]" class="nc-input" :column="field" :edit-enabled="true" />
          </a-form-item>
        </div>
      </a-form>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-input {
  @apply w-full !bg-white rounded px-2 py-2 min-h-[40px] mt-2 mb-2 flex align-center border-solid border-1 border-primary;
}
</style>
