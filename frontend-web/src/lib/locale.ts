import { useEffect, useState } from 'react';

export type Locale = 'fr' | 'en' | 'nl';
const key = 'belconnect-locale';
const supported = (value: string | null): Locale => value === 'en' || value === 'nl' ? value : 'fr';
export function currentLocale(): Locale { return supported(localStorage.getItem(key)); }
export function setLocale(locale: Locale) {
  localStorage.setItem(key, locale);
  document.documentElement.lang = locale === 'fr' ? 'fr-BE' : locale === 'nl' ? 'nl-BE' : 'en';
  window.dispatchEvent(new Event('belconnect-locale-change'));
}
export function useLocale(): Locale {
  const [locale, update] = useState<Locale>(currentLocale);
  useEffect(() => {
    document.documentElement.lang = locale === 'fr' ? 'fr-BE' : locale === 'nl' ? 'nl-BE' : 'en';
    const sync = () => update(currentLocale());
    window.addEventListener('belconnect-locale-change', sync);
    return () => window.removeEventListener('belconnect-locale-change', sync);
  }, [locale]);
  return locale;
}
export function tr(locale: Locale, fr: string, en: string, nl: string): string {
  return locale === 'en' ? en : locale === 'nl' ? nl : fr;
}
