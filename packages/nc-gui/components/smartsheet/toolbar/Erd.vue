<script lang="ts" setup>
const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue'])

const meta = inject(MetaInj)

interface Props {
  modelValue: boolean
}

const vModel = useVModel(props, 'modelValue', emits)

const selectedView = inject(ActiveViewInj)
</script>

<template>
  <a-modal
    v-model:visible="vModel"
    size="small"
    :footer="null"
    width="max(900px,60vw)"
    :closable="false"
    wrap-class-name="erd-single-table-modal"
    transition-name="fade"
  >
    <div class="flex flex-row justify-between w-full items-center mb-1">
      <a-typography-title class="ml-4 select-none" type="secondary" :level="5">
        {{ `${$t('title.erdView')}: ${selectedView?.title}` }}
      </a-typography-title>

      <a-button type="text" class="!rounded-md border-none -mt-1.5 -mr-1" @click="vModel = false">
        <template #icon>
          <MdiClose class="cursor-pointer mt-1 nc-modal-close" />
        </template>
      </a-button>
    </div>

    <div class="w-full h-full !py-0 !px-2" style="height: 70vh">
      <LazyErdView :table="meta" />
    </div>
  </a-modal>
</template>
