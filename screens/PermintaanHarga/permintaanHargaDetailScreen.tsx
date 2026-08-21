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
} from '../../services/permintaanHargaApi';
import { PENAWARAN_THEME } from '../Penawaran/penawaranTheme';
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

  const rawParts = raw
    .split(/[;\n\r]+/)
    .map(p => p.trim())
    .filter(Boolean);

  let ppnStatus: 'EXCLUDE' | 'INCLUDE' | null = null;
  const items: string[] = [];

  for (const part of rawParts) {
    const upper = part.toUpperCase().replace(/\s+/g, '');
    if (
      upper === 'EXCPPN' ||
      upper === 'EXCLUDEPPN' ||
      upper === 'NONPPN' ||
      upper === 'EXCLUDE'
    ) {
      ppnStatus = 'EXCLUDE';
    } else if (
      upper === 'INCPPN' ||
      upper === 'INCLUDEPPN' ||
      upper === 'INCLUDE'
    ) {
      ppnStatus = 'INCLUDE';
    } else {
      let formatted = part
        .replace(/\bSTIAP\b/gi, 'Setiap')
        .replace(/\bSTP\b/gi, 'Setiap')
        .replace(/\bTDK\b/gi, 'Tidak')
        .replace(/\bDG\b/gi, 'Dengan')
        .replace(/\bDGN\b/gi, 'Dengan')
        .replace(/\bBLM\b/gi, 'Belum')
        .replace(/\bSDH\b/gi, 'Sudah')
        .replace(/\bHARGA\s*\+?\s*(\d+)/gi, (_, num) => {
          const formattedNum = new Intl.NumberFormat('id-ID').format(
            Number(num),
          );
          return `Harga +Rp ${formattedNum}`;
        })
        .replace(/\+\s*(\d{3,})/g, (_, num) => {
          const formattedNum = new Intl.NumberFormat('id-ID').format(
            Number(num),
          );
          return `+Rp ${formattedNum}`;
        });

      items.push(formatted);
    }
  }

  return { ppnStatus, items };
};

