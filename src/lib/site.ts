/**
 * WHO THIS SITE IS. One place, so no page invents a detail.
 *
 * Everything below is carried over from jst-beat's `producers` table, which is
 * where tisco prodz's own contact details already live:
 *
 *   ('tscoprodz@gmail.com', 'tisco prodz', '0711405010', 'tiscoprodz')
 *
 * NOTHING HERE IS INVENTED. There is no bio, no location beyond what was
 * recorded, no tiktok/twitter/youtube — those were null in the source and stay
 * absent rather than being filled with something plausible. A real business's
 * contact page is the last place to guess.
 */

export const SITE_NAME = "TISCOPRODZ";

export const CONTACT = {
  email: "tscoprodz@gmail.com",
  /** Also the M-Pesa line, per jst-beat's note on the same row. */
  whatsapp: "0711405010",
  instagram: "tiscoprodz",
} as const;

/** 0711405010 -> +254711405010, the form wa.me needs. */
export function whatsappLink(message?: string): string {
  const intl = `254${CONTACT.whatsapp.replace(/^0/, "")}`;
  return message
    ? `https://wa.me/${intl}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${intl}`;
}

export const instagramLink = `https://instagram.com/${CONTACT.instagram}`;
export const mailtoLink = `mailto:${CONTACT.email}`;
