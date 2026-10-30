import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { AuthProvider } from '@/context/auth-context';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <AuthProvider><ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShadowVisible: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="activities/[id]" options={{ title: 'Activité', headerBackTitle: 'Activités' }} />
        <Stack.Screen name="groups/index" options={{ title: 'Groupes', headerBackTitle: 'Accueil' }} />
        <Stack.Screen name="groups/[id]" options={{ title: 'Groupe', headerBackTitle: 'Groupes' }} />
        <Stack.Screen name="messages/index" options={{ title: 'Messages', headerBackTitle: 'Accueil' }} />
        <Stack.Screen name="messages/new" options={{ title: 'Nouveau message', headerBackTitle: 'Groupe' }} />
        <Stack.Screen name="messages/[id]" options={{ title: 'Conversation', headerBackTitle: 'Messages' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider></AuthProvider>
  );
}
