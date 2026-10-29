import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

export default function AccountScreen(){
  const auth=useAuth(); const [mode,setMode]=useState<'login'|'register'>('login'); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const [firstName,setFirstName]=useState(''); const [lastName,setLastName]=useState(''); const [email,setEmail]=useState(''); const [password,setPassword]=useState('');
  async function submit(){setBusy(true);setError('');try{if(mode==='register')await auth.signUp({firstName,lastName,email,password});else await auth.signIn({email,password});}catch(value){setError(value instanceof Error?value.message:'Connexion impossible.');}finally{setBusy(false);}}
  if(!auth.ready)return <ThemedView style={styles.center}><ThemedText accessibilityLiveRegion="polite">Vérification de la session…</ThemedText></ThemedView>;
  if(auth.profile)return <ThemedView style={styles.screen}><SafeAreaView style={styles.profile} edges={['left','right']}><ThemedText type="eyebrow" style={styles.brand}>MON ESPACE</ThemedText><ThemedText type="title">Bonjour {auth.profile.firstName}</ThemedText><ThemedView type="surface" style={styles.card}><ThemedText type="smallBold">{auth.profile.firstName} {auth.profile.lastName}</ThemedText><ThemedText themeColor="textSecondary">{auth.profile.email}</ThemedText></ThemedView><Pressable style={styles.secondaryButton} onPress={()=>auth.signOut()}><ThemedText type="smallBold" style={styles.brand}>Se déconnecter</ThemedText></Pressable></SafeAreaView></ThemedView>;
  return <ThemedView style={styles.screen}><KeyboardAvoidingView style={styles.screen} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}><SafeAreaView style={styles.form} edges={['left','right','bottom']}><ThemedText type="eyebrow" style={styles.brand}>BELCONNECT</ThemedText><ThemedText type="title">{mode==='login'?'Heureux de vous revoir.':'Rejoignez BelConnect.'}</ThemedText><ThemedText themeColor="textSecondary">{mode==='login'?'Connectez-vous pour retrouver vos inscriptions et vos projets.':'Créez votre compte pour participer aux activités locales.'}</ThemedText>
    {mode==='register'&&<View style={styles.row}><Field label="Prénom" value={firstName} onChangeText={setFirstName}/><Field label="Nom" value={lastName} onChangeText={setLastName}/></View>}
    <Field label="Adresse e-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email"/>
    <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode==='login'?'current-password':'new-password'}/>
    {mode==='register'&&<ThemedText type="small" themeColor="textSecondary">12 caractères minimum.</ThemedText>}{!!error&&<ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>}
    <Pressable disabled={busy} style={({pressed})=>[styles.primaryButton,(pressed||busy)&&styles.pressed]} onPress={submit}><ThemedText type="smallBold" style={styles.buttonText}>{busy?'Patientez…':mode==='login'?'Se connecter':'Créer mon compte'}</ThemedText></Pressable>
    <Pressable onPress={()=>{setError('');setMode(value=>value==='login'?'register':'login');}}><ThemedText type="linkPrimary">{mode==='login'?'Pas encore de compte ? S’inscrire':'Déjà un compte ? Se connecter'}</ThemedText></Pressable>
  </SafeAreaView></ScrollView></KeyboardAvoidingView></ThemedView>;
}

type FieldProps=React.ComponentProps<typeof TextInput>&{label:string};
function Field({label,...props}:FieldProps){return <View style={styles.field}><ThemedText type="smallBold">{label}</ThemedText><TextInput accessibilityLabel={label} placeholderTextColor="#777" style={styles.input} {...props}/></View>;}
const styles=StyleSheet.create({screen:{flex:1},center:{flex:1,alignItems:'center',justifyContent:'center'},scroll:{alignItems:'center'},form:{width:'100%',maxWidth:MaxContentWidth,padding:Spacing.four,gap:Spacing.three},profile:{width:'100%',maxWidth:MaxContentWidth,alignSelf:'center',padding:Spacing.four,gap:Spacing.four},brand:{color:Colors.brand},row:{flexDirection:'row',gap:Spacing.two},field:{gap:Spacing.one,flex:1},input:{minHeight:52,borderWidth:1,borderColor:Colors.border,borderRadius:14,paddingHorizontal:16,fontSize:16,backgroundColor:'#FFFFFF',color:'#111111'},primaryButton:{backgroundColor:Colors.brand,borderRadius:14,minHeight:52,alignItems:'center',justifyContent:'center'},secondaryButton:{borderWidth:1,borderColor:Colors.brand,borderRadius:14,minHeight:52,alignItems:'center',justifyContent:'center'},buttonText:{color:Colors.onBrand},pressed:{opacity:.7},error:{color:'#B42318'},card:{padding:Spacing.four,borderRadius:18,gap:Spacing.one}});
