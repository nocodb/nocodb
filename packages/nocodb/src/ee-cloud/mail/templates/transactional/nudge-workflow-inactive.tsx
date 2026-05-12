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

interface NudgeWorkflowInactiveProps {
  workspaceTitle: string;
  workflowTitle: string;
  workflowUrl: string;
}

const DOC_WORKFLOW = 'https://nocodb.com/docs/product-docs/automation/workflow';

export const NudgeWorkflowInactive = ({
  workspaceTitle,
  workflowTitle,
  workflowUrl,
}: NudgeWorkflowInactiveProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Your workflow isn't running yet</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Your workflow isn't running yet
          </Heading>
          <Section className="py-6 mx-auto font-bold text-center text-gray-900 text-base">
            {workflowTitle} · {workspaceTitle}
          </Section>
          <Text className="text-gray-600 text-center text-sm !mt-0">
            Activate the workflow to start handling triggers — record changes,
            schedules, webhooks. It only runs when active.
          </Text>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={workflowUrl}
          >
            <Text className="!my-[8px]">Open the workflow</Text>
          </Button>
          <Text className="text-gray-600 text-center text-xs !mt-6 !mb-0">
            Stuck on triggers or nodes?{' '}
            <Link className="text-brand-500 underline" href={DOC_WORKFLOW}>
              Read the workflow guide →
            </Link>
          </Text>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

NudgeWorkflowInactive.PreviewProps = {
  workspaceTitle: 'Acme Workspace',
  workflowTitle: 'Notify on new lead',
  workflowUrl: 'https://app.nocodb.com/ws_123/workflows/wf_456',
};

export default NudgeWorkflowInactive;
