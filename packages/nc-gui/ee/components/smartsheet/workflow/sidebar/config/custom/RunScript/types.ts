export interface ExecuteScriptNodeConfig {
  script: string
  variables: ScriptVariable[]
}

export interface ScriptVariable {
  name: string
  value: any
}
