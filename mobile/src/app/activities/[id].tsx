import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { activityImages } from '@/lib/activity-images';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { Activity, getActivity, setActivityLike } from '@/lib/api';
import { createBooking } from '@/lib/bookings';
import { createPaidCheckout } from '@/lib/paid-bookings';
import { useAuth } from '@/context/auth-context';
import { ActivityComments } from '@/components/activity-comments';

const date = new Intl.DateTimeFormat('fr-BE', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Brussels' });

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth=useAuth();
  const paidRequestId=useRef(Crypto.randomUUID());
  const [activity, setActivity] = useState<Activity>(); const [error, setError] = useState(false); const [revision, setRevision] = useState(0);
  const [likeBusy, setLikeBusy] = useState(false); const [likeError, setLikeError] = useState('');
  const [quantity,setQuantity]=useState(1); const [phone,setPhone]=useState(''); const [busy,setBusy]=useState(false); const [bookingError,setBookingError]=useState(''); const [confirmed,setConfirmed]=useState(false);
  useEffect(() => { if (!id) return; const controller = new AbortController(); getActivity(id, controller.signal, auth.token).then(setActivity).catch(() => { if (!controller.signal.aborted) setError(true); }); return () => controller.abort(); }, [id, revision, auth.token]);
  async function toggleLike() {
    if (!auth.token) { router.navigate('/(tabs)/account'); return; }
    if (!activity || likeBusy) return;
    setLikeBusy(true); setLikeError('');
    try { const state = await setActivityLike(activity.id, auth.token, !activity.likedByMe); setActivity(value => value && value.id === activity.id ? { ...value, ...state } : value); }
    catch (value) { setLikeError(value instanceof Error ? value.message : 'Action impossible.'); }
    finally { setLikeBusy(false); }
  }
  async function book(){
    if(!auth.profile||!auth.token){router.navigate('/(tabs)/account');return;}
    if(!activity)return;
    setBusy(true);setBookingError('');
    try{
      const contact={activityId:activity.id,quantity,firstName:auth.profile.firstName,lastName:auth.profile.lastName,email:auth.profile.email,phone,acknowledged:true as const};
      if(activity.price>0){const checkout=await createPaidCheckout(auth.token,{...contact,requestId:paidRequestId.current});await WebBrowser.openBrowserAsync(checkout.url);router.navigate('/(tabs)/account');}
      else{await createBooking(auth.token,contact);setConfirmed(true);setRevision(value=>value+1);}
    }
    catch(value){setBookingError(value instanceof Error?value.message:'Réservation impossible.');}
    finally{setBusy(false);}
  }
  return <ThemedView style={styles.screen}><ScrollView contentContainerStyle={styles.scroll}><SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
    {!activity && !error && <ThemedText accessibilityLiveRegion="polite">Chargement de l’activité…</ThemedText>}
    {error && <View style={styles.block}><ThemedText type="smallBold">Cette activité est indisponible.</ThemedText><Pressable onPress={() => { setActivity(undefined); setError(false); setRevision(value => value + 1); }}><ThemedText type="linkPrimary">Réessayer</ThemedText></Pressable></View>}
    {activity && activityImages[activity.image] && <Image source={activityImages[activity.image]} style={styles.cover} resizeMode="cover" accessibilityLabel={`Photo de ${activity.title}`} />}
    {activity && <><View style={styles.hero}><View style={styles.categoryBadge}><ThemedText type="eyebrow" style={styles.categoryText}>{activity.category}</ThemedText></View><ThemedText type="title" style={styles.activityTitle}>{activity.title}</ThemedText><ThemedText themeColor="textSecondary">{date.format(new Date(activity.startsAt))}</ThemedText><ThemedText themeColor="textSecondary">{activity.city} · {activity.location}</ThemedText><Pressable accessibilityRole="button" accessibilityLabel={`${activity.likedByMe ? 'Retirer mon J’aime' : 'J’aime cette activité'}, ${activity.likeCount} J’aime`} accessibilityState={{ selected: activity.likedByMe, disabled: likeBusy }} disabled={likeBusy} onPress={() => void toggleLike()} style={[styles.likeButton, activity.likedByMe && styles.likeButtonActive]}><ThemedText type="smallBold" style={styles.brand}>{activity.likedByMe ? '♥ Aimé' : '♡ J’aime'} · {activity.likeCount}</ThemedText></Pressable>{!!likeError && <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{likeError}</ThemedText>}</View><View style={styles.section}><ThemedText type="subtitle">L’expérience</ThemedText><ThemedText>{activity.description}</ThemedText></View><View style={styles.section}><ThemedText type="subtitle">Informations pratiques</ThemedText><View style={styles.infoRow}><ThemedText type="smallBold" style={styles.infoLabel}>Rendez-vous</ThemedText><ThemedText style={styles.infoValue}>{activity.details.meetingPoint}</ThemedText></View><View style={styles.infoRow}><ThemedText type="smallBold" style={styles.infoLabel}>Durée</ThemedText><ThemedText style={styles.infoValue}>{activity.details.duration}</ThemedText></View><View style={styles.infoRow}><ThemedText type="smallBold" style={styles.infoLabel}>Public</ThemedText><ThemedText style={styles.infoValue}>{activity.details.audience}</ThemedText></View><View style={styles.infoRow}><ThemedText type="smallBold" style={styles.infoLabel}>Organisateur</ThemedText><ThemedText style={styles.infoValue}>{activity.host}</ThemedText></View></View><View style={styles.bookingBlock}><View style={styles.bookingHeading}><ThemedText type="subtitle">Réserver</ThemedText><View style={styles.priceBadge}><ThemedText type="smallBold" style={styles.brand}>{activity.price === 0 ? 'Gratuit' : `${activity.price.toFixed(2)} €`}</ThemedText></View></View><ThemedText type="small" themeColor="textSecondary">{activity.details.remaining} place(s) disponible(s)</ThemedText>
      {confirmed?<View style={styles.success}><ThemedText type="smallBold" style={styles.brand}>Réservation confirmée.</ThemedText><Pressable onPress={()=>router.navigate('/(tabs)/account')}><ThemedText type="linkPrimary">Voir mes réservations</ThemedText></Pressable></View>:activity.price>0&&activity.demonstration?<ThemedText themeColor="textSecondary">Cette activité est une démonstration : aucun paiement réel ne sera effectué.</ThemedText>:activity.details.remaining<1?<ThemedText themeColor="textSecondary">Cette activité est complète.</ThemedText>:<><View style={styles.quantity}><ThemedText type="smallBold">Participants</ThemedText><View style={styles.stepper}><Pressable accessibilityLabel="Retirer un participant" disabled={quantity===1} style={styles.stepButton} onPress={()=>setQuantity(value=>Math.max(1,value-1))}><ThemedText type="subtitle">−</ThemedText></Pressable><ThemedText type="smallBold">{quantity}</ThemedText><Pressable accessibilityLabel="Ajouter un participant" disabled={quantity===Math.min(4,activity.details.remaining)} style={styles.stepButton} onPress={()=>setQuantity(value=>Math.min(4,activity.details.remaining,value+1))}><ThemedText type="subtitle">+</ThemedText></Pressable></View></View>
        {auth.profile&&<View style={styles.field}><ThemedText type="smallBold">Téléphone (facultatif)</ThemedText><TextInput accessibilityLabel="Téléphone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} placeholder="+32…" placeholderTextColor="#777" style={styles.input}/></View>}
        {!!bookingError&&<ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{bookingError}</ThemedText>}<Pressable disabled={busy} style={({pressed})=>[styles.primaryButton,(pressed||busy)&&styles.pressed]} onPress={book}><ThemedText type="smallBold" style={styles.buttonText}>{busy?(activity.price>0?'Ouverture de Stripe…':'Réservation…'):auth.profile?(activity.price>0?'Payer avec Stripe':'Confirmer la réservation'):'Se connecter pour réserver'}</ThemedText></Pressable><ThemedText type="small" themeColor="textSecondary">{activity.price>0?'Le paiement sécurisé s’ouvrira dans votre navigateur. Revenez ensuite dans Mon espace pour vérifier sa confirmation.':'En confirmant, vous acceptez les conditions de participation de l’organisateur.'}</ThemedText></>}
    </View><View style={styles.section}><ActivityComments key={`${activity.id}-${auth.token ?? 'guest'}`} activityId={activity.id} count={activity.commentCount} onCountChange={count => setActivity(value => value && value.id === activity.id ? { ...value, commentCount: count } : value)} /></View></>}
  </SafeAreaView></ScrollView></ThemedView>;
}

const styles = StyleSheet.create({ screen:{flex:1},scroll:{alignItems:'center'},container:{width:'100%',maxWidth:MaxContentWidth,padding:Spacing.four,gap:Spacing.three},cover:{width:'100%',height:240,borderRadius:22},hero:{backgroundColor:Colors.brandSoft,borderRadius:22,padding:Spacing.four,gap:Spacing.two},activityTitle:{fontSize:28,lineHeight:34},categoryBadge:{alignSelf:'flex-start',backgroundColor:Colors.orangeSoft,borderRadius:8,paddingHorizontal:10,paddingVertical:6},categoryText:{color:Colors.orange},brand:{color:Colors.brand},likeButton:{alignSelf:'flex-start',paddingHorizontal:16,minHeight:42,borderWidth:1,borderColor:Colors.brand,borderRadius:22,justifyContent:'center',backgroundColor:'#FFFFFF'},likeButtonActive:{backgroundColor:'#D7F1E6'},block:{gap:Spacing.two},section:{backgroundColor:Colors.light.surface,borderWidth:1,borderColor:Colors.light.border,borderRadius:20,padding:Spacing.four,gap:Spacing.three},infoRow:{flexDirection:'row',justifyContent:'space-between',gap:Spacing.two,borderTopWidth:1,borderColor:Colors.light.border,paddingTop:Spacing.two},infoLabel:{width:100,color:Colors.light.textSecondary},infoValue:{flex:1},bookingBlock:{gap:Spacing.three,backgroundColor:Colors.light.surface,borderWidth:1,borderColor:Colors.light.border,borderRadius:20,padding:Spacing.four},bookingHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:Spacing.two},priceBadge:{backgroundColor:Colors.brandSoft,borderRadius:20,paddingHorizontal:12,paddingVertical:6},quantity:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},stepper:{flexDirection:'row',alignItems:'center',gap:Spacing.three},stepButton:{width:42,height:42,borderWidth:1,borderColor:Colors.border,borderRadius:12,alignItems:'center',justifyContent:'center'},field:{gap:Spacing.one},input:{minHeight:52,borderWidth:1,borderColor:Colors.border,borderRadius:14,paddingHorizontal:16,fontSize:16,backgroundColor:'#FFFFFF',color:'#111111'},primaryButton:{backgroundColor:Colors.brand,borderRadius:14,minHeight:52,alignItems:'center',justifyContent:'center'},buttonText:{color:Colors.onBrand},pressed:{opacity:.7},error:{color:'#B42318'},success:{backgroundColor:Colors.brandSoft,borderRadius:14,padding:Spacing.three,gap:Spacing.two} });
