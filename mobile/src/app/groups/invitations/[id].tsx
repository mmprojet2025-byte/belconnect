import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { answerGroupInvitation, getGroupInvitations, GroupInvitation } from '@/lib/groups';

export default function GroupInvitationScreen(){
  const {id}=useLocalSearchParams<{id:string}>();
  const {token}=useAuth();
  const [invitation,setInvitation]=useState<GroupInvitation|null>(null);
  const [loaded,setLoaded]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{if(!token)return;const controller=new AbortController();getGroupInvitations(token,controller.signal).then(items=>{if(!controller.signal.aborted){setInvitation(items.find(item=>item.id===Number(id))??null);setLoaded(true);}}).catch(()=>{if(!controller.signal.aborted){setError('Impossible de charger cette invitation.');setLoaded(true);}});return()=>controller.abort();},[id,token]);
  async function answer(decision:'accept'|'decline'){if(!token||!invitation)return;setBusy(true);setError('');try{await answerGroupInvitation(invitation.id,decision,token);setInvitation({...invitation,status:decision==='accept'?'ACCEPTEE':'REFUSEE'});}catch(value){setError(value instanceof Error?value.message:'Action impossible.');}finally{setBusy(false);}}
  return <ThemedView style={styles.screen}><SafeAreaView style={styles.content} edges={['left','right','bottom']}><ThemedText type="eyebrow" style={styles.brand}>INVITATION PRIVÉE</ThemedText><ThemedText type="title">{invitation?.groupName??'Invitation à un groupe'}</ThemedText>{!token?<ThemedText>Connectez-vous pour consulter cette invitation.</ThemedText>:!loaded?<ThemedText>Chargement de l’invitation…</ThemedText>:!invitation?<ThemedText>Cette invitation n’est pas disponible pour ce compte.</ThemedText>:<><ThemedText>Le groupe de l’espace {invitation.spaceName} vous invite à le rejoindre.</ThemedText>{invitation.status==='EN_ATTENTE'?<View style={styles.actions}><Pressable accessibilityRole="button" disabled={busy} style={styles.accept} onPress={()=>void answer('accept')}><ThemedText type="smallBold" style={styles.acceptText}>{busy?'Enregistrement…':'Accepter l’invitation'}</ThemedText></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={()=>void answer('decline')}><ThemedText type="linkPrimary">Refuser</ThemedText></Pressable></View>:<><ThemedText type="smallBold" style={styles.brand}>{invitation.status==='ACCEPTEE'?'Invitation acceptée. Vous êtes membre du groupe.':'Invitation refusée.'}</ThemedText>{invitation.status==='ACCEPTEE'&&<Pressable accessibilityRole="button" onPress={()=>router.replace({pathname:'/groups/[id]',params:{id:String(invitation.groupId)}})}><ThemedText type="linkPrimary">Voir le groupe →</ThemedText></Pressable>}</>}{!!error&&<ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>}</>}</SafeAreaView></ThemedView>;
}
const styles=StyleSheet.create({screen:{flex:1},content:{width:'100%',maxWidth:MaxContentWidth,alignSelf:'center',padding:Spacing.four,gap:Spacing.three},brand:{color:Colors.brand},actions:{gap:Spacing.three,alignItems:'flex-start'},accept:{backgroundColor:Colors.brand,borderRadius:14,paddingHorizontal:18,paddingVertical:13},acceptText:{color:Colors.onBrand},error:{color:'#B42318'}});
