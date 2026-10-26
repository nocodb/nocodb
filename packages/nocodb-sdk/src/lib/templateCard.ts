export interface TemplateCardType {
  id: string;
  title: string;
  description: string;
  useCase: string;
  thumbnail: string | null;
  sharedBaseUuid: string;
  /** Path of its page under nocodb.com/templates. */
  slug: string;
}
