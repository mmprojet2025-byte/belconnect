import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

export const avatarChoices = ['mint', 'amber', 'coral', 'blue'] as const;
export type AvatarCode = typeof avatarChoices[number];

const portraits: Record<AvatarCode, { background: string; skin: string; hair: string; shirt: string }> = {
  mint: { background: '#DDF1E6', skin: '#A66A45', hair: '#242822', shirt: '#22745E' },
  amber: { background: '#FFF0D8', skin: '#D79566', hair: '#53382E', shirt: '#E58335' },
  coral: { background: '#FCE8E7', skin: '#6E402E', hair: '#171D1A', shirt: '#C66370' },
  blue: { background: '#E1ECF8', skin: '#E8B28C', hair: '#8A563B', shirt: '#4779B5' },
};

export function SocialAvatar({ name, size = 44, ring = false, avatarCode }: { name: string; size?: number; ring?: boolean; avatarCode?: string | null }) {
  const initial = name.trim().charAt(0).toLocaleUpperCase('fr') || 'B';
  const portrait = avatarCode && avatarCode in portraits ? portraits[avatarCode as AvatarCode] : null;
  return <View accessibilityLabel={name} style={[styles.outer, { width: size, height: size, borderRadius: size / 2 }, ring && styles.ring]}>
    <View style={[styles.inner, { borderRadius: size / 2, backgroundColor: portrait?.background ?? Colors.brandSoft }]}>{portrait ? <>
      <View style={[styles.shirt, { width: size * .72, height: size * .38, borderRadius: size * .28, bottom: -size * .1, backgroundColor: portrait.shirt }]} />
      <View style={[styles.face, { width: size * .46, height: size * .54, borderRadius: size * .23, top: size * .19, backgroundColor: portrait.skin }]} />
      <View style={[styles.hair, { width: size * .5, height: size * .24, borderTopLeftRadius: size * .25, borderTopRightRadius: size * .25, top: size * .12, backgroundColor: portrait.hair }]} />
      <View style={[styles.eyes, { top: size * .43, gap: size * .12 }]}><View style={[styles.eye, { width: size * .035, height: size * .035 }]} /><View style={[styles.eye, { width: size * .035, height: size * .035 }]} /></View>
      <View style={[styles.smile, { width: size * .11, height: size * .055, top: size * .55, borderBottomLeftRadius: size * .08, borderBottomRightRadius: size * .08 }]} />
    </> : <ThemedText style={[styles.initial, { fontSize: Math.round(size * .38) }]}>{initial}</ThemedText>}</View>
  </View>;
}

const styles = StyleSheet.create({ outer: { padding: 3 }, ring: { borderWidth: 2, borderColor: Colors.brand }, inner: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, initial: { color: Colors.brand, fontWeight: '800' }, shirt: { position: 'absolute' }, face: { position: 'absolute' }, hair: { position: 'absolute' }, eyes: { position: 'absolute', flexDirection: 'row' }, eye: { borderRadius: 4, backgroundColor: '#242822' }, smile: { position: 'absolute', borderBottomWidth: 2, borderColor: '#6E402E' } });
