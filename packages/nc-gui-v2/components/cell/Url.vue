<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import { ColumnInj, ReadonlyInj, computed, inject, isValidURL } from '#imports'

interface Props {
  modelValue: string | null | undefined
}

const { modelValue: value } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const column = inject(ColumnInj)!

const editEnabled = inject(ReadonlyInj)

const vModel = computed({
  get: () => value,
  set: (val) => {
    if (!column.value.meta?.validate || (val && isValidURL(val))) {
      emit('update:modelValue', val)
    }
  },
})

const isValid = computed(() => value && isValidURL(value))

const url = computed<string | null>(() => {
  if (!value || !isValidURL(value)) return null
  /** add url scheme if missing */
  if (/^https?:\/\//.test(value)) return value
  return `https://${value}`
})

const focus: VNodeRef = (el) => (el as HTMLInputElement)?.focus()
</script>

<template>
  <input v-if="editEnabled" :ref="focus" v-model="vModel" class="outline-none text-sm" @blur="editEnabled = false" />
  <nuxt-link v-else-if="isValid" class="text-sm underline hover:opacity-75" :to="url" target="_blank">{{ value }} </nuxt-link>
  <span v-else>{{ value }}</span>
</template>

<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 * @author Wing-Kam Wong <wingkwong.code@gmail.com>
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
