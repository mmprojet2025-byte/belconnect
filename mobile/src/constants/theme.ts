/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#17251F',
    background: '#FFFFFF',
    backgroundElement: '#F4F7F5',
    backgroundSelected: '#DCEDE2',
    textSecondary: '#66766C',
    surface: '#FFFFFF',
    border: '#E5ECE7',
    accent: '#176B52',
  },
  dark: {
    text: '#F4F7F3',
    background: '#111A16',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#AAB8AE',
    surface: '#1D2A22',
    border: '#34443A',
    accent: '#89D9AF',
  },
  brand: '#176B52',
  brandSoft: '#E3F2E9',
  accent: '#E97769',
  onBrand: '#FFFFFF',
  border: '#E2EAE3',
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
