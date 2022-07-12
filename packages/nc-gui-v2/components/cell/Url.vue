<script setup lang="ts">
import { ref, computed } from '#imports'
import { ColumnInj } from '~/components'
import { isValidURL } from '~/utils/urlUtils'

const column = inject(ColumnInj)
const editEnabled = inject<boolean>('editEnabled')

interface Props {
  modelValue: string
}

const { modelValue: value } = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const localState = computed({
  get: () => value,
  set: (val) => {
    if (!(column && column.meta && column.meta.validate) || isValidURL(val)) {
      emit('update:modelValue', val)
    }
  },
})

const isValid = computed(() => value && isValidURL(value))

const root = ref<HTMLInputElement>()
onMounted(() => {
  root.value?.focus()
})
</script>

<template>
  <span v-if="editEnabled">
    <input ref="root" v-model="localState" />
  </span>
  <span v-else>
    <a class="caption py-2 text-primary underline hover:opacity-75" v-if="isValid" :href="value" target="_blank">{{ value }}</a>
    <span v-else>{{ value }}</span>
  </span>
</template>

<style scoped></style>

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
