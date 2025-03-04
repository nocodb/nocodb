import {
  Body,
  Button,
  Column,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Row,
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

interface FormSubmissionTemplateProps {
  formTitle: string;
  tableTitle: string;
  baseTitle: string;
}

const FormSubmission = ({
  formTitle,
  baseTitle,
  tableTitle,
}: FormSubmissionTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>You have a new response!</Preview>
      <Body className="bg-white">
        <ContentWrapper disableContainerPadding>
          <Section className="p-6 mx-auto">
            <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
              You have a new response!
            </Heading>

            <Section
              align="center"
              className="my-6"
              style={{ textAlign: 'center', lineHeight: '28px' }}
            >
              <table
                cellpadding="0"
                cellspacing="0"
                style={{ display: 'inline-block', verticalAlign: 'middle' }}
              >
                <tr>
                  <td style={{ paddingRight: '8px', verticalAlign: 'middle' }}>
                    <Img
                      src={`${NC_EMAIL_ASSETS_BASE_URL}/icons/form-view.png`}
                      alt="Form View Icon"
                      height={28}
                      width={28}
                      className="!h-6 inline-block"
                      style={{ verticalAlign: 'middle' }}
                    />
                  </td>
                  <td style={{ verticalAlign: 'middle' }}>
                    <span
                      className="text-base font-bold text-gray-900"
                      style={{
                        verticalAlign: 'middle',
                        display: 'inline-block',
                        lineHeight: '28px',
                      }}
                    >
                      {formTitle}
                    </span>
                  </td>
                </tr>
              </table>
            </Section>

            <Text className="text-center font-weight-thin text-gray-600 !my-0">
              Someone has responded to your form, a record has been added to
              <span className="font-bold text-gray-800"> {tableTitle} </span>
              in
              <span className="font-bold text-gray-800"> {baseTitle}</span>.
            </Text>
          </Section>

          <Hr />

          <Section className="p-6 mx-auto">
            <Text className="text-lg font-bold text-center !mt-0 !mb-6">
              Here is a copy of the response
            </Text>
          </Section>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

FormSubmission.PreviewProps = {
  formTitle: 'Form Name',
  tableTitle: 'Table Name',
  baseTitle: 'Base Name',
};

export default FormSubmission;
