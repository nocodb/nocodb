export default interface IEmailAdapter {
  init(): Promise<any>;
  mailSend(mail: XcEmail): Promise<any>;
  test(email): Promise<boolean>;
}

interface XcEmailAttachment {
  /** Name that will be displayed to the recipient. Unicode is allowed. */
  filename?: string;
  /** Contents of the file */
  content?: string | Buffer;
  /** Filesystem path or URL (including data URIs). Recommended for large files. */
  path?: string;
  /** HTTP(S) URL that Nodemailer should fetch and attach */
  href?: string;
  /** Custom HTTP headers for href, for example { authorization: 'Bearer …' } */
  httpHeaders?: object;
  /** Explicit MIME type. Defaults to the type inferred from filename */
  contentType?: string;
  /** Content‑Disposition header. Defaults to 'attachment' */
  contentDisposition?: string;
  /** Content‑ID for embedding the attachment inline in the HTML body */
  cid?: string;
  /** Encoding applied when content is a string (e.g. 'base64', 'hex') */
  encoding?: string;
  /** Custom headers for the individual MIME node */
  headers?: object;
  /** Advanced: Full pre‑built MIME node including headers. Overrides every other field. */
  raw?: string;
}

interface XcEmail {
  // from?:string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<XcEmailAttachment>;
  cc?: string;
  bcc?: string;
}

export { XcEmail, XcEmailAttachment };
