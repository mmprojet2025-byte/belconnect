import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { LocalizedTextInput as TextInput } from '@/components/localized-text-input';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SocialAvatar } from '@/components/social-avatar';
import { SocialIcon } from '@/components/social-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth-context';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Conversation, getConversations } from '@/lib/private-messages';
import { getGroupConversations, GroupConversation } from '@/lib/group-chat';
import { useLocale } from '@/context/locale-context';
import { translate } from '@/lib/translations';

function ConversationRow({ item }: { item: Conversation }) {
  const theme = useTheme();
  const {locale}=useLocale();
  const date=new Intl.DateTimeFormat(`${locale}-BE`,{day:'numeric',month:'short',timeZone:'Europe/Brussels'});
  return <Pressable accessibilityRole="button" accessibilityLabel={`Conversation avec ${item.otherName}, ${item.unreadCount} message non lu`} onPress={() => router.push({ pathname: '/messages/[id]', params: { id: item.id } })} style={({ pressed }) => [styles.row, { borderColor: Colors.orangeBorder }, pressed && styles.pressed]}>
    <SocialAvatar name={item.otherName} size={58} ring={item.unreadCount > 0} />
    <View style={styles.rowCopy}><View style={styles.rowTop}><ThemedText type="smallBold" style={styles.name} numberOfLines={1}>{item.otherName}</ThemedText>{item.lastAt && <ThemedText type="small" themeColor="textSecondary">{date.format(new Date(item.lastAt))}</ThemedText>}</View><ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{item.groupName}</ThemedText><ThemedText numberOfLines={1} style={item.unreadCount > 0 && styles.previewUnread}>{item.lastMessage ?? 'Commencez la conversation'}</ThemedText></View>
    {item.unreadCount > 0 ? <View style={styles.badge}><ThemedText type="smallBold" style={styles.badgeText}>{item.unreadCount}</ThemedText></View> : <SocialIcon name="chevron" color={theme.textSecondary} size={18} />}
  </Pressable>;
}

function GroupRow({ item }: { item: GroupConversation }) {
  const theme = useTheme();
  const { locale } = useLocale();
  const date = new Intl.DateTimeFormat(`${locale}-BE`, { day: 'numeric', month: 'short', timeZone: 'Europe/Brussels' });
  return <Pressable accessibilityRole="button" accessibilityLabel={`${translate(locale, 'Discussion de groupe')} ${item.groupName}`} onPress={() => router.push({ pathname: '/messages/groups/[id]', params: { id: item.groupId } })} style={({ pressed }) => [styles.row, { borderColor: theme.border }, pressed && styles.pressed]}>
    <SocialAvatar name={item.groupName} size={58} ring={item.unreadCount > 0} />
    <View style={styles.rowCopy}><View style={styles.rowTop}><ThemedText type="smallBold" style={styles.name} numberOfLines={1}>{item.groupName}</ThemedText>{item.lastAt && <ThemedText type="small" themeColor="textSecondary">{date.format(new Date(item.lastAt))}</ThemedText>}</View><ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{item.spaceName}</ThemedText><ThemedText numberOfLines={1} style={item.unreadCount > 0 && styles.previewUnread}>{item.lastMessage ?? translate(locale, 'Commencez la discussion du groupe')}</ThemedText></View>
    {item.unreadCount > 0 ? <View style={styles.badge}><ThemedText type="smallBold" style={styles.badgeText}>{item.unreadCount}</ThemedText></View> : <SocialIcon name="chevron" color={theme.textSecondary} size={18} />}
  </Pressable>;
}

export default function MessagesScreen() {
  const { token } = useAuth();
  return <MessagesContent key={token ?? 'guest'} token={token} />;
}

