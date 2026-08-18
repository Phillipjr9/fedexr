declare module 'i18n-iso-countries';
declare module '*.json';

declare module 'react-i18next' {
  import * as React from 'react';
  export function useTranslation(ns?: string | string[]): { t: (k: string, opts?: any) => string; i18n: any };
  export const I18nextProvider: React.ComponentType<any>;
  export const Trans: React.ComponentType<any>;
  export const initReactI18next: any;
}

declare module 'i18next' {
  const i18n: any;
  export default i18n;
}

interface Window {
  i18n?: any;
}
