<template>
  <div class="h-100" style="overflow: auto">
    <v-container class="h-100 d-flex flex-column">
      <v-simple-table dense v-if="audits" style="max-width: 1000px; overflow: auto" class="mx-auto flex-grow-1"
                      v-slot:default>
        <thead>
        <tr>
          <th class="caption">
            Operation Type
          </th>
          <th class="caption">
            Operation Sub Type
          </th>
          <th class="caption">Description</th>
          <th class="caption">User</th>
<!--          <th class="caption">Ip</th>-->
          <th class="caption">Created</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="audit in audits">

          <td class="caption">
            {{ audit.op_type }}
          </td>
          <td class="caption">
            {{ audit.op_sub_type }}
          </td>
          <td class="caption">
            {{ audit.description }}
          </td>
          <td class="caption">
            {{ audit.user }}
          </td>
<!--          <td class="caption">-->
<!--            {{ audit.ip }}-->
<!--          </td>-->
          <td class="caption">
            <v-tooltip bottom>
              <template v-slot:activator="{on}">
                <span v-on="on">{{ calculateDiff(audit.created_at) }}</span>
              </template>
              <span class="caption">{{ audit.created_at }}</span>
            </v-tooltip>
          </td>
        </tr>
        </tbody>
      </v-simple-table>
      <v-pagination
        v-model="page"
        :length="Math.ceil(count / limit)"
        :total-visible="8"
        @input="loadAudits"></v-pagination>
    </v-container>
  </div>
</template>

<script>
import dayjs from 'dayjs';

const relativeTime = require('dayjs/plugin/relativeTime')
const utc = require('dayjs/plugin/utc')
dayjs.extend(utc)
dayjs.extend(relativeTime)

export default {
  name: "audit",
  data: () => ({
    audits: null,
    count: 0,
    limit: 25,
    page: 1
  }),
  created() {
    this.loadAudits();
  },
  methods: {
    async loadAudits() {
      const {list, count} = await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'xcAuditList', {
        limit: this.limit,
        offset: this.limit * (this.page - 1),
      }]);
      this.audits = list;
      this.count = count;
    },
    calculateDiff(date) {
      return dayjs.utc(date).fromNow()
    }
  }
}
</script>

<style scoped>

</style>
