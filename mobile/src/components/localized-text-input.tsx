import { TextInput, type TextInputProps } from 'react-native';
import { useLocale } from '@/context/locale-context';
import { translate } from '@/lib/translations';

export function LocalizedTextInput({ placeholder, accessibilityLabel, ...props }: TextInputProps) {
  const { locale } = useLocale();
  return <TextInput {...props} placeholder={placeholder ? translate(locale, placeholder) : undefined} accessibilityLabel={accessibilityLabel ? translate(locale, accessibilityLabel) : undefined} />;
}
