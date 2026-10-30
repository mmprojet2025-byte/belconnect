import { Link } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { LocalizedTextInput as TextInput } from '@/components/localized-text-input';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SocialAvatar } from '@/components/social-avatar';
import { SocialIcon } from '@/components/social-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { answerGroupInvitation, getGroupInvitations, getGroups, Group, GroupInvitation } from '@/lib/groups';

const joined = (group: Group) => group.membershipStatus === 'MEMBRE' || group.membershipStatus === 'ADMINISTRATEUR';

function GroupCard({ group }: { group: Group }) {
  const theme = useTheme();
  return <Link href={{ pathname: '/groups/[id]', params: { id: group.id } }} asChild><Pressable accessibilityRole="button" accessibilityLabel={`Voir le groupe ${group.name}`} style={({ pressed }) => [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, pressed && styles.pressed]}>
    <View style={styles.cover}>{group.coverUrl ? <Image source={{ uri: group.coverUrl }} style={styles.image} resizeMode="cover" accessibilityLabel={`Photo du groupe ${group.name}`} /> : <View style={styles.imageFallback}><SocialIcon name="group" color={Colors.brand} size={48} /></View>}</View>
    <View style={styles.cardBody}><View style={styles.cardHeading}><SocialAvatar name={group.name} size={46} /><View style={styles.cardTitle}><ThemedText type="subtitle" style={styles.groupName} numberOfLines={1}>{group.name}</ThemedText><ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{group.spaceName}</ThemedText></View></View>
      <ThemedText numberOfLines={2} themeColor="textSecondary">{group.description || 'Un groupe pour se rencontrer et partager.'}</ThemedText>
      <View style={styles.cardFooter}><View style={[styles.badge, joined(group) && styles.joinedBadge]}><ThemedText type="smallBold" style={styles.badgeText}>{joined(group) ? 'Membre' : group.membershipStatus === 'EN_ATTENTE' ? 'Demande envoyée' : 'À découvrir'}</ThemedText></View><View style={styles.explore}><ThemedText type="smallBold" style={styles.brand}>Voir le groupe</ThemedText><SocialIcon name="chevron" color={Colors.brand} size={18} /></View></View>
    </View>
  </Pressable></Link>;
}

