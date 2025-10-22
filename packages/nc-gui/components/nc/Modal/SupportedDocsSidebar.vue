<template>
  <div class="w-[320px] h-full p-5 bg-nc-bg-gray-extralight">
    <slot />
    <slot name="divider">
      <NcDivider class="!my-4" />
    </slot>
  </div>
</template>
