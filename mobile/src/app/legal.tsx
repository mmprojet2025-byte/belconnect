import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useLocale } from '@/context/locale-context';
import { translate } from '@/lib/translations';

export default function LegalScreen() {
  const { locale } = useLocale();
  const t = (text: string) => translate(locale, text);
  return <ThemedView style={styles.screen}><ScrollView contentContainerStyle={styles.scroll}><SafeAreaView edges={['left', 'right', 'bottom']} style={styles.content}>
    <ThemedText type="title">{t('Informations légales')}</ThemedText>
    <View style={styles.notice}><ThemedText type="smallBold">{t('Documents en préparation')}</ThemedText><ThemedText type="small">{t('BelConnect est en développement. Les textes ci-dessous ne sont pas encore des conditions ou mentions légales en vigueur.')}</ThemedText></View>
    <Section title={t('Mentions légales')} text={t('L’identité de l’exploitant, son adresse et ses coordonnées professionnelles doivent être confirmées avant la publication.')} />
    <Section title={t('Conditions d’utilisation')} text={t('Les règles des comptes, des activités, des projets et des contenus sont en préparation. Elles devront être accessibles avant l’inscription.')} />
    <Section title={t('Paiements et remboursements')} text={t('Avant un paiement, le prix total, le vendeur et les conditions d’annulation ou de remboursement devront être indiqués sur le parcours concerné.')} />
    <Section title={t('Protection des données')} text={t('La politique de confidentialité et la suppression du compte doivent être finalisées avant l’ouverture au public. La page Confidentialité et données présente l’état actuel.')} />
  </SafeAreaView></ScrollView></ThemedView>;
}

function Section({ title, text }: { title: string; text: string }) {
  return <View style={styles.section}><ThemedText type="subtitle">{title}</ThemedText><ThemedText themeColor="textSecondary">{text}</ThemedText></View>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, scroll: { alignItems: 'center' }, content: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.four, gap: Spacing.three }, notice: { backgroundColor: Colors.brandSoft, borderRadius: 16, padding: Spacing.three, gap: Spacing.one }, section: { backgroundColor: Colors.light.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: Spacing.three, gap: Spacing.two } });
