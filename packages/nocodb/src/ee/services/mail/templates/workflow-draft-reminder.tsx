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

interface WorkflowDraftReminderTemplateProps {
  workflowTitle: string;
  baseTitle: string;
  draftAgeDays: number;
  link: string;
}

export const WorkflowDraftReminder = ({
  workflowTitle,
  baseTitle,
  draftAgeDays,
  link,
}: WorkflowDraftReminderTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>
        Your automation "{workflowTitle}" has unpublished changes
      </Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Unpublished draft changes
          </Heading>
          <Section className="py-4 mx-auto text-center">
            <Text className="text-gray-600 text-sm !mt-0 !mb-4">
              Your automation{' '}
              <span className="font-bold text-gray-800">{workflowTitle}</span>{' '}
              in <span className="font-bold text-gray-800">{baseTitle}</span>{' '}
              has unpublished draft changes for{' '}
              <span className="font-bold text-gray-800">
                {draftAgeDays} {draftAgeDays === 1 ? 'day' : 'days'}
              </span>
              . Publish the workflow so your updates take effect.
            </Text>
          </Section>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={link}
          >
            <Text className="!my-[8px]">Review & Publish</Text>
          </Button>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

WorkflowDraftReminder.PreviewProps = {
  workflowTitle: 'My Automation',
  baseTitle: 'Project Base',
  draftAgeDays: 5,
  link: 'https://app.nocodb.com',
};

export default WorkflowDraftReminder;
