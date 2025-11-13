<script setup lang="ts">
import dayjs from 'dayjs'
import { useSyncFormOrThrow } from '../useSyncForm'

const { syncConfigForm } = useSyncFormOrThrow()
</script>

<template>
  <div class="text-nc-content-gray-emphasis text-captionBold">Additional Details</div>

  <div v-if="syncConfigForm.updated_at" class="flex items-center justify-between mt-4">
    <div class="text-nc-content-gray-emphasis text-bodyDefaultSmBold">Last Modified</div>
    <div class="text-nc-content-gray-subtle2 text-bodyDefaultSm">
      {{ dayjs(syncConfigForm.updated_at).format('DD MMMM YYYY') }}
    </div>
  </div>

  <div class="flex items-center justify-between mt-4">
    <div class="text-nc-content-gray-emphasis text-bodyDefaultSmBold">Created On</div>
    <div class="text-nc-content-gray-subtle2 text-bodyDefaultSm">
      {{ dayjs(syncConfigForm.created_at).format('DD MMMM YYYY') }}
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
