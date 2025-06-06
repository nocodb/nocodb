<script lang="ts" setup>
const route = useRoute()

interface BreadcrumbType {
  title: string
  active?: boolean
}

const { t } = useI18n()

const breadcrumb = computed<BreadcrumbType[]>(() => {
  const payload: BreadcrumbType[] = [
    {
      title: 'Account',
    },
  ]

  if (route.name?.toString().includes('account-index-workspace')) {
    payload.pop()

    payload.push({
      title: t('objects.workspace'),
    })

    switch (route.name.toString().split('-').pop()) {
      case 'billing': {
        payload.push({
          title: t('general.billing'),
          active: true,
        })
        break
      }
      case 'settings': {
        payload.push({
          title: t('labels.settings'),
          active: true,
        })
        break
      }
    }

    return payload
  }

  console.log(route.name)

  if (route.name?.toString().includes('index-typeOrId-marketplace')) {
    payload.pop()

    switch (route.name.toString().split('-').pop()) {
      default: {
        payload.push({
          title: t('general.community'),
          active: true,
        })
        break
      }
    }

    return payload
  }

  switch (route.params.page) {
    case 'profile': {
      payload.push({
        title: t('labels.profile'),
        active: true,
      })
      break
    }
    case 'oauth-clients': {
      payload.push({
        title: t('title.oauthClients'),
        active: true,
      })
      break
    }
    case 'mcp': {
      payload.push({
        title: t('title.mcpServer'),
        active: true,
      })
      break
    }
    case 'external-integrations': {
      payload.push({
        title: t('title.externalIntegrations'),
        active: true,
      })
      break
    }
    case 'tokens': {
      payload.push({
        title: t('title.tokens'),
        active: true,
      })
      break
    }
    case 'audit': {
      payload.push({
        title: t('title.auditLogs'),
        active: true,
      })
      break
    }
    case 'apps': {
      payload.push({
        title: t('title.appStore'),
        active: true,
      })
      break
    }
    case 'authentication': {
      payload.push({
        title: t('labels.authentication'),
        active: true,
      })
      break
    }
    case 'audits': {
      payload.push({
        title: t('title.audits'),
        active: true,
      })
      break
    }
  }

  switch (route.params.nestedPage) {
    case 'password-reset': {
      payload.push(
        ...[
          {
            title: t('objects.users'),
          },
          {
            title: t('title.resetPasswordMenu'),
            active: true,
          },
        ],
      )
      break
    }
    case 'settings': {
      payload.push(
        ...[
          {
            title: t('objects.users'),
          },
          {
            title: t('activity.settings'),
            active: true,
          },
        ],
      )
      break
    }
  }

  if ((route.params.page === undefined && route.params.nestedPage === '') || route.params.nestedPage === 'list') {
    payload.push(
      ...[
        {
          title: t('objects.users'),
        },
        {
          title: t('title.userManagement'),
          active: true,
        },
      ],
    )
  }

  return payload
})
</script>

<template>
  <div class="nc-breadcrumb">
    <template v-for="(item, i) of breadcrumb" :key="i">
      <div
        class="nc-breadcrumb-item"
        :class="{
          active: item.active,
        }"
      >
        {{ item.title }}
      </div>
      <GeneralIcon v-if="i !== breadcrumb.length - 1" icon="ncSlash1" class="nc-breadcrumb-divider" />
    </template>
  </div>
</template>
