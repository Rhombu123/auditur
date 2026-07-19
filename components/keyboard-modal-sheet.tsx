import type { ReactNode } from "react";
import { MotiView } from "moti";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, shadow, spacing } from "@/constants/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Centered card (e.g. scan result). Default is bottom sheet. */
  centered?: boolean;
  sheetStyle?: StyleProp<ViewStyle>;
};

export function KeyboardModalSheet({
  visible,
  onClose,
  children,
  centered = false,
  sheetStyle,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View
          style={[
            styles.backdrop,
            centered ? styles.backdropCentered : styles.backdropBottom,
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityLabel="Close popup"
          />
          <MotiView
            from={{ opacity: 0, scale: 0.97, translateY: 10 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{
              type: "timing",
              duration: 220,
              delay: 90,
            }}
            style={[
              centered ? styles.sheetCentered : styles.sheetBottom,
              !centered && { paddingBottom: Math.max(insets.bottom, spacing.xl) },
              sheetStyle,
            ]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              automaticallyAdjustKeyboardInsets={false}
              bounces={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.content,
                centered && styles.centeredContent,
              ]}
            >
              {!centered ? <View style={styles.handle} /> : null}
              {children}
            </ScrollView>
          </MotiView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  backdropBottom: {
    justifyContent: "flex-end",
  },
  backdropCentered: {
    justifyContent: "center",
    padding: spacing.lg,
  },
  sheetBottom: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing.xxl,
    maxHeight: "94%",
    minHeight: 220,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    ...shadow.sheet,
  },
  sheetCentered: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.sheet,
    paddingHorizontal: spacing.xxl,
    maxHeight: "92%",
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    ...shadow.sheet,
  },
  content: {
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  centeredContent: {
    alignItems: "stretch",
    gap: spacing.md,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.xl,
  },
});
