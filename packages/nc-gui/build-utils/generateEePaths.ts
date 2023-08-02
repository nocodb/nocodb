import tsConfig from '../.nuxt/tsconfig.json'

export default function () {
  const baseUrl = tsConfig?.compilerOptions?.baseUrl || './'
  return Object.entries(tsConfig?.compilerOptions?.paths || {}).reduce<Record<string, string[]>>((pathObj, [key, paths]) => {
    pathObj[key] = [paths?.[0].replace(baseUrl, `${baseUrl}/ee`), ...paths]
    return pathObj
  }, {})
}
