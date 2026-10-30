import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

export function SocialAvatar({ name, size = 44, ring = false }: { name: string; size?: number; ring?: boolean }) {
  const initial = name.trim().charAt(0).toLocaleUpperCase('fr') || 'B';
  return <View accessibilityLabel={name} style={[styles.outer, { width: size, height: size, borderRadius: size / 2 }, ring && styles.ring]}>
    <View style={[styles.inner, { borderRadius: size / 2 }]}><ThemedText style={[styles.initial, { fontSize: Math.round(size * .38) }]}>{initial}</ThemedText></View>
  </View>;
}

const styles = StyleSheet.create({ outer: { padding: 3 }, ring: { borderWidth: 2, borderColor: Colors.brand }, inner: { flex: 1, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, initial: { color: Colors.brand, fontWeight: '800' } });
