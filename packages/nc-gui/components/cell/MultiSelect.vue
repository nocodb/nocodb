<script lang="ts" setup>
import type { Select as AntSelect } from 'ant-design-vue'
import type { SelectOptionsType } from 'nocodb-sdk'
import {
  ActiveCellInj,
  ColumnInj,
  ReadonlyInj,
  computed,
  h,
  inject,
  onMounted,
  ref,
  useEventListener,
  useProject,
  watch,
} from '#imports'
import MdiCloseCircle from '~icons/mdi/close-circle'

interface Props {
  modelValue?: string | string[]
}

const { modelValue } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { isMysql } = useProject()

const column = inject(ColumnInj)!

const readOnly = inject(ReadonlyInj)!

const active = inject(ActiveCellInj, ref(false))

const selectedIds = ref<string[]>([])

const aselect = ref<typeof AntSelect>()

const isOpen = ref(false)

const options = computed<SelectOptionsType[]>(() => {
  if (column?.value.colOptions) {
    const opts = column.value.colOptions
      ? (column.value.colOptions as any).options.filter((el: any) => el.title !== '') || []
      : []
    for (const op of opts.filter((el: any) => el.order === null)) {
      op.title = op.title.replace(/^'/, '').replace(/'$/, '')
    }
    return opts
  }
  return []
})

const vModel = computed({
  get: () => selectedIds.value.map((el) => options.value.find((op) => op.id === el)?.title),
  set: (val) => emit('update:modelValue', val.length === 0 ? null : val.join(',')),
})

const selectedTitles = computed(() =>
  modelValue
    ? typeof modelValue === 'string'
      ? isMysql
        ? modelValue.split(',').sort((a, b) => {
            const opa = options.value.find((el) => el.title === a)
            const opb = options.value.find((el) => el.title === b)
            if (opa && opb) {
              return opa.order! - opb.order!
            }
            return 0
          })
        : modelValue.split(',')
      : modelValue
    : [],
)

const handleKeys = (e: KeyboardEvent) => {
  switch (e.key) {
    case 'Escape':
      e.preventDefault()
      isOpen.value = false
      break
    case 'Enter':
      e.stopPropagation()
      break
  }
}

const handleClose = (e: MouseEvent) => {
  if (aselect.value && !aselect.value.$el.contains(e.target)) {
    isOpen.value = false
  }
}

onMounted(() => {
  selectedIds.value = selectedTitles.value.flatMap((el) => {
    const item = options.value.find((op) => op.title === el)?.id
    if (item) {
      return [item]
    }

    return []
  })
})

useEventListener(document, 'click', handleClose)

watch(
  () => modelValue,
  () => {
    selectedIds.value = selectedIds.value = selectedTitles.value.flatMap((el) => {
      const item = options.value.find((op) => op.title === el)?.id
      if (item) {
        return [item]
      }

      return []
    })
  },
)

watch(isOpen, (n, _o) => {
  if (!n) aselect.value?.$el.blur()
})
</script>

<template>
  <a-select
    ref="aselect"
    v-model:value="vModel"
    mode="multiple"
    class="w-full"
    :bordered="false"
    :show-arrow="!readOnly"
    :show-search="false"
    :open="isOpen"
    :disabled="readOnly"
    dropdown-class-name="nc-dropdown-multi-select-cell"
    @keydown="handleKeys"
    @click="isOpen = !isOpen"
  >
    <a-select-option v-for="op of options" :key="op.id" :value="op.title" @click.stop>
      <a-tag class="rounded-tag" :color="op.color">
        <span class="text-slate-500">{{ op.title }}</span>
      </a-tag>
    </a-select-option>

    <template #tagRender="{ value: val, onClose }">
      <a-tag
        v-if="options.find((el) => el.title === val)"
        class="rounded-tag"
        :style="{ display: 'flex', alignItems: 'center' }"
        :color="options.find((el) => el.title === val).color"
        :closable="active && (vModel.length > 1 || !column?.rqd)"
        :close-icon="h(MdiCloseCircle, { class: ['ms-close-icon'] })"
        @close="onClose"
      >
        <span class="w-full text-slate-500">{{ val }}</span>
      </a-tag>
    </template>
  </a-select>
</template>

<style scoped>
.ms-close-icon {
  color: rgba(0, 0, 0, 0.25);
  cursor: pointer;
  display: flex;
  font-size: 12px;
  font-style: normal;
  height: 12px;
  line-height: 1;
  text-align: center;
  text-transform: none;
  transition: color 0.3s ease, opacity 0.15s ease;
  width: 12px;
  z-index: 1;
  margin-right: -6px;
  margin-left: 3px;
}
.ms-close-icon:before {
  display: block;
}
.ms-close-icon:hover {
  color: rgba(0, 0, 0, 0.45);
}
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

:deep(.ant-select-selection-overflow-item) {
  @apply "flex overflow-hidden";
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
