import GeneralBaseLogo from '~/components/general/BaseLogo.vue'
import { ClientType } from '~/lib'

enum IntegrationsPageMode {
  LIST,
  ADD,
}

const integrationType: Record<'PostgreSQL' | 'MySQL', ClientType> = {
  PostgreSQL: ClientType.PG,
  MySQL: ClientType.MYSQL,
}

type IntegrationType = (typeof integrationType)[keyof typeof integrationType]

const pageMode = ref(IntegrationsPageMode.LIST)

const activeIntegration = ref()

const categories = ref<{ label: string; icon: any }[]>([])

const activeCategory = ref<{ label: string; icon: any } | null>(null)

function defaultValues(type: IntegrationType) {
  const genericValues = {
    payload: {},
  }

  switch (type) {
    case integrationType.PostgreSQL:
      return {
        ...genericValues,
        type: integrationType.PostgreSQL,
        title: 'PostgreSQL',
        logo: h(GeneralBaseLogo, {
          'source-type': 'pg',
          'class': 'logo',
        }),
      }
    case integrationType.MySQL:
      return {
        ...genericValues,
        type: integrationType.MySQL,
        title: 'MySQL',
        logo: h(GeneralBaseLogo, {
          'source-type': 'mysql2',
          'class': 'logo',
        }),
      }
  }
}

export function useIntegrationsPage() {
  const addIntegration = (type: IntegrationType) => {
    activeIntegration.value = defaultValues(type)
    categories.value = []
    activeCategory.value = null
    pageMode.value = IntegrationsPageMode.ADD
  }

  return {
    IntegrationsPageMode,
    integrationType,
    pageMode,
    addIntegration,
    activeIntegration,
    categories,
    activeCategory,
  }
}
