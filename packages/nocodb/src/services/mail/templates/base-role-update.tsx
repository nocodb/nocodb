import {
  Body,
  Button,
  Head,
  Heading,
  Html,
  Img,
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
import { NC_EMAIL_ASSETS_BASE_URL } from '~/constants';

interface BaseRoleUpdateTemplateProps {
  baseTitle: string;
  role: string;
  name: string;
  email: string;
  link: string;
}

export const BaseRoleUpdate = ({
  baseTitle,
  email,
  link,
  role,
  name,
}: BaseRoleUpdateTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Your base role has been updated</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Your base role has been updated
          </Heading>
          <Section className="py-6 text-center font-bold text-gray-900 text-base">
            {baseTitle}
          </Section>
          <Section className="pb-6 text-center">
            <Img
              src={`${NC_EMAIL_ASSETS_BASE_URL}/badges/${role}.png`}
              alt={role}
              className="h-7 mx-auto"
            />
          </Section>
          <Text className="text-gray-600 text-center text-sm !mt-0 !mb-6">
            Your access in
            <span className="font-bold text-gray-800"> {baseTitle} </span>
            has been updated to{' '}
            <span className="font-bold text-gray-800 capitalize ">{role} </span>
            by <span className="font-bold text-gray-800">{` ${name}`}</span> (
            {email})
          </Text>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={link}
          >
            <Text className="!my-[8px]">Go to Base</Text>
          </Button>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

BaseRoleUpdate.PreviewProps = {
  baseTitle: 'Base Title',
  role: 'editor',
  name: 'John Doe',
  email: 'johndoe@nocodb.com',
  link: 'www.nocodb.com',
};

export default BaseRoleUpdate;
