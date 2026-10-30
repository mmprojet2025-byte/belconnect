import * as Crypto from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SocialAvatar } from '@/components/social-avatar';
import { SocialIcon } from '@/components/social-icon';
import { useAuth } from '@/context/auth-context';
import { Colors, Spacing } from '@/constants/theme';
import { deleteGroupPost, getGroupAnnouncements, getGroupPosts, GroupAnnouncement, GroupPost, publishGroupPost } from '@/lib/group-feed';

const date = new Intl.DateTimeFormat('fr-BE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Brussels' });

export function GroupFeed({ groupId }: { groupId: number }) {
  const { token } = useAuth();
  const [announcements, setAnnouncements] = useState<GroupAnnouncement[]>([]);
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const requestId = useRef(Crypto.randomUUID());

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    Promise.all([getGroupAnnouncements(groupId, token, controller.signal), getGroupPosts(groupId, token, undefined, controller.signal)])
      .then(([news, items]) => { setAnnouncements(news); setPosts(items); setHasMore(items.length === 30); })
      .catch(value => { if (!controller.signal.aborted) setError(value instanceof Error ? value.message : 'Chargement impossible.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [groupId, token]);

  async function publish() {
    if (!token || !content.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const created = await publishGroupPost(groupId, token, content.trim(), requestId.current);
      setPosts(current => [created, ...current.filter(post => post.id !== created.id)]);
      setContent(''); requestId.current = Crypto.randomUUID();
    } catch (value) { setError(value instanceof Error ? value.message : 'Publication impossible.'); }
    finally { setBusy(false); }
  }

  async function remove(postId: number) {
    if (!token || busy) return;
    setBusy(true); setError('');
    try { await deleteGroupPost(groupId, postId, token); setPosts(current => current.filter(post => post.id !== postId)); }
    catch (value) { setError(value instanceof Error ? value.message : 'Suppression impossible.'); }
    finally { setBusy(false); }
  }

  async function more() {
    if (!token || !posts.length || busy) return;
    setBusy(true); setError('');
    try {
      const older = await getGroupPosts(groupId, token, posts[posts.length - 1].id);
      setPosts(current => [...current, ...older]); setHasMore(older.length === 30);
    } catch (value) { setError(value instanceof Error ? value.message : 'Chargement impossible.'); }
    finally { setBusy(false); }
  }

  return <View style={styles.section}>
    {announcements.length > 0 && <View style={styles.block}><ThemedText type="subtitle">Annonces du groupe</ThemedText>{announcements.map(item => <ThemedView type="surface" style={styles.announcement} key={item.id}><View style={styles.authorRow}><SocialAvatar name={item.author} size={40} /><View style={styles.authorCopy}><ThemedText type="smallBold">{item.author}</ThemedText><ThemedText type="small" style={styles.brand}>Annonce officielle</ThemedText></View></View><ThemedText>{item.content}</ThemedText><ThemedText type="small" themeColor="textSecondary">{date.format(new Date(item.createdAt))}</ThemedText></ThemedView>)}</View>}
    <View style={styles.block}><ThemedText type="subtitle">Le fil du groupe</ThemedText><ThemedText themeColor="textSecondary">Partagez une idée, une question ou une nouvelle avec le groupe.</ThemedText>
      <ThemedView type="surface" style={styles.composer}><TextInput accessibilityLabel="Écrire au groupe" placeholder="Qu’aimeriez-vous partager ?" placeholderTextColor="#777" multiline maxLength={1000} value={content} onChangeText={setContent} style={styles.input} /><Pressable accessibilityRole="button" disabled={!content.trim() || busy} onPress={() => void publish()} style={[styles.send, (!content.trim() || busy) && styles.disabled]}><SocialIcon name="send" color={Colors.onBrand} size={17} /><ThemedText type="smallBold" style={styles.sendText}>Publier</ThemedText></Pressable></ThemedView>
      {!!error && <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>}
      {loading ? <ThemedText themeColor="textSecondary">Chargement des échanges…</ThemedText> : posts.length === 0 ? <ThemedText themeColor="textSecondary">Aucune discussion pour le moment. Lancez la première !</ThemedText> : posts.map(post => <ThemedView type="surface" style={styles.post} key={post.id}><View style={styles.authorRow}><SocialAvatar name={post.author} size={40} /><View style={styles.authorCopy}><ThemedText type="smallBold">{post.author}</ThemedText><ThemedText type="small" themeColor="textSecondary">{date.format(new Date(post.createdAt))}</ThemedText></View></View><ThemedText>{post.content}</ThemedText>{post.mine && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void remove(post.id)}><ThemedText type="small" style={styles.delete}>Supprimer</ThemedText></Pressable>}</ThemedView>)}
      {hasMore && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void more()}><ThemedText type="linkPrimary">Voir plus de publications</ThemedText></Pressable>}
    </View>
  </View>;
}

const styles = StyleSheet.create({ section: { gap: Spacing.four, paddingTop: Spacing.four, borderTopWidth: 1, borderColor: Colors.border }, block: { gap: Spacing.two }, announcement: { gap: Spacing.two, padding: Spacing.three, borderWidth: 1, borderColor: Colors.brand, borderRadius: 18, backgroundColor: Colors.brandSoft }, post: { gap: Spacing.three, padding: Spacing.three, borderWidth: 1, borderColor: Colors.border, borderRadius: 18 }, authorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two }, authorCopy: { flex: 1 }, brand: { color: Colors.brand }, composer: { gap: Spacing.two, padding: Spacing.two, borderWidth: 1, borderColor: Colors.border, borderRadius: 18 }, input: { minHeight: 75, padding: 10, fontSize: 16, color: '#17251F', textAlignVertical: 'top' }, send: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: Colors.brand, borderRadius: 13, paddingHorizontal: 18, paddingVertical: 11 }, disabled: { opacity: 0.45 }, sendText: { color: Colors.onBrand }, delete: { color: '#B42318' }, error: { color: '#B42318' } });
