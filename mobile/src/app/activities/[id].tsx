import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { Activity, getActivity } from '@/lib/api';

const date = new Intl.DateTimeFormat('fr-BE', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Brussels' });

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activity, setActivity] = useState<Activity>(); const [error, setError] = useState(false); const [revision, setRevision] = useState(0);
  useEffect(() => { if (!id) return; const controller = new AbortController(); getActivity(id, controller.signal).then(setActivity).catch(() => { if (!controller.signal.aborted) setError(true); }); return () => controller.abort(); }, [id, revision]);
  return <ThemedView style={styles.screen}><ScrollView contentContainerStyle={styles.scroll}><SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
    {!activity && !error && <ThemedText accessibilityLiveRegion="polite">Chargement de l’activité…</ThemedText>}
    {error && <View style={styles.block}><ThemedText type="smallBold">Cette activité est indisponible.</ThemedText><Pressable onPress={() => { setActivity(undefined); setError(false); setRevision(value => value + 1); }}><ThemedText type="linkPrimary">Réessayer</ThemedText></Pressable></View>}
    {activity && <><View style={styles.hero}><ThemedText type="eyebrow" style={styles.brand}>{activity.category}</ThemedText><ThemedText type="title">{activity.title}</ThemedText><ThemedText themeColor="textSecondary">{date.format(new Date(activity.startsAt))}</ThemedText><ThemedText themeColor="textSecondary">{activity.city} · {activity.location}</ThemedText></View><View style={styles.block}><ThemedText type="subtitle">L’expérience</ThemedText><ThemedText>{activity.description}</ThemedText></View><View style={styles.block}><ThemedText type="subtitle">Informations pratiques</ThemedText><ThemedText>Rendez-vous : {activity.details.meetingPoint}</ThemedText><ThemedText>Durée : {activity.details.duration}</ThemedText><ThemedText>Public : {activity.details.audience}</ThemedText><ThemedText>Organisé par {activity.host}</ThemedText></View><View style={styles.booking}><View><ThemedText type="smallBold">{activity.price === 0 ? 'Gratuit' : `${activity.price.toFixed(2)} €`}</ThemedText><ThemedText type="small" themeColor="textSecondary">{activity.details.remaining} place(s) disponible(s)</ThemedText></View><View style={styles.disabledButton}><ThemedText type="smallBold" style={styles.disabledText}>Réservation bientôt</ThemedText></View></View></>}
  </SafeAreaView></ScrollView></ThemedView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, scroll: { alignItems: 'center' }, container: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.four, gap: Spacing.four }, hero: { backgroundColor: Colors.brandSoft, borderRadius: 24, padding: Spacing.five, gap: Spacing.two }, brand: { color: Colors.brand }, block: { gap: Spacing.two }, booking: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.four, borderTopWidth: 1, borderColor: Colors.border }, disabledButton: { backgroundColor: Colors.brandSoft, borderRadius: 14, padding: 14 }, disabledText: { color: Colors.brand } });
