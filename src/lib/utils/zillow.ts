/**
 * Build a Zillow property URL from address parts.
 * Returns null if insufficient data (need at least street + city + state).
 */
export function buildZillowUrl(parts: {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): string | null {
  const { street, city, state, zip } = parts;

  if (!street || !city || !state) return null;

  const normalize = (s: string) =>
    s
      .replace(/[.,#']/g, '')
      .replace(/\s+/g, '-')
      .trim();

  const segments = [normalize(street), normalize(city), normalize(state)];
  if (zip) segments.push(normalize(zip));

  return `https://www.zillow.com/homes/${segments.join('-')}_rb/`;
}
