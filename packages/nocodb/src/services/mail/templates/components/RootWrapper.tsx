import { Font, Tailwind } from '@react-email/components';
import * as React from 'react';

export const RootWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <Tailwind
      config={{
        theme: {
          fontFamily: {
            sans: ['Manrope', 'sans-serif'],
          },
          fontSize: {
            xs: ['12px', { lineHeight: '16px' }],
            sm: ['14px', { lineHeight: '20px' }],
            base: ['16px', { lineHeight: '24px' }],
            lg: ['18px', { lineHeight: '28px' }],
            xl: ['20px', { lineHeight: '28px' }],
            '2xl': ['24px', { lineHeight: '32px' }],
            '3xl': ['30px', { lineHeight: '36px' }],
            '4xl': ['36px', { lineHeight: '36px' }],
            '5xl': ['48px', { lineHeight: '1' }],
            '6xl': ['60px', { lineHeight: '1' }],
            '7xl': ['72px', { lineHeight: '1' }],
            '8xl': ['96px', { lineHeight: '1' }],
            '9xl': ['144px', { lineHeight: '1' }],
          },
          spacing: {
            px: '1px',
            0: '0',
            0.5: '2px',
            1: '4px',
            1.5: '6px',
            2: '8px',
            2.5: '10px',
            3: '12px',
            3.5: '14px',
            4: '16px',
            5: '20px',
            6: '24px',
            7: '28px',
            8: '32px',
            9: '36px',
            10: '40px',
            11: '44px',
            12: '48px',
            14: '56px',
            16: '64px',
            20: '80px',
            24: '96px',
            28: '112px',
            32: '128px',
            36: '144px',
            40: '160px',
            44: '176px',
            48: '192px',
            52: '208px',
            56: '224px',
            60: '240px',
            64: '256px',
            72: '288px',
            80: '320px',
            96: '384px',
          },
          extend: {
            colors: {
              base: {
                white: '#FFFFFF',
                black: '#000000',
              },
              brand: {
                50: '#EBF0FF',
                100: '#D6E0FF',
                200: '#ADC2FF',
                300: '#85A3FF',
                400: '#5C85FF',
                500: '#3366FF',
                600: '#2952CC',
                700: '#1F3D99',
                800: '#142966',
                900: '#0A1433',
              },
              gray: {
                10: '#FCFCFC',
                50: '#F9F9FA',
                100: '#F4F4F5',
                200: '#E7E7E9',
                300: '#D5D5D9',
                400: '#9AA2AF',
                500: '#6A7184',
                600: '#4A5268',
                700: '#374151',
                800: '#1F293A',
                900: '#101015',
              },
              red: {
                50: '#FFF2F1',
                100: '#FFDBD9',
                200: '#FFB7B2',
                300: '#FF928C',
                400: '#FF6E65',
                500: '#FF4A3F',
                600: '#E8463C',
                700: '#CB3F36',
                800: '#B23830',
                900: '#7D2721',
              },
              pink: {
                50: '#FFEEFB',
                100: '#FED8F4',
                200: '#FEB0E8',
                300: '#FD89DD',
                400: '#FD61D1',
                500: '#FC3AC6',
                600: '#CA2E9E',
                700: '#972377',
                800: '#65174F',
                900: '#320C28',
              },
              orange: {
                50: '#FFF5EF',
                100: '#FEE6D6',
                200: '#FDCDAD',
                300: '#FCB483',
                400: '#FB9B5A',
                500: '#FA8231',
                600: '#E1752C',
                700: '#C86827',
                800: '#964E1D',
                900: '#4B270F',
              },
              purple: {
                50: '#F3ECFA',
                100: '#E5D4F5',
                200: '#CBA8EB',
                300: '#B17DE1',
                400: '#9751D7',
                500: '#7D26CD',
                600: '#641EA4',
                700: '#4B177B',
                800: '#320F52',
                900: '#190829',
              },
              blue: {
                50: '#EDF9FF',
                100: '#D7F2FF',
                200: '#AFE5FF',
                300: '#86D9FF',
                400: '#5ECCFF',
                500: '#36BFFF',
                600: '#2B99CC',
                700: '#207399',
                800: '#164C66',
                900: '#0B2633',
              },
              yellow: {
                50: '#fffbf2',
                100: '#fff0d1',
                200: '#fee5b0',
                300: '#fdd889',
                400: '#fdcb61',
                500: '#fcbe3a',
                600: '#ca982e',
                700: '#977223',
                800: '#654c17',
                900: '#32260c',
              },
              maroon: {
                50: '#FFF0F7',
                100: '#FFCFE6',
                200: '#FFABD2',
                300: '#EC7DB1',
                400: '#D45892',
                500: '#B33771',
                600: '#9D255D',
                700: '#801044',
                800: '#690735',
                900: '#42001F',
              },
              green: {
                50: '#ECFFF2',
                100: '#D4F7E0',
                200: '#A9EFC1',
                300: '#7DE6A3',
                400: '#52DE84',
                500: '#27D665',
                600: '#1FAB51',
                700: '#17803D',
                800: '#105628',
                900: '#082B14',
              },
            },
          },
        },
      }}
    >
      <Font
        fontFamily="Manrope"
        fallbackFontFamily={['sans-serif']}
        webFont={{
          url: 'https://fonts.gstatic.com/s/manrope/v15/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk59FN_C-bnTfc7AGrY.woff2',
          format: 'woff2',
        }}
        fontStyle="extra-light"
        fontWeight={200}
      />
      <Font
        fontFamily="Manrope"
        fallbackFontFamily={['sans-serif']}
        webFont={{
          url: 'https://fonts.gstatic.com/s/manrope/v15/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk6jFN_C-bnTfc7AGrY.woff2',
          format: 'woff2',
        }}
        fontStyle="light"
        fontWeight={300}
      />
      <Font
        fontFamily="Manrope"
        fallbackFontFamily={['sans-serif']}
        webFont={{
          url: 'https://fonts.gstatic.com/s/manrope/v15/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk79FN_C-bnTfc7AGrY.woff2',
          format: 'woff2',
        }}
        fontStyle="normal"
        fontWeight={400}
      />
      <Font
        fontFamily="Manrope"
        fallbackFontFamily={['sans-serif']}
        webFont={{
          url: 'https://fonts.gstatic.com/s/manrope/v15/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk7PFN_C-bnTfc7AGrY.woff2',
          format: 'woff2',
        }}
        fontStyle="medium"
        fontWeight={500}
      />
      <Font
        fontFamily="Manrope"
        fallbackFontFamily={['sans-serif']}
        webFont={{
          url: 'https://fonts.gstatic.com/s/manrope/v15/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk4jE9_C-bnTfc7AGrY.woff2',
          format: 'woff2',
        }}
        fontStyle="semibold"
        fontWeight={600}
      />
      <Font
        fontFamily="Manrope"
        fallbackFontFamily={['sans-serif']}
        webFont={{
          url: 'https://fonts.gstatic.com/s/manrope/v15/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk4aE9_C-bnTfc7AGrY.woff2',
          format: 'woff2',
        }}
        fontStyle="bold"
        fontWeight={700}
      />
      <Font
        fontFamily="Manrope"
        fallbackFontFamily={['sans-serif']}
        webFont={{
          url: 'https://fonts.gstatic.com/s/manrope/v15/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk59E9_C-bnTfc7AGrY.woff2',
          format: 'woff2',
        }}
        fontStyle="extra-bold"
        fontWeight={800}
      />
      {children}
    </Tailwind>
  );
};
