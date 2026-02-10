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

/**
 * Fetch the og:image from a Zillow property page.
 * Used as fallback when RPR doesn't have a photo (e.g. sold/off-market properties).
 * Returns the image URL or null; never throws.
 */
export async function fetchZillowPropertyImage(parts: {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): Promise<string | null> {
  try {
    const url = buildZillowUrl(parts);
    if (!url) return null;

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(5000),
      redirect: "follow",
    });

    if (!res.ok) return null;

    const html = await res.text();
    const match = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
      || html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);

    return match?.[1] || null;
  } catch {
    return null;
  }
}
