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

interface VerifyYourEmailTemplateProps {
  email: string;
  link: string;
}

export const VerifyYourEmail = ({
  email,
  link,
}: VerifyYourEmailTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Verify your Email</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Verify your Email
          </Heading>
          <Section className="py-6 mx-auto font-bold text-center text-gray-900 text-base">
            {email}
          </Section>
          <Text className="text-gray-600 text-center text-sm !mt-0 !mb-6">
            Please verify your account to complete the sign-up process.
          </Text>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={link}
          >
            <Text className="!my-[8px]">Verify Email</Text>
          </Button>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

VerifyYourEmail.PreviewProps = {
  email: 'janedoe@gmail.com',
  link: 'https://nocodb.com',
};

export default VerifyYourEmail;
