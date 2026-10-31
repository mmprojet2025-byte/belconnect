import { Link } from 'expo-router';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import { avatarChoices, SocialAvatar } from '@/components/social-avatar';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { Profile } from '@/lib/mobile-auth';
import { useLocale } from '@/context/locale-context';
import { translate } from '@/lib/translations';
import { useAuth } from '@/context/auth-context';

type Props = { profile: Profile };

export function AccountProfileOverview({ profile }: Props) {
  const name = `${profile.firstName} ${profile.lastName}`.trim();
  const { locale } = useLocale();
  const auth = useAuth();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const t = (text: string) => translate(locale, text);
  async function choose(code: string) {
    setSaving(true);
    try { await auth.chooseAvatar(code); setPickerOpen(false); }
    catch { Alert.alert(t('Avatar indisponible'), t('Réessayez dans un moment.')); }
    finally { setSaving(false); }
  }
  return <View style={styles.container}>
    <View style={styles.heading}><View style={styles.side}><Pressable accessibilityRole="button" accessibilityLabel={t('Choisir mon avatar')} onPress={() => setPickerOpen(true)} style={styles.avatarButton}><SocialAvatar name={name} avatarCode={profile.avatarCode} size={50} /><View style={styles.avatarEdit}><ThemedText style={styles.avatarPlus}>+</ThemedText></View></Pressable></View><ThemedText type="subtitle" style={styles.title} numberOfLines={1}>{t('Mon espace')}</ThemedText><View style={styles.side}><Link href="/settings" asChild><Pressable accessibilityRole="button" style={styles.settingsButton}><ThemedText type="smallBold" style={styles.settingsText}>{t('Réglages')}</ThemedText></Pressable></Link></View></View>
    <View style={styles.identity}><ThemedText type="title" style={styles.name} numberOfLines={2}>{name}</ThemedText><ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{profile.email}</ThemedText></View>
    <Modal transparent animationType="fade" visible={pickerOpen} onRequestClose={() => setPickerOpen(false)}><View style={styles.overlay}><View style={styles.picker}><ThemedText type="subtitle">{t('Choisir mon avatar')}</ThemedText><ThemedText themeColor="textSecondary">{t('Choisissez un personnage pour votre profil et vos messages.')}</ThemedText><View style={styles.choices}>{avatarChoices.map(code => <Pressable key={code} accessibilityRole="button" accessibilityLabel={`${t('Avatar')} ${code}`} disabled={saving} onPress={() => void choose(code)} style={[styles.choice, profile.avatarCode === code && styles.selected]}><SocialAvatar name={name} avatarCode={code} size={70} /></Pressable>)}</View><Pressable accessibilityRole="button" onPress={() => setPickerOpen(false)} style={styles.close}><ThemedText type="linkPrimary">{t('Fermer')}</ThemedText></Pressable></View></View></Modal>
  </View>;
}

const styles = StyleSheet.create({ container: { padding: Spacing.two, gap: Spacing.three, borderWidth: 1, borderColor: Colors.orangeBorder, borderRadius: 18 }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 }, side: { width: 82, alignItems: 'center' }, title: { flex: 1, textAlign: 'center', fontSize: 20 }, avatarButton: { width: 56, height: 52 }, avatarEdit: { position: 'absolute', right: 0, bottom: 0, width: 19, height: 19, borderRadius: 10, backgroundColor: Colors.brand, alignItems: 'center', justifyContent: 'center' }, avatarPlus: { color: '#FFFFFF', fontSize: 16, lineHeight: 18, fontWeight: '700' }, identity: { gap: 2 }, name: { fontSize: 24, lineHeight: 29 }, settingsButton: { borderWidth: 1, borderColor: Colors.border, borderRadius: 999, minHeight: 40, paddingHorizontal: Spacing.two, alignItems: 'center', justifyContent: 'center' }, settingsText: { color: Colors.brand, fontSize: 12 }, overlay: { flex: 1, justifyContent: 'center', padding: Spacing.four, backgroundColor: 'rgba(0,0,0,.35)' }, picker: { padding: Spacing.four, gap: Spacing.three, borderRadius: 22, backgroundColor: '#FFFFFF' }, choices: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', gap: Spacing.two }, choice: { padding: Spacing.one, borderRadius: 50, borderWidth: 2, borderColor: 'transparent' }, selected: { borderColor: Colors.brand }, close: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' } });
