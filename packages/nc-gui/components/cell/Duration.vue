<script setup lang="ts">
import {
  ColumnInj,
  EditModeInj,
  computed,
  convertDurationToSeconds,
  convertMS2Duration,
  durationOptions,
  inject,
  ref,
} from '#imports'

interface Props {
  modelValue: number | string | null | undefined
}

const { modelValue } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const column = inject(ColumnInj)

const editEnabled = inject(EditModeInj)

const showWarningMessage = ref(false)

const durationInMS = ref(0)

const isEdited = ref(false)

const durationType = ref(column?.value?.meta?.duration || 0)

const durationPlaceholder = computed(() => durationOptions[durationType.value].title)

const localState = computed({
  get: () => convertMS2Duration(modelValue, durationType.value),
  set: (val) => {
    isEdited.value = true
    const res = convertDurationToSeconds(val, durationType.value)
    if (res._isValid) {
      durationInMS.value = res._sec
    }
  },
})

const checkDurationFormat = (evt: KeyboardEvent) => {
  evt = evt || window.event
  const charCode = evt.which ? evt.which : evt.keyCode
  // ref: http://www.columbia.edu/kermit/ascii.html
  const PRINTABLE_CTL_RANGE = charCode > 31
  const NON_DIGIT = charCode < 48 || charCode > 57
  const NON_COLON = charCode !== 58
  const NON_PERIOD = charCode !== 46
  if (PRINTABLE_CTL_RANGE && NON_DIGIT && NON_COLON && NON_PERIOD) {
    showWarningMessage.value = true
    evt.preventDefault()
  } else {
    showWarningMessage.value = false
    // only allow digits, '.' and ':' (without quotes)
    return true
  }
}

const submitDuration = () => {
  if (isEdited.value) {
    emit('update:modelValue', durationInMS.value)
  }
  isEdited.value = false
}
</script>

<template>
  <div class="duration-cell-wrapper">
    <input
      v-if="editEnabled"
      ref="durationInput"
      v-model="localState"
      :placeholder="durationPlaceholder"
      @blur="submitDuration"
      @keypress="checkDurationFormat($event)"
      @keydown.enter="submitDuration"
    />

    <span v-else> {{ localState }}</span>

    <div v-if="showWarningMessage" class="duration-warning">
      <!-- TODO: i18n -->
      Please enter a number
    </div>
  </div>
</template>

<style scoped>
.duration-cell-wrapper {
  padding: 10px;
}

.duration-warning {
  text-align: left;
  margin-top: 10px;
  color: #e65100;
}
</style>

<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
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
