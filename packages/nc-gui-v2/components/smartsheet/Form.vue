<script setup lang="ts">
import type { Permission } from '~/composables/useUIPermission/rolePermissions'
import { computed, inject } from '#imports'
import { MetaInj } from '~/context'

const { isUIAllowed } = useUIPermission()

const formState = reactive({
  heading: 'TestForm1',
  subheading: '',
})

const isEditable = isUIAllowed('editFormView' as Permission)

const meta = inject(MetaInj)

const columns = computed(() => meta?.value?.columns || [])

const hiddenColumns = computed(() => [])

function addAllColumns() {}

function removeAllColumns() {}

function updateView() {}
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
      </a-card>
    </a-col>
  </a-row>
</template>

<style scoped lang="scss"></style>
