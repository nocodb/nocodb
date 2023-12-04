<script lang="ts" setup></script>

<template>
  <div class="flex flex-row items-center w-full bg-white rounded-lg border-1 shadow-sm mb-0.5 overflow-hidden">
    <a
      v-e="['c:navbar:join-cloud']"
      class="flex flex-grow !no-underline items-center justify-center border-r-1 h-full hover:bg-gray-100"
      href="https://app.nocodb.com/#/signin?utm_source=OSS&utm_medium=OSS&utm_campaign=OSS&utm_content=OSS"
    >
      <div class="px-1 font-semibold text-gray-700 prose-sm" style="line-height: 1.3125rem">
        {{ $t('labels.joinCloudForFree') }}
      </div>
    </a>
    <a-tooltip overlay-class-name="nc-join-cloud-tooltip">
      <template #title>
        <div class="w-68 bg-transparent overflow-hidden rounded-3xl shadow border border-zinc-100">
          <div class="p-6 bg-white flex-col justify-start items-center gap-4 inline-flex pb-7">
            <div class="self-stretch justify-start items-center gap-3 inline-flex">
              <div class="text-slate-800 text-2xl font-bold leading-9">Business</div>
              <div class="px-2 py-1 bg-brand-50 rounded-lg justify-center items-center gap-2 flex">
                <div class="text-brand-500 text-sm font-medium leading-tight">Usage based</div>
              </div>
            </div>
            <div class="self-stretch justify-start items-center gap-2 inline-flex">
              <div class="text-gray-500 text-base font-bold leading-normal">$</div>
              <div class="text-gray-500 text-base font-bold line-through leading-normal">99 Onwards</div>
              <div class="text-neutral-900 text-4xl font-bold leading-10">Free</div>
            </div>
            <div class="self-stretch text-gray-500 text-base font-bold leading-normal">/ month / workspace</div>
            <div
              class="self-stretch px-4 bg-white rounded-lg shadow border border-gray-200 justify-center items-center gap-2 inline-flex"
            >
              <div class="text-gray-700 text-sm font-semibold leading-tight">Start for Free</div>
            </div>
            <div class="self-stretch text-center text-gray-500 text-xs font-medium leading-none">No credit card required</div>
            <div class="self-stretch opacity-0 text-center text-gray-500 text-xs font-medium leading-none">
              No credit card required
            </div>
            <div class="self-stretch text-slate-600 text-sm font-semibold leading-tight">Everything in Team plus:</div>
            <div class="self-stretch justify-between items-center inline-flex">
              <div class="justify-end items-center gap-3 flex">
                <GeneralIcon icon="check" class="text-brand-500" />
                <div class="text-brand-500 text-lg font-bold leading-normal">20 Users Included</div>
              </div>
            </div>
            <div class="self-stretch justify-between items-center inline-flex">
              <div class="justify-start items-center gap-3 flex">
                <GeneralIcon icon="check" class="text-brand-500" />

                <div class="text-slate-800 text-sm font-semibold leading-tight">300k + rows/workspace</div>
              </div>
            </div>
            <div class="self-stretch justify-between items-center inline-flex">
              <div class="justify-start items-center gap-3 flex">
                <GeneralIcon icon="check" class="text-brand-500" />

                <div class="text-slate-800 text-sm font-semibold leading-tight">25 GB + storage</div>
              </div>
            </div>
            <div class="self-stretch justify-between items-center inline-flex">
              <div class="justify-start items-center gap-3 flex">
                <GeneralIcon icon="check" class="text-brand-500" />

                <div class="text-slate-800 text-sm font-semibold leading-tight">APIs - 10+ Requests/second</div>
              </div>
            </div>
            <div class="self-stretch justify-start items-center gap-3 inline-flex">
              <GeneralIcon icon="check" class="text-brand-500" />

              <div class="text-slate-800 text-sm font-semibold leading-tight">Support for External Database</div>
            </div>
            <div class="self-stretch justify-start items-center gap-3 inline-flex">
              <GeneralIcon icon="check" class="text-brand-500" />

              <div class="text-slate-800 text-sm font-semibold leading-tight">Folders for views</div>
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
