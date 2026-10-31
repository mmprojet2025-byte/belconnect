import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LocalizedTextInput as TextInput } from '@/components/localized-text-input';
import { SocialAvatar } from '@/components/social-avatar';
import { SocialIcon } from '@/components/social-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth-context';
import { useLocale } from '@/context/locale-context';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { getGroupConversations, getGroupMessages, GroupMessage, markGroupMessagesRead, sendGroupMessage } from '@/lib/group-chat';
import { translate } from '@/lib/translations';

export default function GroupChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  return <GroupChatContent key={`${id}-${token ?? 'guest'}`} id={id} token={token} />;
}

function GroupChatContent({ id, token }: { id: string | undefined; token: string | null }) {
  const groupId = Number(id);
  const { locale } = useLocale();
  const t = (text: string) => translate(locale, text);
  const date = new Intl.DateTimeFormat(`${locale}-BE`, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' });
  const [groupName, setGroupName] = useState('');
  const [items, setItems] = useState<GroupMessage[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const requestId = useRef(Crypto.randomUUID());
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const newestId = items[0]?.id;

  useEffect(() => {
    if (newestId) requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [newestId]);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!token || !Number.isSafeInteger(groupId) || groupId < 1) return;
    try {
      const [conversations, messages] = await Promise.all([
        getGroupConversations(token, signal), getGroupMessages(groupId, token, undefined, signal),
      ]);
      if (signal?.aborted) return;
      const group = conversations.find(item => item.groupId === groupId);
      if (!group) throw new Error('Cette discussion de groupe n’est plus accessible.');
      setGroupName(group.groupName);
      setItems(current => {
        const latest = new Set(messages.map(message => message.id));
        return [...messages, ...current.filter(message => !latest.has(message.id) && (messages.length === 0 || message.id < messages[messages.length - 1].id))];
      });
      setHasMore(messages.length === 30);
      setError('');
      if (messages.length) await markGroupMessagesRead(groupId, messages[0].id, token);
    } catch (value) {
      if (!signal?.aborted) setError(value instanceof Error ? value.message : 'Chargement impossible.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [groupId, token]);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = setInterval(() => void load(controller.signal), 10_000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [load]));

  async function more() {
    if (!token || !items.length || busy) return;
    setBusy(true);
    try {
      const older = await getGroupMessages(groupId, token, items[items.length - 1].id);
      setItems(current => [...current, ...older]);
      setHasMore(older.length === 30);
    } catch (value) { setError(value instanceof Error ? value.message : 'Chargement impossible.'); }
    finally { setBusy(false); }
  }

  async function send() {
    if (!token || !groupName || !content.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const message = await sendGroupMessage(groupId, content.trim(), requestId.current, token);
      setItems(current => [message, ...current.filter(item => item.id !== message.id)]);
      await markGroupMessagesRead(groupId, message.id, token);
      setContent(''); requestId.current = Crypto.randomUUID();
    } catch (value) { setError(value instanceof Error ? value.message : 'Envoi impossible.'); }
    finally { setBusy(false); }
  }

  return <ThemedView style={styles.screen}><KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
    {!token ? <Pressable onPress={() => router.navigate('/(tabs)/account')}><ThemedText type="linkPrimary">{t('Connectez-vous pour voir vos messages')}</ThemedText></Pressable> : !Number.isSafeInteger(groupId) || groupId < 1 ? <ThemedText style={styles.error}>Groupe invalide.</ThemedText> : <View style={styles.chat}>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)/messages')} style={styles.back}><ThemedText type="linkPrimary">← {t('Messages')}</ThemedText></Pressable>
      <View style={styles.header}><SocialAvatar name={groupName || 'Groupe'} size={46} /><View style={styles.headerCopy}><ThemedText type="smallBold" numberOfLines={1}>{groupName || t('Discussion de groupe')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{t('Tous les membres du groupe')}</ThemedText></View><Pressable accessibilityRole="button" accessibilityLabel={t('Actualiser')} onPress={() => void load()} style={styles.refresh}><SocialIcon name="refresh" color={Colors.brand} size={22} /></Pressable></View>
      {!!error && <ThemedText accessibilityLiveRegion="assertive" style={styles.errorBanner}>{error}</ThemedText>}
      <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messageContent} keyboardShouldPersistTaps="handled">
        {loading && !groupName ? <ThemedText themeColor="textSecondary">{t('Chargement des messages…')}</ThemedText> : <>
          {hasMore && <Pressable disabled={busy} onPress={() => void more()} style={styles.more}><ThemedText type="linkPrimary">{t('Voir les messages précédents')}</ThemedText></Pressable>}
          {items.length === 0 && <View style={styles.empty}><SocialIcon name="group" color={Colors.brand} size={36} /><ThemedText type="smallBold">{t('Dites bonjour au groupe !')}</ThemedText></View>}
          {[...items].reverse().map(item => <View key={item.id} style={[styles.messageRow, item.mine && styles.messageRowMine]}>{!item.mine && <SocialAvatar name={item.senderName} size={30} />}<ThemedView type="surface" style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}>{!item.mine && <ThemedText type="smallBold" style={styles.sender}>{item.senderName}</ThemedText>}<ThemedText>{item.content}</ThemedText><ThemedText type="small" themeColor="textSecondary">{date.format(new Date(item.createdAt))}</ThemedText></ThemedView></View>)}
        </>}
      </ScrollView>
      {groupName && <View style={styles.compose}><TextInput accessibilityLabel={t('Écrire un message')} placeholder={t('Écrire au groupe…')} placeholderTextColor="#718077" multiline maxLength={2000} value={content} onChangeText={setContent} style={styles.input} /><Pressable accessibilityRole="button" accessibilityLabel={t('Envoyer le message')} disabled={!content.trim() || busy} onPress={() => void send()} style={[styles.send, (!content.trim() || busy) && styles.disabled]}><SocialIcon name="send" color={Colors.onBrand} size={21} /></Pressable></View>}
    </View>}
  </SafeAreaView></KeyboardAvoidingView></ThemedView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, safe: { flex: 1 }, chat: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  back: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44, paddingHorizontal: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: 10, backgroundColor: Colors.orangeSoft, borderBottomWidth: 1, borderColor: Colors.orangeBorder },
  headerCopy: { flex: 1 }, refresh: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#B42318', padding: Spacing.three }, errorBanner: { color: '#B42318', paddingHorizontal: Spacing.three, paddingVertical: 8 },
  messages: { flex: 1 }, messageContent: { padding: Spacing.three, gap: Spacing.two, flexGrow: 1 }, more: { alignSelf: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7 }, messageRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 19, gap: 4 },
  mine: { backgroundColor: Colors.brandSoft, borderBottomRightRadius: 5 }, theirs: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 5 }, sender: { color: Colors.brand },
  compose: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two, padding: Spacing.two, paddingHorizontal: Spacing.three, borderTopWidth: 1, borderColor: Colors.border, backgroundColor: '#FFFFFF' },
  input: { flex: 1, minHeight: 46, maxHeight: 120, borderWidth: 1, borderColor: Colors.border, borderRadius: 23, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16, color: '#17251F', backgroundColor: '#F7F9F6' },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.brand, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: .4 },
});
