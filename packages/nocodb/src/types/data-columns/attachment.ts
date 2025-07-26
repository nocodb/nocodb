import type { NcContext, PublicAttachmentScope } from 'nocodb-sdk';

// Attachment data types for v3 API
export interface DataAttachmentRequestUrl {
  url: string;
}

export interface DataAttachmentRequestId {
  id: string;
}

export type DataAttachmentRequest =
  | DataAttachmentRequestUrl
  | DataAttachmentRequestId;

export interface AttachmentUrlUploadParam {
  context: NcContext;
  scope?: PublicAttachmentScope;
  modelId: string;
  column: {
    id: string;
    title: string;
    column_name: string;
  };
  recordId: string;
  attachments: {
    id?: string;
    url: string;
  }[];
}
