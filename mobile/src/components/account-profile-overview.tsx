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
    <View style={styles.heading}><SocialAvatar name={name} size={78} /><Link href="/settings" asChild><Pressable accessibilityRole="button" style={styles.settingsButton}><ThemedText type="smallBold" style={styles.settingsText}>Réglages</ThemedText></Pressable></Link></View>
    <View style={styles.identity}><ThemedText type="title" style={styles.name} numberOfLines={2}>{name}</ThemedText><ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{profile.email}</ThemedText></View>
  </View>;
}

const styles = StyleSheet.create({ container: { paddingVertical: Spacing.two, gap: Spacing.two }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, identity: { gap: 2 }, name: { fontSize: 27, lineHeight: 32 }, settingsButton: { borderWidth: 1, borderColor: Colors.border, borderRadius: 999, minHeight: 44, paddingHorizontal: Spacing.three, alignItems: 'center', justifyContent: 'center' }, settingsText: { color: Colors.brand } });
