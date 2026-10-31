import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth-context';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { getMessageMembers, MessageMember, startConversation } from '@/lib/private-messages';
import { getGroups, Group } from '@/lib/groups';
import { useLocale } from '@/context/locale-context';
import { translate } from '@/lib/translations';

export default function NewMessageScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { token } = useAuth();
  return <NewMessageContent key={`${groupId}-${token ?? 'guest'}`} groupId={groupId} token={token} />;
}

function NewMessageContent({ groupId, token }: { groupId: string | undefined; token: string | null }) {
  const { locale } = useLocale();
  const t = (text: string) => translate(locale, text);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(groupId && Number.isSafeInteger(Number(groupId)) && Number(groupId) > 0 ? Number(groupId) : null);
  const id = selectedGroupId;
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groupError, setGroupError] = useState('');
  const [members, setMembers] = useState<MessageMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number>();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || id !== null) return;
    const controller = new AbortController();
    getGroups(controller.signal, token).then(items => setGroups(items.filter(item => item.membershipStatus === 'MEMBRE' || item.membershipStatus === 'ADMINISTRATEUR')))
      .catch(value => { if (!controller.signal.aborted) setGroupError(value instanceof Error ? value.message : 'Chargement impossible.'); })
      .finally(() => { if (!controller.signal.aborted) setLoadingGroups(false); });
    return () => controller.abort();
  }, [id, token]);

  useEffect(() => {
    if (!token || id === null) return;
    const controller = new AbortController();
    getMessageMembers(id, token, controller.signal).then(setMembers)
      .catch(value => { if (!controller.signal.aborted) setError(value instanceof Error ? value.message : 'Chargement impossible.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, token]);

  async function start(memberId: number) {
    if (!token || id === null || busy) return;
    setBusy(memberId); setError('');
    try {
      const conversation = await startConversation(id, memberId, token);
      router.push({ pathname: '/messages/[id]', params: { id: conversation.id } });
    } catch (value) { setError(value instanceof Error ? value.message : 'Conversation impossible.'); }
    finally { setBusy(undefined); }
  }

  return <ThemedView style={styles.screen}><ScrollView contentContainerStyle={styles.scroll}><SafeAreaView style={styles.content} edges={['left', 'right', 'bottom']}>
    <ThemedText type="title">{t(id === null ? 'Choisir un groupe' : 'Choisir une personne')}</ThemedText>
    <View style={styles.hint}><ThemedText type="smallBold" style={styles.hintStep}>{t(id === null ? 'ÉTAPE 1 SUR 2' : 'ÉTAPE 2 SUR 2')}</ThemedText><ThemedText themeColor="textSecondary">{t(id === null ? 'Touchez un groupe pour voir les personnes à qui vous pouvez écrire.' : 'Touchez une personne pour ouvrir une discussion privée.')}</ThemedText></View>
    {!token ? <Pressable onPress={() => router.navigate('/(tabs)/account')}><ThemedText type="linkPrimary">{t('Connectez-vous pour écrire')}</ThemedText></Pressable> : id === null ? <>
      {!!groupError && <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{groupError}</ThemedText>}
      {loadingGroups ? <ThemedText themeColor="textSecondary">{t('Chargement de vos groupes…')}</ThemedText> : groups.length === 0 && !groupError ? <View style={styles.empty}><ThemedText themeColor="textSecondary">{t('Rejoignez un groupe pour écrire à ses membres.')}</ThemedText><Pressable onPress={() => router.navigate('/groups')}><ThemedText type="linkPrimary">{t('Explorer les groupes →')}</ThemedText></Pressable></View> : groups.map(group => <Pressable key={group.id} accessibilityRole="button" onPress={() => { setError(''); setLoading(true); setSelectedGroupId(group.id); }} style={styles.member}><View style={styles.avatar}><ThemedText type="smallBold" style={styles.avatarText}>{group.name.charAt(0).toUpperCase()}</ThemedText></View><ThemedText type="smallBold" style={styles.name}>{group.name}</ThemedText><ThemedText type="linkPrimary">{t('Voir les personnes →')}</ThemedText></Pressable>)}
    </> : <>
      {!groupId && <Pressable onPress={() => { setSelectedGroupId(null); setMembers([]); }}><ThemedText type="linkPrimary">{t('← Changer de groupe')}</ThemedText></Pressable>}
      {!!error && <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>}
      {loading ? <ThemedText themeColor="textSecondary">Chargement des membres…</ThemedText> : members.length === 0 && !error ? <ThemedText themeColor="textSecondary">Aucun autre membre disponible dans ce groupe.</ThemedText> : members.map(member => <Pressable key={member.id} accessibilityRole="button" disabled={busy !== undefined} onPress={() => void start(member.id)} style={styles.member}><View style={styles.avatar}><ThemedText type="smallBold" style={styles.avatarText}>{member.name.charAt(0).toUpperCase()}</ThemedText></View><ThemedText type="smallBold" style={styles.name}>{member.name}</ThemedText><ThemedText type="linkPrimary">{busy === member.id ? 'Ouverture…' : 'Écrire →'}</ThemedText></Pressable>)}
    </>}
  </SafeAreaView></ScrollView></ThemedView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, scroll: { alignItems: 'center' }, content: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.four, gap: Spacing.three }, hint: { gap: Spacing.one, padding: Spacing.three, borderRadius: 16, backgroundColor: Colors.brandSoft, borderLeftWidth: 3, borderLeftColor: Colors.orangeBorder }, hintStep: { color: Colors.brand }, error: { color: '#B42318' }, empty: { gap: Spacing.two, padding: Spacing.three, borderWidth: 1, borderColor: Colors.border, borderRadius: 16 }, member: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.one, paddingVertical: Spacing.three, borderBottomWidth: 1, borderBottomColor: Colors.orangeBorder }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: Colors.brand }, name: { flex: 1 } });
