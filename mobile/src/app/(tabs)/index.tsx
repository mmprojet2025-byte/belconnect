import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityCard } from '@/components/activity-card';
import { SocialAvatar } from '@/components/social-avatar';
import { SocialIcon } from '@/components/social-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useActivities } from '@/hooks/use-activities';
import { useAuth } from '@/context/auth-context';
import { getGroups, Group } from '@/lib/groups';

export default function HomeScreen() {
  const { token } = useAuth();
  const { activities, loading, error, retry } = useActivities();
  const [groupState, setGroupState] = useState<{ token: string | null; items: Group[] }>({ token: null, items: [] });
  const groups = groupState.token === token ? groupState.items : [];
  useEffect(() => {
    const controller = new AbortController();
    getGroups(controller.signal, token).then(items => { if (!controller.signal.aborted) setGroupState({ token, items }); }).catch(() => {});
    return () => controller.abort();
  }, [token]);
  return <ThemedView style={styles.screen}><ScrollView contentContainerStyle={styles.scroll}><SafeAreaView style={styles.container} edges={['left', 'right']}>
    <View style={styles.topbar}><View><ThemedText type="eyebrow" style={styles.brand}>LA BELGIQUE SE RENCONTRE</ThemedText><ThemedText type="subtitle" style={styles.wordmark}>BelConnect</ThemedText></View><Link href="/messages" asChild><Pressable accessibilityRole="button" accessibilityLabel="Ouvrir mes messages" style={styles.messageIcon}><SocialIcon name="message" color={Colors.brand} size={25} /></Pressable></Link></View>
    <View style={styles.hero}><ThemedText type="eyebrow" style={styles.heroEyebrow}>PRÈS DE VOUS</ThemedText><ThemedText type="title" style={heroStyles.heading}>On se retrouve dehors ?</ThemedText><ThemedText style={styles.lead}>Des sorties, des projets et des personnes à rencontrer en Belgique.</ThemedText><Link href="/activities" asChild><Pressable accessibilityRole="button" style={({ pressed }) => [styles.button, pressed && styles.pressed]}><ThemedText type="smallBold" style={styles.buttonText}>Explorer les activités →</ThemedText></Pressable></Link></View>
    <View style={styles.sectionHeader}><ThemedText type="subtitle">Communautés</ThemedText><Link href="/groups"><ThemedText type="linkPrimary">Tout voir</ThemedText></Link></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.communities}>{groups.slice(0, 6).map(group => <Link key={group.id} href={{ pathname: '/groups/[id]', params: { id: group.id } }} asChild><Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir le groupe ${group.name}`} style={styles.communityCard}><SocialAvatar name={group.name} size={42} /><ThemedText type="smallBold" numberOfLines={2} style={styles.communityName}>{group.name}</ThemedText><ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{group.spaceName}</ThemedText></Pressable></Link>)}<Link href="/groups" asChild><Pressable accessibilityRole="button" accessibilityLabel="Découvrir tous les groupes" style={styles.communityCard}><View style={styles.communityDiscover}><SocialIcon name="group" color={Colors.brand} size={23} /></View><ThemedText type="smallBold">Tous les groupes</ThemedText><ThemedText type="small" themeColor="textSecondary">Explorer →</ThemedText></Pressable></Link></ScrollView>
    <Link href="/messages" asChild><Pressable accessibilityRole="button" accessibilityLabel="Ouvrir mes conversations privées" style={styles.messageShortcut}><View style={styles.messageShortcutIcon}><SocialIcon name="message" color={Colors.brand} size={23} /></View><View style={styles.messageCopy}><ThemedText type="smallBold">Vos messages</ThemedText><ThemedText type="small" themeColor="textSecondary">Retrouvez les personnes de vos groupes</ThemedText></View><SocialIcon name="chevron" color={Colors.brand} size={18} /></Pressable></Link>
    <View style={styles.sectionHeader}><View><ThemedText type="eyebrow" style={styles.brand}>POUR VOUS</ThemedText><ThemedText type="subtitle">À découvrir</ThemedText></View><Link href="/activities"><ThemedText type="linkPrimary">Tout voir →</ThemedText></Link></View>
    {loading && <ThemedText accessibilityLiveRegion="polite">Chargement des activités…</ThemedText>}
    {error && <ThemedView type="surface" style={styles.error}><ThemedText type="smallBold">Le catalogue est momentanément indisponible.</ThemedText><Pressable accessibilityRole="button" onPress={retry}><ThemedText type="linkPrimary">Réessayer</ThemedText></Pressable></ThemedView>}
    <View style={styles.list}>{activities.slice(0, 3).map(item => <ActivityCard key={item.id} activity={item} />)}</View>

  </SafeAreaView></ScrollView></ThemedView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, scroll: { alignItems: 'center' }, container: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.four, gap: Spacing.four }, topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, wordmark: { color: Colors.brand, fontSize: 27 }, messageIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' }, hero: { backgroundColor: '#173E30', borderRadius: 28, padding: Spacing.five, gap: Spacing.three }, heroEyebrow: { color: '#BDE4CB' }, brand: { color: Colors.brand }, lead: { fontSize: 17, lineHeight: 25, color: '#E0EEE4' }, button: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18 }, buttonText: { color: Colors.brand }, pressed: { opacity: 0.76 }, sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, communities: { gap: Spacing.two, paddingVertical: 2 }, communityCard: { width: 145, minHeight: 145, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.border, borderRadius: 17, padding: Spacing.two, gap: 5 }, communityName: { flex: 1 }, communityDiscover: { width: 42, height: 42, borderRadius: 13, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, messageShortcut: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.border, borderRadius: 18, padding: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.two }, messageShortcutIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, messageCopy: { flex: 1, gap: 2 }, list: { gap: Spacing.three }, error: { padding: Spacing.four, borderRadius: 18, gap: Spacing.two } });
const heroStyles = StyleSheet.create({ heading: { fontSize: 32, lineHeight: 38, color: '#FFFFFF' } });
