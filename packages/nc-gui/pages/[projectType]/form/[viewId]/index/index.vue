<script lang="ts" setup>
import { RelationTypes, UITypes, isVirtualCol } from 'nocodb-sdk'
import { useSharedFormStoreOrThrow } from '#imports'

const { sharedFormView, submitForm, v$, formState, notFound, formColumns, submitted, secondsRemain, isLoading } =
  useSharedFormStoreOrThrow()

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
</script>

<template>
  <div class="h-full flex flex-col items-center">
    <div
      class="color-transition relative flex flex-col justify-center gap-2 w-full max-w-[max(33%,600px)] m-auto py-4 pb-8 px-16 md:(bg-white dark:bg-slate-700 rounded-lg border-1 border-gray-200 shadow-xl)"
    >
      <template v-if="sharedFormView">
        <h1 class="prose-2xl font-bold self-center my-4">{{ sharedFormView.heading }}</h1>

        <h2 v-if="sharedFormView.subheading" class="prose-lg text-slate-500 dark:text-slate-300 self-center mb-4 leading-6">
          {{ sharedFormView.subheading }}
        </h2>

        <a-alert v-if="notFound" type="warning" class="my-4 text-center" message="Not found" />

        <template v-else-if="submitted">
          <div class="flex justify-center">
            <div v-if="sharedFormView" class="min-w-350px mt-3">
              <a-alert
                type="success"
                class="my-4 text-center"
                outlined
                :message="sharedFormView.success_msg || 'Successfully submitted form data'"
              />

              <p v-if="sharedFormView.show_blank_form" class="text-xs text-slate-500 dark:text-slate-300 text-center my-4">
                New form will be loaded after {{ secondsRemain }} seconds
              </p>

              <div v-if="sharedFormView.submit_another_form" class="text-center">
                <a-button type="primary" @click="submitted = false"> Submit Another Form</a-button>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <GeneralOverlay class="bg-gray-400/75" :model-value="isLoading" inline transition>
            <div class="w-full h-full flex items-center justify-center">
              <a-spin size="large" />
            </div>
          </GeneralOverlay>

          <div class="nc-form-wrapper">
            <div class="nc-form h-full">
              <div class="flex flex-col gap-6">
                <div v-for="(field, index) in formColumns" :key="index" class="flex flex-col gap-2">
                  <div class="flex nc-form-column-label">
                    <LazySmartsheetHeaderVirtualCell
                      v-if="isVirtualCol(field)"
                      :column="{ ...field, title: field.label || field.title }"
                      :required="isRequired(field, field.required)"
                      :hide-menu="true"
                    />

                    <LazySmartsheetHeaderCell
                      v-else
                      :column="{ ...field, title: field.label || field.title }"
                      :required="isRequired(field, field.required)"
                      :hide-menu="true"
                    />
                  </div>

                  <div>
                    <LazySmartsheetVirtualCell
                      v-if="isVirtualCol(field)"
                      class="mt-0 nc-input"
                      :data-testid="`nc-form-input-cell-${field.label || field.title}`"
                      :class="`nc-form-input-${field.title.replaceAll(' ', '')}`"
                      :column="field"
                    />

                    <LazySmartsheetCell
                      v-else
                      v-model="formState[field.title]"
                      class="nc-input"
                      :data-testid="`nc-form-input-cell-${field.label || field.title}`"
                      :class="`nc-form-input-${field.title.replaceAll(' ', '')}`"
                      :column="field"
                      :edit-enabled="true"
                    />

                    <div class="flex flex-col gap-2 text-slate-500 dark:text-slate-300 text-[0.75rem] my-2 px-1">
                      <div v-for="error of v$.localState[field.title]?.$errors" :key="error" class="text-red-500">
                        {{ error.$message }}
                      </div>

                      {{ field.description }}
                    </div>
                  </div>
                </div>
              </div>

              <div class="text-center mt-4">
                <button
                  type="submit"
                  class="uppercase scaling-btn prose-sm"
                  data-testid="shared-form-submit-button"
                  @click="submitForm"
                >
                  {{ $t('general.submit') }}
                </button>
              </div>
            </div>
          </div>
        </template>
      </template>
    </div>

    <div class="flex items-end">
      <GeneralPoweredBy />
    </div>
  </div>
</template>
