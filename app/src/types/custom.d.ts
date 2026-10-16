declare module 'i18n-iso-countries';
declare module '*.json';

// Use the installed i18next/react-i18next types rather than replacing their
// exports with `any`, which also breaks React's HTML children augmentation.
interface Window {
  i18n?: typeof import('i18next').default;
}
