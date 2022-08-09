<script lang="ts" setup>
import type { SelectOptionType } from '~~/../nocodb-sdk/build/main/index.js'
import { computed, inject } from '#imports'
import { ActiveCellInj, ColumnInj } from '~/context'

interface Props {
  modelValue: string | undefined
}

const { modelValue } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const column = inject(ColumnInj)
// const isForm = inject<boolean>('isForm', false)
// const editEnabled = inject(EditModeInj, ref(false))
const active = inject(ActiveCellInj, ref(false))

const aselect = ref<any>(null)
const isOpen = ref(false)

const vModel = computed({
  get: () => modelValue,
  set: (val) => emit('update:modelValue', val || null),
})

const options = computed(() => {
  if (column?.value.colOptions) {
    const opts = column.value.colOptions
      ? column.value.colOptions.options.filter((el: SelectOptionType) => el.title !== '') || []
      : []
    for (const op of opts.filter((el: SelectOptionType) => el.order === null)) {
      op.title = op.title.replace(/^'/, '').replace(/'$/, '')
    }
    return opts
  }
  return []
})

const handleKeys = (e: any) => {
  switch (e.key) {
    case 'Escape':
      e.preventDefault()
      isOpen.value = false
      break
  }
}

const handleClose = (e: any) => {
  if (aselect.value) {
    const selectClick = aselect.value.$el.contains(e.target)
    if (!selectClick) {
      isOpen.value = false
      aselect.value.blur()
    }
  }
}

onMounted(() => {
  document.addEventListener('click', handleClose)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClose)
})

watch(
  () => isOpen.value,
  (n, _o) => {
    if (n === false) {
      aselect.value.blur()
    }
  },
)
</script>

<template>
  <a-select
    ref="aselect"
    v-model:value="vModel"
    class="w-full"
    :allow-clear="!column.rqd && active"
    placeholder="Select an option"
    :bordered="false"
    :open="isOpen"
    @select="isOpen = false"
    @keydown="handleKeys"
    @click="isOpen = !isOpen"
  >
    <a-select-option v-for="op of options" :key="op.title" @click.stop>
      <a-tag class="rounded-tag" :color="op.color">
        <span class="text-slate-500">{{ op.title }}</span>
      </a-tag>
    </a-select-option>
  </a-select>
</template>

<style scoped lang="scss">
.rounded-tag {
  padding: 0px 12px;
  border-radius: 12px;
}
:deep(.ant-tag) {
  @apply "rounded-tag";
}
:deep(.ant-select-clear) {
  opacity: 1;
}
</style>
<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
-->
