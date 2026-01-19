<script lang="ts" setup>
import { NcMenu } from "#components"
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

const { isFeatureEnabled } = useBetaFeatureToggle()

const { isAiFeaturesEnabled } = useNocoAi()

const onClickOption = (mode: NcBaseCreateMode) => {
    if (isTemplatesFeatureEnabled.value && mode === NcBaseCreateMode.FROM_TEMPLATE) {
        vVisible.value = false
        navigateToTemplates()

        return
    }

    // Temp do nothing
    if ([NcBaseCreateMode.SANDBOX_APP].includes(mode)) {
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
    <component :is="variant === 'modal' ? 'div' : NcMenu" variant="large" :class="{
        'py-1 flex flex-col gap-0.5': variant === 'modal'
    }" data-testid="nc-home-create-new-menu" @click="vVisible = false">
        <NcMenuItemLabel v-if="variant === 'modal'" class="!py-2" @click.stop>
            CREATE BASE
        </NcMenuItemLabel>
        <DashboardTreeViewCreateProjectMenuItem v-e="['c:base:create:scratch']" :variant="variant" icon="plus"
            label="From Scratch" subtext="Start with an empty base"
            @click="onClickOption(NcBaseCreateMode.FROM_SCRATCH)" />

        <DashboardTreeViewCreateProjectMenuItem v-if="isTemplatesFeatureEnabled" v-e="['c:base:template:create']"
            :variant="variant" icon="globe" label="From Template" subtext="Pre-built structures for common use cases"
            @click="onClickOption(NcBaseCreateMode.FROM_TEMPLATE)" />

        <DashboardTreeViewCreateProjectMenuItem v-if="isAiFeaturesEnabled" v-e="['c:base:ai:create']" :variant="variant"
            icon="ncAutoAwesome" label="Build with AI" subtext="Pre-built structures for common use cases"
            @click="onClickOption(NcBaseCreateMode.BUILD_WITH_AI)" />

        <template v-if="isFeatureEnabled(FEATURE_FLAG.SANDBOXES)">
            <DashboardTreeViewCreateProjectMenuItem v-e="['c:base:market:create']" :variant="variant" icon="ncBox"
                label="From App Store" subtext="Install apps built by the community"
                @click="onClickOption(NcBaseCreateMode.FROM_APP_STORE)" />

            <NcDivider />

            <DashboardTreeViewCreateProjectMenuItem v-e="['c:base:managed:create']" :variant="variant" icon="ncBox"
                label="Managed App" subtext="Build and publish to the App Store"
                @click="onClickOption(NcBaseCreateMode.MANAGED_APP)" />

            <DashboardTreeViewCreateProjectMenuItem v-e="['c:base:sandbox:create']" :variant="variant" icon="ncBox"
                label="Sandbox App" subtext="Safely test changes on an existing app"
                @click="onClickOption(NcBaseCreateMode.SANDBOX_APP)">
                <template #label>
                    <div class="flex items-center gap-2">
                        Sandbox App
                        <NcBadgeBeta class="!text-nc-content-brand-disabled !bg-nc-bg-brand" />
                    </div>
                </template>
            </DashboardTreeViewCreateProjectMenuItem>

        </template>
    </component>

    <!-- Todo: confirm design - same as base overview cards -->
    <!-- <div v-else class="flex flex-row gap-6 flex-wrap max-w-[min(80vw,738px)] children:(!w-[230px] !max-w-[230px])">
        <ProjectActionItem v-e="['c:base:create:scratch']" icon="plus" label="From Scratch"
            subtext="Start with an empty base" @click="onClickOption(NcBaseCreateMode.FROM_SCRATCH)" />

        <ProjectActionItem v-if="isTemplatesFeatureEnabled" v-e="['c:base:template:create']" icon="globe"
            label="From Template" subtext="Pre-built structures for common use cases"
            @click="onClickOption(NcBaseCreateMode.FROM_TEMPLATE)" />


        <ProjectActionItem v-if="isAiFeaturesEnabled" v-e="['c:base:ai:create']" icon="ncAutoAwesome"
            label="Build with AI" subtext="Pre-built structures for common use cases"
            @click="onClickOption(NcBaseCreateMode.BUILD_WITH_AI)" />

        <template v-if="isFeatureEnabled(FEATURE_FLAG.SANDBOXES)">
            <ProjectActionItem v-e="['c:base:market:create']" icon="ncBox" label="From App Store"
                subtext="Install apps built by the community" @click="onClickOption(NcBaseCreateMode.FROM_APP_STORE)" />

            <ProjectActionItem v-e="['c:base:managed:create']" icon="ncBox" label="Managed App"
                subtext="Build and publish to the App Store" @click="onClickOption(NcBaseCreateMode.MANAGED_APP)" />

            <ProjectActionItem v-e="['c:base:sandbox:create']" icon="ncBox" label="Sandbox App"
                subtext="Safely test changes on an existing app" @click="onClickOption(NcBaseCreateMode.SANDBOX_APP)" />

        </template>
    </div> -->
</template>

<style scoped lang="scss">
.nc-content-wrapper {
    .nc-content-subtitle {
        @apply text-tiny !leading-4 text-nc-content-gray-muted;
    }
}

.nc-menu-item-integration {
    .nc-integration-icon-wrapper {
        @apply flex items-center justify-center children:flex-none w-6;
    }

    .nc-integration-icon {
        transition: fill 0.2s ease;
    }

    &:not(:hover) {
        .nc-integration-icon {
            @apply text-nc-content-gray-muted;

            & * {
                fill: currentColor !important;
            }
        }
    }
}
</style>

<style lang="scss">
.nc-menu-item-combo {
    @apply !pr-1;
}

.nc-sub-menu-item-icon-only {
    @apply !mx-0 -my-1;

    .ant-dropdown-menu-submenu-title {
        @apply !px-0 !w-8 children:w-8 flex items-center !justify-center;
    }
}
</style>