import { Link } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { activityImages } from '@/lib/activity-images';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { Activity } from '@/lib/api';

const date = new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' });

export function ActivityCard({ activity }: { activity: Activity }) {
  const available = activity.details.remaining > 0;
  const free = activity.price === 0;
  return <Link href={{ pathname: '/activities/[id]', params: { id: activity.id } }} asChild>
    <Pressable accessibilityRole="button" accessibilityLabel={`Voir ${activity.title}, ${free ? 'gratuit' : `${activity.price} euros`}`} style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}>
      <ThemedView type="surface" style={styles.card}>
        <View style={styles.media}>
          {activityImages[activity.image] ? <Image source={activityImages[activity.image]} style={styles.image} resizeMode="cover" accessibilityLabel={`Photo de ${activity.title}`} /> : <View style={styles.imageFallback} />}
          <View style={styles.priceBadge}><ThemedText type="smallBold" style={styles.priceText}>{free ? 'Gratuit' : `${activity.price.toFixed(2)} €`}</ThemedText></View>
        </View>
        <View style={styles.content}>
          <View style={styles.topline}><ThemedText type="eyebrow" style={styles.category}>{activity.category}</ThemedText>{activity.demonstration && <ThemedText type="small" themeColor="textSecondary">Démo</ThemedText>}</View>
          <ThemedText type="subtitle" style={styles.title} numberOfLines={2}>{activity.title}</ThemedText>
          <ThemedText type="smallBold" style={styles.date}>{date.format(new Date(activity.startsAt))}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{activity.city} · {activity.location}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{activity.likedByMe ? '♥' : '♡'} {activity.likeCount} J’aime</ThemedText>
          <View style={styles.footer}><ThemedText type="small" themeColor="textSecondary">{available ? `${activity.details.remaining} places disponibles` : 'Complet'}</ThemedText><ThemedText type="smallBold" style={styles.action}>{free && available ? 'Participer →' : 'Voir l’activité →'}</ThemedText></View>
        </View>
      </ThemedView>
    </Pressable>
  </Link>;
}

const styles = StyleSheet.create({ pressable: { borderRadius: 22 }, pressed: { opacity: 0.75 }, card: { borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border }, media: { position: 'relative' }, image: { width: '100%', height: 190 }, imageFallback: { height: 190, backgroundColor: Colors.brandSoft }, priceBadge: { position: 'absolute', top: 14, right: 14, backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 }, priceText: { color: '#173D32' }, content: { padding: Spacing.three, gap: Spacing.one }, topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, category: { color: Colors.brand }, title: { fontSize: 21, lineHeight: 27 }, date: { color: Colors.brand, textTransform: 'capitalize' }, footer: { borderTopWidth: 1, borderColor: Colors.border, marginTop: Spacing.two, paddingTop: Spacing.two, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.one }, action: { color: Colors.brand, flexShrink: 0 } });
