export interface CompanyResponse {
  "legalName": string,
  "displayName": string,
  "address": {
    "line1": string,
    "line2": string,
    "city": string,
    "state": string,
    "zip": string,
  },
  "phone": string
}