<script setup lang="ts">
import { RelationTypes, UITypes, isVirtualCol } from 'nocodb-sdk'
import { useSharedFormStoreOrThrow } from '#imports'

const { sharedView, submitForm, v$, formState, notFound, formColumns, submitted, secondsRemain } = useSharedFormStoreOrThrow()

function isRequired(_columnObj: Record<string, any>, required = false) {
  let columnObj = _columnObj
  if (
    columnObj.uidt === UITypes.LinkToAnotherRecord &&
    columnObj.colOptions &&
    columnObj.colOptions.type === RelationTypes.BELONGS_TO
  ) {
    columnObj = formColumns.value.find((c: Record<string, any>) => c.id === columnObj.colOptions.fk_child_column_id) as Record<
      string,
      any
    >
  }

  return required || (columnObj && columnObj.rqd && !columnObj.cdf)
}
</script>

<template>
  <div class="bg-primary/100 !h-[100vh] overflow-auto w-100 flex flex-col">
    <div>
      <img src="~/assets/img/icons/512x512-trans.png" width="30" class="mx-4 mt-2" />
    </div>
    <div class="m-4 mt-2 bg-white rounded p-2 flex-1">
      <a-alert v-if="notFound" type="warning" class="mx-auto mt-10 max-w-[300px]" message="Not found"> </a-alert>

      <template v-else-if="submitted">
        <div class="flex justify-center">
          <div v-if="sharedView" style="min-width: 350px" class="mt-3">
            <a-alert type="success" outlined :message="sharedView.success_msg || 'Successfully submitted form data'"> </a-alert>
            <p v-if="sharedView.show_blank_form" class="text-xs text-gray-500 text-center">
              New form will be loaded after {{ secondsRemain }} seconds
            </p>
            <div v-if="sharedView.submit_another_form" class="text-center">
              <a-button color="primary" @click="submitted = false"> Submit Another Form</a-button>
            </div>
          </div>
        </div>
      </template>
      <div v-else-if="sharedView" class="">
        <a-row class="justify-center">
          <a-col :md="20">
            <div>
              <div class="h-full ma-0 rounded-b-0">
                <div
                  class="nc-form-wrapper pb-10 rounded shadow-xl"
                  style="background: linear-gradient(180deg, #dbdbdb 0, #dbdbdb 200px, white 200px)"
                >
                  <div class="mt-10 flex items-center justify-center flex-col">
                    <div class="nc-form-banner backgroundColor darken-1 flex-column justify-center d-flex">
                      <div class="flex items-center justify-center grow h-[100px]">
                        <img src="~/assets/img/icon.png" width="50" class="mx-4" />
                        <span class="text-4xl font-weight-bold">NocoDB</span>
                      </div>
                    </div>
                  </div>

                  <div class="mx-auto nc-form bg-white shadow-lg pa-2 mb-10 max-w-[600px] mx-auto rounded">
                    <h2 class="mt-4 text-4xl font-weight-bold text-left mx-4 mb-3 px-1">
                      {{ sharedView.view.heading }}
                    </h2>

                    <div class="text-lg text-left mx-4 py-2 px-1 text-gray-500">
                      {{ sharedView.view.subheading }}
                    </div>
                    <div class="h-100">
                      <div v-for="(field, index) in formColumns" :key="index" class="flex flex-col mt-4 px-4 space-y-2">
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
                        <div v-if="isVirtualCol(field)" class="mt-0">
                          <SmartsheetVirtualCell class="mt-0 nc-input" :column="field" />
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
                            :column="field"
                            :edit-enabled="true"
                          />
                          <template v-if="v$.localState.$dirty && v$.localState?.[field.title]">
                            <div v-for="error of v$.localState[field.title].$errors" :key="error" class="text-xs text-red-500">
                              {{ error.$message }}
                            </div>
                          </template>
                        </div>
                      </div>

                      <div class="text-center my-9">
                        <a-button type="primary" size="large" @click="submitForm(formState, additionalState)"> Submit</a-button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </a-col>
        </a-row>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-input {
  @apply w-full !bg-white rounded px-2 py-2 min-h-[40px] mt-2 mb-2 flex align-center border-solid border-1 border-primary;
}

.nc-form-wrapper {
  @apply my-0 mx-auto max-w-[800px];
}
</style>
