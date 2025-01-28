<script lang="ts" setup>
interface Props {
  modelValue: string | null | undefined
}

const props = defineProps<Props>()

const rowHeight = inject(RowHeightInj, ref(undefined))

const readOnly = inject(ReadonlyInj, ref(false))

const validEmail = computed(() => props.modelValue && validateEmail(props.modelValue))
</script>

<template>
  <nuxt-link
    v-if="validEmail"
    no-ref
    class="py-1 underline inline-block nc-cell-field-link max-w-full relative z-3"
    :href="`mailto:${modelValue}`"
    target="_blank"
    :tabindex="readOnly ? -1 : 0"
  >
    <LazyCellClampedText :value="modelValue" :lines="rowHeight" class="nc-cell-field" />
  </nuxt-link>

  <LazyCellClampedText v-else :value="modelValue" :lines="rowHeight" class="nc-cell-field" />
</template>
