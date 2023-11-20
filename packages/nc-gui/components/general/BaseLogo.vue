<script setup lang="ts">
import LogosMysqlIcon from '~icons/logos/mysql-icon'
import LogosPostgresql from '~icons/nc-icons/postgresql'
import VscodeIconsFileTypeSqlite from '~icons/vscode-icons/file-type-sqlite'
import SimpleIconsMicrosoftsqlserver from '~icons/simple-icons/microsoftsqlserver'
import LogosSnowflakeIcon from '~icons/logos/snowflake-icon'
import MdiDatabaseOutline from '~icons/mdi/database-outline'

const { sourceType } = defineProps<{ sourceType?: string }>()

const baseIcon = computed(() => {
  switch (sourceType) {
    case ClientType.MYSQL:
      return LogosMysqlIcon
    case ClientType.PG:
      return LogosPostgresql
    case ClientType.SQLITE:
      return VscodeIconsFileTypeSqlite
    case ClientType.MSSQL:
      return SimpleIconsMicrosoftsqlserver
    case ClientType.SNOWFLAKE:
      return LogosSnowflakeIcon
    default:
      return MdiDatabaseOutline
  }
})
</script>

<template>
  <component :is="baseIcon" />
</template>
