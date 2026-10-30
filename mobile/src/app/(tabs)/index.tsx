import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SocialIcon } from '@/components/social-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useLocale } from '@/context/locale-context';
import { activityImages } from '@/lib/activity-images';
import { Booking, getBookings } from '@/lib/bookings';
import { getGroupAnnouncements, GroupAnnouncement } from '@/lib/group-feed';
import { getGroups, Group } from '@/lib/groups';
import { translate } from '@/lib/translations';

type CommunityNews = GroupAnnouncement & { group: Group };
const member = (group: Group) => group.membershipStatus === 'MEMBRE' || group.membershipStatus === 'ADMINISTRATEUR';

export default function HomeScreen() {
  const { token, profile } = useAuth();
  return <HomeContent key={token ?? 'guest'} token={token} firstName={profile?.firstName ?? null} />;
}

function HomeContent({ token, firstName }: { token: string | null; firstName: string | null }) {
  const { locale } = useLocale();
  const t = (text: string) => translate(locale, text);
  const date = new Intl.DateTimeFormat(`${locale}-BE`, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Brussels' });
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [news, setNews] = useState<CommunityNews | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [bookingError, setBookingError] = useState(false);
  const [newsError, setNewsError] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useFocusEffect(useCallback(() => {
    if (!token) return;
    const controller = new AbortController();
    setNow(Date.now());
    setLoading(true);
    setBookings([]);
    setNews(null);
    setBookingError(false);
    setNewsError(false);
    Promise.allSettled([
      getBookings(token),
      getGroups(controller.signal, token).then(async groups => {
        const results = await Promise.allSettled(groups.filter(member).slice(0, 6).map(async group =>
          (await getGroupAnnouncements(group.id, token, controller.signal)).slice(0, 2).map(item => ({ ...item, group }))));
        const available = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
        if (results.length && results.every(result => result.status === 'rejected')) throw new Error('Annonces indisponibles');
        return available.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
      }),
    ]).then(([reservationResult, newsResult]) => {
      if (controller.signal.aborted) return;
      if (reservationResult.status === 'fulfilled') setBookings(reservationResult.value);
      else setBookingError(true);
      if (newsResult.status === 'fulfilled') setNews(newsResult.value);
      else setNewsError(true);
      setLoading(false);
    });
    return () => controller.abort();
  }, [token]));

  const next = bookings.filter(item => item.status === 'CONFIRMEE' && !item.activityCancelled && new Date(item.startsAt).getTime() > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];

  return <ThemedView style={styles.screen}><ScrollView contentContainerStyle={styles.scroll}><SafeAreaView style={styles.content} edges={['left', 'right']}>
    <View style={styles.topbar}><ThemedText type="subtitle" style={styles.wordmark}>BelConnect</ThemedText><Link href="/messages" asChild><Pressable accessibilityRole="button" accessibilityLabel="Ouvrir mes messages" style={styles.messageButton}><SocialIcon name="message" color={Colors.brand} size={24} /></Pressable></Link></View>
    <View style={styles.intro}><ThemedText type="eyebrow" style={styles.orange}>{t('VOTRE JOURNÉE')}</ThemedText><ThemedText type="title" style={styles.greeting}>{firstName ? `${t('Bonjour')} ${firstName}` : t('Bienvenue sur BelConnect')}</ThemedText><ThemedText themeColor="textSecondary">{t('Vos prochains rendez-vous et les nouvelles de vos communautés, au même endroit.')}</ThemedText></View>

    <View style={styles.sectionHeader}><ThemedText type="subtitle">{t('Votre prochain rendez-vous')}</ThemedText></View>
    {next ? <Link href={{ pathname: '/activities/[id]', params: { id: next.activityId } }} asChild><Pressable accessibilityRole="button" style={styles.bookingCard}>{next.image && activityImages[next.image] ? <Image source={activityImages[next.image]} style={styles.bookingImage} resizeMode="cover" accessibilityLabel={`Photo de ${next.title}`} /> : <View style={styles.bookingFallback}><SocialIcon name="activity" color={Colors.orange} size={34} /></View>}<View style={styles.cardBody}><ThemedText type="eyebrow" style={styles.orange}>{t('RÉSERVATION CONFIRMÉE')}</ThemedText><ThemedText type="subtitle" numberOfLines={2}>{next.title}</ThemedText><ThemedText themeColor="textSecondary">{date.format(new Date(next.startsAt))}</ThemedText><ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{next.location}</ThemedText><ThemedText type="smallBold" style={styles.link}>{t('Voir ma réservation →')}</ThemedText></View></Pressable></Link>
      : <ThemedView type="surface" style={styles.empty}><ThemedText themeColor="textSecondary">{!token ? t('Connectez-vous pour voir votre prochain rendez-vous.') : loading ? t('Chargement de vos réservations…') : bookingError ? t('Vos réservations sont momentanément indisponibles.') : t('Aucune réservation à venir pour le moment.')}</ThemedText><Link href={token ? '/(tabs)/activities' : '/(tabs)/account'}><ThemedText type="linkPrimary">{token ? t('Découvrir les activités →') : t('Se connecter →')}</ThemedText></Link></ThemedView>}

    <View style={styles.sectionHeader}><ThemedText type="subtitle">{t('Dans vos communautés')}</ThemedText><Link href="/groups"><ThemedText type="linkPrimary">{t('Voir les groupes')}</ThemedText></Link></View>
    {news ? <Link href={{ pathname: '/groups/[id]', params: { id: news.group.id } }} asChild><Pressable accessibilityRole="button" style={styles.newsCard}><ThemedText type="eyebrow" style={styles.orange}>{t('ANNONCE DU GROUPE')}</ThemedText><ThemedText type="smallBold">{news.group.name} · {news.author}</ThemedText><ThemedText numberOfLines={4}>{news.content}</ThemedText><ThemedText type="smallBold" style={styles.link}>{t('Ouvrir le groupe →')}</ThemedText></Pressable></Link>
      : <ThemedView type="surface" style={styles.empty}><ThemedText themeColor="textSecondary">{!token ? t('Connectez-vous pour suivre vos communautés.') : loading ? t('Chargement des nouvelles…') : newsError ? t('Les nouvelles de vos groupes sont momentanément indisponibles.') : t('Aucune annonce récente dans vos groupes.')}</ThemedText><Link href="/groups"><ThemedText type="linkPrimary">{t('Découvrir les groupes →')}</ThemedText></Link></ThemedView>}

    <View style={styles.sectionHeader}><ThemedText type="subtitle">{t('Explorer BelConnect')}</ThemedText></View>
    <View style={styles.explore}><Link href="/(tabs)/activities" asChild><Pressable accessibilityRole="button" style={styles.exploreCard}><SocialIcon name="activity" color={Colors.orange} size={29} /><ThemedText type="smallBold">{t('Activités')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{t('Sorties et rencontres')}</ThemedText></Pressable></Link><Link href="/(tabs)/projects" asChild><Pressable accessibilityRole="button" style={styles.exploreCard}><SocialIcon name="project" color={Colors.brand} size={29} /><ThemedText type="smallBold">{t('Projets')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{t('Idées à soutenir')}</ThemedText></Pressable></Link></View>
  </SafeAreaView></ScrollView></ThemedView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, scroll: { alignItems: 'center' }, content: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.four, gap: Spacing.three },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, wordmark: { color: Colors.brand, fontSize: 27 }, messageButton: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  intro: { gap: Spacing.two, paddingVertical: Spacing.two }, greeting: { fontSize: 30, lineHeight: 36 }, orange: { color: Colors.orange }, sectionHeader: { paddingTop: Spacing.two },
  bookingCard: { borderWidth: 1, borderColor: Colors.border, borderRadius: 20, overflow: 'hidden', backgroundColor: '#FFFFFF' }, bookingImage: { width: '100%', height: 160 }, bookingFallback: { height: 110, backgroundColor: Colors.orangeSoft, alignItems: 'center', justifyContent: 'center' }, cardBody: { padding: Spacing.three, gap: Spacing.two },
  newsCard: { padding: Spacing.three, gap: Spacing.two, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4, borderLeftColor: Colors.orange, borderRadius: 18, backgroundColor: '#FFFFFF' }, empty: { padding: Spacing.three, gap: Spacing.two, borderWidth: 1, borderColor: Colors.border, borderRadius: 18 }, link: { color: Colors.brand, marginTop: Spacing.one },
  explore: { flexDirection: 'row', gap: Spacing.two }, exploreCard: { flex: 1, minHeight: 132, padding: Spacing.three, gap: Spacing.one, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, backgroundColor: '#FFFFFF' },
});
