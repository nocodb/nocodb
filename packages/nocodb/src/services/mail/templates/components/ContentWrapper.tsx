import { Container, Img, Section } from '@react-email/components';
import * as React from 'react';
import { NC_EMAIL_ASSETS_BASE_URL } from '~/constants';

export const ContentWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <Container className="px-3 my-16 max-w-[480px]">
      <Section className="py-6 m-auto bg-gray-50 border border-gray-200 border-solid rounded-t-xl">
        <Img
          alt="NocoDB"
          src={`${NC_EMAIL_ASSETS_BASE_URL}/nocodb-logo.png`}
          width={40}
          style={{ display: 'block', margin: 'auto auto' }}
          height={40}
        />
      </Section>
      <Section className="p-6 border border-gray-200 border-solid border-t-0 rounded-b-xl bg-white">
        {children}
      </Section>
    </Container>
  );
};
