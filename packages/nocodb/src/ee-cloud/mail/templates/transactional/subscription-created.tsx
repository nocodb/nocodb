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

interface SubscriptionCreatedTemplateProps {
  workspaceTitle: string;
  planTitle: string;
  seatCount: number;
  periodEnd?: string;
  isTrial: boolean;
  billingPortalUrl: string;
}

export const SubscriptionCreated = ({
  workspaceTitle,
  planTitle,
  seatCount,
  periodEnd,
  isTrial,
  billingPortalUrl,
}: SubscriptionCreatedTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>
        {isTrial ? 'Your trial is active' : 'Your subscription is active'}
      </Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            {isTrial ? 'Your trial is now active' : 'Welcome to your new plan'}
          </Heading>
          <Section className="py-6 mx-auto font-bold text-center text-gray-900 text-base">
            {workspaceTitle}
          </Section>
          <Text className="text-gray-600 text-center text-sm !mt-0">
            Plan: <span className="font-bold text-gray-800">{planTitle}</span> ·
            Seats: <span className="font-bold text-gray-800">{seatCount}</span>
          </Text>
          {periodEnd ? (
            <Text className="text-gray-600 text-center text-sm !mt-0">
              {isTrial ? 'Trial ends ' : 'Next billing date: '}
              <span className="font-bold text-gray-800">{periodEnd}</span>
            </Text>
          ) : null}
          <Text className="text-gray-600 text-center text-sm !mt-0 !mb-6">
            Thanks for choosing NocoDB. You can manage your subscription any
            time from the billing portal.
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

SubscriptionCreated.PreviewProps = {
  workspaceTitle: 'Acme Workspace',
  planTitle: 'Business',
  seatCount: 5,
  periodEnd: 'Jun 12, 2026',
  isTrial: false,
  billingPortalUrl: 'https://app.nocodb.com/billing',
};

export default SubscriptionCreated;
