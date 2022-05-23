<template>
  <div align="center">
    <h1>user picture</h1>
    <section class="">
      <div class="col-xs-offset-1 col-xs-10 col-md-offset-3 col-md-4">
        <form class="signin form-horizontal">
          <fieldset>
            <div class="form-group text-center">
            </div>
            <div class="text-center form-group">
              <span class="btn btn-primary btn-raised btn-file">
                Select Image <input type="file" uploader="uploader">
              </span>
            </div>
            <div class="text-center form-group">
              <button class="btn btn-primary btn-raised" @click="uploadProfilePicture()">
                Upload
              </button>
              <button class="btn btn-default btn-raised" @click="cancelUpload()">
                <!-- Cancel -->
                {{ $t('general.cancel') }}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </section>
  </div>
</template>

<script>
export default {
  directives: { },
  components: { },
  validate({ params }) { return true },
  props: { },
  data() {
    return {

    }
  },
  head() { return {} },
  computed: {

  },
  watch: { },
  created() { },
  mounted() {},
  beforeDestroy() {},
  methods: {
    uploadProfilePicture() {
      // console.log('uploadProfilePicture');
    },
    cancelUpload() {
      // console.log('cancelUpload');
    }

  },
  beforeCreated() {},
  destroy() {}
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
