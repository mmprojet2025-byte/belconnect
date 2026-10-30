import { StyleSheet, View } from 'react-native';
import { SocialAvatar } from '@/components/social-avatar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { Profile } from '@/lib/mobile-auth';

type Props = { profile: Profile };

export function AccountProfileOverview({ profile }: Props) {
  const name = `${profile.firstName} ${profile.lastName}`.trim();
  return <View style={styles.container}>
    <View style={styles.heading}><SocialAvatar name={name} size={78} /><View style={styles.identity}><ThemedText type="title" style={styles.name} numberOfLines={2}>{name}</ThemedText><ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{profile.email}</ThemedText></View></View>
  </View>;
}

const styles = StyleSheet.create({ container: { paddingVertical: Spacing.two }, heading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three }, identity: { flex: 1, gap: 2 }, name: { fontSize: 27, lineHeight: 32 } });
