export function formatStatusLabel(value: string) {
  return value.toLowerCase().split('_').filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
