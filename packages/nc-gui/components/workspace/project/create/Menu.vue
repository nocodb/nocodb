<script lang="ts" setup>
import { NcMenu } from '#components'
interface Props {
  visible: boolean
  variant: 'modal' | 'dropdown'
  baseCreateMode: NcBaseCreateMode | null
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'dropdown',
})

const emits = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'update:baseCreateMode', value: NcBaseCreateMode | null): void
}>()

const vVisible = useVModel(props, 'visible', emits)

const baseCreateMode = useVModel(props, 'baseCreateMode', emits)

const { isAiFeaturesEnabled } = useNocoAi()

const onClickOption = (mode: NcBaseCreateMode) => {
  baseCreateMode.value = mode
}

onMounted(() => {
  if (!isAiFeaturesEnabled.value && props.variant === 'modal') {
    baseCreateMode.value = NcBaseCreateMode.FROM_SCRATCH
  }
})
</script>

<template>
  <component
    :is="variant === 'modal' ? 'div' : NcMenu"
    variant="large"
    :class="{
      'py-1 flex flex-col gap-0.5': variant === 'modal',
    }"
    data-testid="nc-home-create-new-menu"
    @click="vVisible = false"
  >
    <NcMenuItemLabel v-if="variant === 'modal'" class="!py-2" @click.stop> CREATE BASE </NcMenuItemLabel>
    <WorkspaceProjectCreateMenuItem
      v-e="['c:base:create:scratch']"
      :variant="variant"
      icon="plus"
      label="From Scratch"
      subtext="Start with an empty base"
      @click="onClickOption(NcBaseCreateMode.FROM_SCRATCH)"
    />

    <WorkspaceProjectCreateMenuItem
      v-if="isAiFeaturesEnabled"
      v-e="['c:base:ai:create']"
      :variant="variant"
      icon="ncAutoAwesome"
      label="Build with AI"
      subtext="Pre-built structures for common use cases"
      @click="onClickOption(NcBaseCreateMode.BUILD_WITH_AI)"
    />
  </component>
</template>
