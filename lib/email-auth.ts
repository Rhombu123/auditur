import { getErrorMessage } from "@/lib/errors";

export function normalizeEmail(input: string): string {
  const email = input.trim().toLowerCase();
  if (!email.includes("@") || !email.includes(".")) {
    throw new Error("Enter a valid email address.");
  }
  return email;
}

/** Turn Supabase Auth errors into clearer messages for the login screen. */
export function formatAuthError(error: unknown, fallback: string): string {
  const message = getErrorMessage(error, fallback);
  const lower = message.toLowerCase();

  if (
    lower.includes("over_email_send_rate_limit") ||
    lower.includes("email rate limit exceeded")
  ) {
    return "Supabase email limit reached (default is 2/hour). Raise it under Authentication → Rate Limits in the Supabase dashboard, or connect custom SMTP.";
  }

  const waitMatch = message.match(/after (\d+) seconds?/i);
  if (waitMatch) {
    return `Wait ${waitMatch[1]} seconds before requesting another code.`;
  }

  return message;
}
