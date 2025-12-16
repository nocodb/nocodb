import { NocoSDK } from '@noco-integrations/core'

export const NON_EDITABLE_FIELDS = [
  NocoSDK.UITypes.Button,
  NocoSDK.UITypes.QrCode,
  NocoSDK.UITypes.Barcode,
  NocoSDK.UITypes.Formula,
  NocoSDK.UITypes.CreatedTime,
  NocoSDK.UITypes.LastModifiedTime,
  NocoSDK.UITypes.CreatedBy,
  NocoSDK.UITypes.LastModifiedBy,
  NocoSDK.UITypes.Lookup,
  NocoSDK.UITypes.Rollup,
]