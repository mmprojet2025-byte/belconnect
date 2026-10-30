import { Link } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SocialIcon } from '@/components/social-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { getProjects, Project, projectImages } from '@/lib/projects';

const date = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long' });
const helpLabels: Record<string, string> = { BENEVOLAT: 'Bénévolat', COMPETENCES: 'Compétences', PARTAGE: 'Partage' };

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
    <ThemedText type="eyebrow" style={styles.brand}>IDÉES LOCALES</ThemedText><ThemedText type="title">Des projets qui nous rassemblent.</ThemedText><ThemedText themeColor="textSecondary">Découvrez ce que les communautés construisent près de vous.</ThemedText>
    <View style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.border }]}><SocialIcon name="search" color={theme.textSecondary} size={20} /><TextInput accessibilityLabel="Rechercher un projet" placeholder="Un projet, un objectif…" placeholderTextColor={theme.textSecondary} value={query} onChangeText={setQuery} style={[styles.searchInput, { color: theme.text }]} /></View>
    {!loading && !error && <ThemedText type="small" themeColor="textSecondary">{visible.length} projet{visible.length > 1 ? 's' : ''} à découvrir</ThemedText>}
  </View>} renderItem={({ item }) => <Link href={{ pathname: '/projects/[id]', params: { id: item.id } }} asChild><Pressable accessibilityRole="button" accessibilityLabel={`Découvrir le projet ${item.title}`} style={({ pressed }) => [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, pressed && styles.pressed]}>
    {item.imageUrl && projectImages[item.imageUrl] ? <Image source={projectImages[item.imageUrl]} style={styles.image} resizeMode="cover" accessibilityLabel={`Image du projet ${item.title}`} /> : <View style={styles.imageFallback}><SocialIcon name="project" color={Colors.brand} size={48} /></View>}
    <View style={styles.cardBody}><View style={styles.organizer}><SocialIcon name="group" color={Colors.brand} size={18} /><ThemedText type="smallBold" style={styles.brand} numberOfLines={1}>{item.spaceName}</ThemedText></View><ThemedText type="subtitle" numberOfLines={2}>{item.title}</ThemedText><ThemedText themeColor="textSecondary" numberOfLines={2}>{item.objective}</ThemedText>
      <View style={styles.meta}>{item.startsOn && <ThemedText type="small" themeColor="textSecondary">Dès le {date.format(new Date(`${item.startsOn}T12:00:00`))}</ThemedText>}{item.helpTypes.length > 0 && <ThemedText type="small" themeColor="textSecondary">{item.helpTypes.map(value => helpLabels[value] ?? value).join(' · ')}</ThemedText>}</View>
      <View style={[styles.footer, { borderColor: theme.border }]}><ThemedText type="smallBold" style={styles.brand}>Voir le projet</ThemedText><SocialIcon name="chevron" color={Colors.brand} size={20} /></View>
    </View>
  </Pressable></Link>} ItemSeparatorComponent={() => <View style={styles.separator} />} ListEmptyComponent={loading ? <ThemedText accessibilityLiveRegion="polite">Chargement des projets…</ThemedText> : error ? <ThemedView type="surface" style={styles.empty}><ThemedText>{error}</ThemedText><Pressable accessibilityRole="button" onPress={retry}><ThemedText type="linkPrimary">Réessayer</ThemedText></Pressable></ThemedView> : <ThemedView type="surface" style={styles.empty}><ThemedText type="smallBold">{query ? 'Aucun résultat' : 'Aucun projet publié'}</ThemedText><ThemedText themeColor="textSecondary">{query ? 'Essayez une autre recherche.' : 'Revenez bientôt découvrir de nouvelles idées.'}</ThemedText></ThemedView>} refreshing={loading && projects.length > 0} onRefresh={retry} /></SafeAreaView></ThemedView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' }, list: { padding: Spacing.four, paddingBottom: Spacing.six }, header: { gap: Spacing.two, marginBottom: Spacing.four }, brand: { color: Colors.brand }, search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, marginTop: Spacing.two }, searchInput: { flex: 1, minHeight: 52, fontSize: 16 }, card: { borderWidth: 1, borderRadius: 22, overflow: 'hidden' }, pressed: { opacity: .75 }, image: { width: '100%', height: 210 }, imageFallback: { width: '100%', height: 210, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, cardBody: { padding: Spacing.three, gap: Spacing.two }, organizer: { flexDirection: 'row', alignItems: 'center', gap: 7 }, meta: { gap: 2 }, footer: { borderTopWidth: 1, paddingTop: Spacing.two, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, separator: { height: Spacing.three }, empty: { padding: Spacing.four, borderRadius: 18, gap: Spacing.two } });
