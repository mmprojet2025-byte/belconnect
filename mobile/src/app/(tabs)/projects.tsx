import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { LocalizedTextInput as TextInput } from '@/components/localized-text-input';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProjectFeedCard } from '@/components/project-feed-card';
import { SocialIcon } from '@/components/social-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { getProjects, Project } from '@/lib/projects';
import { useLocale } from '@/context/locale-context';
import { translate } from '@/lib/translations';

export default function ProjectsScreen() {
  const { token } = useAuth();
  return <ProjectsContent key={token ?? 'guest'} token={token} />;
}

function ProjectsContent({ token }: { token: string | null }) {
  const theme = useTheme();
  const {locale}=useLocale();
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'free' | 'help'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getProjects(controller.signal, token).then(items => { if (!controller.signal.aborted) setProjects(items); })
      .catch(() => { if (!controller.signal.aborted) setError('Impossible de charger les projets.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision, token]);
  const visible = useMemo(() => projects.filter(item => {
    const matches = `${item.title} ${item.objective} ${item.spaceName}`.toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr'));
    return matches && (filter === 'all' || (filter === 'free' ? item.participationPriceCents === 0 : item.helpTypes.length > 0));
  }), [projects, query, filter]);
  const retry = () => { setError(''); setLoading(true); setRevision(value => value + 1); };

  return <ThemedView style={styles.screen}><SafeAreaView style={styles.safe} edges={['left', 'right']}><FlatList data={visible} keyExtractor={item => String(item.id)} contentContainerStyle={styles.list} ListHeaderComponent={<View style={styles.header}>
    <ThemedText type="eyebrow" style={styles.eyebrow}>FIL DE PROJETS</ThemedText><ThemedText type="title" style={styles.title}>Des idées à découvrir</ThemedText><ThemedText themeColor="textSecondary">Faites défiler les projets des communautés.</ThemedText>
    <View style={[styles.search, { backgroundColor: theme.surface }]}><SocialIcon name="search" color={theme.textSecondary} size={20} /><TextInput accessibilityLabel={translate(locale,'Rechercher un projet')} placeholder={translate(locale,'Un projet, un objectif…')} placeholderTextColor={theme.textSecondary} value={query} onChangeText={setQuery} style={[styles.searchInput, { color: theme.text }]} /><Pressable accessibilityRole="button" accessibilityState={{ expanded: filtersOpen }} accessibilityLabel={translate(locale,'Filtres')} onPress={() => setFiltersOpen(value => !value)} style={[styles.filterButton, filtersOpen && styles.filterButtonSelected]}><SocialIcon name="filter" color={filtersOpen ? Colors.onBrand : Colors.brand} size={19} /><ThemedText type="smallBold" style={{ color: filtersOpen ? Colors.onBrand : Colors.brand }}>{filter === 'all' ? '' : '1'}</ThemedText></Pressable></View>
    {filtersOpen && <View style={[styles.filterPanel, { backgroundColor: theme.surface }]}><View style={styles.panelHeading}><ThemedText type="subtitle">{translate(locale,'Filtres')}</ThemedText><Pressable accessibilityRole="button" onPress={() => setFilter('all')}><ThemedText type="linkPrimary">{translate(locale,'Réinitialiser')}</ThemedText></Pressable></View>{([['all', 'Tout voir'], ['free', 'Gratuit'], ['help', 'Aide recherchée']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={[styles.option, filter === value && styles.optionSelected]}><ThemedText style={{ color: theme.text }}>{translate(locale,label)}</ThemedText>{filter === value && <ThemedText style={styles.selectedMark}>✓</ThemedText>}</Pressable>)}<Pressable accessibilityRole="button" onPress={() => setFiltersOpen(false)} style={styles.showResults}><ThemedText type="smallBold" style={styles.showResultsText}>{translate(locale,'Voir les résultats')} · {visible.length}</ThemedText></Pressable></View>}
    {!loading && !error && <ThemedText type="small" themeColor="textSecondary">{visible.length} {translate(locale,visible.length>1?'projets à découvrir':'projet à découvrir')}</ThemedText>}
  </View>} renderItem={({ item }) => <ProjectFeedCard project={item} />} ItemSeparatorComponent={() => <View style={styles.separator} />} ListEmptyComponent={loading ? <ThemedText accessibilityLiveRegion="polite">Chargement des projets…</ThemedText> : error ? <ThemedView type="surface" style={styles.empty}><ThemedText>{error}</ThemedText><Pressable accessibilityRole="button" onPress={retry}><ThemedText type="linkPrimary">Réessayer</ThemedText></Pressable></ThemedView> : <ThemedView type="surface" style={styles.empty}><ThemedText type="smallBold">{query || filter !== 'all' ? translate(locale,'Aucun résultat') : translate(locale,'Aucun projet publié')}</ThemedText><ThemedText themeColor="textSecondary">{query || filter !== 'all' ? translate(locale,'Essayez une autre recherche.') : translate(locale,'Revenez bientôt découvrir de nouvelles idées.')}</ThemedText></ThemedView>} refreshing={loading && projects.length > 0} onRefresh={retry} /></SafeAreaView></ThemedView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' }, list: { padding: Spacing.four, paddingBottom: Spacing.six }, header: { gap: Spacing.two, marginBottom: Spacing.four }, eyebrow: { color: Colors.orange }, title: { fontSize: 30, lineHeight: 36 }, search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderColor: Colors.orangeBorder, borderRadius: 29, paddingLeft: Spacing.three, paddingRight: Spacing.two, marginTop: Spacing.two }, searchInput: { flex: 1, minWidth: 0, minHeight: 54, fontSize: 16 }, filterButton: { minWidth: 42, minHeight: 42, borderWidth: 1, borderColor: Colors.orangeBorder, borderRadius: 22, paddingHorizontal: Spacing.two, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: Spacing.one }, filterButtonSelected: { backgroundColor: Colors.brand, borderColor: Colors.brand }, filterPanel: { borderWidth: 1, borderColor: Colors.border, borderTopWidth: 2, borderTopColor: Colors.orangeBorder, borderRadius: 20, padding: Spacing.three, gap: Spacing.one }, panelHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.two }, option: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three, borderRadius: 10 }, optionSelected: { backgroundColor: Colors.orangeSoft }, selectedMark: { color: Colors.brand }, showResults: { backgroundColor: Colors.brand, borderRadius: 14, minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.two }, showResultsText: { color: Colors.onBrand }, separator: { height: Spacing.three }, empty: { padding: Spacing.four, borderRadius: 18, gap: Spacing.two } });
