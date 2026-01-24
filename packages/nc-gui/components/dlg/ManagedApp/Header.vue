<script lang="ts" setup>
interface Props {
  visible: boolean
  iconClass?: string
  title?: string
  subTitle?: string
  titleClass?: string
  subTitleClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  iconClass: '',
  titleClass: '',
  subTitleClass: '',
})

const emits = defineEmits(['update:visible'])

const { title, subTitle } = toRefs(props)

const vVisible = useVModel(props, 'visible', emits)
</script>

<template>
  <div class="p-4 w-full flex items-center gap-3 border-b border-nc-border-gray-medium">
    <div class="nc-dlg-managed-app-icon" :class="iconClass">
      <slot name="icon">
        <GeneralIcon icon="ncBox" class="h-5 w-5" />
      </slot>
    </div>
    <div class="flex-1">
      <div class="font-semibold text-lg text-nc-content-gray-emphasis" :class="titleClass">
        <slot name="title">
          {{ title }}
        </slot>
      </div>
      <div v-if="$slots.subTitle || subTitle" class="text-xs text-nc-content-gray-subtle2" :class="subTitleClass">
        <slot name="subTitle">
          {{ subTitle }}
        </slot>
      </div>
    </div>

    <slot name="rightExtra"> </slot>

    <slot name="closeButton">
      <NcButton size="small" type="text" class="self-start" @click="vVisible = false">
        <GeneralIcon icon="close" class="text-nc-content-gray-subtle2" />
      </NcButton>
    </slot>
  </div>
</template>

<style lang="scss" scoped>
.nc-dlg-managed-app-icon {
  @apply w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm;
  background: linear-gradient(135deg, var(--nc-content-brand) 0%, var(--nc-content-blue-medium) 100%);
  box-shadow: 0 2px 4px rgba(51, 102, 255, 0.15);
}
</style>
