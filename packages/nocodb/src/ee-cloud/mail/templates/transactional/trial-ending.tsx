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

interface TrialEndingTemplateProps {
  workspaceTitle: string;
  planTitle: string;
  daysRemaining: number;
  trialEndsAt: string;
  billingPortalUrl: string;
}

export const TrialEnding = ({
  workspaceTitle,
  planTitle,
  daysRemaining,
  trialEndsAt,
  billingPortalUrl,
}: TrialEndingTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>{`Your ${planTitle} trial ends in ${daysRemaining} day${
        daysRemaining === 1 ? '' : 's'
      }`}</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Your trial ends soon
          </Heading>
          <Section className="py-6 mx-auto font-bold text-center text-gray-900 text-base">
            {workspaceTitle}
          </Section>
          <Text className="text-gray-600 text-center text-sm !mt-0">
            Your <span className="font-bold text-gray-800">{planTitle}</span>{' '}
            trial ends in{' '}
            <span className="font-bold text-gray-800">
              {daysRemaining} day{daysRemaining === 1 ? '' : 's'}
            </span>{' '}
            on <span className="font-bold text-gray-800">{trialEndsAt}</span>.
          </Text>
          <Text className="text-gray-600 text-center text-sm !mt-0">
            We don't have a payment method on file, so your workspace will move
            back to the Free plan when the trial ends unless you add one.
          </Text>
          <Text className="text-gray-600 text-center text-sm !mt-0 !mb-6">
            Add a card now to keep your team on {planTitle} without
            interruption.
          </Text>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={billingPortalUrl}
          >
            <Text className="!my-[8px]">Add payment method</Text>
          </Button>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

TrialEnding.PreviewProps = {
  workspaceTitle: 'Acme Workspace',
  planTitle: 'Business',
  daysRemaining: 3,
  trialEndsAt: 'May 16, 2026',
  billingPortalUrl: 'https://app.nocodb.com/billing',
};

export default TrialEnding;
