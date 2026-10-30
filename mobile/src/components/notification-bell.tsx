import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SocialIcon } from '@/components/social-icon';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useLocale } from '@/context/locale-context';
import { getNotifications } from '@/lib/notifications';
import { translate } from '@/lib/translations';

export function NotificationBell() {
  const { token } = useAuth();
  const { locale } = useLocale();
  const [unread, setUnread] = useState(0);

  useFocusEffect(useCallback(() => {
    if (!token) { setUnread(0); return; }
    let active = true;
    const refresh = () => void getNotifications(token).then(items => {
      if (active) setUnread(items.filter(item => !item.readAt).length);
    }).catch(() => {});
    refresh();
    const timer = setInterval(refresh, 30_000);
    return () => { active = false; clearInterval(timer); };
  }, [token]));

  return <Link href="/notifications" asChild><Pressable accessibilityRole="button" accessibilityLabel={translate(locale, 'Voir toutes les notifications')} style={styles.button}>
    <SocialIcon name="notification" color={Colors.brand} size={23} />
    {unread > 0 && <View style={styles.badge}><ThemedText type="smallBold" style={styles.badgeText}>{unread > 9 ? '9+' : unread}</ThemedText></View>}
  </Pressable></Link>;
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 2, right: 0, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 3, backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 10, lineHeight: 14 },
});
