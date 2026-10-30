import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SocialIcon } from '@/components/social-icon';
import { Colors, Spacing } from '@/constants/theme';
import { apiUrl } from '@/lib/api';
import { activityImages } from '@/lib/activity-images';
import { Booking } from '@/lib/bookings';
import { getGroups, Group } from '@/lib/groups';
import { PaidAttempt } from '@/lib/paid-bookings';
import { getMyProjectEntries, ProjectEntry } from '@/lib/profile-participations';
import { projectImages } from '@/lib/projects';
import { useLocale } from '@/context/locale-context';
import { translate } from '@/lib/translations';

type Props={token:string|null;bookings:Booking[];paidAttempts:PaidAttempt[];loadingBookings:boolean;bookingError:string;cancelling?:number;onRefreshBookings:()=>void;onCancel:(booking:Booking)=>void};
const projectStatus:Record<string,string>={CONFIRMEE:'Inscription confirmée',ANNULEE:'Inscription annulée',EN_ATTENTE:'Paiement en attente',PAYE:'Paiement confirmé',REMBOURSE:'Remboursé',REMBOURSEMENT_EN_COURS:'Remboursement en cours',PROPOSEE:'Aide proposée',ACCEPTEE:'Aide acceptée',REFUSEE:'Aide refusée'};
const helpType:Record<string,string>={BENEVOLAT:'Bénévolat',COMPETENCES:'Compétences',PARTAGE:'Partage',SOUTIEN_MORAL:'Soutien moral'};
function projectImage(url:string|null){if(!url)return null;return projectImages[url]??{uri:url.startsWith('http')?url:`${apiUrl}${url}`};}

