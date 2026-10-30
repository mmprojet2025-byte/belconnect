import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Locale, useLocale } from '@/context/locale-context';
import { Colors, Spacing } from '@/constants/theme';

const languages: { code: Locale; label: string }[] = [
  { code: 'fr', label: 'Français' }, { code: 'en', label: 'English' }, { code: 'nl', label: 'Nederlands' },
];

export function LanguagePicker() {
  const { locale, setLocale } = useLocale();
  return <View style={styles.container}><ThemedText type="smallBold">Langue</ThemedText><View style={styles.row}>{languages.map(item => <Pressable key={item.code} accessibilityRole="radio" accessibilityState={{ selected: locale === item.code }} accessibilityLabel={item.label} style={[styles.option, locale === item.code && styles.selected]} onPress={() => setLocale(item.code)}><ThemedText type="smallBold" style={locale === item.code ? styles.selectedText : styles.text}>{item.label}</ThemedText></Pressable>)}</View></View>;
}

const styles = StyleSheet.create({ container: { gap: Spacing.one }, row: { flexDirection: 'row', gap: Spacing.one }, option: { flex: 1, minHeight: 42, paddingHorizontal: 4, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border }, selected: { backgroundColor: Colors.brand, borderColor: Colors.brand }, selectedText: { color: Colors.onBrand, fontSize: 12 }, text: { color: Colors.light.textSecondary, fontSize: 12 } });
