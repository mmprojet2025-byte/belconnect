import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SocialAvatar } from '@/components/social-avatar';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { Profile } from '@/lib/mobile-auth';

type Props = { profile: Profile };

export function AccountProfileOverview({ profile }: Props) {
  const name = `${profile.firstName} ${profile.lastName}`.trim();
  return <View style={styles.container}>
    <View style={styles.heading}><SocialAvatar name={name} size={78} /><View style={styles.identity}><ThemedText type="title" style={styles.name} numberOfLines={2}>{name}</ThemedText><ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{profile.email}</ThemedText></View><Link href="/settings" asChild><Pressable accessibilityRole="button" style={styles.settingsButton}><ThemedText type="smallBold" style={styles.settingsText}>Réglages</ThemedText></Pressable></Link></View>
  </View>;
}

const styles = StyleSheet.create({ container: { paddingVertical: Spacing.two }, heading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two }, identity: { flex: 1, minWidth: 0, gap: 2 }, name: { fontSize: 21, lineHeight: 25 }, settingsButton: { borderWidth: 1, borderColor: Colors.border, borderRadius: 999, minHeight: 40, paddingHorizontal: Spacing.two, alignItems: 'center', justifyContent: 'center' }, settingsText: { color: Colors.brand, fontSize: 12 } });
