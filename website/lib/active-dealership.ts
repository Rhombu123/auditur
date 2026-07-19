let activeDealershipId: string | null = null;

export function setApiDealershipId(dealershipId: string | null): void {
  activeDealershipId = dealershipId;
}

export function requireApiDealershipId(): string {
  if (!activeDealershipId) {
    throw new Error("Lot data is unavailable right now.");
  }
  return activeDealershipId;
}
