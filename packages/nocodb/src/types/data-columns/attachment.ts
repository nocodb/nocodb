import type { NcContext, NcRequest, PublicAttachmentScope } from 'nocodb-sdk';

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
  req?: Partial<NcRequest>;
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

export interface AttachmentBase64UploadParam {
  context: NcContext;
  scope?: PublicAttachmentScope;
  modelId: string;
  columnId: string;
  recordId: string;
  req?: Partial<NcRequest>;
  attachment: {
    contentType: string;
    file: string; // base64-encoded-file-content
    filename: string;
  };
}
