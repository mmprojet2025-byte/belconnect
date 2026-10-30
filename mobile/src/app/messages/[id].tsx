import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LocalizedTextInput as TextInput } from '@/components/localized-text-input';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SocialAvatar } from '@/components/social-avatar';
import { SocialIcon } from '@/components/social-icon';
import { useAuth } from '@/context/auth-context';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { blockMessageUser, Conversation, getConversation, getPrivateMessages, markConversationRead, PrivateMessage, reportPrivateMessage, sendPrivateMessage, unblockMessageUser } from '@/lib/private-messages';
import { useLocale } from '@/context/locale-context';
import { translate } from '@/lib/translations';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  return <ConversationContent key={`${id}-${token ?? 'guest'}`} id={id} token={token} />;
}

function ConversationContent({ id, token }: { id: string | undefined; token: string | null }) {
  const {locale}=useLocale();
  const t=(text:string)=>translate(locale,text);
  const date=new Intl.DateTimeFormat(`${locale}-BE`,{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Brussels'});
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
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const newestId = items[0]?.id;
  useEffect(() => {
    if (newestId) requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [newestId]);

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
    Alert.alert(t('Bloquer ce membre ?'), t('Vous ne pourrez plus échanger de nouveaux messages ensemble. L’historique restera visible.'), [
      { text: t('Annuler'), style: 'cancel' },
      { text: t('Bloquer'), style: 'destructive', onPress: () => void changeBlock(true) },
    ]);
  }

  async function report() {
    if (!token || !reportId || !reason.trim() || busy) return;
    setBusy(true); setError('');
    try { await reportPrivateMessage(reportId, reason.trim(), token); setReportId(undefined); setReason(''); Alert.alert(t('Signalement envoyé'), t('Merci. Le message a été signalé.')); }
    catch (value) { setError(value instanceof Error ? value.message : 'Signalement impossible.'); }
    finally { setBusy(false); }
  }

  return <ThemedView style={styles.screen}><KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
    {!token ? <Pressable style={styles.gate} onPress={() => router.navigate('/(tabs)/account')}><ThemedText type="linkPrimary">Connectez-vous pour voir vos messages</ThemedText></Pressable> : !Number.isSafeInteger(conversationId) || conversationId < 1 ? <ThemedText style={styles.error}>Conversation invalide.</ThemedText> : <View style={styles.chat}>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)/messages')} style={styles.backToMessages}><ThemedText type="linkPrimary">← {t('Messages')}</ThemedText></Pressable>
      <View style={styles.header}><SocialAvatar name={conversation?.otherName ?? 'BelConnect'} size={46} /><View style={styles.headerCopy}><ThemedText type="smallBold" style={styles.headerName} numberOfLines={1}>{conversation?.otherName ?? 'Conversation'}</ThemedText><ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{conversation?.groupName ?? 'Chargement…'}</ThemedText></View><Pressable accessibilityRole="button" accessibilityLabel="Actualiser les messages" onPress={refresh} style={styles.refresh}><SocialIcon name="refresh" color={Colors.brand} size={22} /></Pressable></View>
      {conversation && <Pressable accessibilityRole="button" onPress={confirmBlock} style={styles.blockButton}><ThemedText type="small" style={styles.block}>{conversation.blockedByMe ? 'Débloquer ce membre' : 'Bloquer ce membre'}</ThemedText></Pressable>}
      {!!error && <ThemedText accessibilityLiveRegion="assertive" style={styles.errorBanner}>{error}</ThemedText>}
      <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messageContent} keyboardShouldPersistTaps="handled">
        {loading && !conversation ? <ThemedText themeColor="textSecondary">Chargement des messages…</ThemedText> : <>
          {hasMore && <Pressable disabled={busy} onPress={() => void more()} style={styles.more}><ThemedText type="linkPrimary">Voir les messages précédents</ThemedText></Pressable>}
          {items.length === 0 && <View style={styles.empty}><SocialIcon name="message" color={Colors.brand} size={36} /><ThemedText type="smallBold">Dites bonjour !</ThemedText><ThemedText type="small" themeColor="textSecondary">Cette conversation n’a pas encore de message.</ThemedText></View>}
          {[...items].reverse().map(item => <View key={item.id} style={[styles.messageRow, item.mine && styles.messageRowMine]}>{!item.mine && <SocialAvatar name={conversation?.otherName ?? 'Membre'} size={30} />}<ThemedView type="surface" style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}><ThemedText>{item.content}</ThemedText><View style={styles.meta}><ThemedText type="small" themeColor="textSecondary">{date.format(new Date(item.createdAt))}{item.mine && item.readAt ? ' · Lu' : ''}</ThemedText>{!item.mine && <Pressable accessibilityRole="button" onPress={() => { setReportId(item.id); setReason(''); }}><ThemedText type="small" style={styles.report}>Signaler</ThemedText></Pressable>}</View>{reportId === item.id && <View style={styles.reportForm}><TextInput accessibilityLabel="Motif du signalement" placeholder="Pourquoi ce signalement ?" placeholderTextColor="#777" maxLength={500} value={reason} onChangeText={setReason} style={styles.reportInput} /><View style={styles.reportActions}><Pressable onPress={() => setReportId(undefined)}><ThemedText type="linkPrimary">Annuler</ThemedText></Pressable><Pressable disabled={!reason.trim() || busy} onPress={() => void report()}><ThemedText type="linkPrimary">Envoyer</ThemedText></Pressable></View></View>}</ThemedView></View>)}
        </>}
      </ScrollView>
      {conversation && (conversation.canSend ? <View style={styles.compose}><TextInput accessibilityLabel="Écrire un message" placeholder="Écrire un message…" placeholderTextColor="#718077" multiline maxLength={2000} value={content} onChangeText={setContent} style={styles.input} /><Pressable accessibilityRole="button" accessibilityLabel="Envoyer le message" disabled={!content.trim() || busy} onPress={() => void send()} style={[styles.send, (!content.trim() || busy) && styles.disabled]}><SocialIcon name="send" color={Colors.onBrand} size={21} /></Pressable></View> : <View style={styles.unavailable}><ThemedText type="small" themeColor="textSecondary">L’envoi est indisponible. Vérifiez votre adhésion ou le blocage de cette conversation.</ThemedText></View>)}
    </View>}
  </SafeAreaView></KeyboardAvoidingView></ThemedView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, safe: { flex: 1 }, gate: { padding: Spacing.four }, chat: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' }, backToMessages: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44, paddingHorizontal: Spacing.three }, header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: 10, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: Colors.border }, headerCopy: { flex: 1 }, headerName: { fontSize: 17 }, refresh: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, blockButton: { alignSelf: 'flex-end', paddingHorizontal: Spacing.three, paddingVertical: 8 }, block: { color: '#A9433B' }, error: { color: '#B42318' }, errorBanner: { color: '#B42318', paddingHorizontal: Spacing.three, paddingVertical: 8 }, messages: { flex: 1 }, messageContent: { padding: Spacing.three, gap: Spacing.two, flexGrow: 1 }, more: { alignSelf: 'center' }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.one }, messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7 }, messageRowMine: { justifyContent: 'flex-end' }, bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 19, gap: 4 }, mine: { backgroundColor: Colors.brandSoft, borderBottomRightRadius: 5 }, theirs: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 5 }, meta: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two }, report: { color: '#A9433B' }, reportForm: { gap: Spacing.two, paddingTop: Spacing.two }, reportInput: { minHeight: 48, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, color: '#17251F', backgroundColor: '#FFF' }, reportActions: { flexDirection: 'row', justifyContent: 'space-between' }, compose: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two, padding: Spacing.two, paddingHorizontal: Spacing.three, borderTopWidth: 1, borderColor: Colors.border, backgroundColor: '#FFFFFF' }, input: { flex: 1, minHeight: 46, maxHeight: 120, borderWidth: 1, borderColor: Colors.border, borderRadius: 23, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16, color: '#17251F', backgroundColor: '#F7F9F6' }, send: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.brand, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: .4 }, unavailable: { padding: Spacing.three, borderTopWidth: 1, borderColor: Colors.border } });