export default function GroupsScreen() {
  const { token } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [invitationError, setInvitationError] = useState('');
  const [query, setQuery] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getGroups(controller.signal, token).then(setGroups)
      .catch(() => { if (!controller.signal.aborted) setError('Impossible de charger les groupes.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    if (token) getGroupInvitations(token, controller.signal).then(setInvitations).catch(() => { if (!controller.signal.aborted) setInvitationError('Impossible de charger les invitations.'); });
    return () => controller.abort();
  }, [revision, token]);
  const filtered = useMemo(() => groups.filter(group => {
    const matches = `${group.name} ${group.spaceName} ${group.description}`.toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr'));
    return matches && (!mineOnly || joined(group));
  }), [groups, mineOnly, query]);
  const retry = () => { setError(''); setLoading(true); setRevision(value => value + 1); };
  async function respond(id:number,decision:'accept'|'decline') { if(!token)return;setInvitationError('');try{await answerGroupInvitation(id,decision,token);setRevision(value=>value+1);}catch(e){setInvitationError(e instanceof Error?e.message:'Action impossible.');} }

  return <ThemedView style={styles.screen}><SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}><FlatList data={filtered} keyExtractor={item => String(item.id)} renderItem={({ item }) => <GroupCard group={item} />} contentContainerStyle={styles.list} ItemSeparatorComponent={() => <View style={styles.separator} />} ListHeaderComponent={<View style={styles.header}>
    <ThemedText type="eyebrow" style={styles.brand}>COMMUNAUTÉS</ThemedText><ThemedText type="title">Trouvez votre groupe.</ThemedText><ThemedText themeColor="textSecondary">Des personnes avec qui partager plus que des activités.</ThemedText>
    {token&&invitations.filter(item=>item.status==='EN_ATTENTE').map(item=><ThemedView type="surface" style={styles.invitation} key={item.id}><ThemedText type="smallBold" style={styles.brand}>INVITATION</ThemedText><ThemedText type="subtitle">{item.groupName}</ThemedText><ThemedText>{item.spaceName} vous invite à rejoindre ce groupe privé.</ThemedText><View style={styles.invitationActions}><Pressable accessibilityRole="button" style={styles.accept} onPress={()=>void respond(item.id,'accept')}><ThemedText type="smallBold" style={styles.acceptText}>Accepter</ThemedText></Pressable><Pressable accessibilityRole="button" onPress={()=>void respond(item.id,'decline')}><ThemedText type="linkPrimary">Refuser</ThemedText></Pressable></View></ThemedView>)}
    {!!invitationError&&<ThemedText accessibilityLiveRegion="assertive" style={styles.invitationError}>{invitationError}</ThemedText>}
    <View style={styles.search}><SocialIcon name="search" color="#718077" size={21} /><TextInput accessibilityLabel="Rechercher un groupe" placeholder="Nom ou communauté" placeholderTextColor="#718077" value={query} onChangeText={setQuery} style={styles.searchInput} /></View>
    <View style={styles.filters}><Pressable accessibilityRole="button" accessibilityState={{ selected: !mineOnly }} onPress={() => setMineOnly(false)} style={[styles.chip, !mineOnly && styles.chipActive]}><ThemedText type="smallBold" style={!mineOnly && styles.chipActiveText}>Tous les groupes</ThemedText></Pressable><Pressable accessibilityRole="button" accessibilityState={{ selected: mineOnly }} onPress={() => setMineOnly(true)} style={[styles.chip, mineOnly && styles.chipActive]}><ThemedText type="smallBold" style={mineOnly && styles.chipActiveText}>Mes groupes</ThemedText></Pressable></View>
    {!loading && !error && <ThemedText type="small" themeColor="textSecondary">{filtered.length} groupe{filtered.length > 1 ? 's' : ''}</ThemedText>}
  </View>} ListEmptyComponent={loading ? <ThemedText accessibilityLiveRegion="polite">Chargement des groupes…</ThemedText> : error ? <View style={styles.empty}><ThemedText>{error}</ThemedText><Pressable onPress={retry}><ThemedText type="linkPrimary">Réessayer</ThemedText></Pressable></View> : <ThemedView type="surface" style={styles.empty}><ThemedText type="smallBold">{mineOnly ? 'Aucun groupe rejoint' : 'Aucun groupe trouvé'}</ThemedText><ThemedText themeColor="textSecondary">{mineOnly ? 'Découvrez un groupe et demandez à le rejoindre.' : 'Essayez une autre recherche.'}</ThemedText></ThemedView>} refreshing={loading && groups.length > 0} onRefresh={retry} /></SafeAreaView></ThemedView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' }, list: { padding: Spacing.four, paddingBottom: Spacing.six }, header: { gap: Spacing.two, marginBottom: Spacing.four }, brand: { color: Colors.brand }, invitation:{padding:Spacing.three,borderWidth:1,borderColor:Colors.brand,borderRadius:16,gap:Spacing.two},invitationActions:{flexDirection:'row',alignItems:'center',gap:Spacing.three},accept:{backgroundColor:Colors.brand,borderRadius:12,paddingHorizontal:18,paddingVertical:10},acceptText:{color:Colors.onBrand},invitationError:{color:'#B42318'}, search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.border, borderRadius: 16, paddingHorizontal: 14, marginTop: Spacing.two }, searchInput: { flex: 1, minHeight: 52, fontSize: 16, color: '#17251F' }, filters: { flexDirection: 'row', gap: Spacing.two, paddingVertical: Spacing.one }, chip: { borderWidth: 1, borderColor: Colors.border, borderRadius: 22, paddingHorizontal: 15, paddingVertical: 9, backgroundColor: '#FFFFFF' }, chipActive: { backgroundColor: Colors.brand, borderColor: Colors.brand }, chipActiveText: { color: Colors.onBrand }, separator: { height: Spacing.three }, card: { borderWidth: 1, borderRadius: 22, overflow: 'hidden' }, pressed: { opacity: .75 }, cover: { height: 160 }, image: { width: '100%', height: '100%' }, imageFallback: { flex: 1, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, cardBody: { padding: Spacing.three, gap: Spacing.two }, cardHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two }, cardTitle: { flex: 1 }, groupName: { fontSize: 21, lineHeight: 27 }, cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.one }, badge: { borderRadius: 20, backgroundColor: '#F0F3EF', paddingHorizontal: 10, paddingVertical: 6 }, joinedBadge: { backgroundColor: Colors.brandSoft }, badgeText: { color: Colors.brand }, explore: { flexDirection: 'row', alignItems: 'center', gap: 2 }, empty: { padding: Spacing.four, borderRadius: 18, gap: Spacing.two } });
