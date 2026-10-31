import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SocialAvatar } from '@/components/social-avatar';
import { SocialIcon } from '@/components/social-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useLocale } from '@/context/locale-context';
import { activityImages } from '@/lib/activity-images';
import { Booking, getBookings } from '@/lib/bookings';
import { getGroups, Group } from '@/lib/groups';
import { getNotifications, MobileNotice } from '@/lib/notifications';
import { getMyProjectEntries, ProjectEntry } from '@/lib/profile-participations';
import { projectImages } from '@/lib/projects';
import { translate } from '@/lib/translations';

const member = (group: Group) => group.membershipStatus === 'MEMBRE' || group.membershipStatus === 'ADMINISTRATEUR';
const projectStatus: Record<string, string> = { CONFIRMEE: 'Inscription confirmée', ANNULEE: 'Inscription annulée', EN_ATTENTE: 'Paiement en attente', PAYE: 'Paiement confirmé', REMBOURSE: 'Remboursé', REMBOURSEMENT_EN_COURS: 'Remboursement en cours', PROPOSEE: 'Aide proposée', ACCEPTEE: 'Aide acceptée', REFUSEE: 'Aide refusée' };

export default function HomeScreen() {
  const { token, profile } = useAuth();
  return <HomeContent key={token ?? 'guest'} token={token} firstName={profile?.firstName ?? null} />;
}

