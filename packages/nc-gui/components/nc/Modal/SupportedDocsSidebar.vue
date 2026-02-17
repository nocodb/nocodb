<template>
  <div class="w-[320px] h-full flex-none p-5 bg-nc-bg-gray-extralight border-l-1 border-nc-border-gray-medium">
    <slot />
    <slot name="divider">
      <NcDivider class="!my-4" />
    </slot>
  </div>
</template>
