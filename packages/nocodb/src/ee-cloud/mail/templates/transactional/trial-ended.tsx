import {
  Body,
  Button,
  Head,
  Heading,
  Html,
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

interface TrialEndedTemplateProps {
  workspaceTitle: string;
  planTitle: string;
  billingPortalUrl: string;
}

export const TrialEnded = ({
  workspaceTitle,
  planTitle,
  billingPortalUrl,
}: TrialEndedTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Your trial has ended</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Your trial has ended
          </Heading>
          <Section className="py-6 mx-auto font-bold text-center text-gray-900 text-base">
            {workspaceTitle}
          </Section>
          <Text className="text-gray-600 text-center text-sm !mt-0">
            Your <span className="font-bold text-gray-800">{planTitle}</span>{' '}
            trial ended without a payment method on file. Your workspace has
            been moved back to the Free plan.
          </Text>
          <Text className="text-gray-600 text-center text-sm !mt-0 !mb-6">
            You can resubscribe any time from the billing portal.
          </Text>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={billingPortalUrl}
          >
            <Text className="!my-[8px]">Manage billing</Text>
          </Button>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

TrialEnded.PreviewProps = {
  workspaceTitle: 'Acme Workspace',
  planTitle: 'Business',
  billingPortalUrl: 'https://app.nocodb.com/billing',
};

export default TrialEnded;
