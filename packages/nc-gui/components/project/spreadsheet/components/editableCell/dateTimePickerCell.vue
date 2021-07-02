<template>
  <v-datetime-picker
    v-on="parentListeners"
    class="caption xc-date-time-picker"
    ref="picker"
    :text-field-props="{
      class:'caption mt-0 pt-0',
      flat:true,
      solo:true,
      dense:true,
      hideDetails:true
    }"
    :time-picker-props="{
      format:'24hr'
    }"
    v-model="localState"
  ></v-datetime-picker>
</template>

<script>

export default {
  name: "date-time-picker-cell",
  props: ['value', 'ignoreFocus'],
  mounted() {
    if (!this.ignoreFocus) {
      this.$refs.picker.display = true;
    }
  },
  computed: {
    localState: {
      get() {
        // todo : time value correction

        if(/^\d{6,}$/.test(this.value)){
          return new Date(+this.value);
        }


        return /\dT\d/.test(this.value) ? new Date(this.value.replace(/(\d)T(?=\d)/, '$1 ')) : this.value;
      },
      set(val) {
        // if(/^\d{6,}$/.test(this.value)){
        //   return this.$emit('input', new Date(this.value).getTime());
        // }


        const uVal = new Date(val).toISOString().slice(0, 19).replace('T', ' ').replace(/(\d{1,2}:\d{1,2}):\d{1,2}$/,'$1');
        console.log(val, uVal)
        this.$emit('input', uVal);
      }
    },
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
/deep/ .v-input, /deep/ .v-text-field {
  margin-top: 0 !important;
  padding-top: 0 !important;
  font-size: inherit !important;
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
