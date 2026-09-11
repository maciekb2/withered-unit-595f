export const CONTACT_LIMITS = { name: 120, email: 254, message: 4000 } as const;
export type ContactFields = { name: string; email: string; message: string };
export function validateContact(fields: ContactFields): Partial<Record<keyof ContactFields, string>> {
  const errors: Partial<Record<keyof ContactFields, string>> = {};
  if (!fields.name.trim() || fields.name.length > CONTACT_LIMITS.name || /[\u0000-\u001f\u007f]/.test(fields.name)) errors.name = 'Podaj imię lub podpis (do 120 znaków).';
  if (fields.email.length > CONTACT_LIMITS.email || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(fields.email) || /[\u0000-\u001f\u007f]/.test(fields.email)) errors.email = 'Podaj poprawny adres e-mail.';
  if (!fields.message.trim() || fields.message.length > CONTACT_LIMITS.message || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(fields.message)) errors.message = 'Napisz wiadomość (do 4000 znaków).';
  return errors;
}
