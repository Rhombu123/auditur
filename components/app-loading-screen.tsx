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

export function AppLoadingScreen() {
  const pulse = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    const progressAnimation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    pulseAnimation.start();
    progressAnimation.start();
    return () => {
      pulseAnimation.stop();
      progressAnimation.stop();
    };
  }, [progress, pulse]);

  return (
    <View style={styles.screen}>
      <Animated.View
        style={[
          styles.logoWrap,
          {
            opacity: pulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.82, 1],
            }),
            transform: [
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1.03],
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
      </Animated.View>
      <Text style={styles.name}>Auditur</Text>
      <Text style={styles.status}>Preparing your lot</Text>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.bar,
            {
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-64, 112],
                  }),
                },
              ],
            },
          ]}
        />
      </View>
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
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  name: {
    marginTop: spacing.lg,
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
  track: {
    width: 112,
    height: 3,
    marginTop: spacing.lg,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  bar: {
    width: 64,
    height: 3,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
});
