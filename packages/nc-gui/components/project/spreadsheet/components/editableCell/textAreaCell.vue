<template>
  <div>
    <div class="d-flex ma-1" v-if="!isForm">
      <v-spacer>
      </v-spacer>
      <v-btn v-if="!isForm" outlined x-small class="mr-1" @click="$emit('cancel')">Cancel</v-btn>
      <v-btn v-if="!isForm" x-small color="primary" @click="save">Save</v-btn>
    </div>
    <textarea v-on="parentListeners"  ref="textarea" v-model="localState" rows="3"
              @input="isForm && save()"
              @keydown.stop.enter></textarea>
  </div>

</template>

<script>
export default {
  name: "textAreaCell",
  props: {
    value: String,
    isForm: Boolean
  },
  data: () => ({
    localState: ''
  }),
  created() {
    this.localState = this.value;
  },
  mounted() {
    this.$refs.textarea && this.$refs.textarea.focus();
  }, watch: {
    value(val) {
      this.localState = val;
    },
    localState(val) {
      if (this.isForm) {
        this.$emit('input', val)
      }
    }
  },
  methods: {
    save() {
      this.$emit('input', this.localState)
    }
  },
  computed:{

    parentListeners(){
      const $listeners = {};

      if(this.$listeners.blur){
        $listeners.blur = this.$listeners.blur;
      }
      if(this.$listeners.focus){
        $listeners.focus = this.$listeners.focus;
      }

      return $listeners;
    },
  }
}
</script>

<style scoped>
input, textarea {
  width: 100%;
  min-height:60px;
  height: calc(100% - 28px);
  color: var(--v-textColor-base);
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
