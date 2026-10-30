import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityCard } from '@/components/activity-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useActivities } from '@/hooks/use-activities';

export default function HomeScreen() {
  const { activities, loading, error, retry } = useActivities();
  return <ThemedView style={styles.screen}><ScrollView contentContainerStyle={styles.scroll}><SafeAreaView style={styles.container} edges={['left', 'right']}>
    <View style={styles.hero}><ThemedText type="eyebrow" style={styles.brand}>BELCONNECT</ThemedText><ThemedText type="title">La Belgique se rencontre ici.</ThemedText><ThemedText themeColor="textSecondary" style={styles.lead}>Découvrez des activités locales, rejoignez des groupes et donnez vie aux projets près de chez vous.</ThemedText><Link href="/activities" asChild><Pressable accessibilityRole="button" style={({ pressed }) => [styles.button, pressed && styles.pressed]}><ThemedText type="smallBold" style={styles.buttonText}>Explorer les activités</ThemedText></Pressable></Link></View>
    <Link href="/groups" asChild><Pressable accessibilityRole="button" accessibilityLabel="Explorer les groupes" style={groupStyles.shortcut}><ThemedText type="smallBold">Groupes</ThemedText><ThemedText type="linkPrimary">Découvrir les communautés →</ThemedText></Pressable></Link>
    <Link href="/messages" asChild><Pressable accessibilityRole="button" accessibilityLabel="Ouvrir mes messages" style={groupStyles.shortcut}><ThemedText type="smallBold">Messages</ThemedText><ThemedText type="linkPrimary">Voir mes conversations →</ThemedText></Pressable></Link>
    <View style={styles.sectionHeader}><ThemedText type="subtitle">À découvrir</ThemedText><Link href="/activities"><ThemedText type="linkPrimary">Tout voir</ThemedText></Link></View>
    {loading && <ThemedText accessibilityLiveRegion="polite">Chargement des activités…</ThemedText>}
    {error && <ThemedView type="surface" style={styles.error}><ThemedText type="smallBold">Le catalogue est momentanément indisponible.</ThemedText><Pressable accessibilityRole="button" onPress={retry}><ThemedText type="linkPrimary">Réessayer</ThemedText></Pressable></ThemedView>}
    <View style={styles.list}>{activities.slice(0, 3).map(item => <ActivityCard key={item.id} activity={item} />)}</View>
  </SafeAreaView></ScrollView></ThemedView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, scroll: { alignItems: 'center' }, container: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.four, gap: Spacing.four }, hero: { backgroundColor: Colors.brandSoft, borderRadius: 28, padding: Spacing.five, gap: Spacing.three }, brand: { color: Colors.brand }, lead: { fontSize: 18, lineHeight: 27 }, button: { alignSelf: 'flex-start', backgroundColor: Colors.brand, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18 }, buttonText: { color: Colors.onBrand }, pressed: { opacity: 0.76 }, sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, list: { gap: Spacing.three }, error: { padding: Spacing.four, borderRadius: 18, gap: Spacing.two } });

const groupStyles = StyleSheet.create({ shortcut: { borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: Spacing.three, flexDirection: "row", justifyContent: "space-between", alignItems: "center" } });
