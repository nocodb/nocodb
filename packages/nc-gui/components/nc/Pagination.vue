<script setup lang="ts">
const props = defineProps<{
  current: number
  total: number
  pageSize: number
  entityName?: string
  mode: 'simple' | 'full'
}>()

const emits = defineEmits(['update:current', 'update:pageSize'])

const { total } = toRefs(props)

const current = useVModel(props, 'current', emits)

const pageSize = useVModel(props, 'pageSize', emits)

const entityName = computed(() => props.entityName || 'item')

const totalPages = computed(() => Math.max(Math.ceil(total.value / pageSize.value), 1))

const { isMobileMode } = useGlobal()

const mode = computed(() => props.mode || (isMobileMode.value ? 'simple' : 'full'))

const changePage = ({ increase }: { increase: boolean }) => {
  if (increase && current.value < totalPages.value) {
    current.value = current.value + 1
  } else if (current.value > 0) {
    current.value = current.value - 1
  }
}

const goToLastPage = () => {
  current.value = totalPages.value
}

const goToFirstPage = () => {
  current.value = 1
}
</script>

<template>
  <div class="nc-pagination flex flex-row items-center gap-x-2">
    <NcButton
      v-if="mode === 'full'"
      v-e="[`a:pagination:${entityName}:first-page`]"
      class="first-page"
      type="secondary"
      size="small"
      :disabled="current === 1"
      @click="goToFirstPage"
    >
      <GeneralIcon icon="doubleLeftArrow" />
    </NcButton>

    <NcButton
      v-e="[`a:pagination:${entityName}:prev-page`]"
      class="prev-page"
      type="secondary"
      size="small"
      :disabled="current === 1"
      @click="changePage({ increase: false })"
    >
      <GeneralIcon icon="arrowLeft" />
    </NcButton>
    <div class="text-gray-600">
      <span class="active"> {{ current }} </span>
      <span class="mx-1"> {{ mode !== 'full' ? '/' : 'of' }} </span>
      <span class="total">
        {{ totalPages }}
      </span>
    </div>

    <NcButton
      v-e="[`a:pagination:${entityName}:next-page`]"
      class="next-page"
      type="secondary"
      size="small"
      :disabled="current === totalPages"
      @click="changePage({ increase: true })"
    >
      <GeneralIcon icon="arrowRight" />
    </NcButton>

    <NcButton
      v-if="mode === 'full'"
      v-e="[`a:pagination:${entityName}:last-page`]"
      class="last-page"
      type="secondary"
      size="small"
      :disabled="current === totalPages"
      @click="goToLastPage"
    >
      <GeneralIcon icon="doubleRightArrow" />
    </NcButton>
  </div>
</template>
