import * as React from 'react';
import {
  Body,
  Button,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components';
import {
  ContentWrapper,
  Footer,
  RootWrapper,
} from '~/services/mail/templates/components';

interface TeamAssignedToWorkspaceTemplateProps {
  teamTitle: string;
  workspaceTitle: string;
  inviterName: string;
  inviterEmail: string;
  roleLabel: string;
  link: string;
}

export const TeamAssignedToWorkspace = ({
  teamTitle,
  workspaceTitle,
  inviterName,
  inviterEmail,
  roleLabel,
  link,
}: TeamAssignedToWorkspaceTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Your team was added to a workspace</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Your team was added to a workspace
          </Heading>
          <Text className="text-gray-600 text-center !my-6 text-sm">
            <span className="font-bold text-gray-800">{inviterName}</span> ({inviterEmail})
            has added your team <span className="font-bold text-gray-800">{teamTitle}</span> to workspace{' '}
            <span className="font-bold text-gray-800">{workspaceTitle}</span> with role{' '}
            <span className="font-bold text-gray-800">{roleLabel}</span>.
          </Text>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={link}
          >
            <Text className="!my-[8px]">Open NocoDB</Text>
          </Button>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

TeamAssignedToWorkspace.PreviewProps = {
  teamTitle: 'Team Name',
  workspaceTitle: 'Workspace Name',
  inviterName: 'John Doe',
  inviterEmail: 'johndoe@nocodb.com',
  roleLabel: 'Editor',
  link: 'https://app.nocodb.com',
};

export default TeamAssignedToWorkspace;


