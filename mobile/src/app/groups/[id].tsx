import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { getGroups, Group, joinGroup } from '@/lib/groups';
import { useAuth } from '@/context/auth-context';
import { GroupFeed } from '@/components/group-feed';

export default function GroupDetailScreen() {
  const auth = useAuth();
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
  return <ThemedView style={styles.screen}><ScrollView><SafeAreaView style={styles.content} edges={['left', 'right', 'bottom']}>
    {!group ? <ThemedText>{error ? 'Groupe indisponible.' : 'Chargement du groupe…'}</ThemedText> : <View style={styles.body}>
      {group.coverUrl ? <Image source={{ uri: group.coverUrl }} style={styles.image} resizeMode="cover" /> : <View style={styles.initial}><ThemedText type="title" style={styles.initialText}>{group.name.charAt(0).toUpperCase()}</ThemedText></View>}
      <ThemedText type="title">{group.name}</ThemedText>
      <ThemedText type="smallBold">Espace {group.spaceName}</ThemedText>
      <ThemedText>{group.description || 'Un groupe pour se rencontrer et partager.'}</ThemedText>
      {group.membershipStatus === 'AUCUNE' ? <Pressable disabled={joining} accessibilityRole="button" style={styles.joinButton} onPress={() => auth.token ? Alert.alert('Rejoindre ce groupe ?', 'Votre demande sera examinée par un administrateur de l’espace.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Envoyer ma demande', onPress: () => void requestToJoin() }]) : router.navigate('/(tabs)/account')}><ThemedText type="smallBold" style={styles.joinText}>{joining ? 'Envoi…' : auth.token ? 'Demander à rejoindre' : 'Se connecter pour rejoindre'}</ThemedText></Pressable> : <ThemedText type="smallBold" style={styles.initialText}>{group.membershipStatus === 'EN_ATTENTE' ? 'Demande en attente' : group.membershipStatus === 'MEMBRE' ? 'Vous êtes membre' : group.membershipStatus === 'ADMINISTRATEUR' ? 'Vous administrez ce groupe' : group.membershipStatus === 'REFUSEE' ? 'Demande refusée' : 'Adhésion enregistrée'}</ThemedText>}
      {!!joinError && <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{joinError}</ThemedText>}
      {(group.membershipStatus === 'MEMBRE' || group.membershipStatus === 'ADMINISTRATEUR') && auth.token && <GroupFeed key={`${group.id}-${auth.token}`} groupId={group.id} />}
    </View>}
  </SafeAreaView></ScrollView></ThemedView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: Spacing.four }, body: { gap: Spacing.three }, image: { width: '100%', height: 240, borderRadius: 20 }, initial: { height: 180, borderRadius: 20, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, initialText: { color: Colors.brand }, joinButton: { minHeight: 52, backgroundColor: Colors.brand, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, joinText: { color: Colors.onBrand }, error: { color: '#B42318' } });
