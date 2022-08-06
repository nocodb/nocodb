<script setup lang="ts">
import Draggable from 'vuedraggable'
import type { ColumnType } from 'nocodb-sdk'
import { useToast } from 'vue-toastification'
import type { Permission } from '~/composables/useUIPermission/rolePermissions'
import { computed, inject } from '#imports'
import { ActiveViewInj, FieldsInj, MetaInj } from '~/context'
import { extractSdkResponseErrorMsg } from '~/utils'
import MdiPlusIcon from '~icons/mdi/plus'
import MdiDragIcon from '~icons/mdi/drag-vertical'

const toast = useToast()

const state = useGlobal()

const { $api } = useNuxtApp()

const { isUIAllowed } = useUIPermission()

const formState = reactive({
  heading: '',
  subheading: '',
  submit_another_form: false,
  show_blank_form: false,
  email: false,
  success_msg: '',
})

const isEditable = isUIAllowed('editFormView' as Permission)

const meta = inject(MetaInj)

const view = inject(ActiveViewInj)

const { loadData, paginationData, formattedData: data, loadFormData, formData, changePage } = useViewData(meta, view as any)

const columns = computed(() => meta?.value?.columns || [])

const hiddenColumns = computed(() => [])

const filteredColumns = computed(() => [])

const fields = inject(FieldsInj, ref([]))

const formView = ref({})

function updateView() {}

function submitForm() {}

function isDbRequired() {}

async function addAllColumns() {}

async function removeAllColumns() {}

async function checkSMTPStatus() {}

function setFormData() {
  Object.assign(formState, {
    heading: formData.value?.heading,
    subheading: formData.value?.subheading,
    submit_another_form: !!formData.value?.submit_another_form,
    show_blank_form: !!formData.value?.email,
    email: formData.value?.submit_another_form,
    success_msg: formData.value?.success_msg,
  })
}

onMounted(async () => {
  await loadFormData()
  setFormData()
})

// TODO: check if it's required
watch(
  () => formData,
  (v) => {
    setFormData()
  },
)
</script>

<template>
  <a-row class="h-full flex">
    <a-col v-if="isEditable" :span="6" class="bg-[#f7f7f7] shadow-md pa-5">
      {{ formState }}
      <div class="flex">
        <div class="flex flex-row flex-1 text-lg">
          <span>
            <!-- Fields -->
            {{ $t('objects.fields') }}
          </span>
        </div>
        <div class="flex flex-row">
          <div class="cursor-pointer mr-2">
            <span v-if="hiddenColumns.length" style="border-bottom: 2px solid rgb(218, 218, 218)" @click="addAllColumns()">
              <!-- Add all -->
              {{ $t('general.addAll') }}
            </span>
            <span v-if="columns.length" style="border-bottom: 2px solid rgb(218, 218, 218)" @click="removeAllColumns">
              <!-- Remove all -->
              {{ $t('general.removeAll') }}
            </span>
          </div>
        </div>
      </div>
      <draggable :list="hiddenColumns" item-key="title" handle=".nc-child-draggable-icon">
        <template #item="{ element, index }">
          <a-card size="small" class="ma-0 pa-0 cursor-pointer">
            <div class="flex">
              <div class="flex flex-row flex-1">
                <MdiDragIcon />
                <label class=""> TODO: column name </label>
              </div>
              <div class="flex flex-row">
                <MdiDragIcon class="flex flex-1" />
              </div>
            </div>
          </a-card>
        </template>
        <template #footer>
          <div class="mt-4 border-dashed border-2 border-gray-400 py-3 text-gray-400 text-center">
            <!-- Drag and drop fields here to hide -->
            {{ $t('msg.info.dragDropHide') }}
          </div>
          <a-button type="link" class="w-full caption mt-2" size="large" @click="addNewOption()">
            <div class="flex items-center prose-sm justify-center text-gray-400">
              <MdiPlusIcon />
              <!-- Add new field to this table -->
              {{ $t('activity.addField') }}
            </div>
          </a-button>
        </template>
      </draggable>
    </a-col>
    <a-col :span="isEditable ? 18 : 24">
      <a-card class="px-10 py-20 h-full">
        <a-form :model="formState" class="bg-[#fefefe]">
          <!-- Header -->
          <div class="pb-2">
            <a-form-item class="ma-0 gap-0 pa-0">
              <a-input
                v-model:value="formState.heading"
                class="w-full text-bold text-h3"
                size="large"
                hide-details
                placeholder="Form Title"
                :bordered="false"
                @blur="updateView()"
                @keydown.enter="updateView()"
              />
            </a-form-item>
          </div>
          <!-- Sub Header -->
          <a-form-item>
            <a-input
              v-model:value="formState.subheading"
              class="w-full"
              size="large"
              hide-details
              :placeholder="$t('msg.info.formDesc')"
              :bordered="false"
              @click="updateView"
            />
          </a-form-item>
        </a-form>

        <draggable :list="columns" item-key="title" handle=".nc-child-draggable-icon">
          <template #item="{ element, index }">
            <!-- TODO: render columns -->
          </template>
          <template #footer>
            <div v-if="!columns.length" class="mt-4 border-dashed border-2 border-gray-400 py-3 text-gray-400 text-center">
              Drag and drop fields here to add
            </div>
          </template>
        </draggable>

        <div class="justify-center flex mt-5">
          <a-button class="flex items-center gap-2 !bg-primary text-white rounded" size="large" @click="submitForm">
            <!-- Submit -->
            {{ $t('general.submit') }}
          </a-button>
        </div>

        <!-- After form is submitted -->
        <div class="text-gray-500 mt-10 mb-4">
          {{ $t('msg.info.afterFormSubmitted') }}
        </div>
        <!-- Show this message -->
        <label class="text-gray-600 text-bold"> {{ $t('msg.info.showMessage') }}: </label>
        <a-textarea v-model="formState.success_msg" rows="3" hide-details @input="updateView" />

        <!-- Other options -->
        <div class="mt-4">
          <div class="my-4">
            <!-- Show "Submit Another Form" button -->
            <a-switch v-model:checked="formState.submit_another_form" v-t="[`a:form-view:submit-another-form`]" />
            <span class="ml-4">{{ $t('msg.info.submitAnotherForm') }}</span>
          </div>

          <div class="my-4">
            <!-- Show a blank form after 5 seconds -->
            <a-switch v-model:checked="formState.show_blank_form" v-t="[`a:form-view:show-blank-form`]" />
            <span class="ml-4">{{ $t('msg.info.showBlankForm') }}</span>
          </div>

          <div class="my-4">
            <a-switch v-model:checked="formState.email" v-t="[`a:form-view:email-me`]" />
            <!-- Email me at <email> -->
            <span class="ml-4">
              {{ $t('msg.info.emailForm') }} <span class="text-bold text-gray-600">{{ state.user.value?.email }}</span>
            </span>
          </div>
        </div>
      </a-card>
    </a-col>
  </a-row>
</template>

<style scoped lang="scss"></style>
