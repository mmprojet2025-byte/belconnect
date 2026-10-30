import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SocialIcon } from '@/components/social-icon';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { getNotifications, markNotificationRead, MobileNotice } from '@/lib/notifications';

const date=new Intl.DateTimeFormat('fr-BE',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Brussels'});
export default function NotificationsScreen(){const auth=useAuth();const [items,setItems]=useState<MobileNotice[]>([]);const [loading,setLoading]=useState(false);const [error,setError]=useState('');
 const load=useCallback(async()=>{if(!auth.token){setItems([]);return;}setLoading(true);setError('');try{setItems(await getNotifications(auth.token));}catch(value){setError(value instanceof Error?value.message:'Chargement impossible.');}finally{setLoading(false);}},[auth.token]);
 useFocusEffect(useCallback(()=>{void load();},[load]));
 async function read(notice:MobileNotice){if(!auth.token||notice.readAt)return;try{await markNotificationRead(auth.token,notice);setItems(value=>value.map(item=>item.source===notice.source&&item.id===notice.id?{...item,readAt:new Date().toISOString()}:item));}catch(value){setError(value instanceof Error?value.message:'Action impossible.');}}
 if(!auth.profile)return <ThemedView style={styles.center}><ThemedText>Connectez-vous dans Mon espace pour voir vos notifications.</ThemedText></ThemedView>;
 const unread=items.filter(item=>!item.readAt);const history=items.filter(item=>!!item.readAt);
 const card=(item:MobileNotice)=><ThemedView type="surface" style={[styles.card,!item.readAt&&styles.unreadCard,item.source==='activity'&&styles.urgentCard,item.source==='message'&&styles.messageCard]} key={`${item.source}-${item.id}`}>
  <View style={styles.cardHeader}><View style={[styles.badge,item.source==='activity'?styles.urgentBadge:item.source==='message'?styles.messageBadge:styles.normalBadge]}><SocialIcon name={item.source==='activity'?'activity':item.source==='project'?'project':item.source==='message'?'message':item.source==='group'?'group':'notification'} color={item.source==='activity'?Colors.orange:item.source==='message'?Colors.message:Colors.brand} size={16}/><ThemedText type="eyebrow" style={item.source==='activity'?styles.urgentText:item.source==='message'?styles.messageText:styles.normalText}>{item.source==='activity'?'Activité annulée':item.source==='project'?'Projet':item.source==='message'?'Message':item.source==='group'?'Groupe':'Espace'}</ThemedText></View>{!item.readAt&&<ThemedText type="smallBold" style={styles.newText}>Nouveau</ThemedText>}</View>
  <ThemedText type="smallBold">{item.title}</ThemedText><ThemedText>{item.message}</ThemedText><ThemedText type="small" themeColor="textSecondary">{date.format(new Date(item.createdAt))}</ThemedText>
  <View style={styles.actions}>{item.source==='activity'&&<Pressable accessibilityRole="button" onPress={()=>router.navigate('/(tabs)/account')}><ThemedText type="linkPrimary">Voir ma réservation →</ThemedText></Pressable>}{item.source==='message'&&item.conversationId&&<Pressable accessibilityRole="button" onPress={()=>router.navigate({pathname:'/messages/[id]',params:{id:String(item.conversationId)}})}><ThemedText type="linkPrimary">Ouvrir la conversation →</ThemedText></Pressable>}{!item.readAt&&<Pressable accessibilityRole="button" onPress={()=>void read(item)}><ThemedText type="linkPrimary">Marquer comme lue</ThemedText></Pressable>}</View>
 </ThemedView>;
 return <ThemedView style={styles.screen}><ScrollView contentContainerStyle={styles.scroll}><SafeAreaView style={styles.container} edges={['left','right','bottom']}>
  <ThemedText type="title">Notifications</ThemedText><ThemedText themeColor="textSecondary">Les changements importants restent ici, même après lecture.</ThemedText>
  <Pressable accessibilityRole="button" style={styles.refresh} onPress={()=>void load()}><ThemedText type="linkPrimary">Actualiser</ThemedText></Pressable>
  {!!error&&<ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>}
  {loading&&items.length===0&&<ThemedText>Chargement…</ThemedText>}
  {!loading&&items.length===0&&!error&&<ThemedView type="surface" style={styles.card}><ThemedText type="smallBold">Aucune notification</ThemedText><ThemedText themeColor="textSecondary">Les changements concernant vos activités et vos communautés apparaîtront ici.</ThemedText></ThemedView>}
  {unread.length>0&&<View style={styles.section}><ThemedText type="subtitle">À lire · {unread.length}</ThemedText>{unread.map(card)}</View>}
  {history.length>0&&<View style={styles.section}><ThemedText type="subtitle">Déjà lues</ThemedText>{history.map(card)}</View>}
 </SafeAreaView></ScrollView></ThemedView>}
const styles=StyleSheet.create({screen:{flex:1},center:{flex:1,alignItems:'center',justifyContent:'center',padding:Spacing.four},scroll:{alignItems:'center'},container:{width:'100%',maxWidth:MaxContentWidth,padding:Spacing.four,gap:Spacing.three},section:{gap:Spacing.three,marginTop:Spacing.two},refresh:{alignSelf:'flex-start'},card:{padding:Spacing.three,borderRadius:18,borderWidth:1,borderColor:Colors.light.border,gap:Spacing.two},unreadCard:{backgroundColor:Colors.brandSoft},urgentCard:{borderColor:'#EFC6AA'},messageCard:{borderColor:'#BBD3EC'},cardHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},badge:{borderRadius:8,paddingHorizontal:8,paddingVertical:5,flexDirection:'row',alignItems:'center',gap:6},urgentBadge:{backgroundColor:Colors.orangeSoft},normalBadge:{backgroundColor:Colors.brandSoft},messageBadge:{backgroundColor:Colors.messageSoft},urgentText:{color:Colors.orange},normalText:{color:Colors.brand},messageText:{color:Colors.message},newText:{color:Colors.brand},actions:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:Spacing.two},error:{color:'#B42318'}});
