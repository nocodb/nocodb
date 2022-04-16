<template>
  <v-tabs class="h-100" color="x-active">
    <v-tab>
      <span class="caption text-capitalize">
        <!--Audit Logs-->
        {{ $t('title.auditLogs') }}
      </span>
    </v-tab>
    <v-tab-item class="h-100">
      <audit :nodes="nodes" />
    </v-tab-item>

    <!--    <v-tab>
      <span class="caption text-capitalize">
        &lt;!&ndash;SQL Migrations&ndash;&gt;
        {{ $t('title.sqlMigrations') }}
      </span>
    </v-tab>
    <v-tab-item>
      <sql-log-and-output>
        <db :nodes="nodes" />
      </sql-log-and-output>
    </v-tab-item>-->
  </v-tabs>
</template>

<script>
import Db from '@/components/project/auditTab/db'
import SqlLogAndOutput from '~/components/project/sqlLogAndOutput'
import Audit from '~/components/project/auditTab/audit'
import AuditCE from '~/components/project/auditTab/auditCE'

export default {
  name: 'AuditTab',
  components: { Db, Audit: (process.env.EE ? Audit : AuditCE), SqlLogAndOutput },
  props: ['nodes']
}
</script>

<style scoped lang="scss">
::v-deep{
  .v-window{
    height:calc(100% - 32px);
    .v-window__container{
      height: 100%;
    }
  }
}
</style>
