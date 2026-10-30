import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SocialIcon } from '@/components/social-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { getProject, Project, projectImages } from '@/lib/projects';

const date = new Intl.DateTimeFormat('fr-BE', { dateStyle: 'long' });
const money = new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' });
const helpLabels: Record<string, string> = { BENEVOLAT: 'Donner du temps', COMPETENCES: 'Partager une compétence', PARTAGE: 'Faire connaître' };

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  return <ProjectContent key={`${id}-${token ?? 'guest'}`} id={id} token={token} />;
}

function ProjectContent({ id, token }: { id: string | undefined; token: string | null }) {
  const [project, setProject] = useState<Project>();
  const [error, setError] = useState(false);
  useEffect(() => {
    const projectId = Number(id);
    if (!Number.isSafeInteger(projectId) || projectId < 1) return;
    const controller = new AbortController();
    getProject(projectId, controller.signal, token).then(value => { if (!controller.signal.aborted) setProject(value); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [id, token]);
  const invalid = !Number.isSafeInteger(Number(id)) || Number(id) < 1;

  return <ThemedView style={styles.screen}><ScrollView><SafeAreaView style={styles.content} edges={['left', 'right', 'bottom']}>{!project ? <ThemedText accessibilityLiveRegion="polite">{invalid || error ? 'Projet indisponible.' : 'Chargement du projet…'}</ThemedText> : <View style={styles.body}>
    {project.imageUrl && projectImages[project.imageUrl] ? <Image source={projectImages[project.imageUrl]} style={styles.image} resizeMode="cover" accessibilityLabel={`Image du projet ${project.title}`} /> : <View style={styles.imageFallback}><SocialIcon name="project" color={Colors.brand} size={54} /></View>}
    <View style={styles.organizer}><SocialIcon name="group" color={Colors.brand} size={20} /><ThemedText type="smallBold" style={styles.brand}>{project.spaceName}</ThemedText></View>
    <ThemedText type="title">{project.title}</ThemedText>
    <ThemedView type="surface" style={styles.objective}><ThemedText type="eyebrow" style={styles.brand}>POURQUOI CE PROJET</ThemedText><ThemedText style={styles.objectiveText}>{project.objective}</ThemedText></ThemedView>
    <View style={styles.section}><ThemedText type="subtitle">Le projet</ThemedText><ThemedText>{project.description}</ThemedText></View>
    {project.helpTypes.length > 0 && <View style={styles.section}><ThemedText type="subtitle">Comment aider</ThemedText><View style={styles.helpList}>{project.helpTypes.map(value => <View key={value} style={styles.helpChip}><ThemedText type="smallBold" style={styles.brand}>{helpLabels[value] ?? value}</ThemedText></View>)}</View></View>}
    {(project.startsOn || project.meetingPlace || project.participationPriceCents !== null) && <View style={styles.section}><ThemedText type="subtitle">Informations pratiques</ThemedText>{project.startsOn && <ThemedText>Début prévu : {date.format(new Date(`${project.startsOn}T12:00:00`))}</ThemedText>}{project.meetingPlace && <ThemedText>Lieu : {project.meetingPlace}</ThemedText>}{project.participationPriceCents !== null && <ThemedText>Participation : {project.participationPriceCents === 0 ? 'gratuite' : money.format(project.participationPriceCents / 100)}</ThemedText>}</View>}
  </View>}</SafeAreaView></ScrollView></ThemedView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: Spacing.four }, body: { gap: Spacing.four }, image: { width: '100%', height: 250, borderRadius: 22 }, imageFallback: { width: '100%', height: 250, borderRadius: 22, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, organizer: { flexDirection: 'row', alignItems: 'center', gap: 8 }, brand: { color: Colors.brand }, objective: { padding: Spacing.four, borderRadius: 20, gap: Spacing.two }, objectiveText: { fontSize: 18, lineHeight: 27 }, section: { gap: Spacing.two }, helpList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }, helpChip: { backgroundColor: Colors.brandSoft, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 } });
