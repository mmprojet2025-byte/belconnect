import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityCard } from '@/components/activity-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useActivities } from '@/hooks/use-activities';

export default function ActivitiesScreen() {
  const { activities, loading, error, retry } = useActivities();
  return <ThemedView style={styles.screen}><SafeAreaView style={styles.safe} edges={['left', 'right']}><FlatList data={activities} keyExtractor={item => item.id} renderItem={({ item }) => <ActivityCard activity={item} />} contentContainerStyle={styles.list} ItemSeparatorComponent={() => <View style={styles.separator} />} ListHeaderComponent={<View style={styles.header}><ThemedText type="title">Bougez, partagez, rencontrez.</ThemedText><ThemedText themeColor="textSecondary">Des rendez-vous proposés par les communautés locales.</ThemedText></View>} ListEmptyComponent={loading ? <ThemedText accessibilityLiveRegion="polite">Chargement…</ThemedText> : error ? <View style={styles.header}><ThemedText>Impossible de charger les activités.</ThemedText><Pressable onPress={retry}><ThemedText type="linkPrimary">Réessayer</ThemedText></Pressable></View> : <ThemedText>Aucune activité publiée pour le moment.</ThemedText>} refreshing={loading && activities.length > 0} onRefresh={retry} /></SafeAreaView></ThemedView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, safe: { flex: 1, alignItems: 'center' }, list: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.four, paddingBottom: Spacing.six }, header: { gap: Spacing.two, marginBottom: Spacing.four }, separator: { height: Spacing.three } });
