import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth-context';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { Conversation, getConversations } from '@/lib/private-messages';

const date = new Intl.DateTimeFormat('fr-BE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Brussels' });

export default function MessagesScreen() {
  const { token } = useAuth();
  return <MessagesContent key={token ?? 'guest'} token={token} />;
}

function MessagesContent({ token }: { token: string | null }) {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback((signal?: AbortSignal) => {
    if (!token) return Promise.resolve();
    return getConversations(token, signal).then(setItems)
      .catch(value => { if (!signal?.aborted) setError(value instanceof Error ? value.message : 'Chargement impossible.'); })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [token]);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const refresh = setInterval(() => void load(controller.signal), 20_000);
    return () => { clearInterval(refresh); controller.abort(); };
  }, [load]));

  function refresh() { setError(''); setLoading(true); void load(); }
  const unread = items.reduce((total, item) => total + item.unreadCount, 0);

  return <ThemedView style={styles.screen}><ScrollView contentContainerStyle={styles.scroll}><SafeAreaView style={styles.content} edges={['left', 'right', 'bottom']}>
    <View style={styles.heading}><View><ThemedText type="title">Messages</ThemedText><ThemedText themeColor="textSecondary">Vos conversations avec les membres des groupes.</ThemedText></View><Pressable accessibilityRole="button" onPress={refresh}><ThemedText type="linkPrimary">Actualiser</ThemedText></Pressable></View>
    {!token ? <Pressable accessibilityRole="button" onPress={() => router.navigate('/(tabs)/account')}><ThemedText type="linkPrimary">Connectez-vous pour voir vos messages</ThemedText></Pressable> : <>
      {unread > 0 && <ThemedText type="smallBold" style={styles.unread}>{unread} message{unread > 1 ? 's' : ''} non lu{unread > 1 ? 's' : ''}</ThemedText>}
      {!!error && <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>}
      {loading && items.length === 0 ? <ThemedText themeColor="textSecondary">Chargement des conversations…</ThemedText> : items.length === 0 && !error ? <ThemedView type="surface" style={styles.empty}><ThemedText type="smallBold">Aucune conversation</ThemedText><ThemedText themeColor="textSecondary">Ouvrez un groupe dont vous êtes membre pour discuter avec quelqu’un.</ThemedText><Pressable onPress={() => router.navigate('/groups')}><ThemedText type="linkPrimary">Explorer les groupes →</ThemedText></Pressable></ThemedView> : items.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Conversation avec ${item.otherName}, ${item.unreadCount} message non lu`} onPress={() => router.push({ pathname: '/messages/[id]', params: { id: item.id } })}><ThemedView type="surface" style={styles.card}><View style={styles.row}><ThemedText type="smallBold">{item.otherName}</ThemedText>{item.unreadCount > 0 && <ThemedText type="smallBold" style={styles.badge}>{item.unreadCount}</ThemedText>}</View><ThemedText type="small" themeColor="textSecondary">{item.groupName}</ThemedText><ThemedText numberOfLines={2}>{item.lastMessage ?? 'Commencez la conversation'}</ThemedText>{item.lastAt && <ThemedText type="small" themeColor="textSecondary">{date.format(new Date(item.lastAt))}</ThemedText>}</ThemedView></Pressable>)}
    </>}
  </SafeAreaView></ScrollView></ThemedView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, scroll: { alignItems: 'center' }, content: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.four, gap: Spacing.three }, heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.two }, unread: { color: Colors.brand }, error: { color: '#B42318' }, empty: { padding: Spacing.four, borderRadius: 18, gap: Spacing.two }, card: { padding: Spacing.three, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, gap: Spacing.one }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two }, badge: { backgroundColor: Colors.brand, color: Colors.onBrand, borderRadius: 14, overflow: 'hidden', minWidth: 24, textAlign: 'center', paddingHorizontal: 6 } });
