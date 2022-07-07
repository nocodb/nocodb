<script setup lang="ts">
import dayjs from 'dayjs'
import { computed } from '@vue/reactivity'

const { modelValue } = defineProps<{ modelValue: any }>()
const emit = defineEmits(['update:modelValue'])

const localState = computed({
  get() {
    if (!modelValue || !dayjs(modelValue).isValid()) {
      return undefined
    }

    return (/^\d+$/.test(modelValue) ? dayjs(+modelValue) : dayjs(modelValue)).format('YYYY-MM-DD')
  },
  set(val) {
    if (dayjs(val).isValid()) {
      emit('update:modelValue', val && dayjs(val).format('YYYY-MM-DD'))
    }
  },
})

/*

export default {
  name: 'DatePickerCell',
  props: {
    value: [String, Date],
  },
  computed: {
    localState: {
      get() {
        if (!this.value || !dayjs(this.value).isValid()) {
          return undefined
        }

        return (/^\d+$/.test(this.value) ? dayjs(+this.value) : dayjs(this.value)).format('YYYY-MM-DD')
      },
      set(val) {
        if (dayjs(val).isValid()) {
          this.$emit('input', val && dayjs(val).format('YYYY-MM-DD'))
        }
      },
    },
    date() {
      if (!this.value || this.localState) {
        return this.localState
      }
      return 'Invalid Date'
    },
    parentListeners() {
      const $listeners = {}

      if (this.$listeners.blur) {
        $listeners.blur = this.$listeners.blur
      }
      if (this.$listeners.focus) {
        $listeners.focus = this.$listeners.focus
      }

      return $listeners
    },
  },
  mounted() {
    if (this.$el && this.$el.$el) {
      this.$el.$el.focus()
    }
  },
} */
</script>

<template>
  <!--  <v-menu> -->
  <!--    <template #activator="{ on }"> -->
  <input v-model="localState" type="date" class="value" />
  <!--    </template> -->
  <!--    <v-date-picker v-model="localState" flat @click.native.stop v-on="parentListeners" /> -->
  <!--  </v-menu> -->
</template>

<style scoped>
.value {
  width: 100%;
  min-height: 20px;
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
