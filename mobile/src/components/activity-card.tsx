import { Link } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { activityImages } from '@/lib/activity-images';
import { SocialAvatar } from '@/components/social-avatar';
import { SocialIcon } from '@/components/social-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { Activity } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';

const date = new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' });

export function ActivityCard({ activity }: { activity: Activity }) {
  const theme = useTheme();
  const available = activity.details.remaining > 0;
  const free = activity.price === 0;
  return <Link href={{ pathname: '/activities/[id]', params: { id: activity.id } }} asChild>
    <Pressable accessibilityRole="button" accessibilityLabel={`Voir ${activity.title}, ${free ? 'gratuit' : `${activity.price} euros`}`} style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}>
      <ThemedView type="surface" style={[styles.card, { borderColor: theme.border }]}>
        <View style={styles.publisher}><SocialAvatar name={activity.host} size={40} /><View style={styles.publisherCopy}><ThemedText type="smallBold" numberOfLines={1}>{activity.host}</ThemedText><ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{activity.city} · {date.format(new Date(activity.startsAt))}</ThemedText></View><SocialIcon name="chevron" color={theme.textSecondary} size={18} /></View>
        <View style={styles.media}>
          {activityImages[activity.image] ? <Image source={activityImages[activity.image]} style={styles.image} resizeMode="cover" accessibilityLabel={`Photo de ${activity.title}`} /> : <View style={styles.imageFallback}><SocialIcon name="activity" color={Colors.brand} size={42} /></View>}
          <View style={styles.priceBadge}><ThemedText type="smallBold" style={styles.priceText}>{free ? 'Gratuit' : `${activity.price.toFixed(2)} €`}</ThemedText></View>
        </View>
        <View style={styles.content}>
          <View style={styles.topline}><ThemedText type="eyebrow" style={styles.category}>{activity.category}</ThemedText>{activity.demonstration && <ThemedText type="small" themeColor="textSecondary">Démo</ThemedText>}</View>
          <ThemedText type="subtitle" style={styles.title} numberOfLines={2}>{activity.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{activity.location} · {available ? `${activity.details.remaining} places restantes` : 'Complet'}</ThemedText>
          <View style={styles.social}><View style={styles.metric}><SocialIcon name={activity.likedByMe ? 'heartFilled' : 'heart'} color={activity.likedByMe ? Colors.accent : theme.text} size={21} /><ThemedText type="smallBold">{activity.likeCount}</ThemedText></View><View style={styles.metric}><SocialIcon name="comment" color={theme.text} size={20} /><ThemedText type="smallBold">{activity.commentCount}</ThemedText></View><ThemedText type="smallBold" style={styles.action}>Voir l’activité →</ThemedText></View>
        </View>
      </ThemedView>
    </Pressable>
  </Link>;
}

const styles = StyleSheet.create({ pressable: { borderRadius: 22 }, pressed: { opacity: 0.75 }, card: { borderRadius: 22, overflow: 'hidden', borderWidth: 1 }, publisher: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.three, paddingVertical: 12, gap: 10 }, publisherCopy: { flex: 1 }, media: { position: 'relative' }, image: { width: '100%', height: 220 }, imageFallback: { height: 220, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, priceBadge: { position: 'absolute', top: 14, right: 14, backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 }, priceText: { color: '#173D32' }, content: { padding: Spacing.three, gap: Spacing.one }, topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, category: { color: Colors.brand }, title: { fontSize: 21, lineHeight: 27 }, social: { borderTopWidth: 1, borderColor: Colors.border, marginTop: Spacing.two, paddingTop: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.four }, metric: { flexDirection: 'row', alignItems: 'center', gap: 5 }, action: { color: Colors.brand, marginLeft: 'auto' } });
