<script lang="ts" setup>
import MonacoJsonObjectEditor from '@/components/monaco/Editor.vue'
import { computed, inject } from '#imports'
import { EditModeInj } from '~/context'

interface Props {
  modelValue: string | Record<string, any>
  isForm: boolean
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue', 'cancel'])

const editEnabled = inject(EditModeInj)

let expand = $ref(false)

let isValid = $ref(true)

let error = $ref()

const vModel = computed({
  get: () => (typeof props.modelValue === 'string' ? JSON.parse(props.modelValue) : props.modelValue),
  set: (val) => {
    if (props.isForm) {
      emits('update:modelValue', JSON.stringify(val))
    }
  },
})

function save() {
  expand = false
  emits('update:modelValue', JSON.stringify(vModel.value))
}

function validate(n: boolean, e: any) {
  isValid = n
  error = e
}
</script>

<script lang="ts">
export default {
  name: 'JsonEditableCell',
}
</script>

<template>
  <v-dialog :is="expand ? 'v-dialog' : 'div'" v-model="expand" max-width="800px" class="cell-container" @keydown.stop.enter>
    <div class="d-flex pa-1" :class="{ backgroundColor: expand }">
      <v-spacer />
      <v-icon small class="mr-2" @click="expand = !expand">
        {{ expand ? 'mdi-arrow-collapse' : 'mdi-arrow-expand' }}
      </v-icon>
      <template v-if="!isForm">
        <v-btn outlined x-small class="mr-1" @click="$emit('cancel')">
          <!-- Cancel -->
          {{ $t('general.cancel') }}
        </v-btn>
        <v-btn x-small color="primary" :disabled="!isValid" @click="save">
          <!-- Save -->
          {{ $t('general.save') }}
        </v-btn>
      </template>
      <v-btn v-else-if="expand" x-small @click="expand = false">
        <!-- Close -->
        {{ $t('general.close') }}
      </v-btn>
    </div>
    <MonacoJsonObjectEditor
      v-if="expand"
      v-model="vModel"
      class="text-left caption"
      style="width: 300px; min-height: min(600px, 80vh); min-width: 100%"
      @validate="validate"
    />
    <MonacoJsonObjectEditor
      v-else
      v-model="vModel"
      class="text-left caption"
      style="width: 300px; min-height: 200px; min-width: 100%"
      @validate="validate"
    />
    <div v-show="error" class="px-2 py-1 text-left caption error--text">
      {{ error }}
    </div>
  </v-dialog>
</template>

<style scoped>
.cell-container {
  width: 100%;
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
