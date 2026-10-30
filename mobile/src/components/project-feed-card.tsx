import { Link } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { SocialAvatar } from '@/components/social-avatar';
import { SocialIcon } from '@/components/social-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Project, projectImages } from '@/lib/projects';

const date = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long' });
const helpLabels: Record<string, string> = { BENEVOLAT: 'Bénévolat', COMPETENCES: 'Compétences', PARTAGE: 'Partage' };

export function ProjectFeedCard({ project }: { project: Project }) {
  const theme = useTheme();
  return <Link href={{ pathname: '/projects/[id]', params: { id: project.id } }} asChild><Pressable accessibilityRole="button" accessibilityLabel={`Découvrir le projet ${project.title}`} style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}><ThemedView type="surface" style={[styles.card, { borderColor: theme.border }]}>
    <View style={styles.publisher}><SocialAvatar name={project.spaceName} size={40} /><View style={styles.publisherCopy}><ThemedText type="smallBold" numberOfLines={1}>{project.spaceName}</ThemedText><ThemedText type="small" themeColor="textSecondary">Projet local</ThemedText></View><SocialIcon name="chevron" color={theme.textSecondary} size={18} /></View>
    {project.imageUrl && projectImages[project.imageUrl] ? <Image source={projectImages[project.imageUrl]} style={styles.image} resizeMode="cover" accessibilityLabel={`Image du projet ${project.title}`} /> : <View style={styles.imageFallback}><SocialIcon name="project" color={Colors.brand} size={44} /></View>}
    <View style={styles.content}><ThemedText type="eyebrow" style={styles.brand}>PROJET</ThemedText><ThemedText type="subtitle" numberOfLines={2}>{project.title}</ThemedText><ThemedText themeColor="textSecondary" numberOfLines={3}>{project.objective}</ThemedText>
      <View style={styles.meta}>{project.startsOn && <ThemedText type="small" themeColor="textSecondary">Dès le {date.format(new Date(`${project.startsOn}T12:00:00`))}</ThemedText>}{project.helpTypes.length > 0 && <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{project.helpTypes.map(value => helpLabels[value] ?? value).join(' · ')}</ThemedText>}</View>
      <View style={[styles.footer, { borderColor: theme.border }]}><ThemedText type="smallBold" style={styles.brand}>Découvrir le projet →</ThemedText></View>
    </View>
  </ThemedView></Pressable></Link>;
}

const styles = StyleSheet.create({ pressable: { borderRadius: 22 }, pressed: { opacity: .75 }, card: { borderRadius: 22, overflow: 'hidden', borderWidth: 1 }, publisher: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.three, paddingVertical: 12, gap: 10 }, publisherCopy: { flex: 1 }, image: { width: '100%', height: 220 }, imageFallback: { height: 220, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, content: { padding: Spacing.three, gap: Spacing.one }, brand: { color: Colors.brand }, meta: { gap: 2, marginTop: Spacing.one }, footer: { borderTopWidth: 1, paddingTop: Spacing.three, marginTop: Spacing.two } });
