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
    <View style={styles.kalkulasiCard}>
      <Text
        style={[styles.sectionTitle, { color: '#166534', marginBottom: 10 }]}
      >
        Hasil Kalkulasi
      </Text>

      <View style={styles.kalkulasiHeader}>
        <View style={styles.kalkulasiHeaderLeft}>
          <Text style={styles.kalkulasiLabel}>Harga Satuan Kalkulasi</Text>
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
          <Text style={styles.kalkulasiKetLabel}>Rincian Kalkulasi:</Text>
          <View style={styles.kalkulasiItemList}>
            {parsed.items.map((itemText, idx) => (
              <View key={`ket-${idx}`} style={styles.kalkulasiItemRow}>
                <Text style={styles.kalkulasiBullet}>-</Text>
                <Text style={styles.kalkulasiItemText}>{itemText}</Text>
              </View>
            ))}
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

      {/* Top Navigation Bar */}
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back-ios" size={18} color={THEME.ink} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>
          Detail Permintaan Harga
        </Text>
        <View style={{ width: 36 }} />
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
              <Text style={styles.metaText}>
                Dibuat oleh: <Text style={styles.metaValue}>{createdBy}</Text>
              </Text>
              <Text style={styles.metaText}>
                {formatDateTimeLocal(data?.created_at_fmt)}
              </Text>
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
                label="Jumlah Order"
                value={`${formatNumber(data?.mh_jmlorder || 0)} Pcs`}
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

            {data?.mh_ket ? (
              <View style={styles.keteranganBox}>
                <Text style={styles.keteranganLabel}>Keterangan:</Text>
                <Text style={styles.keteranganText}>{data.mh_ket}</Text>
              </View>
            ) : null}
          </View>

          {/* Card 4: Hasil Kalkulasi (Jika Selesai) */}
          <HasilKalkulasiSection
            status={data?.mh_status}
            harga={data?.mh_harga_kalkulasi}
            ket={data?.mh_ket_kalkulasi}
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...PENAWARAN_SHADOW.card,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.ink,
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
    color: '#0369a1',
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
    color: THEME.ink,
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
});
