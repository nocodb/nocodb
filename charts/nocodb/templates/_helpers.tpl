{{/*
Expand the name of the chart.
*/}}
{{- define "nocodb.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "nocodb.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "nocodb.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "nocodb.labels" -}}
helm.sh/chart: {{ include "nocodb.chart" . }}
{{ include "nocodb.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "nocodb.selectorLabels" -}}
app.kubernetes.io/name: {{ include "nocodb.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "nocodb.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "nocodb.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{- define "postgresHost" -}}
{{- printf "%s-postgresql" .Release.Name }}
{{- end }}

{{- define "postgresDatabase" -}}
{{- .Values.postgresql.auth.database }}
{{- end }}

{{- define "postgresUsername" -}}
{{- .Values.postgresql.auth.username }}
{{- end }}

{{- define "postgresPassword" -}}
{{- .Values.postgresql.auth.password }}
{{- end }}

{{- define "databaseUri" -}}
{{- printf "pg://%s:5432?u=%s&p=%s&d=%s" (include "postgresHost" .) (include "postgresUsername" .) (include "postgresPassword" .) (include "postgresDatabase" .) }}
{{- end }}
