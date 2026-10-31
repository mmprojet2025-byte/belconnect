import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { LocalizedTextInput as TextInput } from '@/components/localized-text-input';
import { SocialIcon } from '@/components/social-icon';
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
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [cityOpen, setCityOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [today] = useState(() => Date.now());
  const cities = useMemo(() => [...new Set(activities.map(item => item.city?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, locale)), [activities, locale]);
  const categories = useMemo(() => [...new Set(activities.map(item => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, locale)), [activities, locale]);
  const visible = useMemo(() => activities.filter(item => {
    const matches = `${item.title} ${item.city} ${item.category}`.toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr'));
    const start = new Date(item.startsAt).getTime();
    const withinWeek = start >= today && start < today + 7 * 24 * 60 * 60 * 1000;
    return matches && (!city || item.city?.trim() === city) && (!category || item.category === category) && (filter === 'all' || (filter === 'free' ? item.price === 0 : withinWeek));
  }), [activities, query, city, filter, category, today]);
  const activeFilters = Number(filter !== 'all') + Number(Boolean(category));
  return <ThemedView style={styles.screen}><SafeAreaView style={styles.safe} edges={['left', 'right']}><FlatList data={visible} keyExtractor={item => item.id} renderItem={({ item }) => <ActivityCard activity={item} />} contentContainerStyle={styles.list} ItemSeparatorComponent={() => <View style={styles.separator} />} ListHeaderComponent={<View style={styles.header}>
    <ThemedText type="eyebrow" style={styles.eyebrow}>{translate(locale,'Activités')}</ThemedText><ThemedText type="title" style={styles.title}>{translate(locale,'À faire près de vous')}</ThemedText>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: cityOpen }} accessibilityLabel={translate(locale,'Choisir une ville')} onPress={() => { setCityOpen(value => !value); setFiltersOpen(false); }} style={styles.cityButton}><SocialIcon name="location" color={theme.text} size={20} /><ThemedText type="smallBold" style={{ color: theme.text }}>{city || translate(locale,'Toutes les villes')}</ThemedText><ThemedText style={{ color: theme.textSecondary }}>{cityOpen ? '⌃' : '⌄'}</ThemedText></Pressable>
    {cityOpen && <View style={[styles.options, { backgroundColor: theme.surface, borderColor: theme.border }]}>{['', ...cities].map(value => <Pressable key={value || 'all-cities'} accessibilityRole="button" accessibilityState={{ selected: city === value }} onPress={() => { setCity(value); setCityOpen(false); }} style={[styles.option, city === value && styles.optionSelected]}><ThemedText type="smallBold" style={{ color: theme.text }}>{value || translate(locale,'Toutes les villes')}</ThemedText>{city === value && <ThemedText style={styles.selectedMark}>✓</ThemedText>}</Pressable>)}</View>}
    <View style={[styles.searchBar, { backgroundColor: theme.surface }]}><SocialIcon name="search" color={theme.textSecondary} size={22} /><TextInput accessibilityLabel={translate(locale,'Rechercher une activité')} placeholder={translate(locale,'Rechercher une activité…')} placeholderTextColor={theme.textSecondary} value={query} onChangeText={setQuery} style={[styles.searchInput, { color: theme.text }]} /><Pressable accessibilityRole="button" accessibilityState={{ expanded: filtersOpen }} accessibilityLabel={translate(locale,'Filtres')} onPress={() => { setFiltersOpen(value => !value); setCityOpen(false); }} style={[styles.filterButton, filtersOpen && styles.filterButtonSelected]}><SocialIcon name="filter" color={filtersOpen ? Colors.onBrand : Colors.brand} size={19} /><ThemedText type="smallBold" style={{ color: filtersOpen ? Colors.onBrand : Colors.brand }}>{activeFilters || ''}</ThemedText></Pressable></View>
    {filtersOpen && <View style={[styles.filterPanel, { backgroundColor: theme.surface }]}><View style={styles.panelHeading}><ThemedText type="subtitle">{translate(locale,'Filtres')}</ThemedText><Pressable accessibilityRole="button" onPress={() => { setFilter('all'); setCategory(''); }}><ThemedText type="linkPrimary">{translate(locale,'Réinitialiser')}</ThemedText></Pressable></View><ThemedText type="smallBold">{translate(locale,'Quand et à quel prix')}</ThemedText>{([['all', 'Tout voir'], ['free', 'Gratuit'], ['soon', 'Cette semaine']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={[styles.option, filter === value && styles.optionSelected]}><ThemedText style={{ color: theme.text }}>{translate(locale,label)}</ThemedText>{filter === value && <ThemedText style={styles.selectedMark}>✓</ThemedText>}</Pressable>)}{categories.length > 0 && <><ThemedText type="smallBold" style={styles.categoryHeading}>{translate(locale,'Catégorie')}</ThemedText>{['', ...categories].map(value => <Pressable key={value || 'all-categories'} accessibilityRole="button" accessibilityState={{ selected: category === value }} onPress={() => setCategory(value)} style={[styles.option, category === value && styles.optionSelected]}><ThemedText style={{ color: theme.text }}>{value || translate(locale,'Toutes les catégories')}</ThemedText>{category === value && <ThemedText style={styles.selectedMark}>✓</ThemedText>}</Pressable>)}</>}<Pressable accessibilityRole="button" onPress={() => setFiltersOpen(false)} style={styles.showResults}><ThemedText type="smallBold" style={styles.showResultsText}>{translate(locale,'Voir les résultats')} · {visible.length}</ThemedText></Pressable></View>}
    {!loading && !error && <ThemedText type="small" themeColor="textSecondary">{visible.length} {translate(locale,visible.length>1?'activités':'activité')}</ThemedText>}
  </View>} ListEmptyComponent={loading ? <ThemedText accessibilityLiveRegion="polite">Chargement…</ThemedText> : error ? <View style={styles.header}><ThemedText>Impossible de charger les activités.</ThemedText><Pressable onPress={retry}><ThemedText type="linkPrimary">Réessayer</ThemedText></Pressable></View> : <ThemedText>Aucune activité ne correspond à votre recherche.</ThemedText>} refreshing={loading && activities.length > 0} onRefresh={retry} /></SafeAreaView></ThemedView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  list: { padding: Spacing.four, paddingBottom: Spacing.six }, header: { gap: Spacing.two, marginBottom: Spacing.four },
  eyebrow: { color: Colors.orange }, title: { fontSize: 30, lineHeight: 36, marginBottom: Spacing.one },
  cityButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: Spacing.two, paddingHorizontal: Spacing.two },
  options: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  option: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three },
  optionSelected: { backgroundColor: Colors.orangeSoft }, selectedMark: { color: Colors.brand },
  searchBar: { minHeight: 58, borderWidth: 1, borderColor: Colors.border, borderRadius: 29, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingLeft: Spacing.three, paddingRight: Spacing.two },
  searchInput: { flex: 1, minWidth: 0, height: 54, fontSize: 16 },
  filterButton: { minWidth: 42, minHeight: 42, borderWidth: 1, borderColor: Colors.orangeBorder, borderRadius: 22, paddingHorizontal: Spacing.two, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: Spacing.one },
  filterButtonSelected: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  filterPanel: { borderWidth: 1, borderColor: Colors.border, borderTopWidth: 2, borderTopColor: Colors.orangeBorder, borderRadius: 20, padding: Spacing.three, gap: Spacing.one },
  panelHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.two },
  categoryHeading: { marginTop: Spacing.two },
  showResults: { backgroundColor: Colors.brand, borderRadius: 14, minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.two },
  showResultsText: { color: Colors.onBrand }, separator: { height: Spacing.three },
});
