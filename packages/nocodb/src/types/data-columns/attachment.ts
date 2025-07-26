// Attachment data types for v3 API
export interface DataAttachmentRequestUrl {
  url: string;
}

export interface DataAttachmentRequestId {
  id: string;
}

export type DataAttachmentRequest = DataAttachmentRequestUrl | DataAttachmentRequestId;

export interface DataAttachmentResponse {
  id: string;
  url: string;
  title?: string;
  mimetype?: string;
  size?: number;
  path?: string;
}