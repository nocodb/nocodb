import {
  Body,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Button, Section,
} from '@react-email/components';
import * as React from 'react';
import RootWrapper from '../components/RootWrapper';
import { Footer } from '../components/Footer';
import ContentWrapper from '../components/ContentWrapper';

// Corresponding ejs template
interface Props {
  email: string;
  link: string;
}

export const PasswordReset = () => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Password reset requested</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Password reset requested
          </Heading>
          <Section className="py-6 mx-auto font-bold text-center text-gray-900 text-base">
            {'<%= email %>'}
          </Section>
          <Text className="text-gray-600 text-center text-sm !mt-0">
            You’ve requested for a password reset, click on the ‘Reset Password’ button to reset your password.
          </Text>
          <Button className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10" href="<%= link %>">
            <Text className="!my-[8px]">
              Reset Password
            </Text>
          </Button>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);
export default PasswordReset;
