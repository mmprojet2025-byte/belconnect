import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/context/auth-context';
import { LocaleProvider, useLocale } from '@/context/locale-context';
import { translate } from '@/lib/translations';
import { Colors } from '@/constants/theme';

const navigationTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: Colors.brand, background: Colors.light.background, card: Colors.light.surface, text: Colors.light.text, border: Colors.light.border } };

export default function RootLayout() { return <LocaleProvider><AppStack /></LocaleProvider>; }

function AppStack() {
  const { locale } = useLocale();
  const label = (text: string) => translate(locale, text);
  return (
    <AuthProvider><ThemeProvider value={navigationTheme}>
      <Stack screenOptions={{ headerShadowVisible: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="activities/[id]" options={{ title: label('Activité'), headerBackTitle: label('Activités'), headerTransparent: false, headerStyle: { backgroundColor: Colors.light.background } }} />
        <Stack.Screen name="projects/[id]" options={{ title: label('Projet'), headerBackTitle: label('Projets'), headerTransparent: false, headerStyle: { backgroundColor: Colors.light.background } }} />
        <Stack.Screen name="groups/index" options={{ title: label('Groupes'), headerBackTitle: label('Accueil') }} />
        <Stack.Screen name="groups/[id]" options={{ title: label('Groupe'), headerBackTitle: label('Groupes') }} />
        <Stack.Screen name="messages/index" options={{ title: label('Messages'), headerBackTitle: label('Accueil') }} />
        <Stack.Screen name="messages/new" options={{ title: label('Nouveau message'), headerBackTitle: label('Groupe') }} />
        <Stack.Screen name="messages/[id]" options={{ title: label('Conversation'), headerBackTitle: label('Messages') }} />
        <Stack.Screen name="privacy" options={{ title: label('Confidentialité et données'), headerBackTitle: label('Retour') }} />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider></AuthProvider>
  );
}
