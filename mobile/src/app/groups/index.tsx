import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { getGroups, Group } from '@/lib/groups';
import { useAuth } from '@/context/auth-context';

export default function GroupsScreen() {
  const auth = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getGroups(controller.signal, auth.token).then(setGroups).catch(() => { if (!controller.signal.aborted) setError('Impossible de charger les groupes.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision, auth.token]);
  const retry = () => { setError(''); setLoading(true); setRevision(value => value + 1); };
  const filtered = groups.filter(group => `${group.name} ${group.spaceName} ${group.description}`.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')));
  return <ThemedView style={styles.screen}><SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}><FlatList data={filtered} keyExtractor={item => String(item.id)} contentContainerStyle={styles.list} ListHeaderComponent={<View style={styles.header}><ThemedText type="title">Trouvez votre communauté</ThemedText><ThemedText themeColor="textSecondary">Découvrez les groupes près de chez vous.</ThemedText><TextInput accessibilityLabel="Rechercher un groupe" placeholder="Rechercher un groupe" placeholderTextColor="#777" value={query} onChangeText={setQuery} style={styles.input} /></View>} renderItem={({ item }) => <Link href={{ pathname: '/groups/[id]', params: { id: item.id } }} asChild><Pressable accessibilityRole="button" accessibilityLabel={`Voir le groupe ${item.name}`} style={styles.card}>{item.coverUrl ? <Image source={{ uri: item.coverUrl }} style={styles.image} resizeMode="cover" /> : <View style={styles.initial}><ThemedText type="title" style={styles.initialText}>{item.name.charAt(0).toUpperCase()}</ThemedText></View>}<ThemedText type="subtitle">{item.name}</ThemedText><ThemedText type="small" themeColor="textSecondary">{item.spaceName}</ThemedText><ThemedText>{item.description || 'Un groupe pour se rencontrer et partager.'}</ThemedText><ThemedText type="linkPrimary">Découvrir le groupe →</ThemedText></Pressable></Link>} ItemSeparatorComponent={() => <View style={styles.separator} />} ListEmptyComponent={loading ? <ThemedText>Chargement des groupes…</ThemedText> : error ? <View><ThemedText>{error}</ThemedText><Pressable onPress={retry}><ThemedText type="linkPrimary">Réessayer</ThemedText></Pressable></View> : <ThemedText>{query ? 'Aucun groupe ne correspond à votre recherche.' : 'Aucun groupe accessible pour le moment.'}</ThemedText>} refreshing={loading && groups.length > 0} onRefresh={retry} /></SafeAreaView></ThemedView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' }, list: { padding: Spacing.four, paddingBottom: Spacing.six }, header: { gap: Spacing.three, marginBottom: Spacing.four }, input: { minHeight: 52, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 16, fontSize: 16, color: '#111', backgroundColor: '#FFF' }, card: { padding: Spacing.three, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, gap: Spacing.two }, image: { width: '100%', height: 180, borderRadius: 14 }, initial: { height: 120, borderRadius: 14, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, initialText: { color: Colors.brand }, separator: { height: Spacing.three } });
