import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { enablePush, getNotifications, markNotificationRead, MobileNotice } from '@/lib/notifications';

const date=new Intl.DateTimeFormat('fr-BE',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Brussels'});
export default function NotificationsScreen(){const auth=useAuth();const [items,setItems]=useState<MobileNotice[]>([]);const [loading,setLoading]=useState(false);const [error,setError]=useState('');const [pushMessage,setPushMessage]=useState('');
 const load=useCallback(async()=>{if(!auth.token){setItems([]);return;}setLoading(true);setError('');try{setItems(await getNotifications(auth.token));}catch(value){setError(value instanceof Error?value.message:'Chargement impossible.');}finally{setLoading(false);}},[auth.token]);
 useFocusEffect(useCallback(()=>{void load();},[load]));
 async function read(notice:MobileNotice){if(!auth.token||notice.readAt)return;try{await markNotificationRead(auth.token,notice);setItems(value=>value.map(item=>item.source===notice.source&&item.id===notice.id?{...item,readAt:new Date().toISOString()}:item));}catch(value){setError(value instanceof Error?value.message:'Action impossible.');}}
 async function activate(){if(!auth.token)return;setPushMessage('');try{await enablePush(auth.token);setPushMessage('Téléphone enregistré pour les alertes push.');}catch(value){setPushMessage(value instanceof Error?value.message:'Activation impossible.');}}
 if(!auth.profile)return <ThemedView style={styles.center}><ThemedText>Connectez-vous dans Mon espace pour voir vos notifications.</ThemedText></ThemedView>;
 const unread=items.filter(item=>!item.readAt);const history=items.filter(item=>!!item.readAt);
 const card=(item:MobileNotice)=><ThemedView type="surface" style={[styles.card,!item.readAt&&styles.unreadCard,item.source==='activity'&&styles.urgentCard]} key={`${item.source}-${item.id}`}>
  <View style={styles.cardHeader}><View style={[styles.badge,item.source==='activity'?styles.urgentBadge:styles.normalBadge]}><ThemedText type="eyebrow" style={item.source==='activity'?styles.urgentText:styles.normalText}>{item.source==='activity'?'Activité annulée':item.source==='group'?'Groupe':'Espace'}</ThemedText></View>{!item.readAt&&<ThemedText type="smallBold" style={styles.newText}>Nouveau</ThemedText>}</View>
  <ThemedText type="smallBold">{item.title}</ThemedText><ThemedText>{item.message}</ThemedText><ThemedText type="small" themeColor="textSecondary">{date.format(new Date(item.createdAt))}</ThemedText>
  <View style={styles.actions}>{item.source==='activity'&&<Pressable accessibilityRole="button" onPress={()=>router.navigate('/(tabs)/account')}><ThemedText type="linkPrimary">Voir ma réservation →</ThemedText></Pressable>}{!item.readAt&&<Pressable accessibilityRole="button" onPress={()=>void read(item)}><ThemedText type="linkPrimary">Marquer comme lue</ThemedText></Pressable>}</View>
 </ThemedView>;
 return <ThemedView style={styles.screen}><ScrollView contentContainerStyle={styles.scroll}><SafeAreaView style={styles.container} edges={['left','right','bottom']}>
  <ThemedText type="title">Notifications</ThemedText><ThemedText themeColor="textSecondary">Les changements importants restent ici, même après lecture.</ThemedText>
  <Pressable accessibilityRole="button" style={styles.refresh} onPress={()=>void load()}><ThemedText type="linkPrimary">Actualiser</ThemedText></Pressable>
  {!!error&&<ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>}
  {loading&&items.length===0&&<ThemedText>Chargement…</ThemedText>}
  {!loading&&items.length===0&&!error&&<ThemedView type="surface" style={styles.card}><ThemedText type="smallBold">Aucune notification</ThemedText><ThemedText themeColor="textSecondary">Les changements concernant vos activités et vos communautés apparaîtront ici.</ThemedText></ThemedView>}
  {unread.length>0&&<View style={styles.section}><ThemedText type="subtitle">À lire · {unread.length}</ThemedText>{unread.map(card)}</View>}
  {history.length>0&&<View style={styles.section}><ThemedText type="subtitle">Déjà lues</ThemedText>{history.map(card)}</View>}
  <Pressable accessibilityRole="button" style={styles.primary} onPress={()=>void activate()}><ThemedText type="smallBold" style={styles.onBrand}>Enregistrer ce téléphone pour les alertes</ThemedText></Pressable>
  {!!pushMessage&&<ThemedText accessibilityLiveRegion="polite" themeColor="textSecondary">{pushMessage}</ThemedText>}
 </SafeAreaView></ScrollView></ThemedView>}
const styles=StyleSheet.create({screen:{flex:1},center:{flex:1,alignItems:'center',justifyContent:'center',padding:Spacing.four},scroll:{alignItems:'center'},container:{width:'100%',maxWidth:MaxContentWidth,padding:Spacing.four,gap:Spacing.three},section:{gap:Spacing.three,marginTop:Spacing.two},refresh:{alignSelf:'flex-start'},primary:{backgroundColor:Colors.brand,minHeight:52,borderRadius:14,alignItems:'center',justifyContent:'center',paddingHorizontal:Spacing.three},onBrand:{color:Colors.onBrand},card:{padding:Spacing.three,borderRadius:18,borderWidth:1,borderColor:Colors.light.border,gap:Spacing.two},unreadCard:{backgroundColor:Colors.brandSoft},urgentCard:{borderColor:'#EFC6AA'},cardHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},badge:{borderRadius:8,paddingHorizontal:8,paddingVertical:5},urgentBadge:{backgroundColor:Colors.orangeSoft},normalBadge:{backgroundColor:Colors.brandSoft},urgentText:{color:Colors.orange},normalText:{color:Colors.brand},newText:{color:Colors.brand},actions:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:Spacing.two},error:{color:'#B42318'}});
