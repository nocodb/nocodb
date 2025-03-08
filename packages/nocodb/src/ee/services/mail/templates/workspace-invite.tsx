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

interface WorkspaceInviteTemplateProps {
  workspaceTitle: string;
  name: string;
  email: string;
  link: string;
}

export const WorkspaceInvite = ({
  workspaceTitle,
  name,
  email,
  link,
}: WorkspaceInviteTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>You have been invited</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            You’ve been invited
          </Heading>
          <Section className="py-6 mx-auto font-bold text-center text-gray-900 text-base">
            {workspaceTitle}
          </Section>
          <Text className="text-gray-600 text-center text-sm !mt-0 !mb-6">
            <span className="font-bold text-gray-800">{name}</span> ({email})
            has invited you to join{' '}
            <span className="font-bold text-gray-800">{workspaceTitle}</span>.
            Click on ‘Accept invite’ to join.
          </Text>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={link}
          >
            <Text className="!my-[8px]"> Accept invite</Text>
          </Button>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

WorkspaceInvite.PreviewProps = {
  workspaceTitle: 'Workspace Title',
  name: 'Jane Doe',
  email: 'jane@nocodb.com',
};
export default WorkspaceInvite;
