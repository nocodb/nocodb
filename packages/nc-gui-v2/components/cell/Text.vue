<script setup lang="ts">
import { inject, ref, useVModel } from '#imports'
import { EditModeInj } from '~/context'

interface Props {
  modelValue: string
}

const props = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const editEnabled = inject(EditModeInj, ref(false))

const vModel = useVModel(props, 'modelValue', emit)

const focus = (el: HTMLInputElement) => el.focus()
</script>

<template>
  <input v-if="editEnabled" :ref="focus" v-model="vModel" />
  <span v-else>{{ vModel }}</span>
</template>

<style scoped>
input,
textarea {
  width: 100%;
  height: 100%;
  color: var(--v-textColor-base);
  outline: none;
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
