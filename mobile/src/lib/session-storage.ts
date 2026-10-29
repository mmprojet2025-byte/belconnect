import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const key='belconnect.mobile.session';

export async function readToken() {
  if(Platform.OS==='web') return typeof localStorage==='undefined'?null:localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}
export async function saveToken(token:string) {
  if(Platform.OS==='web') { localStorage.setItem(key,token); return; }
  await SecureStore.setItemAsync(key,token,{ keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
}
export async function removeToken() {
  if(Platform.OS==='web') { localStorage.removeItem(key); return; }
  await SecureStore.deleteItemAsync(key);
}
