<script lang="ts" setup>
interface Props {
  modelValue: string | null | undefined
}

const props = defineProps<Props>()

const rowHeight = inject(RowHeightInj, ref(undefined))

const readOnly = inject(ReadonlyInj, ref(false))

const emailHref = computed(() => getEmailHref(props.modelValue))
</script>

<template>
  <nuxt-link
    v-if="emailHref"
    no-ref
    class="py-1 underline inline-block nc-cell-field-link max-w-full relative z-3"
    :href="emailHref"
    target="_blank"
    :tabindex="readOnly ? -1 : 0"
  >
    <LazyCellClampedText :value="modelValue" :lines="rowHeight" class="nc-cell-field" />
  </nuxt-link>

  <LazyCellClampedText v-else :value="modelValue" :lines="rowHeight" class="nc-cell-field" />
</template>
