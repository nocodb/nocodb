<script lang="ts" setup>
interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue'])

const meta = inject(MetaInj)

const vModel = useVModel(props, 'modelValue', emits)

const selectedView = inject(ActiveViewInj)
</script>

<template>
  <a-modal
    v-model:visible="vModel"
    :class="{ active: vModel }"
    size="small"
    :footer="null"
    width="max(900px,60vw)"
    :closable="false"
    wrap-class-name="erd-single-table-modal"
    transition-name="fade"
    :destroy-on-close="true"
  >
    <div class="flex justify-between w-full items-start px-[24px] pt-6 pb-4 border-b-1">
      <div class="select-none text-slate-500 font-semibold">
        {{ `${$t('title.erdView')}: ${selectedView?.title}` }}
      </div>

      <div class="flex h-full items-center justify-center rounded group" @click="vModel = false">
        <MdiClose class="cursor-pointer mt-1 nc-modal-close group-hover:text-accent text-opacity-100" />
      </div>
    </div>

    <div class="w-full h-70vh">
      <LazyErdView :table="meta" />
    </div>
  </a-modal>
</template>

<style>
.erd-single-table-modal {
  .ant-modal {
    @apply !top-[50px];
  }
  .ant-modal-body {
    @apply !p-0;
  }
}
</style>
