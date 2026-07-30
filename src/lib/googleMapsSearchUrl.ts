/** Opens Google Maps (app on mobile when installed) for a free-text address or place query. */
export function googleMapsSearchUrl(query: string): string {
  const q = query.trim();
  if (!q) return "#";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
