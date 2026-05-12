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

interface PlanChangedTemplateProps {
  workspaceTitle: string;
  oldPlanTitle: string;
  newPlanTitle: string;
  effectiveAt?: string;
  billingPortalUrl: string;
}

export const PlanChanged = ({
  workspaceTitle,
  oldPlanTitle,
  newPlanTitle,
  effectiveAt,
  billingPortalUrl,
}: PlanChangedTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Your plan was updated</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Plan changed
          </Heading>
          <Section className="py-6 mx-auto font-bold text-center text-gray-900 text-base">
            {workspaceTitle}
          </Section>
          <Text className="text-gray-600 text-center text-sm !mt-0">
            Your plan changed from{' '}
            <span className="font-bold text-gray-800">{oldPlanTitle}</span> to{' '}
            <span className="font-bold text-gray-800">{newPlanTitle}</span>.
          </Text>
          {effectiveAt ? (
            <Text className="text-gray-600 text-center text-sm !mt-0">
              Effective{' '}
              <span className="font-bold text-gray-800">{effectiveAt}</span>.
            </Text>
          ) : null}
          <Text className="text-gray-600 text-center text-sm !mt-0 !mb-6">
            Any proration will appear on your next invoice.
          </Text>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={billingPortalUrl}
          >
            <Text className="!my-[8px]">View billing</Text>
          </Button>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

PlanChanged.PreviewProps = {
  workspaceTitle: 'Acme Workspace',
  oldPlanTitle: 'Plus',
  newPlanTitle: 'Business',
  effectiveAt: 'May 12, 2026',
  billingPortalUrl: 'https://app.nocodb.com/billing',
};

export default PlanChanged;
