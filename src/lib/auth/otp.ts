/**
 * Code de connexion reçu par e-mail (Supabase Auth, « Email OTP ») : 6 chiffres par défaut,
 * jusqu'à 10 si le projet est réglé ainsi. On tolère les espaces et tirets collés depuis l'e-mail.
 */
export function normalizeOtp(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, "");
  return /^\d{6,10}$/.test(digits) ? digits : null;
}
