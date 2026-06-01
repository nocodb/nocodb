import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest } from '~/interface/config';

export interface WebBookmarkMetadata {
  url: string;
  title: string | null;
  description: string | null;
  faviconUrl: string | null;
  // Source og:image URL — the in-editor preview shown before the doc is saved
  // (no FileReference id yet). NOT a signed URL. Once saved, the image is served
  // via the cookie-authed doc attachment proxy keyed by FileReference id
  // (DocWebBookmarkNode → AttachmentProxyController) and this field is ignored.
  imageUrl: string | null;
  // Durable storage path of the cached copy. reconcileFileReferences turns this
  // into a FileReference (file_url) on doc save.
  imagePath: string | null;
  // Byte size of the cached image, recorded on the FileReference for workspace
  // storage accounting (0 when the source didn't report a Content-Length).
  fileSize: number | null;
  siteName: string | null;
  status: 'fetched' | 'fetch_failed';
}

@Injectable()
export class WebBookmarkService {
  async fetchMetadata(
    _context: NcContext,
    _param: { url: unknown; req: NcRequest },
  ): Promise<WebBookmarkMetadata> {
    return null;
  }
}
