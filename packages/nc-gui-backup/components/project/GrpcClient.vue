<template>
  <v-container fluid style="height: 100%" class="py-0">
    <v-row class="justify-center align-center">
      <v-col class="text-center pt-5">
        <v-btn :loading="loading" color="primary" outlined @click="download"> Download Proto File </v-btn>
        <p class="caption mt-3">Use BloomRPC or similar tool for testing</p>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  name: 'GrpcClient',
  data: () => ({
    loading: false,
  }),
  methods: {
    async download() {
      this.loading = true;
      let data;
      try {
        data = await this.$store.dispatch('sqlMgr/ActSqlOp', [
          null,
          'grpcProtoDownloadZip',
          {},
          null,
          {
            responseType: 'blob',
          },
        ]);
        const url = window.URL.createObjectURL(new Blob([data], { type: 'application/zip' }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'proto.zip'); // or any other extension
        document.body.appendChild(link);
        link.click();
        // this.$toast.success('Successfully exported metadata').goAway(3000)
        this.$toast.success(`${this.$t('msg.toast.exportMetadata')}`).goAway(3000);
      } catch (e) {
        this.$toast.error('Some internal error occurred').goAway(3000);
      }
      this.loading = false;
    },
  },
};
</script>

<style scoped></style>
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
