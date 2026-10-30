import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

export default function PrivacyScreen() {
  return <ThemedView style={styles.screen}><ScrollView contentContainerStyle={styles.scroll}><SafeAreaView edges={['left', 'right', 'bottom']} style={styles.content}>
    <ThemedText type="title">Confidentialité et données</ThemedText>
    <View style={styles.notice}><ThemedText type="smallBold">Informations en préparation</ThemedText><ThemedText type="small">BelConnect est en développement. La politique complète doit encore être finalisée avant l’ouverture du service au public.</ThemedText></View>
    <Section title="Données utilisées">BelConnect utilise les informations du compte, les inscriptions aux activités, les groupes rejoints, les participations aux projets et les messages nécessaires au fonctionnement du service.</Section>
    <Section title="Qui peut voir vos informations ?">Les personnes autorisées à gérer une activité peuvent consulter les informations nécessaires à votre inscription. Les administrateurs et référents disposent des accès liés à leurs missions.</Section>
    <Section title="Vos droits">Vous pouvez demander l’accès à vos données, leur correction ou, dans les conditions prévues par le RGPD, leur effacement et l’exercice de vos autres droits. La procédure de demande et le contact dédié doivent encore être définis.</Section>
    <Section title="Ce qu’il reste à préciser">L’identité du responsable du traitement, les durées de conservation, les prestataires et les éventuels transferts de données seront indiqués dans la version définitive. L’export et l’effacement complets du compte ne sont pas encore disponibles dans l’application.</Section>
  </SafeAreaView></ScrollView></ThemedView>;
}

function Section({ title, children }: { title: string; children: string }) {
  return <View style={styles.section}><ThemedText type="subtitle">{title}</ThemedText><ThemedText themeColor="textSecondary">{children}</ThemedText></View>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, scroll: { alignItems: 'center' }, content: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.four, gap: Spacing.three }, notice: { backgroundColor: Colors.brandSoft, borderRadius: 16, padding: Spacing.three, gap: Spacing.one }, section: { backgroundColor: Colors.light.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: Spacing.three, gap: Spacing.two } });
