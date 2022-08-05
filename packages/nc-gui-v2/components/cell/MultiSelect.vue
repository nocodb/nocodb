<script lang="ts" setup>
import type { SelectOptionType } from '~~/../nocodb-sdk/build/main/index.js'
import { computed, inject } from '#imports'
import { ColumnInj } from '~/context'

interface Props {
  modelValue: string | string[] | undefined
}

const { modelValue } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { isMysql } = useProject()

const column = inject(ColumnInj)

const options = computed(() => {
  if (column?.colOptions) {
    const opts = column.colOptions ? column.colOptions.options.filter((el: SelectOptionType) => el.title !== '') || [] : []
    for (const op of opts.filter((el: SelectOptionType) => el.order === null)) {
      op.title = op.title.replace(/^'/, '').replace(/'$/, '')
    }
    return opts
  }
  return []
})

const vModel = computed({
  get: () =>
    modelValue
      ? typeof modelValue === 'string'
        ? isMysql
          ? modelValue.split(',').sort((a, b) => {
              const opa = options.value.find((el: SelectOptionType) => el.title === a)
              const opb = options.value.find((el: SelectOptionType) => el.title === b)
              return opa.order - opb.order
            })
          : modelValue.split(',')
        : modelValue
      : [],
  set: (val) => emit('update:modelValue', val.join(',')),
})
</script>

<template>
  <a-select
    v-model:value="vModel"
    mode="multiple"
    class="w-full"
    placeholder="Select an option"
    :bordered="false"
    show-arrow
    :show-search="false"
  >
    <a-select-option v-for="op of options" :key="op.title" style="cursor: pointer">
      <a-tag class="rounded-tag" :color="op.color">
        <span class="text-slate-500">{{ op.title }}</span>
      </a-tag>
    </a-select-option>
    <template #tagRender="{ value: val, label, onClose }">
      <a-tag class="rounded-tag" :color="label[0].props.color" :closable="true" @close="onClose">
        <span class="text-slate-500">{{ val }}</span>
      </a-tag>
    </template>
  </a-select>
</template>

<style scoped>
.rounded-tag {
  padding: 0px 12px;
  border-radius: 12px;
}
:deep(.ant-tag) {
  @apply "rounded-tag";
}
:deep(.ant-tag-close-icon) {
  @apply "text-slate-500";
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
