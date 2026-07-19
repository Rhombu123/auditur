import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors, spacing } from "@/constants/theme";

type Props = {
  onIntroComplete?: () => void;
};

export function AppLoadingScreen({ onIntroComplete }: Props) {
  const logoReveal = useRef(new Animated.Value(0)).current;
  const copyReveal = useRef(new Animated.Value(0)).current;
  const scan = useRef(new Animated.Value(0)).current;
  const completionSent = useRef(false);

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(logoReveal, {
          toValue: 1,
          duration: 460,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(copyReveal, {
          toValue: 1,
          duration: 420,
          delay: 140,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(scan, {
        toValue: 1,
        duration: 560,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(80),
    ]);

    animation.start(({ finished }) => {
      if (finished && !completionSent.current) {
        completionSent.current = true;
        onIntroComplete?.();
      }
    });

    return () => {
      animation.stop();
    };
  }, [copyReveal, logoReveal, onIntroComplete, scan]);

  return (
    <View style={styles.screen}>
      <Animated.View
        style={[
          styles.halo,
          {
            opacity: logoReveal.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.7],
            }),
            transform: [
              {
                scale: logoReveal.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.7, 1],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.logoWrap,
          {
            transform: [
              {
                scale: logoReveal.interpolate({
                  inputRange: [0, 0.72, 1],
                  outputRange: [0.82, 1.035, 1],
                }),
              },
              {
                translateY: logoReveal.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Image
          source={require("../assets/icon.png")}
          style={styles.logo}
          accessibilityLabel="Auditur"
        />
        <Animated.View
          style={[
            styles.scanLine,
            {
              opacity: scan.interpolate({
                inputRange: [0, 0.08, 0.82, 1],
                outputRange: [0, 1, 1, 0],
              }),
              transform: [
                {
                  translateY: scan.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-4, 94],
                  }),
                },
              ],
            },
          ]}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.copy,
          {
            opacity: copyReveal,
            transform: [
              {
                translateY: copyReveal.interpolate({
                  inputRange: [0, 1],
                  outputRange: [8, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.name}>Auditur</Text>
        <Text style={styles.status}>Scan. Verify. Done.</Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.readyDot,
          {
            opacity: scan.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1],
            }),
            transform: [
              {
                scale: scan.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.4, 1],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  halo: {
    position: "absolute",
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: colors.primaryLight,
  },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 27,
    overflow: "hidden",
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 7,
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  scanLine: {
    position: "absolute",
    top: 0,
    left: 9,
    right: 9,
    height: 2,
    borderRadius: 999,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
  copy: {
    alignItems: "center",
    marginTop: spacing.xl,
  },
  name: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  status: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  readyDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
  },
});
