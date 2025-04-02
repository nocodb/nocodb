import {
  Body,
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
import { UITypes } from 'nocodb-sdk';
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
  submissionData: Array<{
    parsedValue?: any;
    columnTitle: string;
    uidt: UITypes | string;
  }>;
}

const FormSubmission = ({
  formTitle,
  baseTitle,
  tableTitle,
  submissionData,
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
                cellPadding="0"
                cellSpacing="0"
                style={{ display: 'inline-block', verticalAlign: 'middle' }}
              >
                <tr>
                  <td style={{ paddingRight: '8px', verticalAlign: 'middle' }}>
                    <Img
                      src={`${NC_EMAIL_ASSETS_BASE_URL}/icons/form-view.png`}
                      alt="Form View Icon"
                      height={24}
                      width={24}
                      className="!h-6 inline-block"
                      style={{ verticalAlign: 'middle' }}
                    />
                  </td>
                  <td style={{ verticalAlign: 'middle' }}>
                    <span
                      className="text-base font-bold mt-0.5 text-gray-900"
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
            <Text className="text-lg font-bold text-center !my-0">
              Here is a copy of the response
            </Text>
            <Section>
              {submissionData.map((s) => (
                <Section className="mt-6" key={s.columnTitle}>
                  <Row>
                    <Column className="flex align-middle items-center">
                      <Img
                        className="align-middle"
                        width={16}
                        height={16}
                        src={`${NC_EMAIL_ASSETS_BASE_URL}/icons/${s.uidt}.png`}
                      />
                      <Section className="!ml-2 truncate inline-block text-[13px] !my-0 !mr-0 leading-4.5 text-gray-600 align-middle">
                        {s.columnTitle}
                      </Section>
                    </Column>
                  </Row>
                  <Row
                    className="px-4 py-2 border border-1 mt-2 border-solid rounded-lg border-gray-200"
                    style={{
                      boxShadow: `0px 0px 4px 0px rgba(0, 0, 0, 0.08)`,
                    }}
                  >
                    <Column>
                      <Text className="text-gray-800 max-w-xs truncate !my-0">
                        {s.parsedValue}
                      </Text>
                    </Column>
                  </Row>
                </Section>
              ))}
            </Section>
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
  submissionData: [
    {
      parsedValue: '$344',
      uidt: UITypes.Currency,
      columnTitle: 'Currency',
    },
    {
      parsedValue: 'Checked',
      uidt: UITypes.Checkbox,
      columnTitle: 'Checkbox',
    },
  ],
};

export default FormSubmission;
