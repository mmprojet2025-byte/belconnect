import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth-context';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { blockMessageUser, Conversation, getConversation, getPrivateMessages, markConversationRead, PrivateMessage, reportPrivateMessage, sendPrivateMessage, unblockMessageUser } from '@/lib/private-messages';

const date = new Intl.DateTimeFormat('fr-BE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Brussels' });

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  return <ConversationContent key={`${id}-${token ?? 'guest'}`} id={id} token={token} />;
}

function ConversationContent({ id, token }: { id: string | undefined; token: string | null }) {
  const conversationId = Number(id);
  const [conversation, setConversation] = useState<Conversation>();
  const [items, setItems] = useState<PrivateMessage[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [reportId, setReportId] = useState<number>();
  const [reason, setReason] = useState('');
  const requestId = useRef(Crypto.randomUUID());

  const load = useCallback((signal?: AbortSignal) => {
    if (!token || !Number.isSafeInteger(conversationId) || conversationId < 1) return Promise.resolve();
    return Promise.all([getConversation(conversationId, token, signal), getPrivateMessages(conversationId, token, undefined, signal)])
      .then(async ([summary, messages]) => {
        if (signal?.aborted) return;
        setConversation(summary);
        setItems(current => {
          const latest = new Set(messages.map(message => message.id));
          return [...messages, ...current.filter(message => !latest.has(message.id) && (messages.length === 0 || message.id < messages[messages.length - 1].id))];
        });
        setHasMore(messages.length === 30);
        if (summary.unreadCount > 0) {
          await markConversationRead(conversationId, token);
          if (!signal?.aborted) setConversation(current => current ? { ...current, unreadCount: 0 } : current);
        }
      })
      .catch(value => { if (!signal?.aborted) setError(value instanceof Error ? value.message : 'Chargement impossible.'); })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [conversationId, token]);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const refresh = setInterval(() => void load(controller.signal), 10_000);
    return () => { clearInterval(refresh); controller.abort(); };
  }, [load]));

  function refresh() { setLoading(true); setError(''); void load(); }

  async function more() {
    if (!token || !items.length || busy) return;
    setBusy(true); setError('');
    try {
      const older = await getPrivateMessages(conversationId, token, items[items.length - 1].id);
      setItems(current => [...current, ...older]); setHasMore(older.length === 30);
    } catch (value) { setError(value instanceof Error ? value.message : 'Chargement impossible.'); }
    finally { setBusy(false); }
  }

  async function send() {
    if (!token || !conversation?.canSend || !content.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const message = await sendPrivateMessage(conversationId, content.trim(), requestId.current, token);
      setItems(current => [message, ...current.filter(item => item.id !== message.id)]);
      setConversation(current => current ? { ...current, lastMessage: message.content, lastAt: message.createdAt } : current);
      setContent(''); requestId.current = Crypto.randomUUID();
    } catch (value) { setError(value instanceof Error ? value.message : 'Envoi impossible.'); }
    finally { setBusy(false); }
  }

  async function changeBlock(block: boolean) {
    if (!token || !conversation || busy) return;
    setBusy(true); setError('');
    try {
      if (block) await blockMessageUser(conversation.otherUserId, token);
      else await unblockMessageUser(conversation.otherUserId, token);
      setConversation(await getConversation(conversationId, token));
    } catch (value) { setError(value instanceof Error ? value.message : 'Action impossible.'); }
    finally { setBusy(false); }
  }

  function confirmBlock() {
    if (!conversation) return;
    if (conversation.blockedByMe) { void changeBlock(false); return; }
    Alert.alert('Bloquer ce membre ?', 'Vous ne pourrez plus échanger de nouveaux messages ensemble. L’historique restera visible.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Bloquer', style: 'destructive', onPress: () => void changeBlock(true) },
    ]);
  }

  async function report() {
    if (!token || !reportId || !reason.trim() || busy) return;
    setBusy(true); setError('');
    try { await reportPrivateMessage(reportId, reason.trim(), token); setReportId(undefined); setReason(''); Alert.alert('Signalement envoyé', 'Merci. Le message a été signalé.'); }
    catch (value) { setError(value instanceof Error ? value.message : 'Signalement impossible.'); }
    finally { setBusy(false); }
  }

  return <ThemedView style={styles.screen}><SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
    {!token ? <Pressable style={styles.content} onPress={() => router.navigate('/(tabs)/account')}><ThemedText type="linkPrimary">Connectez-vous pour voir vos messages</ThemedText></Pressable> : !Number.isSafeInteger(conversationId) || conversationId < 1 ? <ThemedText style={styles.error}>Conversation invalide.</ThemedText> : <ScrollView contentContainerStyle={styles.scroll}><View style={styles.content}>
      <View style={styles.header}><View style={styles.headerCopy}><ThemedText type="title">{conversation?.otherName ?? 'Conversation'}</ThemedText><ThemedText themeColor="textSecondary">{conversation?.groupName ?? 'Chargement…'}</ThemedText></View><Pressable onPress={refresh}><ThemedText type="linkPrimary">Actualiser</ThemedText></Pressable></View>
      {conversation && <Pressable accessibilityRole="button" onPress={confirmBlock}><ThemedText type="small" style={styles.block}>{conversation.blockedByMe ? 'Débloquer ce membre' : 'Bloquer ce membre'}</ThemedText></Pressable>}
      {!!error && <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>}
      {loading && !conversation ? <ThemedText themeColor="textSecondary">Chargement des messages…</ThemedText> : <>
        {hasMore && <Pressable disabled={busy} onPress={() => void more()}><ThemedText type="linkPrimary">Voir les messages précédents</ThemedText></Pressable>}
        {items.length === 0 && <ThemedText themeColor="textSecondary">Aucun message. Dites bonjour !</ThemedText>}
        {[...items].reverse().map(item => <ThemedView type="surface" key={item.id} style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}><ThemedText>{item.content}</ThemedText><View style={styles.meta}><ThemedText type="small" themeColor="textSecondary">{date.format(new Date(item.createdAt))}{item.mine && item.readAt ? ' · Lu' : ''}</ThemedText>{!item.mine && <Pressable onPress={() => { setReportId(item.id); setReason(''); }}><ThemedText type="small" style={styles.report}>Signaler</ThemedText></Pressable>}</View>{reportId === item.id && <View style={styles.reportForm}><TextInput accessibilityLabel="Motif du signalement" placeholder="Pourquoi signalez-vous ce message ?" placeholderTextColor="#777" maxLength={500} value={reason} onChangeText={setReason} style={styles.reportInput} /><View style={styles.reportActions}><Pressable onPress={() => setReportId(undefined)}><ThemedText type="linkPrimary">Annuler</ThemedText></Pressable><Pressable disabled={!reason.trim() || busy} onPress={() => void report()}><ThemedText type="linkPrimary">Envoyer</ThemedText></Pressable></View></View>}</ThemedView>)}
      </>}
      {conversation && (conversation.canSend ? <View style={styles.compose}><TextInput accessibilityLabel="Écrire un message" placeholder="Votre message…" placeholderTextColor="#777" multiline maxLength={2000} value={content} onChangeText={setContent} style={styles.input} /><Pressable accessibilityRole="button" disabled={!content.trim() || busy} onPress={() => void send()} style={[styles.send, (!content.trim() || busy) && styles.disabled]}><ThemedText type="smallBold" style={styles.sendText}>Envoyer</ThemedText></Pressable></View> : <ThemedText themeColor="textSecondary">L’envoi de nouveaux messages est indisponible. Vérifiez votre adhésion au groupe ou le blocage de cette conversation.</ThemedText>)}
    </View></ScrollView>}
  </SafeAreaView></ThemedView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, safe: { flex: 1 }, scroll: { alignItems: 'center' }, content: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.four, gap: Spacing.three }, header: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two, alignItems: 'flex-start' }, headerCopy: { flex: 1 }, block: { color: '#B42318' }, error: { color: '#B42318' }, bubble: { maxWidth: '88%', padding: Spacing.three, borderRadius: 16, gap: Spacing.one }, mine: { alignSelf: 'flex-end', backgroundColor: Colors.brandSoft }, theirs: { alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.border }, meta: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two }, report: { color: '#B42318' }, reportForm: { gap: Spacing.two, paddingTop: Spacing.two }, reportInput: { minHeight: 48, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, color: '#111', backgroundColor: '#FFF' }, reportActions: { flexDirection: 'row', justifyContent: 'space-between' }, compose: { gap: Spacing.two, paddingTop: Spacing.three, borderTopWidth: 1, borderColor: Colors.border }, input: { minHeight: 84, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 14, fontSize: 16, color: '#111', backgroundColor: '#FFF', textAlignVertical: 'top' }, send: { alignSelf: 'flex-end', backgroundColor: Colors.brand, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 }, sendText: { color: Colors.onBrand }, disabled: { opacity: 0.45 } });
