export function normalizeEmail(input: string): string {
  const email = input.trim().toLowerCase();
  if (!email.includes("@") || !email.includes(".")) {
    throw new Error("Enter a valid email address.");
  }
  return email;
}

export function formatAuthError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  const lower = message.toLowerCase();

  if (
    lower.includes("over_email_send_rate_limit") ||
    lower.includes("email rate limit exceeded")
  ) {
    return "Email rate limit reached. Wait a few minutes or check Supabase rate limits.";
  }

  const waitMatch = message.match(/after (\d+) seconds?/i);
  if (waitMatch) {
    return `Wait ${waitMatch[1]} seconds before requesting another code.`;
  }

  if (lower.includes("user not found") || lower.includes("signups not allowed")) {
    return "No account found for this email. Create one on the sign-up page.";
  }

  if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
    return "Could not reach Supabase. Check your internet connection and confirm NEXT_PUBLIC_SUPABASE_URL is set for the website build.";
  }

  return message || fallback;
}
