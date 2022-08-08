<script lang="ts" setup>
import { computed, inject } from '#imports'
import { ColumnInj, EditModeInj } from '~/context'

interface Props {
  modelValue: string | null
}

const { modelValue } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const column = inject(ColumnInj)
const isForm = inject<boolean>('isForm', false)
const editEnabled = inject(EditModeInj, ref(false))

const options = computed(() => column?.value?.dtxp?.split(',').map((v) => v.replace(/\\'/g, "'").replace(/^'|'$/g, '')) || [])

const localState = computed({
  get() {
    return modelValue?.match(/(?:[^',]|\\')+(?='?(?:,|$))/g)?.map((v: string) => v.replace(/\\'/g, "'"))
  },
  set(val?: string[]) {
    emit('update:modelValue', val?.filter((v) => options.value.includes(v)).join(','))
  },
})
</script>

<template>
  <!--
  <v-select
    v-model="localState"
    :items="options"
    hide-details
    :clearable="!column.rqd"
    variation="outlined"
    multiple
  />
-->

  <v-combobox
    v-model="localState"
    :items="options"
    multiple
    chips
    flat
    dense
    solo
    hide-details
    deletable-chips
    class="text-center mt-0"
  >
    <!--    <template #selection="data"> -->
    <!--      <v-chip -->
    <!--        :key="data.item" -->
    <!--        small -->
    <!--        class="ma-1 " -->
    <!--        :color="colors[setValues.indexOf(data.item) % colors.length]" -->
    <!--        @click:close="data.parent.selectItem(data.item)" -->
    <!--      > -->
    <!--        {{ data.item }} -->
    <!--      </v-chip> -->
    <!--    </template> -->

    <!--    <template #item="{item}"> -->
    <!--      <v-chip small :color="colors[setValues.indexOf(item) % colors.length]"> -->
    <!--        {{ item }} -->
    <!--      </v-chip> -->
    <!--    </template> -->
    <!--    <template #append> -->
    <!--      <v-icon small class="mt-2"> -->
    <!--        mdi-menu-down -->
    <!--      </v-icon> -->
    <!--    </template> -->
  </v-combobox>
</template>

<style scoped></style>
