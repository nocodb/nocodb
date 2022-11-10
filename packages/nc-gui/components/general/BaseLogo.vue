<script setup lang="ts">
import LogosMysqlIcon from '~icons/logos/mysql-icon'
import LogosPostgresql from '~icons/logos/postgresql'
import VscodeIconsFileTypeSqlite from '~icons/vscode-icons/file-type-sqlite'
import SimpleIconsMicrosoftsqlserver from '~icons/simple-icons/microsoftsqlserver'
import MdiDatabaseOutline from '~icons/mdi/database-outline'

const { baseType } = defineProps<{ baseType?: string }>()

const baseIcon = computed(() => {
  switch (baseType) {
    case ClientType.MYSQL:
      return LogosMysqlIcon
    case ClientType.PG:
      return LogosPostgresql
    case ClientType.SQLITE:
      return VscodeIconsFileTypeSqlite
    case ClientType.MSSQL:
      return SimpleIconsMicrosoftsqlserver
    default:
      return MdiDatabaseOutline
  }
})
</script>

<template>
  <component :is="baseIcon" />
</template>