export function AccountParticipationFeed({token,bookings,paidAttempts,loadingBookings,bookingError,cancelling,onRefreshBookings,onCancel}:Props){
  const {locale}=useLocale();
  const date=new Intl.DateTimeFormat(`${locale}-BE`,{dateStyle:'medium',timeZone:'Europe/Brussels'});
  const money=new Intl.NumberFormat(`${locale}-BE`,{style:'currency',currency:'EUR'});
  const [tab,setTab]=useState<'activities'|'projects'|'groups'>('activities');
  const [projects,setProjects]=useState<ProjectEntry[]>([]);
  const [groups,setGroups]=useState<Group[]>([]);
  const [groupError,setGroupError]=useState('');
  const [loadingGroups,setLoadingGroups]=useState(false);
  const [projectError,setProjectError]=useState('');
  const [loadingProjects,setLoadingProjects]=useState(false);
  const loadProjects=useCallback(async()=>{if(!token){setProjects([]);return;}setLoadingProjects(true);setProjectError('');try{setProjects(await getMyProjectEntries(token));}catch(value){setProjectError(value instanceof Error?value.message:'Chargement impossible.');}finally{setLoadingProjects(false);}},[token]);
  const loadGroups=useCallback(async()=>{if(!token){setGroups([]);return;}setLoadingGroups(true);setGroupError('');try{setGroups((await getGroups(undefined,token)).filter(item=>item.membershipStatus==='MEMBRE'||item.membershipStatus==='ADMINISTRATEUR'));}catch(value){setGroupError(value instanceof Error?value.message:'Chargement impossible.');}finally{setLoadingGroups(false);}},[token]);
  useFocusEffect(useCallback(()=>{void loadProjects();void loadGroups();},[loadProjects,loadGroups]));
  const pendingPayments=paidAttempts.filter(item=>item.registrationId===null);
  return <View style={styles.container}>
    <View style={styles.heading}><ThemedText type="subtitle">Mon parcours</ThemedText><Pressable accessibilityRole="button" disabled={loadingBookings||loadingProjects||loadingGroups} onPress={()=>{onRefreshBookings();void loadProjects();void loadGroups();}}><ThemedText type="linkPrimary">Actualiser</ThemedText></Pressable></View>
    <View style={styles.tabs} accessibilityRole="tablist"><Pressable accessibilityRole="tab" accessibilityState={{selected:tab==='activities'}} style={[styles.tab,tab==='activities'&&styles.selected]} onPress={()=>setTab('activities')}><SocialIcon name="activity" color={tab==='activities'?Colors.brand:Colors.light.textSecondary} size={18}/><ThemedText type="smallBold" style={tab==='activities'?styles.activeText:styles.inactiveText}>Activités</ThemedText></Pressable><Pressable accessibilityRole="tab" accessibilityState={{selected:tab==='projects'}} style={[styles.tab,tab==='projects'&&styles.selectedProject]} onPress={()=>setTab('projects')}><SocialIcon name="project" color={tab==='projects'?Colors.orange:Colors.light.textSecondary} size={18}/><ThemedText type="smallBold" style={tab==='projects'?styles.activeProjectText:styles.inactiveText}>Projets</ThemedText></Pressable><Pressable accessibilityRole="tab" accessibilityState={{selected:tab==='groups'}} style={[styles.tab,tab==='groups'&&styles.selected]} onPress={()=>setTab('groups')}><SocialIcon name="group" color={tab==='groups'?Colors.brand:Colors.light.textSecondary} size={18}/><ThemedText type="smallBold" style={tab==='groups'?styles.activeText:styles.inactiveText}>Communautés</ThemedText></Pressable></View>
    {tab==='activities'?<View style={styles.list}>
      {loadingBookings&&bookings.length===0&&<ThemedText>Chargement des activités…</ThemedText>}
      {!!bookingError&&<ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{bookingError}</ThemedText>}
      {!loadingBookings&&bookings.length===0&&pendingPayments.length===0&&!bookingError&&<Empty text="Aucune activité pour le moment. Découvrez le fil Activités pour vous inscrire."/>}
      {bookings.map(booking=><ThemedView type="surface" style={[styles.card,styles.accentCard]} key={booking.id}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${translate(locale,'Activité')} ${booking.title}`} onPress={()=>router.navigate({pathname:'/activities/[id]',params:{id:booking.activityId}})}>{activityImages[booking.image]?<Image source={activityImages[booking.image]} style={styles.image} resizeMode="cover"/>:<View style={styles.fallback}><SocialIcon name="activity" color={Colors.brand} size={40}/></View>}<View style={styles.cardBody}><ThemedText type="smallBold" style={styles.kind}>{translate(locale,'ACTIVITÉ')} · {translate(locale,booking.activityCancelled?'Activité annulée':booking.status==='CONFIRMEE'?'Réservation confirmée':'Réservation annulée')}</ThemedText><ThemedText type="subtitle" numberOfLines={2}>{booking.title}</ThemedText><ThemedText type="small" themeColor="textSecondary">{date.format(new Date(booking.startsAt))} · {booking.location}</ThemedText><ThemedText type="small" themeColor="textSecondary">{booking.quantity} {translate(locale,'participant(s)')}</ThemedText></View></Pressable>
        {booking.status==='CONFIRMEE'&&!booking.activityCancelled&&new Date(booking.startsAt)>new Date()&&<Pressable accessibilityRole="button" disabled={cancelling===booking.id} style={styles.cancel} onPress={()=>onCancel(booking)}><ThemedText type="smallBold" style={styles.cancelText}>{cancelling===booking.id?'Annulation…':'Annuler la réservation'}</ThemedText></Pressable>}
      </ThemedView>)}
      {pendingPayments.map(item=><ThemedView type="surface" style={[styles.card,styles.accentCard]} key={`payment-${item.id}`}><Pressable accessibilityRole="button" onPress={()=>router.navigate({pathname:'/activities/[id]',params:{id:item.activityId}})}>{item.image&&activityImages[item.image]?<Image source={activityImages[item.image]} style={styles.image} resizeMode="cover"/>:<View style={styles.fallback}><SocialIcon name="activity" color={Colors.brand} size={40}/></View>}<View style={styles.cardBody}><ThemedText type="smallBold" style={styles.kind}>{translate(locale,'ACTIVITÉ')} · {translate(locale,item.status==='EN_ATTENTE'?'Paiement en attente':'Paiement non abouti')}</ThemedText><ThemedText type="subtitle">{item.title}</ThemedText><ThemedText type="small" themeColor="textSecondary">{date.format(new Date(item.startsAt))} · {money.format(item.amountCents/100)}</ThemedText></View></Pressable></ThemedView>)}
    </View>:tab==='projects'?<View style={styles.list}>
      {loadingProjects&&projects.length===0&&<ThemedText>Chargement des projets…</ThemedText>}
      {!!projectError&&<ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{projectError}</ThemedText>}
      {!loadingProjects&&projects.length===0&&!projectError&&<Empty text="Aucun projet pour le moment. Découvrez le fil Projets pour participer."/>}
      {projects.map(item=><ProjectCard key={`${item.kind}-${item.id}`} item={item}/>)}
    </View>:<View style={styles.list}>
      {loadingGroups&&groups.length===0&&<ThemedText>Chargement des communautés…</ThemedText>}
      {!!groupError&&<ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{groupError}</ThemedText>}
      {!loadingGroups&&groups.length===0&&!groupError&&<Empty text="Vous n’avez pas encore rejoint de communauté. Découvrez les groupes BelConnect."/>}
      {groups.map(group=><ThemedView type="surface" style={styles.card} key={group.id}><Pressable accessibilityRole="button" accessibilityLabel={`${translate(locale,'COMMUNAUTÉ')} ${group.name}`} onPress={()=>router.navigate({pathname:'/groups/[id]',params:{id:group.id}})}>{group.coverUrl?<Image source={{uri:group.coverUrl}} style={styles.image} resizeMode="cover"/>:<View style={styles.fallback}><SocialIcon name="group" color={Colors.brand} size={40}/></View>}<View style={styles.cardBody}><ThemedText type="smallBold" style={styles.kind}>{translate(locale,'COMMUNAUTÉ')} · {translate(locale,group.membershipStatus==='ADMINISTRATEUR'?'ADMINISTRATEUR':'MEMBRE')}</ThemedText><ThemedText type="subtitle" numberOfLines={2}>{group.name}</ThemedText><ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>{group.description||group.spaceName}</ThemedText></View></Pressable></ThemedView>)}
      <Pressable accessibilityRole="button" onPress={()=>router.navigate('/groups')}><ThemedText type="linkPrimary">Découvrir les communautés →</ThemedText></Pressable>
    </View>}
  </View>;
}
function ProjectCard({item}:{item:ProjectEntry}){const {locale}=useLocale();const date=new Intl.DateTimeFormat(`${locale}-BE`,{dateStyle:'medium',timeZone:'Europe/Brussels'});const image=projectImage(item.imageUrl);return <ThemedView type="surface" style={[styles.card,styles.accentCard]}><Pressable accessibilityRole="button" accessibilityLabel={`${translate(locale,'Projet')} ${item.title}`} onPress={()=>router.navigate({pathname:'/projects/[id]',params:{id:String(item.projectId)}})}>{image?<Image source={image} style={styles.image} resizeMode="cover"/>:<View style={styles.fallback}><SocialIcon name="project" color={Colors.brand} size={40}/></View>}<View style={styles.cardBody}><ThemedText type="smallBold" style={styles.kind}>{translate(locale,'PROJET')} · {translate(locale,item.kind==='help'?'PROPOSITION D’AIDE':'PARTICIPATION')}</ThemedText><ThemedText type="subtitle" numberOfLines={2}>{item.title}</ThemedText><ThemedText type="small" themeColor="textSecondary">{item.spaceName}{item.startsOn?` · ${date.format(new Date(`${item.startsOn}T12:00:00`))}`:''}</ThemedText><ThemedText type="smallBold" style={styles.status}>{translate(locale,projectStatus[item.status]??item.status)}{item.type?` · ${translate(locale,helpType[item.type]??item.type)}`:''}</ThemedText></View></Pressable></ThemedView>}
function Empty({text}:{text:string}){return <ThemedView type="surface" style={styles.empty}><ThemedText themeColor="textSecondary">{text}</ThemedText></ThemedView>}
const styles=StyleSheet.create({container:{gap:Spacing.three},heading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',backgroundColor:Colors.orangeSoft,borderRadius:14,paddingHorizontal:Spacing.three,paddingVertical:Spacing.two,minHeight:56},tabs:{flexDirection:'row',backgroundColor:Colors.orangeSoft,borderRadius:14,paddingHorizontal:Spacing.one,overflow:'hidden'},tab:{flex:1,minHeight:60,flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,borderBottomWidth:3,borderColor:'transparent'},selected:{borderColor:Colors.brand},selectedProject:{borderColor:Colors.orange},activeText:{color:Colors.brand,fontSize:12},activeProjectText:{color:Colors.orange,fontSize:12},inactiveText:{color:Colors.light.textSecondary,fontSize:12},list:{gap:Spacing.three},card:{borderWidth:1,borderColor:Colors.border,borderRadius:18,overflow:'hidden'},accentCard:{borderColor:'#DFAE8B'},image:{width:'100%',height:170},fallback:{height:170,backgroundColor:Colors.brandSoft,alignItems:'center',justifyContent:'center'},cardBody:{padding:Spacing.three,gap:Spacing.one},kind:{color:Colors.brand,fontSize:12,letterSpacing:.5},status:{color:Colors.brand,marginTop:Spacing.one},cancel:{borderTopWidth:1,borderColor:Colors.border,padding:Spacing.three},cancelText:{color:'#B42318'},empty:{padding:Spacing.four,borderRadius:16},error:{color:'#B42318'}});
