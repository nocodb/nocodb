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

interface WorkspaceTeamRemovedTemplateProps {
  teamTitle: string;
  workspaceTitle: string;
  removerName: string;
  removerEmail: string;
  roleLabel: string;
  link: string;
}

export const WorkspaceTeamRemoved = ({
  teamTitle,
  workspaceTitle,
  removerName,
  removerEmail,
  roleLabel,
  link,
}: WorkspaceTeamRemovedTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Your team was removed from a workspace</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Your team was removed from a workspace
          </Heading>
          <Text className="text-gray-600 text-center !my-6 text-sm">
            <span className="font-bold text-gray-800">{removerName}</span> ({removerEmail})
            has removed your team <span className="font-bold text-gray-800">{teamTitle}</span> from workspace{' '}
            <span className="font-bold text-gray-800">{workspaceTitle}</span> (previously had role{' '}
            <span className="font-bold text-gray-800">{roleLabel}</span>).
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

WorkspaceTeamRemoved.PreviewProps = {
  teamTitle: 'Team Name',
  workspaceTitle: 'Workspace Name',
  removerName: 'John Doe',
  removerEmail: 'johndoe@nocodb.com',
  roleLabel: 'Editor',
  link: 'https://app.nocodb.com',
};

export default WorkspaceTeamRemoved;

