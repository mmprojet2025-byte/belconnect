import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProjectFeedCard } from '@/components/project-feed-card';
import { SocialIcon } from '@/components/social-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { getProjects, Project } from '@/lib/projects';

export default function ProjectsScreen() {
  const { token } = useAuth();
  return <ProjectsContent key={token ?? 'guest'} token={token} />;
}

function ProjectsContent({ token }: { token: string | null }) {
  const theme = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState('');
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
  const visible = useMemo(() => projects.filter(item => `${item.title} ${item.objective} ${item.spaceName}`.toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr'))), [projects, query]);
  const retry = () => { setError(''); setLoading(true); setRevision(value => value + 1); };

  return <ThemedView style={styles.screen}><SafeAreaView style={styles.safe} edges={['left', 'right']}><FlatList data={visible} keyExtractor={item => String(item.id)} contentContainerStyle={styles.list} ListHeaderComponent={<View style={styles.header}>
    <ThemedText type="eyebrow" themeColor="accent">FIL DE PROJETS</ThemedText><ThemedText type="title" style={styles.title}>Des idées à découvrir</ThemedText><ThemedText themeColor="textSecondary">Faites défiler les projets des communautés.</ThemedText>
    <View style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.border }]}><SocialIcon name="search" color={theme.textSecondary} size={20} /><TextInput accessibilityLabel="Rechercher un projet" placeholder="Un projet, un objectif…" placeholderTextColor={theme.textSecondary} value={query} onChangeText={setQuery} style={[styles.searchInput, { color: theme.text }]} /></View>
    {!loading && !error && <ThemedText type="small" themeColor="textSecondary">{visible.length} projet{visible.length > 1 ? 's' : ''} à découvrir</ThemedText>}
  </View>} renderItem={({ item }) => <ProjectFeedCard project={item} />} ItemSeparatorComponent={() => <View style={styles.separator} />} ListEmptyComponent={loading ? <ThemedText accessibilityLiveRegion="polite">Chargement des projets…</ThemedText> : error ? <ThemedView type="surface" style={styles.empty}><ThemedText>{error}</ThemedText><Pressable accessibilityRole="button" onPress={retry}><ThemedText type="linkPrimary">Réessayer</ThemedText></Pressable></ThemedView> : <ThemedView type="surface" style={styles.empty}><ThemedText type="smallBold">{query ? 'Aucun résultat' : 'Aucun projet publié'}</ThemedText><ThemedText themeColor="textSecondary">{query ? 'Essayez une autre recherche.' : 'Revenez bientôt découvrir de nouvelles idées.'}</ThemedText></ThemedView>} refreshing={loading && projects.length > 0} onRefresh={retry} /></SafeAreaView></ThemedView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' }, list: { padding: Spacing.four, paddingBottom: Spacing.six }, header: { gap: Spacing.two, marginBottom: Spacing.four }, title: { fontSize: 30, lineHeight: 36 }, search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, marginTop: Spacing.two }, searchInput: { flex: 1, minHeight: 52, fontSize: 16 }, separator: { height: Spacing.three }, empty: { padding: Spacing.four, borderRadius: 18, gap: Spacing.two } });
