export function getImageUrl(imagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/images/${imagePath}`;
}

const BUNNY_HOSTNAMES = new Set([
  "player.mediadelivery.net",
  "iframe.mediadelivery.net",
]);

export function isValidBunnyUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:") return false;
    if (u.username || u.password) return false;
    if (!BUNNY_HOSTNAMES.has(u.hostname)) return false;
    return /^\/(play|embed)\/\d+\/[a-zA-Z0-9-]+/.test(u.pathname);
  } catch {
    return false;
  }
}

export function getBunnyEmbedUrl(videoUrl: string): string {
  return videoUrl.includes("?")
    ? `${videoUrl}&autoplay=false`
    : `${videoUrl}?autoplay=false`;
}
