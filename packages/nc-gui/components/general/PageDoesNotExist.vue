<template>
  <div class="nc-h-screen grid place-items-center text-center">
    <div class="flex flex-col items-center gap-6">
      <slot name="icon">
        <img width="48" alt="NocoDB" src="~/assets/img/icons/256x256.png" />
      </slot>

      <div class="text-xl text-nc-content-gray font-bold">
        <slot name="title">
          {{ $t('title.thisPageDoesNotExist') }}
        </slot>
      </div>
      <NcButton @click="navigateTo('/')"> Home</NcButton>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
