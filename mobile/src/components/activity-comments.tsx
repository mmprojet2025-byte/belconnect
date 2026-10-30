import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LocalizedTextInput as TextInput } from '@/components/localized-text-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth-context';
import { Colors, Spacing } from '@/constants/theme';
import { ActivityComment, deleteActivityComment, getActivityComments, postActivityComment } from '@/lib/activity-comments';
import { useLocale } from '@/context/locale-context';

export function ActivityComments({ activityId, count, onCountChange }: { activityId: string; count: number; onCountChange: (count: number) => void }) {
  const {locale}=useLocale();
  const date=new Intl.DateTimeFormat(`${locale}-BE`,{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Brussels'});
  const { token } = useAuth();
  const [items, setItems] = useState<ActivityComment[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const requestId = useRef(Crypto.randomUUID());

  useEffect(() => {
    const controller = new AbortController();
    getActivityComments(activityId, token, undefined, controller.signal)
      .then(result => { setItems(result); setHasMore(result.length === 30); })
      .catch(value => { if (!controller.signal.aborted) setError(value instanceof Error ? value.message : 'Chargement impossible.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [activityId, token]);

  async function more() {
    if (!items.length || busy) return;
    setBusy(true); setError('');
    try {
      const older = await getActivityComments(activityId, token, items[items.length - 1].id);
      setItems(current => [...current, ...older]); setHasMore(older.length === 30);
    } catch (value) { setError(value instanceof Error ? value.message : 'Chargement impossible.'); }
    finally { setBusy(false); }
  }

  async function publish() {
    if (!token) { router.navigate('/(tabs)/account'); return; }
    const value = content.trim();
    if (!value || busy) return;
    setBusy(true); setError('');
    try {
      const created = await postActivityComment(activityId, token, value, requestId.current);
      setItems(current => [created, ...current.filter(item => item.id !== created.id)]);
      setContent(''); requestId.current = Crypto.randomUUID(); onCountChange(count + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Publication impossible.'); }
    finally { setBusy(false); }
  }

  async function remove(commentId: number) {
    if (!token || busy) return;
    setBusy(true); setError('');
    try {
      await deleteActivityComment(activityId, commentId, token);
      setItems(current => current.filter(item => item.id !== commentId)); onCountChange(Math.max(0, count - 1));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Suppression impossible.'); }
    finally { setBusy(false); }
  }

  return <View style={styles.section}>
    <ThemedText type="subtitle">Commentaires · {count}</ThemedText>
    {token ? <View style={styles.compose}><TextInput accessibilityLabel="Écrire un commentaire" placeholder="Votre commentaire…" placeholderTextColor="#777" multiline maxLength={500} value={content} onChangeText={setContent} style={styles.input} /><Pressable accessibilityRole="button" disabled={!content.trim() || busy} onPress={() => void publish()} style={[styles.send, (!content.trim() || busy) && styles.disabled]}><ThemedText type="smallBold" style={styles.sendText}>Publier</ThemedText></Pressable></View> : <Pressable onPress={() => router.navigate('/(tabs)/account')}><ThemedText type="linkPrimary">Connectez-vous pour commenter</ThemedText></Pressable>}
    {!!error && <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>}
    {loading ? <ThemedText themeColor="textSecondary">Chargement des commentaires…</ThemedText> : items.length === 0 ? <ThemedText themeColor="textSecondary">Soyez le premier à commenter.</ThemedText> : items.map(item => <ThemedView type="surface" style={styles.comment} key={item.id}><View style={styles.heading}><ThemedText type="smallBold">{item.author}</ThemedText><ThemedText type="small" themeColor="textSecondary">{date.format(new Date(item.createdAt))}</ThemedText></View><ThemedText>{item.content}</ThemedText>{item.mine && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void remove(item.id)}><ThemedText type="small" style={styles.delete}>Supprimer</ThemedText></Pressable>}</ThemedView>)}
    {hasMore && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void more()}><ThemedText type="linkPrimary">Voir plus de commentaires</ThemedText></Pressable>}
  </View>;
}

const styles = StyleSheet.create({ section: { gap: Spacing.three }, compose: { gap: Spacing.two }, input: { minHeight: 88, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 14, fontSize: 16, color: '#111', backgroundColor: '#FFF', textAlignVertical: 'top' }, send: { alignSelf: 'flex-end', backgroundColor: Colors.brand, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 }, disabled: { opacity: 0.45 }, sendText: { color: Colors.onBrand }, comment: { gap: Spacing.one, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: Spacing.three }, heading: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.one }, delete: { color: '#B42318' }, error: { color: '#B42318' } });