function MessagesContent({ token }: { token: string | null }) {
  const {locale}=useLocale();
  const [items, setItems] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<GroupConversation[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback((signal?: AbortSignal) => {
    if (!token) return Promise.resolve();
    return Promise.allSettled([getConversations(token, signal), getGroupConversations(token, signal)]).then(([privateResult, groupResult]) => {
      if (signal?.aborted) return;
      if (privateResult.status === 'fulfilled') setItems(privateResult.value);
      if (groupResult.status === 'fulfilled') setGroups(groupResult.value);
      setError(privateResult.status === 'rejected' || groupResult.status === 'rejected' ? 'Certaines discussions sont momentanément indisponibles.' : '');
    })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [token]);
  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = setInterval(() => void load(controller.signal), 20_000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [load]));
  const refresh = () => { setError(''); setLoading(true); void load(); };
  const unread = items.reduce((total, item) => total + item.unreadCount, 0) + groups.reduce((total, item) => total + item.unreadCount, 0);
  const filtered = useMemo(() => items.filter(item => `${item.otherName} ${item.groupName}`.toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr'))), [items, query]);
  const visibleGroups = useMemo(() => groups.filter(item => `${item.groupName} ${item.spaceName}`.toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr'))), [groups, query]);

  return <ThemedView style={styles.screen}><SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}><FlatList data={token ? filtered : []} keyExtractor={item => String(item.id)} renderItem={({ item }) => <ConversationRow item={item} />} contentContainerStyle={styles.list} ListHeaderComponent={<View style={styles.header}>
    <View style={styles.heading}><View><ThemedText type="eyebrow" style={styles.brand}>VOS ÉCHANGES</ThemedText><ThemedText type="title">Messages</ThemedText></View><Pressable accessibilityRole="button" accessibilityLabel="Actualiser les conversations" onPress={refresh} style={styles.refresh}><SocialIcon name="refresh" color={Colors.brand} size={22} /></Pressable></View>
    {token && <Pressable accessibilityRole="button" onPress={() => router.push('/messages/new')} style={styles.newMessage}><SocialIcon name="message" color={Colors.onBrand} size={20} /><ThemedText type="smallBold" style={styles.newMessageText}>{translate(locale, 'Nouveau message')}</ThemedText></Pressable>}
    <ThemedText themeColor="textSecondary">Restez en contact avec les membres de vos groupes.</ThemedText>
    {token && <View style={styles.search}><SocialIcon name="search" color="#718077" size={21} /><TextInput accessibilityLabel="Rechercher une conversation" placeholder="Rechercher une personne ou un groupe" placeholderTextColor="#718077" value={query} onChangeText={setQuery} style={styles.searchInput} /></View>}
    {unread > 0 && <View style={styles.unreadPill}><SocialIcon name="message" color={Colors.brand} size={16} /><ThemedText type="smallBold" style={styles.brand}>{unread} {translate(locale,unread>1?'messages non lus':'message non lu')}</ThemedText></View>}
    {!!error && <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>}
    {token && visibleGroups.length > 0 && <View style={styles.groupSection}><ThemedText type="smallBold" style={styles.sectionLabel}>{translate(locale, 'Discussions de groupe')}</ThemedText>{visibleGroups.map(item => <GroupRow key={item.groupId} item={item} />)}{filtered.length > 0 && <ThemedText type="smallBold" style={styles.sectionLabel}>{translate(locale, 'Messages privés')}</ThemedText>}</View>}
  </View>} ItemSeparatorComponent={() => <View style={styles.separator} />} ListEmptyComponent={visibleGroups.length > 0 ? undefined : !token ? <View style={styles.empty}><SocialIcon name="message" color={Colors.brand} size={40} /><ThemedText type="subtitle">Vos échanges commencent ici</ThemedText><ThemedText themeColor="textSecondary">Connectez-vous pour retrouver vos conversations.</ThemedText><Pressable onPress={() => router.navigate('/(tabs)/account')}><ThemedText type="linkPrimary">Se connecter →</ThemedText></Pressable></View> : loading ? <ThemedText accessibilityLiveRegion="polite">Chargement des conversations…</ThemedText> : error ? <Pressable onPress={refresh}><ThemedText type="linkPrimary">Réessayer</ThemedText></Pressable> : <View style={styles.empty}><SocialIcon name="message" color={Colors.brand} size={40} /><ThemedText type="subtitle">{query ? 'Aucun résultat' : 'Aucune conversation'}</ThemedText><ThemedText themeColor="textSecondary">{query ? 'Essayez un autre nom.' : translate(locale, 'Appuyez sur Nouveau message pour écrire à un membre de vos groupes.')}</ThemedText><Pressable onPress={() => router.navigate('/groups')}><ThemedText type="linkPrimary">Explorer les groupes →</ThemedText></Pressable></View>} refreshing={loading && (items.length > 0 || groups.length > 0)} onRefresh={refresh} /></SafeAreaView></ThemedView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' }, list: { padding: Spacing.four, paddingBottom: Spacing.six }, header: { gap: Spacing.two, marginBottom: Spacing.four }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brand: { color: Colors.brand }, refresh: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: Colors.border, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, newMessage: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: Colors.brand }, newMessageText: { color: Colors.onBrand }, search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.orangeBorder, borderRadius: 16, paddingHorizontal: 14, marginTop: Spacing.two }, searchInput: { flex: 1, minHeight: 52, fontSize: 16, color: '#17251F' }, unreadPill: { alignSelf: 'flex-start', backgroundColor: Colors.brandSoft, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6 }, error: { color: '#B42318' }, row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 14, borderBottomWidth: 1 }, pressed: { opacity: .6 }, rowCopy: { flex: 1, gap: 2 }, rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, name: { flex: 1, fontSize: 16 }, previewUnread: { fontWeight: '700' }, badge: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: Colors.brand, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }, badgeText: { color: Colors.onBrand, fontSize: 12 }, groupSection: { marginTop: Spacing.two }, sectionLabel: { color: Colors.brand, marginTop: Spacing.three, marginBottom: Spacing.one, backgroundColor: Colors.orangeSoft, borderLeftWidth: 2, borderLeftColor: Colors.orangeBorder, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two }, separator: { height: 1 }, empty: { alignItems: 'center', gap: Spacing.two, padding: Spacing.five, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.border, borderRadius: 22 } });
