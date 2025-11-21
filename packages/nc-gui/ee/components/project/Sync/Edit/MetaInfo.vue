<script setup lang="ts">
import dayjs from 'dayjs'
import { useSyncFormOrThrow } from '../useSyncForm'

const { syncConfigForm } = useSyncFormOrThrow()

const showUserInfo = false
</script>

<template>
  <div class="text-nc-content-gray text-captionBold font-semibold">
    {{ $t('title.additionalDetails') }}
  </div>

  <div class="flex items-center justify-between mt-3">
    <div class="text-nc-content-gray text-bodyDefaultSmBold font-semibold">
      {{ $t('labels.createdOn') }}
    </div>
    <div class="text-nc-content-gray-subtle2 text-bodyDefaultSm">
      {{ dayjs(syncConfigForm.created_at).format('DD MMMM YYYY') }}
    </div>
  </div>

  <div v-if="syncConfigForm.updated_at" class="flex items-center justify-between mt-3">
    <div class="text-nc-content-gray text-bodyDefaultSmBold font-semibold">
      {{ $t('labels.lastModified') }}
    </div>
    <div class="text-nc-content-gray-subtle2 text-bodyDefaultSm">
      {{ dayjs(syncConfigForm.updated_at).format('DD MMMM YYYY') }}
    </div>
  </div>

  <template v-if="showUserInfo">
    <div class="flex items-center justify-between mt-3">
      <div class="text-nc-content-gray text-bodyDefaultSmBold font-semibold">
        {{ $t('labels.createdBy') }}
      </div>

      <div class="text-nc-content-gray-subtle2 text-bodyDefaultSm">
        <!-- Todo:  -->
        -
      </div>
    </div>
    <div class="flex items-center justify-between mt-3">
      <div class="text-nc-content-gray text-bodyDefaultSmBold font-semibold">
        {{ $t('labels.lastModifiedBy') }}
      </div>

      <div class="text-nc-content-gray-subtle2 text-bodyDefaultSm">
        <!-- Todo:  -->
        -
      </div>
    </div>
  </template>
</template>
