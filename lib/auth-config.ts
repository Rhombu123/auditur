/** Set EXPO_PUBLIC_AUTH_ENABLED=true in .env to require email sign-in again. */
export const AUTH_ENABLED = process.env.EXPO_PUBLIC_AUTH_ENABLED === "true";
