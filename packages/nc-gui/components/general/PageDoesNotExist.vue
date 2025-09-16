<script setup lang="ts">
defineProps<{ title?: string; subtitle?: string; containerClass?: string; actionButtonClass?: string }>()
</script>

<template>
  <div class="nc-h-screen grid place-items-center text-center">
    <div class="flex flex-col items-center gap-5 mx-4" :class="containerClass">
      <slot name="icon">
        <img width="48" alt="NocoDB" src="~/assets/img/icons/256x256.png" />
      </slot>

      <div class="text-xl text-nc-content-gray font-bold">
        <slot name="title">
          {{ $t('title.thisPageDoesNotExist') }}
        </slot>
      </div>
      <div class="text-xl text-nc-content-gray-subtle">
        <slot name="subtitle"> {{ $t('title.thisPageDoesNotExistSubtile') }} </slot>
      </div>

      <slot name="actions">
        <NcButton class="!text-base" :class="actionButtonClass" @click="navigateTo('/')">{{
          $t('activity.goBackHome')
        }}</NcButton>
      </slot>
    </div>
  </div>
</template>
