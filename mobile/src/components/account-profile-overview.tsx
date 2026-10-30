import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SocialAvatar } from '@/components/social-avatar';
import { SocialIcon } from '@/components/social-icon';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getGroups, Group } from '@/lib/groups';
import { Profile } from '@/lib/mobile-auth';

type Props = { profile: Profile; token: string | null; bookingCount: number };

export function AccountProfileOverview({ profile, token, bookingCount }: Props) {
  const theme = useTheme();
  const [groups, setGroups] = useState<Group[]>([]);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    getGroups(controller.signal, token).then(items => {
      if (!controller.signal.aborted) setGroups(items.filter(item => item.membershipStatus === 'MEMBRE' || item.membershipStatus === 'ADMINISTRATEUR'));
    }).catch(() => {});
    return () => controller.abort();
  }, [token]);

  const name = `${profile.firstName} ${profile.lastName}`.trim();
  return <View style={styles.container}>
    <View style={styles.heading}><SocialAvatar name={name} size={78} /><View style={styles.identity}><ThemedText type="title" style={styles.name} numberOfLines={2}>{name}</ThemedText><ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{profile.email}</ThemedText></View></View>
    <ThemedText themeColor="textSecondary">Vos rencontres et communautés BelConnect, au même endroit.</ThemedText>
    <View style={[styles.stats, { borderColor: theme.border }]}><View style={styles.stat}><ThemedText type="subtitle">{groups.length}</ThemedText><ThemedText type="small" themeColor="textSecondary">groupe{groups.length > 1 ? 's' : ''}</ThemedText></View><View style={[styles.divider, { backgroundColor: theme.border }]} /><View style={styles.stat}><ThemedText type="subtitle">{bookingCount}</ThemedText><ThemedText type="small" themeColor="textSecondary">réservation{bookingCount > 1 ? 's' : ''}</ThemedText></View></View>
    <View style={styles.actions}><Link href="/groups" asChild><Pressable accessibilityRole="button" style={styles.primaryAction}><SocialIcon name="group" color={Colors.onBrand} size={18} /><ThemedText type="smallBold" style={styles.primaryText}>Mes groupes</ThemedText></Pressable></Link><Link href="/messages" asChild><Pressable accessibilityRole="button" style={StyleSheet.flatten([styles.secondaryAction, { borderColor: theme.border, backgroundColor: theme.surface }])}><SocialIcon name="message" color={theme.accent} size={18} /><ThemedText type="smallBold" style={{ color: theme.accent }}>Messages</ThemedText></Pressable></Link></View>
  </View>;
}

const styles = StyleSheet.create({ container: { gap: Spacing.three }, heading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three }, identity: { flex: 1, gap: 2 }, name: { fontSize: 27, lineHeight: 32 }, stats: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: Spacing.three }, stat: { flex: 1, alignItems: 'center', gap: 2 }, divider: { width: 1 }, actions: { flexDirection: 'row', gap: Spacing.two }, primaryAction: { flex: 1, minHeight: 46, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: Colors.brand }, primaryText: { color: Colors.onBrand }, secondaryAction: { flex: 1, minHeight: 46, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, secondaryText: { color: Colors.brand } });
