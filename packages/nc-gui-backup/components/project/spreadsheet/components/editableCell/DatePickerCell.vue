<template>
  <v-menu>
    <template #activator="{ on }">
      <input :value="date" class="value" v-on="on" />
    </template>
    <v-date-picker v-model="localState" flat @click.native.stop v-on="parentListeners" />
  </v-menu>
</template>

<script>
import dayjs from 'dayjs';

export default {
  name: 'DatePickerCell',
  props: {
    column: Object,
    value: [String, Date],
  },
  computed: {
    localState: {
      get() {
        if (!this.value || !dayjs(this.value).isValid()) {
          return undefined;
        }

        return (/^\d+$/.test(this.value) ? dayjs(+this.value) : dayjs(this.value)).format('YYYY-MM-DD');
      },
      set(val) {
        if (dayjs(val).isValid()) {
          this.$emit('input', val && dayjs(val).format('YYYY-MM-DD'));
        }
      },
    },
    date() {
      if (!this.value || this.localState) {
        return this.localState
          ? dayjs(this.localState).format(this.datepickerMeta.date_format || 'YYYY-MM-DD')
          : this.localState;
      }
      return 'Invalid Date';
    },
    datepickerMeta() {
      return {
        date_format: 'YYYY-MM-DD',
        ...(this.column && this.column.meta ? this.column.meta : {}),
      };
    },
    parentListeners() {
      const $listeners = {};

      if (this.$listeners.blur) {
        $listeners.blur = this.$listeners.blur;
      }
      if (this.$listeners.focus) {
        $listeners.focus = this.$listeners.focus;
      }

      return $listeners;
    },
  },
  mounted() {
    if (this.$el && this.$el.$el) {
      this.$el.$el.focus();
    }
  },
};
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
