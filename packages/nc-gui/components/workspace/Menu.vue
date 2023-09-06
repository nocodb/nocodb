<script lang="ts" setup></script>

<template>
  <div class="flex flex-row flex-grow pl-0.5 pr-1 py-0.5 rounded-md w-full" style="max-width: calc(100% - 2.5rem)">
    <div class="flex-grow min-w-20">
      <div
        data-testid="nc-workspace-menu"
        class="flex items-center nc-workspace-menu overflow-hidden py-1.25 pr-0.25 justify-center w-full"
      >
        <a
          class="w-10 min-w-10 transition-all duration-200 p-1 transform"
          href="https://github.com/nocodb/nocodb"
          target="_blank"
        >
          <img width="25" alt="NocoDB" src="~/assets/img/icons/256x256.png" />
        </a>

        <div class="font-semibold text-base">Nocodb</div>
        <div class="flex flex-grow"></div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-workspace-menu-item {
  @apply flex items-center pl-2 py-2 gap-2 text-sm hover:text-black;
}
</style>
