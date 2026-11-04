import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

const INTRO_DURATION = 650;
const HOLD_DURATION = 650;
const EXIT_DURATION = 350;

export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);
  const started = useRef(false);
  const [overlayOpacity] = useState(() => new Animated.Value(1));
  const [markScale] = useState(() => new Animated.Value(0.92));
  const [wordmarkOpacity] = useState(() => new Animated.Value(0));
  const [wordmarkOffset] = useState(() => new Animated.Value(6));

  const start = useCallback(() => {
    if (started.current) return;
    started.current = true;

    void AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduceMotion) => {
      void SplashScreen.hideAsync().finally(() => {
        if (reduceMotion) {
          setVisible(false);
          return;
        }

        Animated.sequence([
          Animated.parallel([
            Animated.timing(markScale, {
              toValue: 1,
              duration: INTRO_DURATION,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(wordmarkOpacity, {
              toValue: 1,
              duration: INTRO_DURATION - 100,
              delay: 100,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(wordmarkOffset, {
              toValue: 0,
              duration: INTRO_DURATION,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
          Animated.delay(HOLD_DURATION),
          Animated.timing(overlayOpacity, {
            toValue: 0,
            duration: EXIT_DURATION,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start(() => setVisible(false));
      });
    });
  }, [markScale, overlayOpacity, wordmarkOffset, wordmarkOpacity]);

  if (!visible) return null;

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={start}
      pointerEvents="none"
      style={[styles.splashOverlay, { opacity: overlayOpacity }]}>
      <View style={styles.lockup}>
        <Animated.View style={[styles.mark, { transform: [{ scale: markScale }] }]}>
          <Text style={styles.markLetter}>b</Text>
          <View style={styles.dot} />
        </Animated.View>
        <Animated.Text
          style={[
            styles.wordmark,
            { opacity: wordmarkOpacity, transform: [{ translateY: wordmarkOffset }] },
          ]}>
          BelConnect
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <Text style={styles.iconLetter}>b</Text>
      <View style={styles.iconDot} />
    </View>
  );
}

const styles = StyleSheet.create({
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    backgroundColor: Colors.brand,
    justifyContent: 'center',
    zIndex: 1000,
  },
  lockup: { alignItems: 'center', gap: 16 },
  mark: { alignItems: 'center', height: 96, justifyContent: 'center', width: 96 },
  markLetter: { color: '#FFFFFF', fontSize: 92, fontWeight: '800', letterSpacing: -7, lineHeight: 98 },
  dot: { backgroundColor: Colors.orange, borderRadius: 8, bottom: 18, height: 14, position: 'absolute', right: 4, width: 14 },
  wordmark: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', letterSpacing: -0.7 },
  iconContainer: { alignItems: 'center', backgroundColor: Colors.brand, borderRadius: 28, height: 96, justifyContent: 'center', width: 96 },
  iconLetter: { color: '#FFFFFF', fontSize: 72, fontWeight: '800', letterSpacing: -5, lineHeight: 78 },
  iconDot: { backgroundColor: Colors.orange, borderRadius: 6, bottom: 16, height: 11, position: 'absolute', right: 7, width: 11 },
});
