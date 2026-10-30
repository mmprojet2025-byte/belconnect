import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LocalizedTextInput as TextInput } from '@/components/localized-text-input';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityCard } from '@/components/activity-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useActivities } from '@/hooks/use-activities';
import { useTheme } from '@/hooks/use-theme';
import { useLocale } from '@/context/locale-context';
import { translate } from '@/lib/translations';

export default function ActivitiesScreen() {
  const theme = useTheme();
  const {locale}=useLocale();
  const { activities, loading, error, retry } = useActivities();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'free' | 'soon'>('all');
  const [today] = useState(() => Date.now());
  const visible = useMemo(() => activities.filter(item => {
    const matches = `${item.title} ${item.city} ${item.category}`.toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr'));
    const start = new Date(item.startsAt).getTime();
    const withinWeek = start >= today && start < today + 7 * 24 * 60 * 60 * 1000;
    return matches && (filter === 'all' || (filter === 'free' ? item.price === 0 : withinWeek));
  }), [activities, query, filter, today]);
  return <ThemedView style={styles.screen}><SafeAreaView style={styles.safe} edges={['left', 'right']}><FlatList data={visible} keyExtractor={item => item.id} renderItem={({ item }) => <ActivityCard activity={item} />} contentContainerStyle={styles.list} ItemSeparatorComponent={() => <View style={styles.separator} />} ListHeaderComponent={<View style={styles.header}>
    <ThemedText type="eyebrow" style={styles.eyebrow}>FIL D’ACTIVITÉS</ThemedText><ThemedText type="title" style={styles.title}>À faire près de vous</ThemedText><ThemedText themeColor="textSecondary">Faites défiler les sorties proposées par les communautés.</ThemedText>
    <TextInput accessibilityLabel={translate(locale,'Rechercher une activité ou une ville')} placeholder={translate(locale,'Une activité, une ville…')} placeholderTextColor={theme.textSecondary} value={query} onChangeText={setQuery} style={[styles.search, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{([['all', 'Tout voir'], ['free', 'Gratuit'], ['soon', 'Cette semaine']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={[styles.chip, { borderColor: theme.border }, filter === value && styles.chipSelected]}><ThemedText type="smallBold" style={filter === value ? styles.chipTextSelected : { color: theme.accent }}>{label}</ThemedText></Pressable>)}</ScrollView>
    {!loading && !error && <ThemedText type="small" themeColor="textSecondary">{visible.length} {translate(locale,visible.length>1?'activités':'activité')}</ThemedText>}
  </View>} ListEmptyComponent={loading ? <ThemedText accessibilityLiveRegion="polite">Chargement…</ThemedText> : error ? <View style={styles.header}><ThemedText>Impossible de charger les activités.</ThemedText><Pressable onPress={retry}><ThemedText type="linkPrimary">Réessayer</ThemedText></Pressable></View> : <ThemedText>Aucune activité ne correspond à votre recherche.</ThemedText>} refreshing={loading && activities.length > 0} onRefresh={retry} /></SafeAreaView></ThemedView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' }, list: { padding: Spacing.four, paddingBottom: Spacing.six }, header: { gap: Spacing.two, marginBottom: Spacing.four }, eyebrow: { color: Colors.orange }, title: { fontSize: 30, lineHeight: 36 }, search: { marginTop: Spacing.two, minHeight: 52, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, paddingHorizontal: 16, fontSize: 16 }, filters: { gap: Spacing.two, paddingVertical: Spacing.two }, chip: { borderWidth: 1, borderColor: Colors.border, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10 }, chipSelected: { backgroundColor: Colors.brand, borderColor: Colors.brand }, chipTextSelected: { color: Colors.onBrand }, separator: { height: Spacing.three } });
