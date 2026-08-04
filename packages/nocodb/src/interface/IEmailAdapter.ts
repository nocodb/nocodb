export default interface IEmailAdapter {
  init(): Promise<any>;
  mailSend(mail: XcEmail): Promise<any>;
  test(email): Promise<boolean>;
}

interface XcEmail {
  // from?:string;
  /**
   * Optional From display-name override (the email address stays the adapter's
   * configured sender). Used by white-labelling to brand the sender name.
   */
  fromName?: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export { XcEmail };
