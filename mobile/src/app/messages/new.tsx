import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth-context';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { getMessageMembers, MessageMember, startConversation } from '@/lib/private-messages';

export default function NewMessageScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { token } = useAuth();
  return <NewMessageContent key={`${groupId}-${token ?? 'guest'}`} groupId={groupId} token={token} />;
}

function NewMessageContent({ groupId, token }: { groupId: string | undefined; token: string | null }) {
  const id = Number(groupId);
  const [members, setMembers] = useState<MessageMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number>();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !Number.isSafeInteger(id) || id < 1) return;
    const controller = new AbortController();
    getMessageMembers(id, token, controller.signal).then(setMembers)
      .catch(value => { if (!controller.signal.aborted) setError(value instanceof Error ? value.message : 'Chargement impossible.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, token]);

  async function start(memberId: number) {
    if (!token || busy) return;
    setBusy(memberId); setError('');
    try {
      const conversation = await startConversation(id, memberId, token);
      router.replace({ pathname: '/messages/[id]', params: { id: conversation.id } });
    } catch (value) { setError(value instanceof Error ? value.message : 'Conversation impossible.'); }
    finally { setBusy(undefined); }
  }

  return <ThemedView style={styles.screen}><ScrollView contentContainerStyle={styles.scroll}><SafeAreaView style={styles.content} edges={['left', 'right', 'bottom']}>
    <ThemedText type="title">Choisir un membre</ThemedText>
    <ThemedText themeColor="textSecondary">Démarrez une conversation privée avec un membre de ce groupe.</ThemedText>
    {!token ? <Pressable onPress={() => router.navigate('/(tabs)/account')}><ThemedText type="linkPrimary">Connectez-vous pour écrire</ThemedText></Pressable> : !Number.isSafeInteger(id) || id < 1 ? <ThemedText style={styles.error}>Groupe invalide.</ThemedText> : <>
      {!!error && <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>}
      {loading ? <ThemedText themeColor="textSecondary">Chargement des membres…</ThemedText> : members.length === 0 && !error ? <ThemedText themeColor="textSecondary">Aucun autre membre disponible dans ce groupe.</ThemedText> : members.map(member => <Pressable key={member.id} accessibilityRole="button" disabled={busy !== undefined} onPress={() => void start(member.id)} style={styles.member}><View style={styles.avatar}><ThemedText type="smallBold" style={styles.avatarText}>{member.name.charAt(0).toUpperCase()}</ThemedText></View><ThemedText type="smallBold" style={styles.name}>{member.name}</ThemedText><ThemedText type="linkPrimary">{busy === member.id ? 'Ouverture…' : 'Écrire →'}</ThemedText></Pressable>)}
    </>}
  </SafeAreaView></ScrollView></ThemedView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, scroll: { alignItems: 'center' }, content: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.four, gap: Spacing.three }, error: { color: '#B42318' }, member: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderWidth: 1, borderColor: Colors.border, borderRadius: 16 }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: Colors.brand }, name: { flex: 1 } });
