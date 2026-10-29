import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { apiUrl } from '@/lib/api';

export type MobileNotice={source:'activity'|'workspace'|'group';id:number;title:string;message:string;createdAt:string};
Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:false,shouldSetBadge:true})});

async function call<T>(path:string,token:string,options:RequestInit={}){const response=await fetch(`${apiUrl}/api/mobile${path}`,{...options,headers:{Accept:'application/json',Authorization:`Bearer ${token}`,...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});if(!response.ok)throw new Error(response.status===401?'Votre session a expiré.':'Le service de notifications est indisponible.');return response.status===204?undefined as T:response.json() as Promise<T>;}
export const getNotifications=(token:string)=>call<MobileNotice[]>('/notifications',token);
export const markNotificationRead=(token:string,notice:MobileNotice)=>call<void>(`/notifications/${notice.source}/${notice.id}/read`,token,{method:'POST',body:'{}'});

export async function enablePush(token:string){
  if(Platform.OS==='web')throw new Error('Les notifications push seront disponibles dans l’application Android ou iOS.');
  if(!Device.isDevice)throw new Error('Utilisez un téléphone réel pour activer les notifications.');
  if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('belconnect',{name:'BelConnect',importance:Notifications.AndroidImportance.DEFAULT});
  let permission=await Notifications.getPermissionsAsync();
  if(permission.status!=='granted')permission=await Notifications.requestPermissionsAsync();
  if(permission.status!=='granted')throw new Error('Autorisation de notifications refusée.');
  const projectId=Constants.expoConfig?.extra?.eas?.projectId??Constants.easConfig?.projectId;
  if(!projectId)throw new Error('Le projet EAS doit être associé avant d’activer les notifications push.');
  const push=(await Notifications.getExpoPushTokenAsync({projectId})).data;
  let deviceId=await SecureStore.getItemAsync('belconnect-device-id');
  if(!deviceId){deviceId=Crypto.randomUUID();await SecureStore.setItemAsync('belconnect-device-id',deviceId);}
  await call<void>('/devices',token,{method:'POST',body:JSON.stringify({deviceId,expoPushToken:push,platform:Platform.OS})});
}
