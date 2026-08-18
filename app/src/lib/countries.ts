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
  const list = Object.entries(names).map(([code, name]) => ({ code, name }));

  // Add Kosovo if missing (not in all ISO lists)
  if (!list.find(c => c.code === 'XK')) {
    list.push({ code: 'XK', name: lang === 'es' ? 'Kosovo' : lang === 'fr' ? 'Kosovo' : lang === 'de' ? 'Kosovo' : lang === 'zh' ? '科索沃' : 'Kosovo' });
  }

  // Sort by localized name
  list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}
