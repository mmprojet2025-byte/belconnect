import * as Crypto from 'expo-crypto';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LocalizedTextInput as TextInput } from '@/components/localized-text-input';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useLocale } from '@/context/locale-context';
import { translate } from '@/lib/translations';
import { FreeProjectEnrollment, getFreeProjectEnrollments, getProjectHelp, getProjectOffer, joinFreeProject, ProjectHelp, ProjectOffer, proposeProjectHelp } from '@/lib/project-actions';

const helpLabels: Record<string, string> = { BENEVOLAT: 'Donner du temps', COMPETENCES: 'Partager une compétence', PARTAGE: 'Faire connaître', SOUTIEN_MORAL: 'Soutien moral' };
const activeHelp = (status: string) => status === 'PROPOSEE' || status === 'ACCEPTEE';

export function ProjectParticipation({ projectId, helpTypes, token, onMessageFocus }: { projectId: number; helpTypes: string[]; token: string | null; onMessageFocus?: () => void }) {
  const { locale } = useLocale();
  const t = (text: string) => translate(locale, text);
  const types = helpTypes.filter(type => type in helpLabels);
  const [offer, setOffer] = useState<ProjectOffer | null>(null);
  const [enrollment, setEnrollment] = useState<FreeProjectEnrollment | null>(null);
  const [help, setHelp] = useState<ProjectHelp[]>([]);
  const [selected, setSelected] = useState(types[0] ?? '');
  const [message, setMessage] = useState('');
  const [requestId, setRequestId] = useState(() => Crypto.randomUUID());
  const [loading, setLoading] = useState(Boolean(token));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    let active = true;
    Promise.all([getProjectOffer(projectId, token), getFreeProjectEnrollments(token), getProjectHelp(token)])
      .then(([currentOffer, enrollments, proposals]) => { if (active) { setOffer(currentOffer); setEnrollment(enrollments.find(item => item.projectId === projectId) ?? null); setHelp(proposals.filter(item => item.projectId === projectId)); } })
      .catch(value => { if (active) setError(value instanceof Error ? value.message : translate(locale, 'Participation momentanément indisponible.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, token, locale]);

  async function join() {
    if (!token || busy) return;
    setBusy(true); setError('');
    try { setEnrollment(await joinFreeProject(projectId, token)); }
    catch (value) { setError(value instanceof Error ? value.message : t('Inscription impossible.')); }
    finally { setBusy(false); }
  }

  async function propose() {
    if (!token || !selected || busy) return;
    setBusy(true); setError('');
    try { const result = await proposeProjectHelp(projectId, token, selected, message.trim(), requestId); setHelp(current => [...current, result]); setMessage(''); setRequestId(Crypto.randomUUID()); }
    catch (value) { setError(value instanceof Error ? value.message : t('Proposition impossible.')); }
    finally { setBusy(false); }
  }

  return <View style={styles.section}><ThemedText type="subtitle" style={styles.sectionTitle}>{t('Participer au projet')}</ThemedText>
    {!token ? <View style={styles.block}><ThemedText themeColor="textSecondary">{t('Connectez-vous pour vous inscrire ou proposer votre aide.')}</ThemedText><Link href="/(tabs)/account"><ThemedText type="linkPrimary">{t('Se connecter →')}</ThemedText></Link></View>
      : loading ? <ThemedText themeColor="textSecondary">{t('Chargement des possibilités de participation…')}</ThemedText>
      : <>
        {offer && <View style={styles.block}><ThemedText type="smallBold" style={styles.orange}>{offer.priceCents === 0 ? t('INSCRIPTION GRATUITE') : t('PARTICIPATION PAYANTE')}</ThemedText><ThemedText>{offer.description}</ThemedText>
          {offer.priceCents === 0 ? enrollment?.status === 'CONFIRMEE' ? <ThemedText type="smallBold" style={styles.confirmed}>{t('Vous êtes inscrit à ce projet.')}</ThemedText>
            : offer.active && offer.paymentReady && offer.placesLeft > 0 ? <Pressable accessibilityRole="button" disabled={busy} style={[styles.button, busy && styles.disabled]} onPress={() => void join()}><ThemedText type="smallBold" style={styles.buttonText}>{busy ? t('Patientez…') : t('M’inscrire gratuitement')}</ThemedText></Pressable>
            : <ThemedText themeColor="textSecondary">{offer.placesLeft < 1 ? t('Toutes les places sont réservées.') : t('Les inscriptions sont fermées.')}</ThemedText>
          : <ThemedText themeColor="textSecondary">{t('L’inscription payante n’est pas encore disponible sur mobile.')}</ThemedText>}
        </View>}
        {types.length > 0 && <View style={styles.block}><ThemedText type="smallBold" style={styles.orange}>{t('PROPOSER MON AIDE')}</ThemedText><ThemedText themeColor="textSecondary">{t('Choisissez comment vous souhaitez aider ce projet.')}</ThemedText><View style={styles.choices}>{types.map(type => <Pressable key={type} accessibilityRole="button" accessibilityState={{ selected: selected === type }} onPress={() => setSelected(type)} style={[styles.choice, selected === type && styles.choiceSelected]}><ThemedText type="smallBold" style={selected === type ? styles.choiceSelectedText : styles.choiceText}>{t(helpLabels[type])}</ThemedText></Pressable>)}</View>
          {selected && help.some(item => item.type === selected && activeHelp(item.status)) ? <ThemedText type="smallBold" style={styles.confirmed}>{t('Votre proposition d’aide a été envoyée.')}</ThemedText>
            : <><TextInput accessibilityLabel={t('Message pour l’organisateur')} placeholder={t('Un message facultatif pour l’organisateur…')} placeholderTextColor={Colors.light.textSecondary} multiline maxLength={1000} value={message} onChangeText={setMessage} onFocus={onMessageFocus} style={styles.input} /><Pressable accessibilityRole="button" disabled={busy || !selected} onPress={() => void propose()} style={[styles.button, (busy || !selected) && styles.disabled]}><ThemedText type="smallBold" style={styles.buttonText}>{busy ? t('Patientez…') : t('Envoyer ma proposition')}</ThemedText></Pressable></>}
        </View>}
        {!offer && types.length === 0 && <ThemedText themeColor="textSecondary">{t('Ce projet ne propose pas encore de participation.')}</ThemedText>}
      </>}
    {!!error && <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>}
  </View>;
}

const styles = StyleSheet.create({ section: { backgroundColor: Colors.light.surface, borderWidth: 1, borderColor: Colors.orangeBorder, borderRadius: 20, padding: Spacing.four, gap: Spacing.three }, sectionTitle: { borderLeftWidth: 3, borderLeftColor: Colors.orangeBorder, paddingLeft: Spacing.two }, block: { gap: Spacing.two }, orange: { color: Colors.orange }, confirmed: { color: Colors.brand, backgroundColor: Colors.brandSoft, padding: Spacing.three, borderRadius: 12 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }, choice: { borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20 }, choiceSelected: { borderColor: Colors.brand, backgroundColor: Colors.brandSoft }, choiceText: { color: Colors.light.textSecondary }, choiceSelectedText: { color: Colors.brand }, input: { minHeight: 84, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: Spacing.three, color: Colors.light.text, textAlignVertical: 'top' }, button: { alignSelf: 'flex-start', minHeight: 48, paddingHorizontal: Spacing.three, backgroundColor: Colors.brand, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: Colors.onBrand }, disabled: { opacity: .5 }, error: { color: '#B42318' } });
