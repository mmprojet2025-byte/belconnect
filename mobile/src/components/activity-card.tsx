import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { Activity } from '@/lib/api';

const date = new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' });

export function ActivityCard({ activity }: { activity: Activity }) {
  return <Link href={{ pathname: '/activities/[id]', params: { id: activity.id } }} asChild>
    <Pressable accessibilityRole="button" accessibilityLabel={`Voir ${activity.title}`} style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}>
      <ThemedView type="surface" style={styles.card}>
        <View style={styles.topline}><ThemedText type="eyebrow" style={styles.category}>{activity.category}</ThemedText>{activity.demonstration && <ThemedText type="eyebrow" themeColor="textSecondary">Démo</ThemedText>}</View>
        <ThemedText type="subtitle" style={styles.title}>{activity.title}</ThemedText>
        <ThemedText themeColor="textSecondary">{date.format(new Date(activity.startsAt))}</ThemedText>
        <ThemedText themeColor="textSecondary">{activity.city} · {activity.location}</ThemedText>
        <View style={styles.footer}><ThemedText type="smallBold">{activity.price === 0 ? 'Gratuit' : `${activity.price.toFixed(2)} €`}</ThemedText><ThemedText type="small" themeColor="textSecondary">{activity.details.remaining} place(s)</ThemedText></View>
      </ThemedView>
    </Pressable>
  </Link>;
}

const styles = StyleSheet.create({ pressable: { borderRadius: 20 }, pressed: { opacity: 0.72 }, card: { borderRadius: 20, padding: Spacing.four, gap: Spacing.two, borderWidth: 1, borderColor: Colors.border }, topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, category: { color: Colors.brand }, title: { fontSize: 22, lineHeight: 28 }, footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.two } });
