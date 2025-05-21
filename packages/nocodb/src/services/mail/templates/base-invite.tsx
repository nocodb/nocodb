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

interface BaseInviteTemplateProps {
  baseTitle: string;
  name: string;
  email: string;
  link: string;
}

export const BaseInvite = ({
  baseTitle,
  name,
  email,
  link,
}: BaseInviteTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>You’ve been invited to a Base</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            You’ve been invited to a Base
          </Heading>
          <Section className="py-6 mx-auto font-bold mx-auto text-center text-gray-900 text-base">
            {baseTitle}
          </Section>
          <Text className="text-gray-600 text-center text-sm !mt-0 !mb-6">
            <span className="font-bold text-gray-800">{name}</span> ({email})
            has invited you to collaborate on{' '}
            <span className="font-bold text-gray-800">{baseTitle}</span> base.
          </Text>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={link}
          >
            <Text className="!my-[8px]">Accept Base Invite</Text>
          </Button>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

BaseInvite.PreviewProps = {
  baseTitle: 'Base Title',
  name: 'John Doe',
  email: 'johndoe@nocodb.com',
  link: 'https://app.nocodb.com',
};

export default BaseInvite;
