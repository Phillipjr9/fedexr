declare module 'i18n-iso-countries';
declare module '*.json';

declare module 'react-i18next' {
  export function useTranslation(ns?: string | string[]): any;
  export const I18nextProvider: any;
  export const Trans: any;
  export const initReactI18next: any;
  export function withTranslation(...args: any[]): any;
  const _default: any;
  export default _default;
}

declare module 'i18next' {
  const i18n: any;
  export default i18n;
}

interface Window {
  i18n?: any;
}
