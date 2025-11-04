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

interface TeamMemberRemovedTemplateProps {
  teamTitle: string;
  workspaceTitle?: string;
  removerName: string;
  removerEmail: string;
  roleLabel: string;
  link: string;
}

export const TeamMemberRemoved = ({
  teamTitle,
  workspaceTitle,
  removerName,
  removerEmail,
  roleLabel,
  link,
}: TeamMemberRemovedTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>You've been removed from a team</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            You've been removed from a team
          </Heading>
          <Text className="text-gray-600 text-center !my-6 text-sm">
            <span className="font-bold text-gray-800">{removerName}</span> ({removerEmail})
            has removed you from the team <span className="font-bold text-gray-800">{teamTitle}</span>
            {workspaceTitle ? ` in workspace ${workspaceTitle}` : ''}. Your previous role was{' '}
            <span className="font-bold text-gray-800">{roleLabel}</span>.
          </Text>
          <Text className="text-gray-600 text-center !my-6 text-sm">
            If this was unexpected, please contact your workspace administrators.
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

TeamMemberRemoved.PreviewProps = {
  teamTitle: 'Team Name',
  workspaceTitle: 'Workspace Name',
  removerName: 'John Doe',
  removerEmail: 'johndoe@nocodb.com',
  roleLabel: 'Owner',
  link: 'https://app.nocodb.com',
};

export default TeamMemberRemoved;


