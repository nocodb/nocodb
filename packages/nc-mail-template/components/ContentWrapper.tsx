import { Button, Heading, Img, Section, Text, Container } from '@react-email/components';
import { baseUrl } from '../utils/constant';
import * as React from 'react';

const ContentWrapper = ({ children }) => {
  return (
    <Container className="px-3 my-16 max-w-[480px]">
      <Section className="py-6 m-auto bg-gray-50 border border-gray-200 border-solid rounded-t-xl">
        <Img
          alt="NocoDB"
          src={`${baseUrl}/static/nocodb-logo.png`}
          width={40}
          style={{ display: 'block', margin: 'auto auto' }}
          height={40}
        />
      </Section>
      <Section className="p-6 border border-gray-200 border-solid border-t-0 rounded-b-xl bg-white">
        {children}
      </Section>

    </Container>
  )
}

export default ContentWrapper;