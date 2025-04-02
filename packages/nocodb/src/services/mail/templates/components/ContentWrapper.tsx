import { Container, Hr, Img, Section } from '@react-email/components';
import * as React from 'react';
import { NC_EMAIL_ASSETS_BASE_URL } from '~/constants';

export const ContentWrapper = ({
  children,
  disableContainerPadding,
}: {
  children: React.ReactNode;
  disableContainerPadding?: boolean;
}) => {
  return (
    <Container className="px-3 mt-16 !my-0 max-w-[480px]">
      <Section className="py-6 m-auto bg-gray-50 border border-gray-200 border-solid rounded-t-xl">
        <Img
          alt="NocoDB"
          src={`${NC_EMAIL_ASSETS_BASE_URL}/nocodb-logo.png`}
          width={40}
          style={{ display: 'block', margin: 'auto auto' }}
          height={40}
        />
      </Section>
      <Section
        className={`border border-gray-200 border-solid border-t-0 rounded-b-xl bg-white ${
          disableContainerPadding ? 'p-0' : 'p-6'
        }`}
      >
        {children}
      </Section>

      <Hr className="!my-16" />
    </Container>
  );
};
