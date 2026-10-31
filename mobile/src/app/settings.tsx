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
import { LocalizedTextInput as TextInput } from '@/components/localized-text-input';

export default function SettingsScreen() {
  const auth = useAuth();
  const { locale } = useLocale();
  const t = (text: string) => translate(locale, text);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
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
  async function finishDeletion() {
    if(!deletePassword || deleting)return;
    setDeleting(true);setDeleteError('');
    try { await auth.deleteAccount(deletePassword); router.replace('/(tabs)/account'); }
    catch(value) { setDeleteError(value instanceof Error?value.message:'Suppression impossible.'); }
    finally { setDeleting(false); }
  }
  function confirmDeletion() {
    if(!deletePassword)return;
    Alert.alert(t('Supprimer définitivement ce compte ?'),t('Vous perdrez l’accès à votre compte, vos groupes et vos conversations. Certains échanges et documents nécessaires au suivi de la plateforme peuvent être conservés sans votre profil.'),[
      {text:t('Annuler'),style:'cancel'},
      {text:t('Supprimer mon compte'),style:'destructive',onPress:()=>void finishDeletion()},
    ]);
  }
  return <ThemedView style={styles.screen}><ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}><SafeAreaView style={styles.content} edges={['left', 'right', 'bottom']}>
    <ThemedText type="subtitle">{t('Préférences')}</ThemedText>
    <View style={styles.section}><LanguagePicker /></View>
    {auth.profile && <View style={styles.section}><ThemedText type="smallBold">{t('Avatar')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{t('Choisissez un personnage pour votre profil et vos messages.')}</ThemedText><AvatarChoices name={name} selected={auth.profile.avatarCode} disabled={savingAvatar} onSelect={code => void chooseAvatar(code)} label={t('Avatar')} /></View>}
    <ThemedText type="subtitle">{t('Confidentialité')}</ThemedText>
    <Link href="/privacy" asChild><Pressable accessibilityRole="button" style={styles.row}><ThemedText type="smallBold">{t('Confidentialité et données')}</ThemedText><ThemedText style={styles.accent}>→</ThemedText></Pressable></Link>
    <Link href="/legal" asChild><Pressable accessibilityRole="button" style={styles.row}><ThemedText type="smallBold">{t('Informations légales')}</ThemedText><ThemedText style={styles.accent}>→</ThemedText></Pressable></Link>
    {auth.profile && <><ThemedText type="subtitle">{t('Compte')}</ThemedText><Pressable accessibilityRole="button" style={styles.row} onPress={confirmSignOut}><ThemedText type="smallBold" style={styles.signOut}>{t('Se déconnecter')}</ThemedText></Pressable><View style={styles.section}><Pressable accessibilityRole="button" onPress={()=>{setShowDelete(value=>!value);setDeleteError('');}}><ThemedText type="smallBold" style={styles.signOut}>{t('Supprimer mon compte')}</ThemedText></Pressable>{showDelete && <><ThemedText type="small" themeColor="textSecondary">{t('Cette action est définitive. Entrez votre mot de passe pour confirmer. Si vous gérez un espace, transférez d’abord vos responsabilités sur le web.')}</ThemedText><TextInput accessibilityLabel={t('Mot de passe')} placeholder={t('Mot de passe')} secureTextEntry autoCapitalize="none" value={deletePassword} onChangeText={setDeletePassword} style={styles.password} />{!!deleteError && <ThemedText accessibilityLiveRegion="assertive" style={styles.signOut}>{deleteError}</ThemedText>}<Pressable accessibilityRole="button" disabled={!deletePassword||deleting} onPress={confirmDeletion} style={[styles.deleteButton,(!deletePassword||deleting)&&styles.disabled]}><ThemedText type="smallBold" style={styles.deleteText}>{deleting?t('Suppression…'):t('Confirmer la suppression')}</ThemedText></Pressable></>}</View></>}
  </SafeAreaView></ScrollView></ThemedView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, scroll: { alignItems: 'center' }, content: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.four, gap: Spacing.three }, section: { padding: Spacing.three, gap: Spacing.two, backgroundColor: Colors.light.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 16 }, row: { minHeight: 58, paddingHorizontal: Spacing.three, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, backgroundColor: Colors.light.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, accent: { color: Colors.brand }, signOut: { color: '#B42318' }, password: { minHeight: 50, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, color: Colors.light.text }, deleteButton: { minHeight: 48, borderRadius: 12, backgroundColor: '#A9433B', alignItems: 'center', justifyContent: 'center' }, deleteText: { color: '#fff' }, disabled: { opacity: .45 } });
