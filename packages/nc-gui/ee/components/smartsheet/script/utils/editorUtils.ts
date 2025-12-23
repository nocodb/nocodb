export function generateLibCode(integrations: any[]): string {
  let code = 'declare const integrations: {'
  for (const integration of integrations) {
    const integrationMeta = allIntegrations.find(
      (item) => item.type === integration.type && item.subType === integration.sub_type,
    )!
    let libPropsCode = ''
    if (integrationMeta?.meta?.configSchema) {
      for (const [k, v] of Object.entries(integrationMeta.meta.configSchema)) {
        libPropsCode += `${k}: ${v};`
      }
    }
    code += `
      ${integration.type}: {
        ${integration.title}: {
          ${libPropsCode}
        }
      }
    `
  }
  code += '}'
  return code
}
