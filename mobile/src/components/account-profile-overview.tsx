import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SocialAvatar } from '@/components/social-avatar';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { Profile } from '@/lib/mobile-auth';
import { useLocale } from '@/context/locale-context';
import { translate } from '@/lib/translations';

type Props = { profile: Profile };

export function AccountProfileOverview({ profile }: Props) {
  const name = `${profile.firstName} ${profile.lastName}`.trim();
  const { locale } = useLocale();
  return <View style={styles.container}>
    <View style={styles.heading}><View style={styles.side}><SocialAvatar name={name} size={50} /></View><ThemedText type="subtitle" style={styles.title} numberOfLines={1}>{translate(locale, 'Mon espace')}</ThemedText><View style={styles.side}><Link href="/settings" asChild><Pressable accessibilityRole="button" style={styles.settingsButton}><ThemedText type="smallBold" style={styles.settingsText}>{translate(locale, 'Réglages')}</ThemedText></Pressable></Link></View></View>
    <View style={styles.identity}><ThemedText type="title" style={styles.name} numberOfLines={2}>{name}</ThemedText><ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{profile.email}</ThemedText></View>
  </View>;
}

const styles = StyleSheet.create({ container: { padding: Spacing.two, gap: Spacing.three, borderWidth: 1, borderColor: '#DFAE8B', borderRadius: 18 }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 }, side: { width: 82, alignItems: 'center' }, title: { flex: 1, textAlign: 'center', fontSize: 20 }, identity: { gap: 2 }, name: { fontSize: 24, lineHeight: 29 }, settingsButton: { borderWidth: 1, borderColor: Colors.border, borderRadius: 999, minHeight: 40, paddingHorizontal: Spacing.two, alignItems: 'center', justifyContent: 'center' }, settingsText: { color: Colors.brand, fontSize: 12 } });
