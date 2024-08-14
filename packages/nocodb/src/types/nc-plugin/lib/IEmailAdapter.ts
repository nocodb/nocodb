export default interface IEmailAdapter {
  init(): Promise<any>;
  mailSend(mail: XcEmail): Promise<any>;
  test(email): Promise<boolean>;
}

interface XcEmail {
  // from?:string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export { XcEmail };
