import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/context/auth-context';
import { Colors } from '@/constants/theme';

const navigationTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: Colors.brand, background: Colors.light.background, card: Colors.light.surface, text: Colors.light.text, border: Colors.light.border } };

export default function RootLayout() {
  return (
    <AuthProvider><ThemeProvider value={navigationTheme}>
      <Stack screenOptions={{ headerShadowVisible: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="activities/[id]" options={{ title: 'Activité', headerBackTitle: 'Activités', headerTransparent: false, headerStyle: { backgroundColor: Colors.light.background } }} />
        <Stack.Screen name="projects/[id]" options={{ title: 'Projet', headerBackTitle: 'Projets', headerTransparent: false, headerStyle: { backgroundColor: Colors.light.background } }} />
        <Stack.Screen name="groups/index" options={{ title: 'Groupes', headerBackTitle: 'Accueil' }} />
        <Stack.Screen name="groups/[id]" options={{ title: 'Groupe', headerBackTitle: 'Groupes' }} />
        <Stack.Screen name="messages/index" options={{ title: 'Messages', headerBackTitle: 'Accueil' }} />
        <Stack.Screen name="messages/new" options={{ title: 'Nouveau message', headerBackTitle: 'Groupe' }} />
        <Stack.Screen name="messages/[id]" options={{ title: 'Conversation', headerBackTitle: 'Messages' }} />
        <Stack.Screen name="privacy" options={{ title: 'Confidentialité et données', headerBackTitle: 'Retour' }} />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider></AuthProvider>
  );
}
