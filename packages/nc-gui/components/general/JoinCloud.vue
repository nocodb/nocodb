<script lang="ts" setup></script>

<template>
  <div class="flex flex-row items-center w-full bg-white rounded-lg border-1 border-brand-500 shadow-sm mb-0.5 overflow-hidden">
    <a
      v-e="['c:navbar:join-cloud']"
      class="flex flex-grow !no-underline items-center justify-center border-r-1 h-full hover:bg-gray-100"
      href="https://app.nocodb.com/#/signin?utm_source=OSS&utm_medium=OSS&utm_campaign=OSS&utm_content=OSS"
    >
      <div class="px-1 text-gray-500 prose-sm" style="line-height: 1.3125rem">Try NocoDB Cloud</div>
    </a>
    <a-tooltip overlay-class-name="nc-join-cloud-tooltip">
      <template #title>
        <div class="w-72 bg-transparent overflow-hidden rounded-3xl shadow border border-zinc-100">
          <div class="p-6 bg-white flex-col justify-start items-center gap-4 inline-flex pb-7 w-full">
            <div class="self-stretch justify-start items-center gap-3 inline-flex">
              <div class="text-slate-800 text-lg font-semibold leading-9">NocoDB Cloud</div>
              <div class="px-2 py-1 bg-brand-50 rounded-lg justify-center items-center gap-2 flex">
                <div class="text-brand-500 text-sm font-medium leading-tight">Usage based</div>
              </div>
            </div>
            <div class="self-stretch justify-start items-center gap-2 inline-flex">
              <div class="text-gray-500 text-base font-bold line-through leading-normal">
                $ 99
                <span class="font-thin text-gray-500"> Onwards </span>
              </div>
              <div class="text-neutral-900 text-4xl font-bold leading-10">Free</div>
            </div>
            <div class="self-stretch text-gray-500 text-base leading-normal">/ month / workspace</div>

            <a href="https://app.nocodb.com/#/signin" target="_blank" class="!no-underline" rel="noopener">
              <NcButton class="text-gray-700 text-base font-semibold leading-tight py-4 w-full">Start for Free</NcButton>
            </a>
            <div class="self-stretch text-center text-gray-500 text-xs font-medium leading-none mb-4">
              No credit card required
            </div>
            <div class="flex flex-col items-start w-full">
              <div class="self-stretch text-gray-500 text-base font-semibold leading-tight mb-2">Includes</div>
              <div class="self-stretch justify-between items-center inline-flex">
                <div class="justify-end items-center gap-3 flex">
                  <GeneralIcon icon="check" class="text-brand-500" />
                  <div class="text-brand-500 text-lg font-bold leading-normal">20 Users</div>
                </div>
              </div>
            </div>
            <div class="self-stretch justify-between items-center inline-flex">
              <div class="justify-start items-center gap-3 flex">
                <GeneralIcon icon="check" class="text-brand-500" />

                <div class="text-slate-800 text-sm font-semibold leading-tight">300k rows / workspace</div>
              </div>
            </div>
            <div class="self-stretch justify-between items-center inline-flex">
              <div class="justify-start items-center gap-3 flex">
                <GeneralIcon icon="check" class="text-brand-500" />

                <div class="text-slate-800 text-sm font-semibold leading-tight">25 GB+ storage</div>
              </div>
            </div>
            <div class="self-stretch justify-between items-center inline-flex">
              <div class="justify-start items-center gap-3 flex">
                <GeneralIcon icon="check" class="text-brand-500" />

                <div class="text-slate-800 text-sm font-semibold leading-tight">APIs : 10+ requests / second</div>
              </div>
            </div>
            <div class="self-stretch justify-start items-center gap-3 inline-flex">
              <GeneralIcon icon="check" class="text-brand-500" />

              <div class="text-slate-800 text-sm font-semibold leading-tight">Support for External Database</div>
            </div>
          </div>
        </div>
      </template>
      <NcButton type="text" size="small" class="!rounded-l-none !rounded-r-lg">
        <GeneralIcon icon="help" class="!text-lg -mt-0.5 text-gray-700" />
      </NcButton>
    </a-tooltip>
  </div>
</template>

<style lang="scss">
.nc-join-cloud-tooltip {
  .ant-tooltip-inner {
    @apply !bg-transparent !p-0 !text-gray-700 rounded-3xl;
  }
  .ant-tooltip-arrow-content {
    @apply !bg-white;
  }
}
</style>
