/** Authentication is required by default; explicitly disable it only for isolated local demos. */
export const AUTH_ENABLED = process.env.EXPO_PUBLIC_AUTH_ENABLED !== "false";
