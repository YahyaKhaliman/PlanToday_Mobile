export const THEME = {
  primary: '#4F46E5',
  accent: '#06B6D4',
  ink: '#0F172A',
  muted: '#64748B',
  card: '#FFFFFF',
  soft: '#F1F5F9',
  line: 'rgba(15,23,42,0.08)',
  danger: '#EF4444',
  bgTop: '#F7F9FF',
  bgBottom: '#FFFFFF',
  wa: '#22C55E',
  ok: '#16A34A',
  warn: '#F59E0B',
  warningBg: '#FEF3C7',
  warningBorder: '#FCD34D',
  warningText: '#92400E',
  sub: '#4f46e5',
  success: '#16A34A',
  info: '#0369A1',
};

export const STATUS_COLORS: Record<string, string> = {
  WAIT: '#D97706',
  ACC: '#16A34A',
  TOLAK: '#DC2626',
};

export const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  softCard: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
};

export const COMPANY_STATUS_COLORS: Record<string, { base: string; text: string }> = {
  BELUM: { base: '#6B7280', text: '#374151' },      // Abu-abu / Gray
  MINTA: { base: '#DC2626', text: '#991B1B' },      // Merah / Red (Dimintakan harga)
  WAIT: { base: '#16A34A', text: '#15803D' },       // Hijau / Green (Menunggu acc)
  DONE: { base: '#18181B', text: '#09090B' },       // Hitam / Black (Selesai diproses)
  CANCEL: { base: '#2563EB', text: '#1D4ED8' },     // Biru / Blue (Dibatalkan)
  SELESAI: { base: '#18181B', text: '#09090B' },    // Hitam / Black
  DEFAULT: { base: '#6366F1', text: '#4F46E5' },    // Indigo
};

