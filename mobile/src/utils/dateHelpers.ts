// src/utils/dateHelpers.ts

export function formatDateSection(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const photoDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (photoDay.getTime() === today.getTime()) return 'Today';
  if (photoDay.getTime() === yesterday.getTime()) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function groupPhotosByDate<T extends { dateTaken: string }>(
  photos: T[]
): { title: string; data: T[] }[] {
  const groups: Record<string, T[]> = {};
  for (const photo of photos) {
    const key = photo.dateTaken.split('T')[0]; // YYYY-MM-DD
    if (!groups[key]) groups[key] = [];
    groups[key].push(photo);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a)) // newest first
    .map(([dateStr, data]) => ({
      title: formatDateSection(dateStr + 'T00:00:00Z'),
      data,
    }));
}

export function parseRestoreHeader(header: string | undefined): {
  isRestoring: boolean;
  isRestored: boolean;
} {
  if (!header) return { isRestoring: false, isRestored: false };
  return {
    isRestoring: header.includes('ongoing-request="true"'),
    isRestored: header.includes('ongoing-request="false"'),
  };
}
