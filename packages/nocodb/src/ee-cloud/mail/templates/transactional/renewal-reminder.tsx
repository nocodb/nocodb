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

interface RenewalReminderTemplateProps {
  workspaceTitle: string;
  planTitle: string;
  renewalDate: string;
  amountDue?: string;
  billingPortalUrl: string;
}

export const RenewalReminder = ({
  workspaceTitle,
  planTitle,
  renewalDate,
  amountDue,
  billingPortalUrl,
}: RenewalReminderTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Your subscription renews soon</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Your subscription renews soon
          </Heading>
          <Section className="py-6 mx-auto font-bold text-center text-gray-900 text-base">
            {workspaceTitle}
          </Section>
          <Text className="text-gray-600 text-center text-sm !mt-0">
            Your <span className="font-bold text-gray-800">{planTitle}</span>{' '}
            plan will renew on{' '}
            <span className="font-bold text-gray-800">{renewalDate}</span>.
          </Text>
          {amountDue ? (
            <Text className="text-gray-600 text-center text-sm !mt-0">
              You’ll be charged{' '}
              <span className="font-bold text-gray-800">{amountDue}</span>.
            </Text>
          ) : null}
          <Text className="text-gray-600 text-center text-sm !mt-0 !mb-6">
            Want to change your plan, seat count, or cancel? Manage everything
            from the billing portal.
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

RenewalReminder.PreviewProps = {
  workspaceTitle: 'Acme Workspace',
  planTitle: 'Business',
  renewalDate: 'May 19, 2026',
  amountDue: '$49.00 USD',
  billingPortalUrl: 'https://app.nocodb.com/billing',
};

export default RenewalReminder;
