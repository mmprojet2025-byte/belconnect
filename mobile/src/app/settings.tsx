import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LanguagePicker } from '@/components/language-picker';
import { AvatarChoices } from '@/components/avatar-choices';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useLocale } from '@/context/locale-context';
import { translate } from '@/lib/translations';
import { useState } from 'react';

export default function SettingsScreen() {
  const auth = useAuth();
  const { locale } = useLocale();
  const t = (text: string) => translate(locale, text);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const name = auth.profile ? `${auth.profile.firstName} ${auth.profile.lastName}`.trim() : '';
  async function chooseAvatar(code: string) {
    setSavingAvatar(true);
    try { await auth.chooseAvatar(code); }
    catch { Alert.alert(t('Avatar indisponible'), t('Réessayez dans un moment.')); }
    finally { setSavingAvatar(false); }
  }
  const confirmSignOut = () => Alert.alert(t('Se déconnecter ?'), t('Vous pourrez vous reconnecter à tout moment.'), [
    { text: t('Rester connecté'), style: 'cancel' },
    { text: t('Se déconnecter'), style: 'destructive', onPress: () => { void auth.signOut().then(() => router.replace('/(tabs)/account')); } },
  ]);
  return <ThemedView style={styles.screen}><ScrollView contentContainerStyle={styles.scroll}><SafeAreaView style={styles.content} edges={['left', 'right', 'bottom']}>
    <ThemedText type="subtitle">{t('Préférences')}</ThemedText>
    <View style={styles.section}><LanguagePicker /></View>
    {auth.profile && <View style={styles.section}><ThemedText type="smallBold">{t('Avatar')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{t('Choisissez un personnage pour votre profil et vos messages.')}</ThemedText><AvatarChoices name={name} selected={auth.profile.avatarCode} disabled={savingAvatar} onSelect={code => void chooseAvatar(code)} label={t('Avatar')} /></View>}
    <ThemedText type="subtitle">{t('Confidentialité')}</ThemedText>
    <Link href="/privacy" asChild><Pressable accessibilityRole="button" style={styles.row}><ThemedText type="smallBold">{t('Confidentialité et données')}</ThemedText><ThemedText style={styles.accent}>→</ThemedText></Pressable></Link>
    <Link href="/legal" asChild><Pressable accessibilityRole="button" style={styles.row}><ThemedText type="smallBold">{t('Informations légales')}</ThemedText><ThemedText style={styles.accent}>→</ThemedText></Pressable></Link>
    {auth.profile && <><ThemedText type="subtitle">{t('Compte')}</ThemedText><View style={styles.section}><ThemedText type="smallBold">{t('Désactivation et suppression')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{t('Ces options ne sont pas encore disponibles. Elles nécessitent un parcours sécurisé et la gestion des données liées au compte.')}</ThemedText></View><Pressable accessibilityRole="button" style={styles.row} onPress={confirmSignOut}><ThemedText type="smallBold" style={styles.signOut}>{t('Se déconnecter')}</ThemedText></Pressable></>}
  </SafeAreaView></ScrollView></ThemedView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, scroll: { alignItems: 'center' }, content: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.four, gap: Spacing.three }, section: { padding: Spacing.three, gap: Spacing.two, backgroundColor: Colors.light.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 16 }, row: { minHeight: 58, paddingHorizontal: Spacing.three, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, backgroundColor: Colors.light.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, accent: { color: Colors.brand }, signOut: { color: '#B42318' } });
