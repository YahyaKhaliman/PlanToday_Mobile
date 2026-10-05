/* eslint-disable react-native/no-inline-styles */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/authContext';
import {
  PUBLIC_IMAGE_BASE_PATH,
  PUBLIC_IMAGE_READ_ORIGIN,
} from '../../services/api';
import {
  deletePermintaanHarga,
  getPermintaanHargaDetail,
  KalkulasiDetailData,
} from '../../services/permintaanHargaApi';
import { PENAWARAN_THEME, PENAWARAN_SHADOW } from '../Penawaran/penawaranTheme';
import { COMPANY_STATUS_COLORS } from '../theme';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const THEME = PENAWARAN_THEME;

const DIVISI_OPTIONS = [
  { kode: '1', label: '1 - SPANDUK' },
  { kode: '4', label: '4 - GARMEN' },
  { kode: '5', label: '5 - MMT' },
];

const formatDate = (value?: string) => {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const formatDateTimeLocal = (value?: string) => {
  if (!value) return '-';
  try {
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return value;
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const formatNumber = (n: any) => {
  const num = Number(n);
  if (Number.isNaN(num)) return String(n ?? '-');
  return new Intl.NumberFormat('id-ID').format(num);
};

export type ParsedKetKalkulasi = {
  ppnStatus: 'EXCLUDE' | 'INCLUDE' | null;
  items: string[];
};

export const parseKetKalkulasi = (raw?: string): ParsedKetKalkulasi => {
  if (!raw) return { ppnStatus: null, items: [] };

  // Deteksi status PPN secara global dari string
  let ppnStatus: 'EXCLUDE' | 'INCLUDE' | null = null;
  const upperRaw = raw.toUpperCase();
  if (
    upperRaw.includes('EXC PPN') ||
    upperRaw.includes('EXCLUDE PPN') ||
    upperRaw.includes('EXCPPN') ||
    upperRaw.includes('NON PPN') ||
    upperRaw.includes('NONPPN')
  ) {
    ppnStatus = 'EXCLUDE';
  } else if (
    upperRaw.includes('INC PPN') ||
    upperRaw.includes('INCLUDE PPN') ||
    upperRaw.includes('INCPPN')
  ) {
    ppnStatus = 'INCLUDE';
  }

  const rawParts = raw
    .split(/[;\n\r]+/)
    .map(p => p.trim())
    .filter(Boolean);

  const items: string[] = [];

  for (const part of rawParts) {
    // Bersihkan penanda PPN agar tidak menjadi item terpisah
    let cleaned = part
      .replace(/\b(EXC|INC|EXCLUDE|INCLUDE|NON)\s*PPN\b/gi, '')
      .replace(/^\b(EXCLUDE|INCLUDE)\b$/gi, '')
      .trim();

    if (!cleaned) continue;

    // Rapikan tampilan tag alasan [ALASAN: ...]
    if (/^\[ALASAN:\s*(.+)\]$/i.test(cleaned)) {
      cleaned = cleaned.replace(/^\[ALASAN:\s*(.+)\]$/i, 'Alasan: $1');
    }

    let formatted = cleaned
      .replace(/\bSTIAP\b/gi, 'Setiap')
      .replace(/\bSTP\b/gi, 'Setiap')
      .replace(/\bTDK\b/gi, 'Tidak')
      .replace(/\bDG\b/gi, 'Dengan')
      .replace(/\bDGN\b/gi, 'Dengan')
      .replace(/\bBLM\b/gi, 'Belum')
      .replace(/\bSDH\b/gi, 'Sudah')
      .replace(/\bHARGA\s*\+?\s*(\d+)/gi, (_, num) => {
        const formattedNum = new Intl.NumberFormat('id-ID').format(Number(num));
        return `Harga +Rp ${formattedNum}`;
      })
      .replace(/\+\s*(\d{3,})/g, (_, num) => {
        const formattedNum = new Intl.NumberFormat('id-ID').format(Number(num));
        return `+Rp ${formattedNum}`;
      });

    items.push(formatted);
  }

  return { ppnStatus, items };
};

const HasilKalkulasiSection = ({
  status,
  hargaKalkulasi,
  hargaPengajuan,
  jmlOrder,
  ongkir,
  ket,
  nomorKalkulasi,
  dateKalkulasi,
  userKalkulasi,
  salesNama,
  userCreate,
  kalRpSales,
  kalRpSistem,
  kalPpn,
  kalkulasiDetail,
}: {
  status?: string;
  hargaKalkulasi?: number;
  hargaPengajuan?: number;
  jmlOrder?: number;
  ongkir?: number;
  ket?: string;
  nomorKalkulasi?: string;
  dateKalkulasi?: string;
  userKalkulasi?: string;
  salesNama?: string;
  userCreate?: string;
  kalRpSales?: number;
  kalRpSistem?: number;
  kalPpn?: number;
  kalkulasiDetail?: KalkulasiDetailData | null;
}) => {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const normStatus = String(status || '')
    .trim()
    .toUpperCase();
  const isDone = normStatus === 'DONE';
  const isNego = normStatus === 'NEGO';

  if (!isDone && !isNego) return null;

  const parsed = parseKetKalkulasi(ket);
  const cardBadgeCode = nomorKalkulasi || (isNego ? 'KALS' : 'KAL');
  const userText = isNego ? salesNama || userCreate : userKalkulasi;

  const rawSistemKal = Number(
    kalRpSistem !== undefined
      ? kalRpSistem
      : kalkulasiDetail?.hdr?.kal_rpsistem || 0,
  );
  const rawSalesKal = Number(
    kalRpSales !== undefined
      ? kalRpSales
      : kalkulasiDetail?.hdr?.kal_rpsales || 0,
  );
  const ppnVal = Number(
    kalPpn !== undefined ? kalPpn : kalkulasiDetail?.hdr?.kal_ppn || 0,
  );

  const calculatedFromSistem =
    rawSistemKal > 0
      ? ppnVal > 0
        ? Math.round(rawSistemKal * (1 + ppnVal / 100))
        : rawSistemKal
      : 0;

  const calculatedFromSales =
    rawSalesKal > 0
      ? ppnVal > 0
        ? Math.round(rawSalesKal * (1 + ppnVal / 100))
        : rawSalesKal
      : 0;

  const calcPrice =
    calculatedFromSistem > 0
      ? calculatedFromSistem
      : Number(hargaKalkulasi || 0);

  const reqPrice =
    Number(hargaPengajuan || 0) > 0
      ? Number(hargaPengajuan || 0)
      : calculatedFromSales > 0
      ? calculatedFromSales
      : 0;

  const qty = Number(jmlOrder || 0);

  const hasBothPrices = calcPrice > 0 && reqPrice > 0;
  const gap = reqPrice - calcPrice;
  const persenGap = calcPrice > 0 ? (gap / calcPrice) * 100 : 0;
  const totalGap = gap * qty;

  const themeColors = isNego
    ? {
        cardBg: '#faf5ff',
        cardBorder: '#e9d5ff',
        titleColor: '#581c87',
        badgeBg: '#f3e8ff',
        badgeBorder: '#d8b4fe',
        badgeText: '#6b21a8',
        subBorderColor: '#e9d5ff',
        bulletColor: '#6b21a8',
        itemTextColor: '#4a044e',
      }
    : {
        cardBg: '#f0fdf4',
        cardBorder: '#bbf7d0',
        titleColor: '#166534',
        badgeBg: '#dcfce7',
        badgeBorder: '#86efac',
        badgeText: '#15803d',
        subBorderColor: '#bbf7d0',
        bulletColor: '#15803d',
        itemTextColor: '#14532d',
      };

  const hasKomponen = Boolean(
    kalkulasiDetail?.komponen && kalkulasiDetail.komponen.length > 0,
  );
  const dtl = kalkulasiDetail?.dtl;
  const hasDtl = Boolean(
    dtl &&
      (Number(dtl.kald_rpjahit || 0) > 0 ||
        Number(dtl.kald_rppotong || 0) > 0 ||
        Number(dtl.kald_rpfinishing || 0) > 0 ||
        Number(dtl.kald_rptenagacetak || 0) > 0 ||
        Number(dtl.kald_rpbiayaobat || 0) > 0 ||
        Number(dtl.kald_rpraglan || 0) > 0),
  );
  const cetak = kalkulasiDetail?.cetak;
  const sublim = kalkulasiDetail?.sublim;
  const dtf = kalkulasiDetail?.dtf;
  const bordir = kalkulasiDetail?.bordir;
  const polyflex = kalkulasiDetail?.polyflex;
  const hasVariasi = Boolean(
    Number(cetak?.kald_rpcetak || 0) > 0 ||
      Number(sublim?.kald_rpsublim || 0) > 0 ||
      Number(dtf?.kald_rpdtf || 0) > 0 ||
      Number(bordir?.kald_rpbordir || 0) > 0 ||
      Number(polyflex?.kald_rppolyflex || 0) > 0,
  );
  const hasAksesoris = Boolean(
    kalkulasiDetail?.aksesories && kalkulasiDetail.aksesories.length > 0,
  );
  const hdr = kalkulasiDetail?.hdr;
  const hasHdrDetails = Boolean(
    hdr &&
      (Number(hdr.kal_rpallowance || 0) > 0 ||
        Number(hdr.kal_rplaba || 0) > 0 ||
        Number(hdr.kal_allowance || 0) > 0 ||
        Number(hdr.kal_laba || 0) > 0 ||
        Boolean(hdr.kal_ketbeli)),
  );

  const hasAnyBreakdown =
    hasKomponen || hasDtl || hasVariasi || hasAksesoris || hasHdrDetails;

  return (
    <View
      style={[
        styles.kalkulasiCard,
        {
          backgroundColor: themeColors.cardBg,
          borderColor: themeColors.cardBorder,
          padding: 12,
        },
      ]}
    >
      {/* 1. Header: Icon + Title & Badges */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            flex: 1,
          }}
        >
          <MaterialIcons
            name={isNego ? 'handshake' : 'calculate'}
            size={18}
            color={themeColors.titleColor}
          />
          <Text
            style={[
              styles.sectionTitle,
              {
                color: themeColors.titleColor,
                marginBottom: 0,
                borderBottomWidth: 0,
                paddingBottom: 0,
                fontSize: 14,
              },
            ]}
          >
            Hasil Kalkulasi Harga
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {/* PPN Badge */}
          {parsed.ppnStatus && (
            <View
              style={[
                styles.ppnBadge,
                parsed.ppnStatus === 'INCLUDE'
                  ? styles.ppnBadgeInclude
                  : styles.ppnBadgeExclude,
                { paddingHorizontal: 6, paddingVertical: 2 },
              ]}
            >
              <Text
                style={[
                  styles.ppnBadgeText,
                  parsed.ppnStatus === 'INCLUDE'
                    ? styles.ppnBadgeTextInclude
                    : styles.ppnBadgeTextExclude,
                  { fontSize: 10 },
                ]}
              >
                {parsed.ppnStatus === 'INCLUDE' ? 'Inc PPN' : 'Exc PPN'}
              </Text>
            </View>
          )}

          {/* Tag Kode Badge */}
          <View
            style={[
              styles.ppnBadge,
              {
                backgroundColor: themeColors.badgeBg,
                borderColor: themeColors.badgeBorder,
                paddingHorizontal: 7,
                paddingVertical: 2,
              },
            ]}
          >
            <Text
              style={[
                styles.ppnBadgeText,
                {
                  color: themeColors.badgeText,
                  fontWeight: '900',
                  fontSize: 10.5,
                },
              ]}
            >
              {cardBadgeCode}
            </Text>
          </View>
        </View>
      </View>

      {/* 2. Compact Meta Row (Single Line: Left User, Right Date) */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <MaterialIcons
            name="person"
            size={13}
            color={THEME.muted}
            style={{ marginTop: 0.5 }}
          />
          <Text
            style={{
              fontSize: 11,
              color: '#1e293b',
              fontWeight: '700',
              textTransform: 'capitalize',
            }}
          >
            {userText}
          </Text>
        </View>

        {dateKalkulasi ? (
          <Text
            style={{
              fontSize: 11,
              color: '#64748b',
              fontWeight: '500',
              textAlign: 'right',
            }}
          >
            {formatDateTimeLocal(dateKalkulasi)}
          </Text>
        ) : null}
      </View>

      {/* 3. Compact Price Comparison Grid */}
      <View
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: isNego ? '#f5d0fe' : '#bbf7d0',
          padding: 10,
          gap: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* Kolom 1: Kalkulasi Standar */}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 10.5,
                fontWeight: '700',
                color: '#64748b',
                textTransform: 'uppercase',
                marginBottom: 2,
              }}
            >
              Kalkulasi Harga
            </Text>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '800',
                color: '#15803d',
              }}
            >
              Rp {formatNumber(calcPrice || 0)}
            </Text>
          </View>

          <View style={{ width: 1, height: 28, backgroundColor: '#e2e8f0' }} />

          {/* Kolom 2: Pengajuan Sales */}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 10.5,
                fontWeight: '700',
                color: '#64748b',
                textTransform: 'uppercase',
                marginBottom: 2,
              }}
            >
              Permintaan Harga
            </Text>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '800',
                color: isNego
                  ? '#6b21a8'
                  : reqPrice > calcPrice
                  ? '#0284c7'
                  : '#1e293b',
              }}
            >
              Rp {formatNumber(reqPrice || 0)}
            </Text>
          </View>
        </View>

        {/* Gap Pill Bar (Jika ada perbedaan harga) */}
        {hasBothPrices && Math.abs(gap) >= 1 ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f8fafc',
              borderWidth: 1,
              borderColor: '#e2e8f0',
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 5,
            }}
          >
            <Text
              style={{
                fontSize: 11.5,
                fontWeight: '800',
                color: '#334155',
              }}
            >
              Selisih: Rp {formatNumber(Math.abs(gap))} (
              {Math.abs(persenGap).toFixed(1)}%)
            </Text>

            {qty > 1 && (
              <Text
                style={{
                  fontSize: 10.5,
                  color: '#64748b',
                  fontWeight: '600',
                }}
              >
                Total: Rp {formatNumber(Math.abs(totalGap))}
              </Text>
            )}
          </View>
        ) : null}
      </View>

      {/* 4. Ongkir (Jika ada) */}
      {Number(ongkir) > 0 ? (
        <View
          style={{
            marginTop: 8,
            paddingTop: 6,
            borderTopWidth: 1,
            borderColor: themeColors.subBorderColor,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: '#475569',
              fontWeight: '600',
            }}
          >
            Biaya Pengiriman (Ongkir):
          </Text>
          <Text
            style={{
              fontSize: 11.5,
              fontWeight: '700',
              color: '#0284c7',
            }}
          >
            {`+Rp ${formatNumber(Number(ongkir))}`}
          </Text>
        </View>
      ) : null}

      {/* 5. Rincian Perhitungan Kalkulasi Lengkap (Collapsible Breakdown) */}
      {hasAnyBreakdown && (
        <View
          style={{
            marginTop: 10,
            borderTopWidth: 1,
            borderColor: themeColors.subBorderColor,
            paddingTop: 8,
          }}
        >
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: isNego ? '#f3e8ff' : '#dcfce7',
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 7,
            }}
            activeOpacity={0.75}
            onPress={() => setShowBreakdown(!showBreakdown)}
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <MaterialIcons
                name="receipt-long"
                size={16}
                color={themeColors.titleColor}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: themeColors.titleColor,
                }}
              >
                Rincian Kalkulasi Lengkap
              </Text>
            </View>
            <MaterialIcons
              name={showBreakdown ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              size={20}
              color={themeColors.titleColor}
            />
          </TouchableOpacity>

          {showBreakdown && (
            <View
              style={{
                marginTop: 8,
                backgroundColor: '#ffffff',
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                padding: 10,
                gap: 10,
              }}
            >
              {/* Komponen Bahan / Kain */}
              {hasKomponen && (
                <View>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: '#334155',
                      marginBottom: 6,
                      textTransform: 'uppercase',
                    }}
                  >
                    1. Komponen Bahan / Kain
                  </Text>
                  <View style={{ gap: 6 }}>
                    {kalkulasiDetail?.komponen?.map((k, idx) => (
                      <View
                        key={`komp-${idx}`}
                        style={{
                          backgroundColor: '#f8fafc',
                          borderRadius: 6,
                          padding: 8,
                          borderWidth: 1,
                          borderColor: '#f1f5f9',
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '800',
                              color: '#1e293b',
                            }}
                          >
                            {k.kk_komponen || 'BAHAN'}
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '800',
                              color: '#16a34a',
                            }}
                          >
                            Rp {formatNumber(k.kk_pcs || 0)} / pcs
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontSize: 11,
                            color: '#64748b',
                            marginTop: 2,
                          }}
                        >
                          {k.kk_jeniskain || '-'}
                          {k.kk_warna ? ` (${k.kk_warna})` : ''}
                        </Text>
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            marginTop: 4,
                            paddingTop: 4,
                            borderTopWidth: 0.5,
                            borderTopColor: '#e2e8f0',
                          }}
                        >
                          <Text style={{ fontSize: 10.5, color: '#94a3b8' }}>
                            Harga Kain: Rp {formatNumber(k.kk_harga || 0)}
                          </Text>
                          <Text style={{ fontSize: 10.5, color: '#94a3b8' }}>
                            Babaran: {k.kk_babaran || 0} pcs/kg
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Biaya Konveksi / Jahit */}
              {hasDtl && dtl && (
                <View>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: '#334155',
                      marginBottom: 6,
                      textTransform: 'uppercase',
                    }}
                  >
                    2. Biaya Jahit & Operasional
                  </Text>
                  <View
                    style={{
                      backgroundColor: '#f8fafc',
                      borderRadius: 6,
                      padding: 8,
                      borderWidth: 1,
                      borderColor: '#f1f5f9',
                      gap: 4,
                    }}
                  >
                    {Number(dtl.kald_rpjahit || 0) > 0 && (
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Text style={{ fontSize: 11, color: '#475569' }}>
                          Biaya Jahit{' '}
                          {dtl.kald_jahit ? `(${dtl.kald_jahit})` : ''}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '700',
                            color: '#1e293b',
                          }}
                        >
                          Rp {formatNumber(dtl.kald_rpjahit)}
                        </Text>
                      </View>
                    )}
                    {Number(dtl.kald_rppotong || 0) > 0 && (
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Text style={{ fontSize: 11, color: '#475569' }}>
                          Biaya Potong
                        </Text>
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '700',
                            color: '#1e293b',
                          }}
                        >
                          Rp {formatNumber(dtl.kald_rppotong)}
                        </Text>
                      </View>
                    )}
                    {Number(dtl.kald_rpfinishing || 0) > 0 && (
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Text style={{ fontSize: 11, color: '#475569' }}>
                          Biaya Finishing
                        </Text>
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '700',
                            color: '#1e293b',
                          }}
                        >
                          Rp {formatNumber(dtl.kald_rpfinishing)}
                        </Text>
                      </View>
                    )}
                    {Number(dtl.kald_rptenagacetak || 0) > 0 && (
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Text style={{ fontSize: 11, color: '#475569' }}>
                          Tenaga Cetak
                        </Text>
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '700',
                            color: '#1e293b',
                          }}
                        >
                          Rp {formatNumber(dtl.kald_rptenagacetak)}
                        </Text>
                      </View>
                    )}
                    {Number(dtl.kald_rpbiayaobat || 0) > 0 && (
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Text style={{ fontSize: 11, color: '#475569' }}>
                          Biaya Obat Sablon
                        </Text>
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '700',
                            color: '#1e293b',
                          }}
                        >
                          Rp {formatNumber(dtl.kald_rpbiayaobat)}
                        </Text>
                      </View>
                    )}
                    {Number(dtl.kald_rpraglan || 0) > 0 && (
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Text style={{ fontSize: 11, color: '#475569' }}>
                          Biaya Raglan
                        </Text>
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '700',
                            color: '#1e293b',
                          }}
                        >
                          Rp {formatNumber(dtl.kald_rpraglan)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Biaya Cetak / Sablon / Sublim / DTF / Bordir / Polyflex */}
              {hasVariasi && (
                <View>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: '#334155',
                      marginBottom: 6,
                      textTransform: 'uppercase',
                    }}
                  >
                    3. Biaya Cetak & Variasi
                  </Text>
                  <View
                    style={{
                      backgroundColor: '#f8fafc',
                      borderRadius: 6,
                      padding: 8,
                      borderWidth: 1,
                      borderColor: '#f1f5f9',
                      gap: 4,
                    }}
                  >
                    {Number(cetak?.kald_rpcetak || 0) > 0 && (
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Text style={{ fontSize: 11, color: '#475569' }}>
                          Sablon Manual
                        </Text>
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '700',
                            color: '#1e293b',
                          }}
                        >
                          Rp {formatNumber(cetak?.kald_rpcetak)}
                        </Text>
                      </View>
                    )}
                    {Number(dtf?.kald_rpdtf || 0) > 0 && (
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Text style={{ fontSize: 11, color: '#475569' }}>
                          Cetak DTF{' '}
                          {Number(dtf?.kald_cmdtf || 0) > 0
                            ? `(${dtf?.kald_cmdtf} cm²)`
                            : ''}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '700',
                            color: '#1e293b',
                          }}
                        >
                          Rp {formatNumber(dtf?.kald_rpdtf)}
                        </Text>
                      </View>
                    )}
                    {Number(bordir?.kald_rpbordir || 0) > 0 && (
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Text style={{ fontSize: 11, color: '#475569' }}>
                          Bordir Komputer{' '}
                          {Number(bordir?.kald_cmbordir || 0) > 0
                            ? `(${bordir?.kald_cmbordir} cm²)`
                            : ''}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '700',
                            color: '#1e293b',
                          }}
                        >
                          Rp {formatNumber(bordir?.kald_rpbordir)}
                        </Text>
                      </View>
                    )}
                    {Number(sublim?.kald_rpsublim || 0) > 0 && (
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Text style={{ fontSize: 11, color: '#475569' }}>
                          Sublimasi
                        </Text>
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '700',
                            color: '#1e293b',
                          }}
                        >
                          Rp {formatNumber(sublim?.kald_rpsublim)}
                        </Text>
                      </View>
                    )}
                    {Number(polyflex?.kald_rppolyflex || 0) > 0 && (
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Text style={{ fontSize: 11, color: '#475569' }}>
                          Polyflex
                        </Text>
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '700',
                            color: '#1e293b',
                          }}
                        >
                          Rp {formatNumber(polyflex?.kald_rppolyflex)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Aksesoris Tambahan */}
              {hasAksesoris && (
                <View>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: '#334155',
                      marginBottom: 6,
                      textTransform: 'uppercase',
                    }}
                  >
                    4. Aksesoris Tambahan
                  </Text>
                  <View
                    style={{
                      backgroundColor: '#f8fafc',
                      borderRadius: 6,
                      padding: 8,
                      borderWidth: 1,
                      borderColor: '#f1f5f9',
                      gap: 4,
                    }}
                  >
                    {kalkulasiDetail?.aksesories?.map((a, idx) => (
                      <View
                        key={`aks-${idx}`}
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Text style={{ fontSize: 11, color: '#475569' }}>
                          {a.ka_aksesories}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '700',
                            color: '#1e293b',
                          }}
                        >
                          Rp {formatNumber(a.ka_biaya || 0)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Allowance, Laba Margin & Parameter */}
              {hasHdrDetails && hdr && (
                <View>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: '#334155',
                      marginBottom: 6,
                      textTransform: 'uppercase',
                    }}
                  >
                    5. Allowance & Margin
                  </Text>
                  <View
                    style={{
                      backgroundColor: '#f8fafc',
                      borderRadius: 6,
                      padding: 8,
                      borderWidth: 1,
                      borderColor: '#f1f5f9',
                      gap: 4,
                    }}
                  >
                    {Number(hdr.kal_rencanaorder || 0) > 0 && (
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Text style={{ fontSize: 11, color: '#475569' }}>
                          Rencana Order
                        </Text>
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '700',
                            color: '#1e293b',
                          }}
                        >
                          {formatNumber(hdr.kal_rencanaorder)} pcs
                        </Text>
                      </View>
                    )}
                    {Number(hdr.kal_allowance || 0) > 0 && (
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Text style={{ fontSize: 11, color: '#475569' }}>
                          Allowance ({hdr.kal_allowance}%)
                        </Text>
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '700',
                            color: '#1e293b',
                          }}
                        >
                          +Rp {formatNumber(hdr.kal_rpallowance || 0)}
                        </Text>
                      </View>
                    )}
                    {Number(hdr.kal_laba || 0) > 0 && (
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Text style={{ fontSize: 11, color: '#475569' }}>
                          Margin Laba ({hdr.kal_laba}%)
                        </Text>
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '700',
                            color: '#15803d',
                          }}
                        >
                          +Rp {formatNumber(hdr.kal_rplaba || 0)}
                        </Text>
                      </View>
                    )}
                    {Number(hdr.kal_rpsistem || 0) > 0 && (
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          marginTop: 4,
                          paddingTop: 4,
                          borderTopWidth: 0.5,
                          borderTopColor: '#e2e8f0',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: '#334155',
                          }}
                        >
                          Kalkulasi Sistem (Exc PPN)
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '800',
                            color: '#15803d',
                          }}
                        >
                          Rp {formatNumber(hdr.kal_rpsistem)}
                        </Text>
                      </View>
                    )}
                    {Number(hdr.kal_rpsales || 0) > 0 && (
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          marginTop: 3,
                          paddingTop: Number(hdr.kal_rpsistem || 0) > 0 ? 0 : 4,
                          borderTopWidth:
                            Number(hdr.kal_rpsistem || 0) > 0 ? 0 : 0.5,
                          borderTopColor: '#e2e8f0',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: '#334155',
                          }}
                        >
                          Pengajuan Sales (Exc PPN)
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '800',
                            color: '#6b21a8',
                          }}
                        >
                          Rp {formatNumber(hdr.kal_rpsales)}
                        </Text>
                      </View>
                    )}
                    {hdr.kal_ketbeli ? (
                      <View style={{ marginTop: 4 }}>
                        <Text style={{ fontSize: 10.5, color: '#94a3b8' }}>
                          Spesifikasi Beli: {hdr.kal_ketbeli}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* 6. Rincian Keterangan Kalkulasi */}
      {parsed.items.length > 0 && (
        <View
          style={[
            styles.kalkulasiKetWrap,
            {
              borderTopColor: themeColors.subBorderColor,
              marginTop: 8,
              paddingTop: 6,
            },
          ]}
        >
          <Text
            style={[
              styles.kalkulasiKetLabel,
              { color: themeColors.titleColor, fontSize: 11, marginBottom: 4 },
            ]}
          >
            Keterangan:
          </Text>
          <View style={styles.kalkulasiItemList}>
            {parsed.items.map((itemText, idx) => {
              const isAlasan = itemText.startsWith('Alasan:');
              return (
                <View
                  key={`ket-${idx}`}
                  style={[
                    styles.kalkulasiItemRow,
                    isAlasan && {
                      backgroundColor: isNego ? '#faf5ff' : '#f0fdf4',
                      borderLeftWidth: 2.5,
                      borderLeftColor: isNego ? '#6b21a8' : '#16a34a',
                      paddingHorizontal: 6,
                      paddingVertical: 3,
                      borderRadius: 4,
                      marginBottom: 2,
                    },
                  ]}
                >
                  {!isAlasan && (
                    <Text
                      style={[
                        styles.kalkulasiBullet,
                        { color: themeColors.bulletColor, fontSize: 12 },
                      ]}
                    >
                      •
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.kalkulasiItemText,
                      {
                        color: isAlasan
                          ? isNego
                            ? '#581c87'
                            : '#166534'
                          : themeColors.itemTextColor,
                        fontSize: 11.5,
                        fontWeight: isAlasan ? '700' : '500',
                      },
                    ]}
                  >
                    {itemText}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
};

const statusBadgeStyle = (status: string) => {
  const key = String(status || '').toUpperCase();
  const colors = COMPANY_STATUS_COLORS[key] || COMPANY_STATUS_COLORS.DEFAULT;
  return {
    bg: `${colors.base}1A`,
    border: colors.base,
    text: colors.text,
    label: key || '-',
  };
};

const getStatusDescription = (status: string) => {
  const key = String(status || '').toUpperCase();
  if (key === 'BELUM') return 'Tidak muncul di kalkulasi harga';
  if (key === 'MINTA') return 'Sedang dimintakan harga ke Finance';
  if (key === 'CANCEL') return 'Dibatalkan';
  if (key === 'WAIT') return 'Sudah diproses, menunggu ACC';
  if (key === 'NEGO') return 'Permintaan harga dibawah standar kalkulasi';
  if (key === 'DONE') return 'Selesai';
  return '-';
};

const resolveDivisiLabel = (value: any) => {
  const kode = String(value ?? '').trim();
  if (!kode) return '-';
  const found = DIVISI_OPTIONS.find(item => item.kode === kode);
  return found?.label || kode;
};

const normalizeImageUrl = (value: string): string => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  const baseOrigin = String(PUBLIC_IMAGE_READ_ORIGIN || '').replace(/\/$/, '');
  const basePath = String(PUBLIC_IMAGE_BASE_PATH || '')
    .trim()
    .replace(/\/$/, '');

  const forcedReadUrl = trimmed.replace(
    /^http:\/\/103\.94\.238\.252:8182/i,
    baseOrigin,
  );

  return forcedReadUrl
    .replace(
      /^http:\/\/103\.94\.238\.252:3005\/image\/mintaharga/i,
      `${baseOrigin}${basePath}`,
    )
    .replace(
      /^http:\/\/103\.94\.238\.252:8182\/image\/mintaharga/i,
      `${baseOrigin}${basePath}`,
    );
};

const getSafeImageUrl = (value: any): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = normalizeImageUrl(value);
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
};

const pickImageUrl = (payload: any, index: 1 | 2): string | null => {
  if (!payload) return null;
  const candidates =
    index === 1
      ? [
          payload?.gambar_1_url,
          payload?.gambar1_url,
          payload?.img1,
          payload?.image1,
          payload?.mh_gambar1,
          payload?.gambar1,
          payload?.mh_img1,
          payload?.mh_image1,
        ]
      : [
          payload?.gambar_2_url,
          payload?.gambar2_url,
          payload?.img2,
          payload?.image2,
          payload?.mh_gambar2,
          payload?.gambar2,
          payload?.mh_img2,
          payload?.mh_image2,
        ];

  for (const candidate of candidates) {
    const safeUrl = getSafeImageUrl(candidate);
    if (safeUrl) return safeUrl;
  }

  return null;
};

const buildFallbackImageUrl = (nomor: string, index: 1 | 2): string | null => {
  const cleanedNomor = String(nomor || '').trim();
  if (!cleanedNomor) return null;

  const base = String(PUBLIC_IMAGE_READ_ORIGIN || '').replace(/\/$/, '');
  if (!base) return null;

  const imageBasePath = String(PUBLIC_IMAGE_BASE_PATH || '').replace(/\/$/, '');
  if (!imageBasePath) return null;

  const suffix = index === 1 ? '.jpg' : '-2.jpg';
  return `${base}${imageBasePath}/${encodeURIComponent(cleanedNomor)}${suffix}`;
};

// Compact Grid Cell Component focusing on clean typography
const CompactCell = ({
  label,
  value,
  flex = 1,
  highlight = false,
  fullWidth = false,
}: {
  label: string;
  value: any;
  flex?: number;
  highlight?: boolean;
  fullWidth?: boolean;
}) => (
  <View
    style={[
      styles.cellWrap,
      { flex: fullWidth ? 1 : flex },
      fullWidth && { width: '100%' },
    ]}
  >
    <Text style={styles.cellLabel}>{label}</Text>
    <Text
      style={[styles.cellValue, highlight && styles.cellValueHighlight]}
      numberOfLines={fullWidth ? 3 : 2}
    >
      {String(value ?? '-') || '-'}
    </Text>
  </View>
);

export default function PermintaanHargaDetailScreen({
  route,
  navigation,
}: any) {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const nomor = String(route?.params?.nomor || '');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  const [image1AspectRatio, setImage1AspectRatio] = useState(16 / 9);
  const [image2AspectRatio, setImage2AspectRatio] = useState(16 / 9);
  const [image1Error, setImage1Error] = useState(false);
  const [image2Error, setImage2Error] = useState(false);

  const imageUrl1 = data
    ? pickImageUrl(data, 1)
    : buildFallbackImageUrl(nomor, 1);
  const imageUrl2 = data
    ? pickImageUrl(data, 2)
    : buildFallbackImageUrl(nomor, 2);

  const cacheBuster = useMemo(() => {
    if (!data) return '';
    const rawDate = data?.date_modified || data?.date_create || '';
    return rawDate ? String(new Date(rawDate).getTime()) : String(Date.now());
  }, [data]);

  const imageUrl1WithBuster = useMemo(() => {
    if (!imageUrl1) return null;
    return `${imageUrl1}?t=${cacheBuster}`;
  }, [imageUrl1, cacheBuster]);

  const imageUrl2WithBuster = useMemo(() => {
    if (!imageUrl2) return null;
    return `${imageUrl2}?t=${cacheBuster}`;
  }, [imageUrl2, cacheBuster]);

  const showImage1 = Boolean(imageUrl1WithBuster) && !image1Error;
  const showImage2 = Boolean(imageUrl2WithBuster) && !image2Error;

  const createdBy = useMemo(() => data?.user_create || '-', [data]);
  const statusMeta = useMemo(
    () => statusBadgeStyle(String(data?.mh_status || '')),
    [data?.mh_status],
  );
  const statusDescription = useMemo(
    () => getStatusDescription(String(data?.mh_status || '')),
    [data?.mh_status],
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getPermintaanHargaDetail(nomor, token);
      setData(result);
      setImage1Error(false);
      setImage2Error(false);
      setImage1AspectRatio(16 / 9);
      setImage2AspectRatio(16 / 9);
    } catch (err: any) {
      Toast.show({
        type: 'glassError',
        text1: 'Error',
        text2: err?.response?.data?.message || 'Gagal mengambil detail',
      });
    } finally {
      setLoading(false);
    }
  }, [nomor, token]);

  const remove = useCallback(() => {
    setConfirmVisible(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deletePermintaanHarga(nomor, token);
      setConfirmVisible(false);
      Toast.show({
        type: 'glassSuccess',
        text1: 'Berhasil',
        text2: 'Permintaan harga berhasil dihapus',
      });
      navigation.navigate('PermintaanHargaList');
    } catch (err: any) {
      setConfirmVisible(false);
      Toast.show({
        type: 'glassError',
        text1: 'Error',
        text2: err?.response?.data?.message || 'Gagal menghapus data',
      });
    } finally {
      setDeleting(false);
    }
  }, [navigation, nomor, token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <LinearGradient
      colors={[THEME.bgTop, THEME.bgBottom]}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <StatusBar
        barStyle="dark-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Top Navigation Bar */}
      <View
        style={[styles.topNav, { paddingTop: Math.max(insets.top, 12) + 4 }]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name="arrow-back-ios-new"
            size={18}
            color={THEME.primary}
          />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.navTitle} numberOfLines={2}>
            Detail Permintaan Harga
          </Text>
        </View>
        <View style={styles.headerRightSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={THEME.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Card 1: Header Dokumen & Status */}
          <View style={styles.headerCard}>
            <View style={styles.headerCardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.docLabel}>NOMOR PERMINTAAN</Text>
                <Text style={styles.docNomor}>{nomor || '-'}</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: statusMeta.bg,
                    borderColor: statusMeta.border,
                  },
                ]}
              >
                <Text
                  style={[styles.statusBadgeText, { color: statusMeta.text }]}
                >
                  {statusMeta.label}
                </Text>
              </View>
            </View>

            {/* Status Description Box */}
            <View style={styles.statusDescBox}>
              <Text style={styles.statusDescText}>
                Status:{' '}
                <Text style={{ fontWeight: '800' }}>{statusDescription}</Text>
              </Text>
            </View>

            {/* Meta Timestamp & Creator */}
            <View style={styles.metaRow}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
              >
                <MaterialIcons
                  name="person"
                  size={13}
                  color={THEME.muted}
                  style={{ marginTop: 0.5 }}
                />
                <Text style={styles.metaValue}>{createdBy}</Text>
              </View>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
              >
                <Text style={styles.metaText}>
                  {formatDateTimeLocal(data?.created_at_fmt)}
                </Text>
              </View>
            </View>
          </View>

          {/* Card 2: Informasi Customer & Pekerjaan */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Customer & Pekerjaan</Text>

            <View style={styles.gridRow}>
              <CompactCell label="Customer" value={data?.mh_cus_nama} />
              <CompactCell
                label="Sales"
                value={data?.sales_nama || data?.mh_sal_kode}
              />
            </View>

            <View style={[styles.gridRow, { marginTop: 8 }]}>
              <CompactCell label="Nama Pekerjaan" value={data?.mh_nama} />
              <CompactCell
                label="Divisi Tujuan"
                value={resolveDivisiLabel(data?.mh_divisi)}
              />
            </View>

            <View style={[styles.gridRow, { marginTop: 8 }]}>
              <CompactCell
                label="Tanggal Order"
                value={formatDate(data?.mh_dateorder)}
                fullWidth
              />
            </View>
          </View>

          {/* Card 3: Spesifikasi Teknis & Dimensi */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Spesifikasi Fisik</Text>

            <View style={styles.gridRow}>
              <CompactCell label="Bahan / Kain" value={data?.mh_kain} />
              <CompactCell label="Gramasi" value={data?.mh_gramasi} />
            </View>

            <View style={[styles.gridRow, { marginTop: 8 }]}>
              <CompactCell
                label="Ukuran (p x l)"
                value={`${formatNumber(
                  data?.mh_panjang || 0,
                )} m x ${formatNumber(data?.mh_lebar || 0)} ${
                  data?.mh_divisi === '1' ? 'cm' : 'm'
                }`}
              />
              <CompactCell label="Ket. Ukuran" value={data?.mh_ukuran} />
            </View>

            <View style={[styles.gridRow, { marginTop: 8 }]}>
              <CompactCell
                label="Rencana Order (Pcs)"
                value={`${formatNumber(data?.mh_jmlorder || 0)}`}
                highlight
              />
              <CompactCell label="Finishing" value={data?.mh_finishing} />
            </View>

            {data?.mh_sublim || data?.mh_warna ? (
              <View style={[styles.gridRow, { marginTop: 8 }]}>
                <CompactCell label="Sublim" value={data?.mh_sublim} />
                <CompactCell
                  label="Warna"
                  value={
                    data?.mh_warna
                      ? data.mh_warna.charAt(0).toUpperCase() +
                        data.mh_warna.slice(1).toLowerCase()
                      : undefined
                  }
                />
              </View>
            ) : null}

            {String(data?.mh_divisi) === '4' && data?.mh_workshop ? (
              <View style={[styles.gridRow, { marginTop: 8 }]}>
                <CompactCell
                  label="Workshop"
                  value={
                    String(data.mh_workshop).toUpperCase() === 'P04'
                      ? 'PREMIUM (P04)'
                      : 'MEDIUM (P01)'
                  }
                  fullWidth
                />
              </View>
            ) : null}

            {Number(data?.mh_ongkir) > 0 ? (
              <View style={[styles.gridRow, { marginTop: 8 }]}>
                <CompactCell
                  label="Ongkos Kirim"
                  value={`Rp ${formatNumber(
                    Number(data?.mh_ongkir),
                  )} (Luar Pulau Jawa)`}
                  fullWidth
                />
              </View>
            ) : null}

            {data?.mh_ket ? (
              <View style={styles.keteranganBox}>
                <Text style={styles.keteranganLabel}>Keterangan:</Text>
                <Text style={styles.keteranganText}>{data.mh_ket}</Text>
              </View>
            ) : null}
          </View>

          {/* Card 4: Hasil Kalkulasi (Jika Selesai / Nego) */}
          <HasilKalkulasiSection
            status={data?.mh_status}
            hargaKalkulasi={data?.mh_harga_kalkulasi}
            hargaPengajuan={data?.mh_harga}
            jmlOrder={data?.mh_jmlorder}
            ongkir={data?.mh_ongkir}
            ket={data?.mh_ket_kalkulasi}
            nomorKalkulasi={data?.mh_nomor_kalkulasi}
            dateKalkulasi={data?.mh_date_kalkulasi}
            userKalkulasi={data?.user_kalkulasi || data?.mh_apv_usr}
            salesNama={data?.sales_nama}
            userCreate={data?.user_create}
            kalRpSales={
              data?.kal_rpsales !== undefined
                ? data.kal_rpsales
                : data?.kalkulasi_detail?.hdr?.kal_rpsales
            }
            kalRpSistem={
              data?.kal_rpsistem !== undefined
                ? data.kal_rpsistem
                : data?.kalkulasi_detail?.hdr?.kal_rpsistem
            }
            kalPpn={
              data?.kal_ppn !== undefined
                ? data.kal_ppn
                : data?.kalkulasi_detail?.hdr?.kal_ppn
            }
            kalkulasiDetail={data?.kalkulasi_detail}
          />

          {/* Card 5: Lampiran Gambar */}
          {showImage1 || showImage2 ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Lampiran Foto Produk</Text>

              <View style={styles.imagesGrid}>
                {showImage1 && imageUrl1WithBuster && (
                  <View style={styles.imageColumn}>
                    <Text style={styles.imageSublabel}>Foto Contoh 1</Text>
                    <TouchableOpacity
                      style={styles.imageCardBtn}
                      activeOpacity={0.85}
                      onPress={() => setPreviewModalUrl(imageUrl1WithBuster)}
                    >
                      <Image
                        source={{ uri: imageUrl1WithBuster }}
                        style={[
                          styles.imagePreview,
                          { aspectRatio: image1AspectRatio },
                        ]}
                        onLoad={e => {
                          const w = e?.nativeEvent?.source?.width || 0;
                          const h = e?.nativeEvent?.source?.height || 0;
                          if (w > 0 && h > 0) setImage1AspectRatio(w / h);
                        }}
                        onError={() => setImage1Error(true)}
                        resizeMode="cover"
                      />
                      <View style={styles.imageZoomBadge}>
                        <Text style={styles.imageZoomText}>Lihat Foto</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}

                {showImage2 && imageUrl2WithBuster && (
                  <View style={styles.imageColumn}>
                    <Text style={styles.imageSublabel}>Foto Contoh 2</Text>
                    <TouchableOpacity
                      style={styles.imageCardBtn}
                      activeOpacity={0.85}
                      onPress={() => setPreviewModalUrl(imageUrl2WithBuster)}
                    >
                      <Image
                        source={{ uri: imageUrl2WithBuster }}
                        style={[
                          styles.imagePreview,
                          { aspectRatio: image2AspectRatio },
                        ]}
                        onLoad={e => {
                          const w = e?.nativeEvent?.source?.width || 0;
                          const h = e?.nativeEvent?.source?.height || 0;
                          if (w > 0 && h > 0) setImage2AspectRatio(w / h);
                        }}
                        onError={() => setImage2Error(true)}
                        resizeMode="cover"
                      />
                      <View style={styles.imageZoomBadge}>
                        <Text style={styles.imageZoomText}>Lihat Foto</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={[styles.card, { paddingVertical: 14 }]}>
              <Text style={[styles.sectionTitle, { color: THEME.muted }]}>
                Lampiran Gambar
              </Text>
              <Text style={styles.noImageText}>
                Tidak ada foto lampiran yang diunggah.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Floating Action Buttons (Hanya saat status BELUM) */}
      {!loading && String(data?.mh_status || '').toUpperCase() === 'BELUM' ? (
        <View
          style={[
            styles.bottomAction,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <View style={styles.bottomActionRow}>
            <TouchableOpacity
              style={[styles.editBtn, styles.editBtnHalf]}
              onPress={() =>
                navigation.navigate('PermintaanHargaForm', {
                  mode: 'edit',
                  nomor,
                  initialData: data,
                })
              }
              activeOpacity={0.85}
            >
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteBtn, styles.editBtnHalf]}
              onPress={remove}
              activeOpacity={0.85}
            >
              <Text style={styles.editBtnText}>Hapus</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Modal View Image Fullscreen */}
      <Modal
        visible={Boolean(previewModalUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewModalUrl(null)}
      >
        <View style={styles.fullImageModalOverlay}>
          <TouchableOpacity
            style={styles.closeFullImageBtn}
            onPress={() => setPreviewModalUrl(null)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          {previewModalUrl && (
            <Image
              source={{ uri: previewModalUrl }}
              style={styles.fullModalImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Modal Konfirmasi Hapus */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIndicator} />
            <Text style={styles.modalTitle}>Konfirmasi Hapus</Text>
            <Text style={styles.modalBody}>
              Dokumen permintaan harga ini akan dihapus permanen.{`\n`}
              Lanjutkan?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setConfirmVisible(false)}
                disabled={deleting}
                activeOpacity={0.85}
              >
                <Text style={styles.modalBtnCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtnDelete,
                  deleting ? styles.modalBtnDisabled : null,
                ]}
                onPress={confirmDelete}
                disabled={deleting}
                activeOpacity={0.85}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalBtnDeleteText}>Hapus</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerTextWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightSpacer: {
    width: 38,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: THEME.soft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.line,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.ink,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 110,
  },

  // Header Card
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...PENAWARAN_SHADOW.card,
  },
  headerCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  docLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.muted,
    letterSpacing: 0.5,
  },
  docNomor: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.primary,
    marginTop: 2,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  statusDescBox: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 10,
  },
  statusDescText: {
    fontSize: 12.5,
    color: THEME.info,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 10,
    paddingTop: 10,
  },
  metaText: {
    fontSize: 12,
    color: THEME.muted,
  },
  metaValue: {
    fontWeight: '700',
    color: THEME.muted,
    fontSize: 12,
  },

  // General Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...PENAWARAN_SHADOW.card,
  },
  sectionTitle: {
    color: THEME.ink,
    fontWeight: '800',
    fontSize: 15,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 10,
  },

  // Grid Layout
  gridRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  cellWrap: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#edf2f7',
  },
  cellLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  cellValue: {
    color: '#1e293b',
    fontSize: 13.5,
    fontWeight: '700',
    lineHeight: 18,
  },
  cellValueHighlight: {
    color: THEME.primary,
    fontWeight: '900',
    fontSize: 14.5,
  },

  keteranganBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: THEME.primary,
    marginTop: 10,
  },
  keteranganLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  keteranganText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginTop: 2,
  },

  // Hasil Kalkulasi
  kalkulasiCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 14,
    marginBottom: 10,
    ...PENAWARAN_SHADOW.card,
  },
  kalkulasiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kalkulasiHeaderLeft: {
    flex: 1,
  },
  kalkulasiLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#166534',
    textTransform: 'uppercase',
  },
  kalkulasiPrice: {
    fontSize: 19,
    fontWeight: '900',
    color: '#15803d',
    marginTop: 2,
  },
  ppnBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  ppnBadgeExclude: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  ppnBadgeInclude: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  ppnBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  ppnBadgeTextExclude: {
    color: '#92400e',
  },
  ppnBadgeTextInclude: {
    color: '#166534',
  },
  kalkulasiKetWrap: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#dcfce7',
  },
  kalkulasiKetLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 6,
  },
  kalkulasiItemList: {
    gap: 3,
  },
  kalkulasiItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  kalkulasiBullet: {
    fontSize: 14,
    color: '#15803d',
    lineHeight: 18,
    fontWeight: '900',
  },
  kalkulasiItemText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#14532d',
    lineHeight: 18,
  },

  // Images
  imagesGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  imageColumn: {
    flex: 1,
  },
  imageSublabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.muted,
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  imageCardBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
    height: 130,
    justifyContent: 'center',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imageZoomBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  imageZoomText: {
    color: '#fff',
    fontSize: 10.5,
    fontWeight: '700',
  },
  noImageText: {
    fontSize: 12.5,
    color: '#94a3b8',
  },

  // Full Image Modal
  fullImageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeFullImageBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  fullModalImage: {
    width: '95%',
    height: '80%',
  },

  // Bottom Floating Actions
  bottomAction: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    ...PENAWARAN_SHADOW.card,
  },
  bottomActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  editBtn: {
    backgroundColor: THEME.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnHalf: {
    flex: 1,
  },
  editBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },

  // Confirmation Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.line,
  },
  modalIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: THEME.ink,
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 13,
    color: THEME.muted,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#EEF2F7',
    alignItems: 'center',
  },
  modalBtnCancelText: {
    color: THEME.muted,
    fontWeight: '800',
    fontSize: 13,
  },
  modalBtnDelete: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnDisabled: {
    opacity: 0.6,
  },
  modalBtnDeleteText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
  },
  backBtnText: {
    color: THEME.primary,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.2,
  },
});
