<script lang="ts" setup>
import { NcMenu } from '#components'
interface Props {
  visible: boolean
  variant: 'modal' | 'dropdown'
  baseCreateMode: NcBaseCreateMode | null
  workspaceId?: string
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

const { workspaceId } = toRefs(props)

const workspaceStore = useWorkspace()

const { navigateToTemplates } = workspaceStore

const { isTemplatesFeatureEnabled } = storeToRefs(workspaceStore)

const wsBaseListActions = useWsBaseListActions()

const { isFeatureEnabled } = useBetaFeatureToggle()

const { showEEFeatures, isEEFeatureBlocked } = useEeConfig()

const { isAiFeaturesEnabled } = useNocoAi()

const onClickOption = (mode: NcBaseCreateMode) => {
  if (isTemplatesFeatureEnabled.value && mode === NcBaseCreateMode.FROM_TEMPLATE) {
    vVisible.value = false
    navigateToTemplates(workspaceId.value)

    if (wsBaseListActions) {
      wsBaseListActions.closeModal()
    }

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
  <component
    :is="variant === 'modal' ? 'div' : NcMenu"
    variant="large"
    :class="{
      'py-1 flex flex-col gap-0.5': variant === 'modal',
    }"
    data-testid="nc-base-create-menu"
    @click="vVisible = false"
  >
    <NcMenuItemLabel v-if="variant === 'modal'" class="!py-2" @click.stop> CREATE BASE </NcMenuItemLabel>
    <WorkspaceProjectCreateMenuItem
      v-e="['c:base:create:scratch']"
      :variant="variant"
      icon="plus"
      label="From Scratch"
      subtext="Start with an empty base"
      data-testid="nc-menu-from-scratch"
      @click="onClickOption(NcBaseCreateMode.FROM_SCRATCH)"
    />

    <WorkspaceProjectCreateMenuItem
      v-if="isTemplatesFeatureEnabled && showEEFeatures && !isEEFeatureBlocked"
      v-e="['c:base:template:create']"
      :variant="variant"
      icon="globe"
      label="From Template"
      subtext="Pre-built structures for common use cases"
      data-testid="nc-menu-from-template"
      @click="onClickOption(NcBaseCreateMode.FROM_TEMPLATE)"
    />

    <WorkspaceProjectCreateMenuItem
      v-if="isAiFeaturesEnabled && showEEFeatures && !isEEFeatureBlocked"
      v-e="['c:base:ai:create']"
      :variant="variant"
      icon="ncAutoAwesome"
      label="Build with AI"
      subtext="AI-powered base creation from your use case"
      data-testid="nc-menu-build-with-ai"
      @click="onClickOption(NcBaseCreateMode.BUILD_WITH_AI)"
    />

    <template v-if="isFeatureEnabled(FEATURE_FLAG.MANAGED_APPS) && showEEFeatures && !isEEFeatureBlocked">
      <WorkspaceProjectCreateMenuItem
        v-e="['c:base:market:create']"
        :variant="variant"
        icon="ncBox"
        label="From App Store"
        subtext="Install apps built by the community"
        data-testid="nc-menu-from-app-store"
        @click="onClickOption(NcBaseCreateMode.FROM_APP_STORE)"
      />

      <NcDivider />

      <WorkspaceProjectCreateMenuItem
        v-e="['c:base:managedApp:create']"
        :variant="variant"
        icon="ncBox"
        label="Managed App"
        subtext="Build and publish to the App Store"
        data-testid="nc-menu-managed-app"
        @click="onClickOption(NcBaseCreateMode.MANAGED_APP)"
      />
    </template>
  </component>
</template>
