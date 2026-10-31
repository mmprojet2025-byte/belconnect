import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { getGroups, Group, joinGroup, leaveGroup } from '@/lib/groups';
import { useAuth } from '@/context/auth-context';
import { GroupFeed } from '@/components/group-feed';
import { useLocale } from '@/context/locale-context';
import { translate } from '@/lib/translations';

export default function GroupDetailScreen() {
  const auth = useAuth();
  const {locale}=useLocale();
  const t=(text:string)=>translate(locale,text);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<Group>();
  const [error, setError] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getGroups(controller.signal, auth.token).then(items => { const found = items.find(item => String(item.id) === id); if (found) setGroup(found); else setError(true); }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [id, auth.token, revision]);
  async function requestToJoin() {
    if (!group) return;
    if (!auth.token) { router.navigate('/(tabs)/account'); return; }
    setJoining(true); setJoinError('');
    try { await joinGroup(group.id, auth.token); setRevision(value => value + 1); }
    catch (value) { setJoinError(value instanceof Error ? value.message : 'Demande impossible.'); }
    finally { setJoining(false); }
  }
  async function leave() {
    if (!group || !auth.token || joining) return;
    setJoining(true); setJoinError('');
    try { await leaveGroup(group.id, auth.token); router.replace('/groups'); }
    catch (value) { setJoinError(value instanceof Error ? value.message : 'Impossible de quitter ce groupe.'); }
    finally { setJoining(false); }
  }
  return <ThemedView style={styles.screen}><ScrollView><SafeAreaView style={styles.content} edges={['left', 'right', 'bottom']}>
    {!group ? <ThemedText>{error ? 'Groupe indisponible.' : 'Chargement du groupe…'}</ThemedText> : <View style={styles.body}>
      {group.coverUrl ? <Image source={{ uri: group.coverUrl }} style={styles.image} resizeMode="cover" /> : <View style={styles.initial}><ThemedText type="title" style={styles.initialText}>{group.name.charAt(0).toUpperCase()}</ThemedText></View>}
      <ThemedText type="title">{group.name}</ThemedText>
      <ThemedText type="smallBold">{t('Espace')} {group.spaceName}</ThemedText>
      <ThemedText>{group.description || 'Un groupe pour se rencontrer et partager.'}</ThemedText>
      {group.membershipStatus === 'AUCUNE' ? <Pressable disabled={joining} accessibilityRole="button" style={styles.joinButton} onPress={() => auth.token ? Alert.alert(t('Rejoindre ce groupe ?'), t('Votre demande sera examinée par un administrateur de l’espace.'), [{ text: t('Annuler'), style: 'cancel' }, { text: t('Envoyer ma demande'), onPress: () => void requestToJoin() }]) : router.navigate('/(tabs)/account')}><ThemedText type="smallBold" style={styles.joinText}>{joining ? 'Envoi…' : auth.token ? 'Demander à rejoindre' : 'Se connecter pour rejoindre'}</ThemedText></Pressable> : <ThemedText type="smallBold" style={styles.initialText}>{group.membershipStatus === 'EN_ATTENTE' ? 'Demande en attente' : group.membershipStatus === 'MEMBRE' ? 'Vous êtes membre' : group.membershipStatus === 'ADMINISTRATEUR' ? 'Vous administrez ce groupe' : group.membershipStatus === 'REFUSEE' ? 'Demande refusée' : 'Adhésion enregistrée'}</ThemedText>}
      {!!joinError && <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{joinError}</ThemedText>}
      {(group.membershipStatus === 'MEMBRE' || group.membershipStatus === 'ADMINISTRATEUR') && auth.token && <Pressable accessibilityRole="button" style={styles.messageButton} onPress={() => router.push({ pathname: '/messages/groups/[id]', params: { id: group.id } })}><ThemedText type="smallBold" style={styles.joinText}>{t('Ouvrir la discussion du groupe →')}</ThemedText></Pressable>}
      {(group.membershipStatus === 'MEMBRE' || group.membershipStatus === 'ADMINISTRATEUR') && auth.token && <Pressable accessibilityRole="button" style={styles.privateMessageButton} onPress={() => router.push({ pathname: '/messages/new', params: { groupId: group.id } })}><ThemedText type="smallBold" style={styles.privateMessageText}>{t('Écrire à un membre du groupe →')}</ThemedText></Pressable>}
      {group.membershipStatus === 'MEMBRE' && <Pressable accessibilityRole="button" disabled={joining} style={styles.leaveButton} onPress={() => Alert.alert(t('Quitter ce groupe ?'), t('Vous ne verrez plus sa discussion ni ses publications. Vous pourrez demander à le rejoindre de nouveau.'), [{ text: t('Annuler'), style: 'cancel' }, { text: t('Quitter le groupe'), style: 'destructive', onPress: () => void leave() }])}><ThemedText style={styles.leaveText}>{t('Quitter le groupe')}</ThemedText></Pressable>}
      {(group.membershipStatus === 'MEMBRE' || group.membershipStatus === 'ADMINISTRATEUR') && auth.token && <GroupFeed key={`${group.id}-${auth.token}`} groupId={group.id} />}
    </View>}
  </SafeAreaView></ScrollView></ThemedView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: Spacing.four }, body: { gap: Spacing.three }, image: { width: '100%', height: 240, borderRadius: 20 }, initial: { height: 180, borderRadius: 20, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, initialText: { color: Colors.brand }, joinButton: { minHeight: 52, backgroundColor: Colors.brand, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, messageButton: { minHeight: 52, backgroundColor: Colors.brand, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 }, privateMessageButton: { minHeight: 52, borderWidth: 1, borderColor: Colors.brand, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 }, privateMessageText: { color: Colors.brand }, joinText: { color: Colors.onBrand }, leaveButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' }, leaveText: { color: '#A9433B' }, error: { color: '#B42318' } });
