<script setup lang="ts">
import type { Permission } from '~/composables/useUIPermission/rolePermissions'
import { computed, inject } from '#imports'
import { MetaInj } from '~/context'

const state = useGlobal()

const { isUIAllowed } = useUIPermission()

const formState = reactive({
  heading: '',
  subheading: '',
  submitAnotherForm: false,
  showBlankForm: false,
  emailMe: false,
  successMsg: '',
})

const isEditable = isUIAllowed('editFormView' as Permission)

const meta = inject(MetaInj)

const columns = computed(() => meta?.value?.columns || [])

const hiddenColumns = computed(() => [])

function addAllColumns() {}

function removeAllColumns() {}

function updateView() {}

function submitForm() {}
</script>

<template>
  <a-row class="h-full flex">
    <a-col v-if="isEditable" :span="6" class="bg-[#f7f7f7] shadow-md pa-5">
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
      TODO: Draggable
    </a-col>
    <a-col :span="isEditable ? 18 : 24">
      <a-card class="px-10 py-20 h-full">
        <a-form :model="formState" class="bg-[#fefefe]">
          <!-- Header -->
          <div class="pb-2">
            <a-form-item class="ma-0 gap-0 pa-0">
              <a-input
                v-model:value="formState.heading"
                class="w-full text-bold text-h3 cursor-pointer"
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
              class="w-full cursor-pointer"
              size="large"
              hide-details
              :placeholder="$t('msg.info.formDesc')"
              :bordered="false"
              @click="updateView"
            />
          </a-form-item>
        </a-form>

        <!-- TODO: Draggable Columns -->

        <div class="justify-center flex">
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
        <a-textarea v-model="formState.successMsg" rows="3" hide-details @input="updateView" />

        <!-- Other options -->
        <div class="mt-4">
          <div class="my-4">
            <!-- Show "Submit Another Form" button -->
            <a-switch v-model:checked="formState.submitAnotherForm" v-t="[`a:form-view:submit-another-form`]" />
            <span class="ml-4">{{ $t('msg.info.submitAnotherForm') }}</span>
          </div>

          <div class="my-4">
            <!-- Show a blank form after 5 seconds -->
            <a-switch v-model:checked="formState.showBlankForm" v-t="[`a:form-view:show-blank-form`]" />
            <span class="ml-4">{{ $t('msg.info.showBlankForm') }}</span>
          </div>

          <div class="my-4">
            <a-switch v-model:checked="formState.emailMe" v-t="[`a:form-view:email-me`]" />
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
