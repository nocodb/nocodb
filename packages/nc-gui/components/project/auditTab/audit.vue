<template>
  <div class="h-100" style="overflow: auto">
    <v-toolbar height="30" class="elevation-0">
      <v-spacer />
      <v-btn small outlined @click="loadAudits">
        <v-icon small class="mr-2">
          refresh
        </v-icon>
        <!-- Reload -->
        {{ $t('general.reload') }}
      </v-btn>
    </v-toolbar>
    <v-container class="h-100 d-flex flex-column">
      <v-simple-table
        v-if="audits"
        dense
        style="max-width: 1000px; overflow: auto"
        class="mx-auto flex-grow-1"
      >
        <thead>
          <tr>
            <th class="caption">
              <!--Operation Type-->
              {{ $t('labels.operationType') }}
            </th>
            <th class="caption">
              <!---->
              {{ $t('labels.operationSubType') }}
            </th>
            <th class="caption">
              <!--Description-->
              {{ $t('labels.description') }}
            </th>
            <th class="caption">
              <!--User-->
              {{ $t('objects.user') }}
            </th>
            <!--          <th class="caption">Ip</th>-->
            <th class="caption">
              <!--Created-->
              {{ $t('labels.created') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(audit,i) in audits" :key="i">
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
              {{ audit.user == null?'Shared base':audit.user }}
            </td>
            <!--          <td class="caption">-->
            <!--            {{ audit.ip }}-->
            <!--          </td>-->
            <td class="caption">
              <v-tooltip bottom>
                <template #activator="{on}">
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
        @input="loadAudits"
      />
    </v-container>
  </div>
</template>

<script>
import dayjs from 'dayjs'

const relativeTime = require('dayjs/plugin/relativeTime')
const utc = require('dayjs/plugin/utc')
dayjs.extend(utc)
dayjs.extend(relativeTime)

export default {
  name: 'Audit',
  data: () => ({
    audits: null,
    count: 0,
    limit: 25,
    page: 1
  }),
  created() {
    this.loadAudits()
  },
  methods: {
    async loadAudits() {
      // const { list, count } = await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'xcAuditList', {
      //   limit: this.limit,
      //   offset: this.limit * (this.page - 1)
      // }])
      const {
        list, pageInfo
      } = (await this.$api.project.auditList(
        this.$store.state.project.projectId, {
          limit: this.limit,
          offset: this.limit * (this.page - 1)
        }))

      this.audits = list
      this.count = pageInfo.totalRows
    },
    calculateDiff(date) {
      return dayjs.utc(date).fromNow()
    }
  }
}
</script>

<style scoped>

</style>
