// utils/stringFormatters.ts

/**
 * Extracts 2-letter uppercase initials from a full name for user avatars.
 */
export function getAvatarInitials(fullName: string, fallback = "DH"): string {
  if (!fullName || !fullName.trim()) return fallback;
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Normalizes a numeric or string guest count into the standard "X pessoas" format.
 */
export function formatGuestCountLabel(rawGuestCount: string): string {
  const trimmed = rawGuestCount.trim();
  if (!trimmed) return "30 pessoas";
  return trimmed.toLowerCase().includes("pessoa") ? trimmed : `${trimmed} pessoas`;
}

/**
 * Case-insensitive check for whether a staff member is in the confirmed presence list.
 */
export function isStaffMemberInList(memberName: string, list?: string[]): boolean {
  if (!list || list.length === 0 || !memberName) return false;
  const normalizedTarget = memberName.trim().toLowerCase();
  return list.some((entry) => entry.trim().toLowerCase() === normalizedTarget);
}