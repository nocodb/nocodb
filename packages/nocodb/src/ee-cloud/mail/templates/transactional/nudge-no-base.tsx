import {
  Body,
  Button,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import {
  ContentWrapper,
  Footer,
  RootWrapper,
} from '~/services/mail/templates/components';

interface NudgeNoBaseProps {
  workspaceTitle: string;
  createBaseUrl: string;
}

const DOC_CREATE_BASE =
  'https://nocodb.com/docs/product-docs/bases/create-base';

export const NudgeNoBase = ({
  workspaceTitle,
  createBaseUrl,
}: NudgeNoBaseProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Your workspace is ready — create your first base</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Create your first base
          </Heading>
          <Section className="py-6 mx-auto font-bold text-center text-gray-900 text-base">
            {workspaceTitle}
          </Section>
          <Text className="text-gray-600 text-center text-sm !mt-0">
            A base is where your tables, views, and automations live. Most
            people get going in under 5 minutes.
          </Text>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={createBaseUrl}
          >
            <Text className="!my-[8px]">Create a base</Text>
          </Button>
          <Text className="text-gray-600 text-center text-xs !mt-6 !mb-0">
            New to NocoDB?{' '}
            <Link className="text-brand-500 underline" href={DOC_CREATE_BASE}>
              Read the 5-minute guide →
            </Link>
          </Text>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

NudgeNoBase.PreviewProps = {
  workspaceTitle: 'Acme Workspace',
  createBaseUrl: 'https://app.nocodb.com/ws_123',
};

export default NudgeNoBase;
