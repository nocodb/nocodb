<script lang="ts" setup>

interface Props {
    label: string
    subtext?: string
    icon?: IconMapKey
}

withDefaults(defineProps<Props>(), {
})

</script>

<template>
    <NcMenuItem :inner-class="`w-full ${$slots.subtext || subtext ? '!items-start' : ''}`">
        <slot name="icon">
            <GeneralIcon v-if="icon" :icon="icon" class="h-4 w-4 flex-none" :class="{
                'mt-0.5': $slots.subtext || subtext
            }" />
        </slot>

        <div class="nc-content-wrapper">
            <div class="nc-content-label">
                <slot name="label">{{ label }}</slot>
            </div>
            <div v-if="$slots.subtext || subtext" class="nc-content-subtext">
                <slot name="subtext">{{ subtext }}</slot>
            </div>
        </div>
    </NcMenuItem>
</template>

<style lang="scss" scoped>
.nc-content-wrapper {
    .nc-content-subtext {
        @apply text-tiny !leading-4 text-nc-content-gray-muted;
    }
}
</style>