function HomeContent({ token, firstName }: { token: string | null; firstName: string | null }) {
  const { locale } = useLocale();
  const t = (text: string) => translate(locale, text);
  const date = new Intl.DateTimeFormat(`${locale}-BE`, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Brussels' });
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [notices, setNotices] = useState<MobileNotice[]>([]);
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [loading, setLoading] = useState(Boolean(token));
  const [bookingError, setBookingError] = useState(false);
  const [groupError, setGroupError] = useState(false);
  const [noticeError, setNoticeError] = useState(false);
  const [projectError, setProjectError] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(Boolean(token));
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    if (!token) {
      getGroups(controller.signal).then(items => { if (!controller.signal.aborted) setGroups(items); }).catch(() => { if (!controller.signal.aborted) setGroupError(true); }).finally(() => { if (!controller.signal.aborted) setGroupsLoading(false); });
      return () => controller.abort();
    }
    setNow(Date.now());
    setLoading(true);
    setBookings([]);
    setGroups([]);
    setNotices([]);
    setProjects([]);
    setBookingError(false);
    setGroupError(false);
    setNoticeError(false);
    setProjectError(false);
    setProjectsLoading(true);
    setGroupsLoading(true);
    void getMyProjectEntries(token).then(items => { if (!controller.signal.aborted) setProjects(items); })
      .catch(() => { if (!controller.signal.aborted) setProjectError(true); })
      .finally(() => { if (!controller.signal.aborted) setProjectsLoading(false); });
    Promise.allSettled([
      getBookings(token),
      getGroups(controller.signal, token).then(items => { if (!controller.signal.aborted) { setGroups(items); setGroupsLoading(false); } return items; }),
      getNotifications(token),
    ]).then(([reservationResult, groupsResult, noticesResult]) => {
      if (controller.signal.aborted) return;
      if (reservationResult.status === 'fulfilled') setBookings(reservationResult.value);
      else setBookingError(true);
      if (groupsResult.status === 'fulfilled') setGroups(groupsResult.value);
      else setGroupError(true);
      setGroupsLoading(false);
      if (noticesResult.status === 'fulfilled') setNotices(noticesResult.value);
      else setNoticeError(true);
      setLoading(false);
    });
    return () => controller.abort();
  }, [token]));

  const next = bookings.filter(item => item.status === 'CONFIRMEE' && !item.activityCancelled && new Date(item.startsAt).getTime() > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
  const unread = notices.filter(item => !item.readAt).slice(0, 2);
  const unreadCount = notices.filter(item => !item.readAt).length;
  const visibleGroups = token ? groups.filter(member).slice(0, 3) : [];
  const myProject = projects.find(item => !['ANNULEE', 'REFUSEE', 'REMBOURSE'].includes(item.status)) ?? projects[0];
  const myProjectImage = myProject?.imageUrl ? projectImages[myProject.imageUrl] : undefined;

  return <ThemedView style={styles.screen}><ScrollView contentContainerStyle={styles.scroll}><SafeAreaView style={styles.content} edges={['left', 'right']}>
    <View style={styles.topbar}><ThemedText type="subtitle" style={styles.wordmark}>BelConnect</ThemedText><Link href="/notifications" asChild><Pressable accessibilityRole="button" accessibilityLabel={t('Voir toutes les notifications')} style={styles.messageButton}><SocialIcon name="notification" color={Colors.brand} size={24} />{unreadCount > 0 && <View style={styles.notificationBadge}><ThemedText type="smallBold" style={styles.notificationBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</ThemedText></View>}</Pressable></Link></View>
    <View style={styles.intro}><ThemedText type="eyebrow" style={styles.orange}>{t('VOTRE JOURNÉE')}</ThemedText><ThemedText type="title" style={styles.greeting}>{firstName ? `${t('Bonjour')} ${firstName}` : t('Bienvenue sur BelConnect')}</ThemedText><ThemedText themeColor="textSecondary">{t('Vos rendez-vous, vos nouvelles et vos groupes.')}</ThemedText></View>

    <View style={styles.sectionHeader}><ThemedText type="subtitle">{t('Votre prochain rendez-vous')}</ThemedText></View>
    {next ? <Link href={{ pathname: '/activities/[id]', params: { id: next.activityId } }} asChild><Pressable accessibilityRole="button" style={styles.bookingCard}>{next.image && activityImages[next.image] ? <Image source={activityImages[next.image]} style={styles.bookingImage} resizeMode="cover" accessibilityLabel={`Photo de ${next.title}`} /> : <View style={styles.bookingFallback}><SocialIcon name="activity" color={Colors.orange} size={34} /></View>}<View style={styles.cardBody}><ThemedText type="eyebrow" style={styles.orange}>{t('RÉSERVATION CONFIRMÉE')}</ThemedText><ThemedText type="subtitle" numberOfLines={2}>{next.title}</ThemedText><ThemedText themeColor="textSecondary">{date.format(new Date(next.startsAt))}</ThemedText><ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{next.location}</ThemedText><ThemedText type="smallBold" style={styles.link}>{t('Voir ma réservation →')}</ThemedText></View></Pressable></Link>
      : <ThemedView type="surface" style={styles.empty}><ThemedText themeColor="textSecondary">{!token ? t('Connectez-vous pour voir votre prochain rendez-vous.') : loading ? t('Chargement de vos réservations…') : bookingError ? t('Vos réservations sont momentanément indisponibles.') : t('Aucune réservation à venir pour le moment.')}</ThemedText><Link href={token ? '/(tabs)/activities' : '/(tabs)/account'}><ThemedText type="linkPrimary">{token ? t('Découvrir les activités →') : t('Se connecter →')}</ThemedText></Link></ThemedView>}

    {token && <><View style={styles.sectionHeader}><ThemedText type="subtitle">{t('Mon projet')}</ThemedText></View>{myProject ? <Link href={{ pathname: '/projects/[id]', params: { id: String(myProject.projectId) } }} asChild><Pressable accessibilityRole="button" style={styles.bookingCard}>{myProjectImage ? <Image source={myProjectImage} style={styles.bookingImage} resizeMode="cover" accessibilityLabel={`${t('Projet')} ${myProject.title}`} /> : <View style={styles.bookingFallback}><SocialIcon name="project" color={Colors.orange} size={34} /></View>}<View style={styles.cardBody}><ThemedText type="eyebrow" style={styles.orange}>{t(projectStatus[myProject.status] ?? myProject.status)}</ThemedText><ThemedText type="subtitle" numberOfLines={2}>{myProject.title}</ThemedText><ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{myProject.spaceName}</ThemedText><ThemedText type="smallBold" style={styles.link}>{t('Voir mon projet →')}</ThemedText></View></Pressable></Link> : <ThemedView type="surface" style={styles.empty}><ThemedText themeColor="textSecondary">{projectsLoading ? t('Chargement de vos projets…') : projectError ? t('Vos projets sont momentanément indisponibles.') : t('Aucun projet rejoint pour le moment.')}</ThemedText><Link href="/(tabs)/projects"><ThemedText type="linkPrimary">{t('Découvrir les projets →')}</ThemedText></Link></ThemedView>}</>}

    {token && <><View style={styles.sectionHeader}><ThemedText type="subtitle">{t('À ne pas oublier')}</ThemedText><Link href="/notifications"><ThemedText type="linkPrimary">{t('Tout voir')}</ThemedText></Link></View>{unread.length ? <View style={styles.reminders}>{unread.map(item => <Link key={`${item.source}-${item.id}`} href="/notifications" asChild><Pressable accessibilityRole="button" style={styles.reminder}><View style={styles.reminderIcon}><SocialIcon name={item.source === 'activity' ? 'activity' : item.source === 'project' ? 'project' : item.source === 'message' ? 'message' : 'notification'} color={Colors.orange} size={22} /></View><View style={styles.reminderCopy}><ThemedText type="smallBold" numberOfLines={1}>{item.title}</ThemedText><ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>{item.message}</ThemedText></View><SocialIcon name="chevron" color={Colors.brand} size={16} /></Pressable></Link>)}</View> : <ThemedView type="surface" style={styles.empty}><ThemedText themeColor="textSecondary">{loading ? t('Chargement de vos actualités…') : noticeError ? t('Vos actualités sont momentanément indisponibles.') : t('Rien de nouveau à consulter pour le moment.')}</ThemedText></ThemedView>}</>}

    <View style={styles.sectionHeader}><ThemedText type="subtitle">{t('Mes groupes')}</ThemedText><Link href={{ pathname: '/groups', params: { view: 'mine' } }}><ThemedText type="linkPrimary">{t('Tout voir')}</ThemedText></Link></View>
    <View style={styles.groups}>{visibleGroups.map(group => <Link key={group.id} href={{ pathname: '/groups/[id]', params: { id: group.id } }} asChild><Pressable accessibilityRole="button" accessibilityLabel={`${t('Groupe')} ${group.name}`} style={styles.groupCard}>{group.coverUrl ? <Image source={{ uri: group.coverUrl }} style={styles.groupImage} resizeMode="cover" accessibilityLabel={`${t('Groupe')} ${group.name}`} /> : <View style={styles.groupFallback}><SocialAvatar name={group.name} size={60} /></View>}<View style={styles.groupBody}><ThemedText type="smallBold" style={styles.groupTitle} numberOfLines={2}>{group.name}</ThemedText><ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>{group.description || group.spaceName}</ThemedText><ThemedText type="smallBold" style={styles.link}>{t('Voir mon groupe →')}</ThemedText></View></Pressable></Link>)}{!visibleGroups.length && <ThemedView type="surface" style={styles.empty}><ThemedText themeColor="textSecondary">{groupError ? t('Les groupes sont momentanément indisponibles.') : groupsLoading ? t('Chargement des groupes…') : t('Aucun groupe rejoint pour le moment.')}</ThemedText><Link href="/groups"><ThemedText type="linkPrimary">{t('Explorer les groupes →')}</ThemedText></Link></ThemedView>}</View>
  </SafeAreaView></ScrollView></ThemedView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, scroll: { alignItems: 'center' }, content: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.four, gap: Spacing.three },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: Spacing.three, borderBottomWidth: 1, borderBottomColor: Colors.border }, wordmark: { color: Colors.brand, fontSize: 27 }, messageButton: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: Colors.brandDark, alignItems: 'center', justifyContent: 'center' }, notificationBadge: { position: 'absolute', top: -4, right: -5, minWidth: 19, height: 19, borderRadius: 10, backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }, notificationBadgeText: { color: '#FFFFFF', fontSize: 10, lineHeight: 14 },
  intro: { gap: Spacing.two, padding: Spacing.four, borderRadius: 22, backgroundColor: Colors.brandSoft, borderWidth: 1, borderColor: Colors.orangeBorder }, greeting: { fontSize: 28, lineHeight: 34 }, orange: { color: Colors.orange }, sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, marginTop: Spacing.two, borderLeftWidth: 3, borderLeftColor: Colors.orangeBorder, paddingLeft: Spacing.three, paddingVertical: Spacing.one },
  bookingCard: { borderWidth: 1, borderColor: Colors.orangeBorder, borderRadius: 20, overflow: 'hidden', backgroundColor: '#FFFFFF' }, bookingImage: { width: '100%', height: 160 }, bookingFallback: { height: 110, backgroundColor: Colors.orangeSoft, alignItems: 'center', justifyContent: 'center' }, cardBody: { padding: Spacing.three, gap: Spacing.two },
  empty: { padding: Spacing.three, gap: Spacing.two, borderWidth: 1, borderColor: Colors.border, borderRadius: 18 }, link: { color: Colors.brand, marginTop: Spacing.one },
  reminders: { gap: Spacing.two }, reminder: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3, borderLeftColor: Colors.orangeBorder, borderRadius: 16, backgroundColor: '#FFFFFF' }, reminderIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: Colors.orangeSoft, alignItems: 'center', justifyContent: 'center' }, reminderCopy: { flex: 1, gap: 3 },
  groups: { gap: Spacing.three }, groupCard: { overflow: 'hidden', borderWidth: 1, borderColor: Colors.orangeBorder, borderRadius: 20, backgroundColor: '#FFFFFF' }, groupImage: { width: '100%', height: 165 }, groupFallback: { height: 120, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, groupBody: { padding: Spacing.three, gap: Spacing.one }, groupTitle: { fontSize: 19 },
});
