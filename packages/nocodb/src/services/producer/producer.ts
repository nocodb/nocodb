export abstract class Producer {
  abstract sendMessage(topic: string, message: string): Promise<void>;
}
