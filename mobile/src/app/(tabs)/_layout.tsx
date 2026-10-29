import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs screenOptions={{
      headerShadowVisible: false,
      headerStyle: { backgroundColor: theme.background },
      headerTitleStyle: { color: theme.text, fontWeight: '700' },
      tabBarActiveTintColor: Colors.brand,
      tabBarInactiveTintColor: theme.textSecondary,
      tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.border, height: Platform.OS === 'ios' ? 84 : 66, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 24 : 10 },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarLabel: 'Accueil' }} />
      <Tabs.Screen name="activities" options={{ title: 'Activités', tabBarLabel: 'Activités' }} />
      <Tabs.Screen name="notifications" options={{ title: 'Notifications', tabBarLabel: 'Notifications' }} />
      <Tabs.Screen name="account" options={{ title: 'Mon espace', tabBarLabel: 'Mon espace' }} />
    </Tabs>
  );
}
