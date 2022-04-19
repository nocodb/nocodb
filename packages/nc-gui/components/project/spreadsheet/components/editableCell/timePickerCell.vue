<template>
  <v-menu>
    <template #activator="{on}">
      <input v-model="localState" class="value" v-on="on">
    </template>
    <div class="d-flex flex-column justify-center" @click.stop>
      <v-time-picker v-model="localState" v-on="parentListeners" />
      <v-btn small color="primary" @click="$emit('update')">
        <!-- Save -->
        {{ $t('general.save') }}
      </v-btn>
    </div>
  </v-menu>
</template>

<script>
import dayjs from 'dayjs'

export default {
  name: 'TimePickerCell',
  props: {
    value: [String, Date]
  },
  computed: {
    localState: {
      get() {
        if (!this.value) {
          return this.value
        }
        let dateTime = dayjs(this.value)
        if (!dateTime.isValid()) {
          dateTime = dayjs(this.value, 'HH:mm:ss')
        }
        if (!dateTime.isValid()) {
          dateTime = dayjs(`1999-01-01 ${this.value}`)
        }
        if (!dateTime.isValid()) {
          return this.value
        }
        return dateTime.format('HH:mm:ss')
      },
      set(val) {
        const dateTime = dayjs(`1999-01-01 ${val}:00`)
        if (dateTime.isValid()) { this.$emit('input', dateTime.format('YYYY-MM-DD HH:mm:ssZ')) }
      }

    },
    parentListeners() {
      const $listeners = {}

      if (this.$listeners.blur) {
        $listeners.blur = this.$listeners.blur
      }
      if (this.$listeners.focus) {
        $listeners.focus = this.$listeners.focus
      }

      if (this.$listeners.cancel) {
        $listeners.cancel = this.$listeners.cancel
      }

      return $listeners
    }
  },
  mounted() {
    if (this.$el && this.$el.$el) {
      this.$el.$el.focus()
    }
  }
}
</script>

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
