import type { ReactNode } from "react";
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? spacing.sm : 0}
      >
        <Pressable
          style={[styles.backdrop, centered ? styles.backdropCentered : styles.backdropBottom]}
          onPress={onClose}
        >
          <Pressable
            style={[
              centered ? styles.sheetCentered : styles.sheetBottom,
              !centered && { paddingBottom: Math.max(insets.bottom, spacing.xl) },
              sheetStyle,
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              bounces={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={centered ? styles.centeredContent : undefined}
            >
              {!centered ? <View style={styles.handle} /> : null}
              {children}
            </ScrollView>
          </Pressable>
        </Pressable>
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
    padding: spacing.xxl,
  },
  sheetBottom: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: spacing.xl,
    maxHeight: "92%",
    ...shadow.sheet,
  },
  sheetCentered: {
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: "90%",
    ...shadow.sheet,
  },
  centeredContent: {
    alignItems: "stretch",
    gap: spacing.sm,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.lg,
  },
});
