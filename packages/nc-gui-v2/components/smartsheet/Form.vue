<script setup lang="ts">
import { computed, inject } from '#imports'
import { MetaInj } from '~/context'

// TODO: get editEnabled
const editEnabled = ref(true)

const meta = inject(MetaInj)

const columns = computed(() => meta?.value?.columns || [])

const hiddenColumns = computed(() => [])

function addAllColumns() {}

function removeAllColumns() {}
</script>

<template>
  <a-row class="h-full">
    <a-col v-if="editEnabled" :span="6" class="bg-[#f7f7f7] shadow-md pa-5">
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
    <a-col :span="editEnabled ? 18 : 24"> TODO: Form </a-col>
  </a-row>
</template>

<style scoped lang="scss"></style>
