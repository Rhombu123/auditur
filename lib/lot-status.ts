import { colors } from "@/constants/theme";
import type { LotStatus } from "@/lib/types";

export function lotStatusLabel(status: LotStatus): string {
  switch (status) {
    case "active":
      return "On lot";
    case "sold":
      return "Sold";
    case "auctioned":
      return "Auctioned";
  }
}

export function lotStatusBadgeStyle(status: LotStatus) {
  switch (status) {
    case "active":
      return {
        backgroundColor: colors.successLight,
        color: colors.primaryDark,
        borderColor: colors.primaryBorder,
      };
    case "sold":
      return {
        backgroundColor: colors.dangerLight,
        color: colors.danger,
        borderColor: colors.dangerBorder,
      };
    case "auctioned":
      return {
        backgroundColor: colors.warningLight,
        color: colors.warning,
        borderColor: colors.warningBorder,
      };
  }
}

export function isOnLot(status: LotStatus): boolean {
  return status === "active";
}
