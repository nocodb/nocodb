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

interface BaseTeamRemovedTemplateProps {
  teamTitle: string;
  baseTitle: string;
  removerName: string;
  removerEmail: string;
  roleLabel: string;
  link: string;
}

export const BaseTeamRemoved = ({
  teamTitle,
  baseTitle,
  removerName,
  removerEmail,
  roleLabel,
  link,
}: BaseTeamRemovedTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Your team was removed from a base</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Your team was removed from a base
          </Heading>
          <Text className="text-gray-600 text-center !my-6 text-sm">
            <span className="font-bold text-gray-800">{removerName}</span> ({removerEmail})
            has removed your team <span className="font-bold text-gray-800">{teamTitle}</span> from base{' '}
            <span className="font-bold text-gray-800">{baseTitle}</span> (previously had role{' '}
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

BaseTeamRemoved.PreviewProps = {
  teamTitle: 'Team Name',
  baseTitle: 'Base Name',
  removerName: 'John Doe',
  removerEmail: 'johndoe@nocodb.com',
  roleLabel: 'Editor',
  link: 'https://app.nocodb.com',
};

export default BaseTeamRemoved;

