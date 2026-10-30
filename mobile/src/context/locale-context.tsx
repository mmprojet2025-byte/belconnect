import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type Locale = 'fr' | 'en' | 'nl';
const storageKey = 'belconnect-locale';
const valid = (value: string | null): Locale => value === 'en' || value === 'nl' ? value : 'fr';
const LocaleContext = createContext<{ locale: Locale; setLocale: (value: Locale) => void } | null>(null);

export function LocaleProvider({ children }: PropsWithChildren) {
  const [locale, update] = useState<Locale>('fr');
  useEffect(() => {
    let active = true;
    const read = Platform.OS === 'web' ? Promise.resolve(typeof localStorage === 'undefined' ? null : localStorage.getItem(storageKey)) : SecureStore.getItemAsync(storageKey);
    read.then(value => { if (active) update(valid(value)); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const value = useMemo(() => ({ locale, setLocale: (next: Locale) => {
    update(next);
    if (Platform.OS === 'web') { if (typeof localStorage !== 'undefined') localStorage.setItem(storageKey, next); }
    else void SecureStore.setItemAsync(storageKey, next).catch(() => {});
  } }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('LocaleProvider is missing');
  return value;
}

export function tr(locale: Locale, fr: string, en: string, nl: string) { return locale === 'en' ? en : locale === 'nl' ? nl : fr; }
