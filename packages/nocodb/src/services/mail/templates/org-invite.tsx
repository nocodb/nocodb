import * as React from 'react';
import type { WhiteLabelConfig } from 'nocodb-sdk';
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

interface OrganizationInviteTemplateProps {
  name: string;
  email: string;
  link: string;
  branding?: WhiteLabelConfig | null;
}

export const OrganizationInvite = ({
  name,
  email,
  link,
  branding,
}: OrganizationInviteTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>You’ve been invited to NocoDB</Preview>
      <Body className="bg-white">
        <ContentWrapper branding={branding}>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            You’ve been invited to NocoDB
          </Heading>
          <Text className="text-gray-600 text-center !my-6 text-sm">
            <span className="font-bold text-gray-800">{name}</span> ( {email})
            has invited you to collaborate on NocoDB.
          </Text>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={link}
          >
            <Text className="!my-[8px]">Go to NocoDB</Text>
          </Button>
        </ContentWrapper>
        <Footer branding={branding} />
      </Body>
    </RootWrapper>
  </Html>
);

OrganizationInvite.PreviewProps = {
  name: 'John Doe',
  email: 'johndoe@gmail.com',
  link: 'https://nocodb.com',
};

export default OrganizationInvite;
