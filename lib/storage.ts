export const MENU_IMAGES_BUCKET = "menu-images";

export function getStoragePathFromUrl(value?: unknown, bucket = MENU_IMAGES_BUCKET) {
  if (typeof value !== "string") return "";
  const input = value.trim();
  if (!input) return "";

  try {
    const url = new URL(input);
    const cleanPath = decodeURIComponent(url.pathname);
    const publicMarker = `/storage/v1/object/public/${bucket}/`;
    const signMarker = `/storage/v1/object/sign/${bucket}/`;

    if (cleanPath.includes(publicMarker)) return cleanPath.split(publicMarker)[1] || "";
    if (cleanPath.includes(signMarker)) return cleanPath.split(signMarker)[1] || "";
    return "";
  } catch {
    return input.replace(/^\/+/, "");
  }
}
