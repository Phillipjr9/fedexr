import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';
import esLocale from 'i18n-iso-countries/langs/es.json';
import frLocale from 'i18n-iso-countries/langs/fr.json';
import deLocale from 'i18n-iso-countries/langs/de.json';
import zhLocale from 'i18n-iso-countries/langs/zh.json';

countries.registerLocale(enLocale);
countries.registerLocale(esLocale);
countries.registerLocale(frLocale);
countries.registerLocale(deLocale);
countries.registerLocale(zhLocale);

export function getCountryList(lang = 'en') {
  const names = countries.getNames(lang) || countries.getNames('en');
  return Object.entries(names).map(([code, name]) => ({ code, name }));
}
