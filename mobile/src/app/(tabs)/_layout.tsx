import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { SocialIcon } from '@/components/social-icon';
import { useLocale } from '@/context/locale-context';
import { translate } from '@/lib/translations';

export default function TabsLayout() {
  const theme = useTheme();
  const { locale } = useLocale();
  const label = (text: string) => translate(locale, text);
  return (
    <Tabs screenOptions={{
      headerShadowVisible: false,
      headerStyle: { backgroundColor: theme.background },
      headerTitleStyle: { color: theme.text, fontWeight: '700' },
      tabBarActiveTintColor: theme.accent,
      tabBarInactiveTintColor: theme.textSecondary,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      tabBarItemStyle: { paddingTop: 2 },
      tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.border, height: Platform.OS === 'ios' ? 84 : 66, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 24 : 10 },
    }}>
      <Tabs.Screen name="index" options={{ title: label('Accueil'), tabBarLabel: label('Accueil'), tabBarIcon: ({ color, size }) => <SocialIcon name="home" color={color} size={size} /> }} />
      <Tabs.Screen name="activities" options={{ title: label('Activités'), tabBarLabel: label('Activités'), tabBarIcon: ({ color, size }) => <SocialIcon name="activity" color={color} size={size} /> }} />
      <Tabs.Screen name="projects" options={{ title: label('Projets'), tabBarLabel: label('Projets'), tabBarIcon: ({ color, size }) => <SocialIcon name="project" color={color} size={size} /> }} />
      <Tabs.Screen name="notifications" options={{ title: label('Notifications'), tabBarLabel: label('Notifs'), tabBarIcon: ({ color, size }) => <SocialIcon name="notification" color={color} size={size} /> }} />
      <Tabs.Screen name="account" options={{ title: label('Mon espace'), tabBarLabel: label('Mon espace'), tabBarIcon: ({ color, size }) => <SocialIcon name="account" color={color} size={size} /> }} />
    </Tabs>
  );
}
