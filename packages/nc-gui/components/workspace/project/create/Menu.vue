<script lang="ts" setup>
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
  (e: 'onSelect', mode: NcBaseCreateMode): void
}>()

const vVisible = useVModel(props, 'visible', emits)

const baseCreateMode = useVModel(props, 'baseCreateMode', emits)

const workspaceStore = useWorkspace()

const { navigateToTemplates } = workspaceStore

const { isTemplatesFeatureEnabled } = storeToRefs(workspaceStore)

const { isAiFeaturesEnabled } = useNocoAi()

const onClickOption = (mode: NcBaseCreateMode) => {
  if (isTemplatesFeatureEnabled.value && mode === NcBaseCreateMode.FROM_TEMPLATE) {
    vVisible.value = false
    navigateToTemplates()

    return
  }

  baseCreateMode.value = mode
}

onMounted(() => {
  if (!isAiFeaturesEnabled.value && props.variant === 'modal') {
    baseCreateMode.value = NcBaseCreateMode.FROM_SCRATCH
  }
})
</script>

<template>
  <NcMenu v-if="variant === 'dropdown'" variant="large" data-testid="nc-home-create-new-menu" @click="vVisible = false">
    <DashboardTreeViewCreateProjectMenuItem
      v-e="['c:base:create:scratch']"
      icon="plus"
      label="From Scratch"
      subtext="Start with an empty base"
      @click="onClickOption(NcBaseCreateMode.FROM_SCRATCH)"
    />

    <DashboardTreeViewCreateProjectMenuItem
      v-if="isAiFeaturesEnabled"
      v-e="['c:base:ai:create']"
      icon="ncAutoAwesome"
      label="Build with AI"
      subtext="Pre-built structures for common use cases"
      @click="onClickOption(NcBaseCreateMode.BUILD_WITH_AI)"
    />
  </NcMenu>
  <div v-else class="flex flex-row gap-6 flex-wrap max-w-[min(80vw,738px)] children:(!w-[230px] !max-w-[230px])">
    <ProjectActionItem
      v-e="['c:base:create:scratch']"
      icon="plus"
      label="From Scratch"
      subtext="Start with an empty base"
      @click="onClickOption(NcBaseCreateMode.FROM_SCRATCH)"
    />

    <ProjectActionItem
      v-if="isAiFeaturesEnabled"
      v-e="['c:base:ai:create']"
      icon="ncAutoAwesome"
      label="Build with AI"
      subtext="Pre-built structures for common use cases"
      @click="onClickOption(NcBaseCreateMode.BUILD_WITH_AI)"
    />
  </div>
</template>
