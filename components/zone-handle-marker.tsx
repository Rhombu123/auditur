import { StyleSheet, View } from "react-native";

import { palette } from "@/constants/theme";

type Props = {
  isBend?: boolean;
  isRotation?: boolean;
  isLocked?: boolean;
};

export function ZoneHandleMarker({ isBend, isRotation, isLocked }: Props) {
  return (
    <View
      style={[
        styles.handle,
        isBend ? styles.handleBend : styles.handleCorner,
        isRotation && styles.handleRotation,
        isLocked && styles.handleLocked,
      ]}
    >
      <View
        style={[
          styles.inner,
          isBend ? styles.innerBend : styles.innerCorner,
          isRotation && styles.innerRotation,
          isLocked && styles.innerLocked,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  handle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
  },
  handleCorner: {
    borderColor: palette.white,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  handleBend: {
    borderColor: palette.amber500,
    backgroundColor: "rgba(245,158,11,0.45)",
  },
  inner: {
    width: 13,
    height: 13,
    borderRadius: 7,
  },
  innerCorner: { backgroundColor: palette.white },
  innerBend: { backgroundColor: palette.amber500 },
  handleRotation: {
    borderColor: palette.amber500,
    backgroundColor: "rgba(245,158,11,0.35)",
  },
  innerRotation: { backgroundColor: palette.amber500 },
  handleLocked: {
    borderColor: palette.slate400,
    backgroundColor: "rgba(148,163,184,0.4)",
  },
  innerLocked: { backgroundColor: palette.slate400 },
});
