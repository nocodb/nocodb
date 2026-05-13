import {
  Body,
  Button,
  Head,
  Heading,
  Hr,
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

interface WelcomeTemplateProps {
  email: string;
  link: string;
}

const DOC_BUILD_BASE = 'https://nocodb.com/docs/product-docs/bases/create-base';
const DOC_COLLAB =
  'https://nocodb.com/docs/product-docs/collaboration/workspace-collaboration';
const DOC_AUTOMATION =
  'https://nocodb.com/docs/product-docs/automation/workflow';

export const Welcome = ({ email, link }: WelcomeTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Welcome to NocoDB — let's get you started</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Welcome to NocoDB
          </Heading>
          <Section className="py-6 mx-auto font-bold text-center text-gray-900 text-base">
            {email}
          </Section>
          <Text className="text-gray-600 text-center text-sm !mt-0">
            Your workspace is ready. Open it any time from the button below.
          </Text>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={link}
          >
            <Text className="!my-[8px]">Open your workspace</Text>
          </Button>
          <Hr className="my-6 border-gray-200" />
          <Heading className="text-gray-900 text-center font-bold m-auto text-base md:text-lg">
            Three short reads to get started
          </Heading>
          <Section className="py-4">
            <Text className="text-gray-800 text-sm font-bold !mb-1">
              1. Build your first base
            </Text>
            <Text className="text-gray-600 text-sm !mt-0">
              Create a base, add tables, and start managing your data.{' '}
              <Link className="text-brand-500 underline" href={DOC_BUILD_BASE}>
                Read the guide →
              </Link>
            </Text>
            <Text className="text-gray-800 text-sm font-bold !mb-1">
              2. Invite your team
            </Text>
            <Text className="text-gray-600 text-sm !mt-0">
              Workspaces support roles and permissions for collaborators.{' '}
              <Link className="text-brand-500 underline" href={DOC_COLLAB}>
                Read the guide →
              </Link>
            </Text>
            <Text className="text-gray-800 text-sm font-bold !mb-1">
              3. Automate the boring stuff
            </Text>
            <Text className="text-gray-600 text-sm !mt-0">
              Trigger workflows on record changes, schedules, and webhooks.{' '}
              <Link className="text-brand-500 underline" href={DOC_AUTOMATION}>
                Read the guide →
              </Link>
            </Text>
          </Section>
          <Text className="text-gray-600 text-center text-xs !mt-0 !mb-6">
            Full documentation at{' '}
            <Link
              className="text-brand-500 underline"
              href="https://nocodb.com/docs"
            >
              nocodb.com/docs
            </Link>
            .
          </Text>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

Welcome.PreviewProps = {
  email: 'janedoe@nocodb.com',
  link: 'https://app.nocodb.com',
};

export default Welcome;
