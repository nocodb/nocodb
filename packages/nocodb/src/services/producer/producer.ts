export abstract class Producer {
  abstract sendMessage(topic: string, message: string): Promise<void>;
  abstract sendMessages(topic: string, messages: string[]): Promise<void>;
}
