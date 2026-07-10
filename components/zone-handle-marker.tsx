import { StyleSheet, View } from "react-native";

import { palette } from "@/constants/theme";

type Props = {
  isBend?: boolean;
};

export function ZoneHandleMarker({ isBend }: Props) {
  return (
    <View style={[styles.handle, isBend ? styles.handleBend : styles.handleCorner]}>
      <View style={[styles.inner, isBend ? styles.innerBend : styles.innerCorner]} />
    </View>
  );
}

const styles = StyleSheet.create({
  handle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
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
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  innerCorner: { backgroundColor: palette.white },
  innerBend: { backgroundColor: palette.amber500 },
});