const HasilKalkulasiSection = ({
  status,
  harga,
  ket,
}: {
  status: string;
  harga: number;
  ket?: string;
}) => {
  if (String(status || '').toUpperCase() !== 'DONE') return null;
  const parsed = parseKetKalkulasi(ket);
  return (
    <>
      <Text style={[styles.sectionTitle, styles.sectionTitleGap]}>
        Hasil Kalkulasi
      </Text>
      <View style={styles.kalkulasiCard}>
        <View style={styles.kalkulasiHeader}>
          <View style={styles.kalkulasiHeaderLeft}>
            <Text style={styles.kalkulasiLabel}>Harga Kalkulasi</Text>
            <Text style={styles.kalkulasiPrice}>
              Rp {formatNumber(harga || 0)}
            </Text>
          </View>
          {parsed.ppnStatus && (
            <View
              style={[
                styles.ppnBadge,
                parsed.ppnStatus === 'INCLUDE'
                  ? styles.ppnBadgeInclude
                  : styles.ppnBadgeExclude,
              ]}
            >
              <MaterialIcons
                name={parsed.ppnStatus === 'INCLUDE' ? 'check-circle' : 'info'}
                size={14}
                color={parsed.ppnStatus === 'INCLUDE' ? '#15803D' : '#B45309'}
              />
              <Text
                style={[
                  styles.ppnBadgeText,
                  parsed.ppnStatus === 'INCLUDE'
                    ? styles.ppnBadgeTextInclude
                    : styles.ppnBadgeTextExclude,
                ]}
              >
                {parsed.ppnStatus === 'INCLUDE' ? 'Include PPN' : 'Exclude PPN'}
              </Text>
            </View>
          )}
        </View>

        {parsed.items.length > 0 && (
          <View style={styles.kalkulasiKetWrap}>
            <Text style={styles.kalkulasiKetLabel}>Keterangan:</Text>
            <View style={styles.kalkulasiItemList}>
              {parsed.items.map((itemText, idx) => (
                <View key={`ket-${idx}`} style={styles.kalkulasiItemRow}>
                  <Text style={styles.kalkulasiBullet}>•</Text>
                  <Text style={styles.kalkulasiItemText}>{itemText}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </>
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
  if (key === 'WAIT') return 'Sudah diproses, menunggu acc';
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

  // Paksa semua URL image dari origin uploader lama (8182) ke origin read (8182)
  // agar proses view selalu lewat host image read.
  const forcedReadUrl = trimmed.replace(
    /^http:\/\/103\.94\.238\.252:8182/i,
    baseOrigin,
  );

  // Jika backend masih kirim path lama /image/mintaharga di port API,
  // paksa ke host/path image publik agar konsisten.
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

const InfoRow = ({ label, value }: { label: string; value: any }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{String(value ?? '-')}</Text>
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
  const createdBy = useMemo(
    () => data?.user_create || data?.mh_user_create || data?.created_by || '-',
    [data],
  );
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
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={THEME.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Detail Permintaan Harga</Text>

          <View style={styles.card}>
            <View style={styles.headerTopRow}>
              <Text style={styles.nomorLabel}>Nomor</Text>
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
            <Text style={styles.nomor}>{nomor || '-'}</Text>
            <InfoRow
              label="Tanggal Permintaan"
              value={formatDateTimeLocal(data?.created_at_fmt)}
            />
            <InfoRow label="User Create" value={createdBy} />
            <InfoRow
              label="Keterangan Status Pengajuan"
              value={statusDescription}
            />

            <InfoRow label="Nama Pekerjaan" value={data?.mh_nama || '-'} />
            <InfoRow label="Customer" value={data?.mh_cus_nama || '-'} />
            <InfoRow
              label="Sales"
              value={data?.sales_nama || data?.mh_sal_kode || '-'}
            />
            <InfoRow
              label="Divisi Tujuan"
              value={resolveDivisiLabel(data?.mh_divisi)}
            />
            <InfoRow
              label="Terakhir Order"
              value={formatDate(data?.mh_dateorder)}
            />

            <Text style={[styles.sectionTitle, styles.sectionTitleGap]}>
              Spesifikasi
            </Text>
            <InfoRow label="Kain" value={data?.mh_kain || '-'} />
            <InfoRow label="Gramasi" value={data?.mh_gramasi || '-'} />
            <InfoRow label="Finishing" value={data?.mh_finishing || '-'} />
            <View style={[styles.row, styles.rowInlineWrap]}>
              <View style={styles.inlineField}>
                <Text style={styles.label}>Panjang</Text>
                <Text style={styles.value}>
                  {formatNumber(data?.mh_panjang || 0)}
                </Text>
              </View>
              <View style={styles.inlineField}>
                <Text style={styles.label}>Lebar</Text>
                <Text style={styles.value}>
                  {formatNumber(data?.mh_lebar || 0)}
                </Text>
              </View>
            </View>
            <InfoRow label="Ket. Ukuran" value={data?.mh_ukuran || '-'} />

            <InfoRow
              label="Jumlah Order"
              value={formatNumber(data?.mh_jmlorder || 0)}
            />
            <InfoRow label="Keterangan" value={data?.mh_ket} />

            <HasilKalkulasiSection
              status={data?.mh_status}
              harga={data?.mh_harga_kalkulasi}
              ket={data?.mh_ket_kalkulasi}
            />

            <Text style={[styles.imageSectionTitle, styles.sectionTitleGap]}>
              Gambar
            </Text>

            <Text style={styles.imageLabel}>Gambar 1</Text>
            {showImage1 && imageUrl1WithBuster ? (
              <View style={styles.imagePreviewFrame}>
                <Image
                  source={{ uri: imageUrl1WithBuster }}
                  style={[
                    styles.imagePreview,
                    { aspectRatio: image1AspectRatio },
                  ]}
                  onLoad={e => {
                    const width = e?.nativeEvent?.source?.width || 0;
                    const height = e?.nativeEvent?.source?.height || 0;
                    if (width > 0 && height > 0) {
                      setImage1AspectRatio(width / height);
                    }
                  }}
                  onError={() => setImage1Error(true)}
                  resizeMode="contain"
                />
              </View>
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderText}>
                  Belum ada gambar
                </Text>
              </View>
            )}

            {showImage2 && imageUrl2WithBuster ? (
              <>
                <Text style={[styles.imageLabel, styles.imageLabelSpacing]}>
                  Gambar 2
                </Text>
                <View style={styles.imagePreviewFrame}>
                  <Image
                    source={{ uri: imageUrl2WithBuster }}
                    style={[
                      styles.imagePreview,
                      { aspectRatio: image2AspectRatio },
                    ]}
                    onLoad={e => {
                      const width = e?.nativeEvent?.source?.width || 0;
                      const height = e?.nativeEvent?.source?.height || 0;
                      if (width > 0 && height > 0) {
                        setImage2AspectRatio(width / height);
                      }
                    }}
                    onError={() => setImage2Error(true)}
                    resizeMode="contain"
                  />
                </View>
              </>
            ) : null}
          </View>
        </ScrollView>
      )}

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
              activeOpacity={0.9}
            >
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteBtn, styles.editBtnHalf]}
              onPress={remove}
              activeOpacity={0.9}
            >
              <Text style={styles.editBtnText}>Hapus</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Modal konfirmasi hapus */}
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
  content: { padding: 16, paddingBottom: 120 },
  title: {
    color: THEME.ink,
    fontWeight: '800',
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 10,
  },
  nomorLabel: {
    color: THEME.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  nomor: {
    color: THEME.primary,
    fontWeight: '700',
    marginTop: 4,
    fontSize: 18,
  },
  editBtn: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnFull: {
    width: '100%',
  },
  editBtnHalf: {
    flex: 1,
  },
  deleteBtn: {
    backgroundColor: '#DC2626',
    borderColor: '#B91C1C',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnText: {
    color: THEME.bgBottom,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1,
  },
  bottomAction: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: THEME.card,
    borderTopWidth: 1,
    borderTopColor: THEME.line,
  },
  bottomActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.line,
    padding: 14,
    marginBottom: 12,
  },
  row: {
    marginTop: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.line,
  },
  rowInlineWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  inlineField: {
    flex: 1,
  },
  label: {
    color: THEME.muted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  value: {
    color: THEME.ink,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
    lineHeight: 21,
  },
  sectionTitle: {
    color: THEME.ink,
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 8,
  },
  sectionTitleGap: {
    marginTop: 14,
  },
  kalkulasiCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginTop: 4,
    marginBottom: 4,
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
    fontSize: 12,
    fontWeight: '700',
    color: THEME.muted,
    marginBottom: 2,
  },
  kalkulasiPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  ppnBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  ppnBadgeExclude: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  ppnBadgeInclude: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  ppnBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  ppnBadgeTextExclude: {
    color: '#92400E',
  },
  ppnBadgeTextInclude: {
    color: '#166534',
  },
  kalkulasiKetWrap: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  kalkulasiKetLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.muted,
    marginBottom: 6,
  },
  kalkulasiItemList: {
    gap: 4,
  },
  kalkulasiItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  kalkulasiBullet: {
    fontSize: 14,
    color: THEME.primary,
    lineHeight: 18,
    fontWeight: '900',
  },
  kalkulasiItemText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.ink,
    lineHeight: 18,
  },
  imageSectionTitle: {
    color: THEME.ink,
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 8,
  },
  imageLabel: {
    color: THEME.muted,
    fontSize: 12,
    marginBottom: 6,
  },
  imageLabelSpacing: {
    marginTop: 12,
  },
  imagePreviewFrame: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  imagePreview: {
    width: '100%',
    minHeight: 180,
    maxWidth: '100%',
    alignSelf: 'stretch',
  },
  imagePlaceholder: {
    height: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    color: THEME.muted,
    fontWeight: '600',
  },
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
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.line,
  },
  modalIndicator: {
    width: 44,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: THEME.ink,
    marginBottom: 10,
  },
  modalBody: {
    fontSize: 13,
    color: THEME.muted,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#EEF2F7',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.line,
  },
  modalBtnCancelText: {
    color: THEME.muted,
    fontWeight: '900',
    fontSize: 13,
  },
  modalBtnDelete: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnDisabled: {
    opacity: 0.6,
  },
  modalBtnDeleteText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 13,
  },
});
