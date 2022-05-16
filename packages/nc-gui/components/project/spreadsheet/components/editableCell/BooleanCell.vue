<template>
  <div class="d-flex align-center " :class="{'justify-center':!isForm}">
    <input v-model="localState" type="checkbox" v-on="parentListeners">
  </div>
</template>

<script>
export default {
  name: 'BooleanCell',
  props: {
    value: [String, Number, Boolean],
    isForm: Boolean
  },
  computed: {
    localState: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },

    parentListeners() {
      const $listeners = {}
      return $listeners
    }
  },
  mounted() {
    this.$el.focus()
  }
}
</script>

<style scoped>

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
