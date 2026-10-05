/* eslint-disable react-native/no-inline-styles */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  getMasterCustomer,
  PenawaranMasterOption,
} from '../../services/penawaranApi';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import LinearGradient from 'react-native-linear-gradient';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/authContext';
import {
  createPermintaanHarga,
  PermintaanHargaPayload,
  updatePermintaanHarga,
  calculateSpandukApi,
  calculateMmtApi,
  getKalkulasiMasterOptions,
  uploadPermintaanHargaImage,
  getJenisKainMintaHargaApi,
  getTambahanOptionsApi,
  getCetakOptionsApi,
  calculateGarmenApi,
  getCustomerSoHistoryApi,
  CustomerSoHistoryItem,
  getPraOrderListApi,
  getPraOrderDetailApi,
  PraOrderItem,
  PraOrderDetail,
} from '../../services/permintaanHargaApi';
import {
  launchCamera,
  launchImageLibrary,
  Asset,
} from 'react-native-image-picker';
import RNBlobUtil from 'react-native-blob-util';
import ImageResizer from 'react-native-image-resizer';
import { Image } from 'react-native';
import { usePressGuard } from '../../utils/usePressGuard';
import { PENAWARAN_SHADOW, PENAWARAN_THEME } from '../Penawaran/penawaranTheme';
import {
  hitungOngkirOtomatis,
  OngkirMasterItem,
  FALLBACK_ONGKIR_OPTIONS,
  detectAlokasiFromText,
} from '../../utils/ongkirEngine';

const THEME = PENAWARAN_THEME;

const DIVISI_OPTIONS = [
  { kode: '1', label: 'SPANDUK' },
  { kode: '5', label: 'MMT' },
  { kode: '4', label: 'GARMEN' },
];

const toYmd = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatDateOrderDisplay = (val: string) => {
  if (!val) return '';
  const s = String(val).trim().slice(0, 10);
  const parts = s.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY
  }
  return val;
};

const onlyDigits = (value: string) =>
  String(value || '').replace(/[^0-9]/g, '');

const sanitizeDecimalInput = (val: string) => {
  const normalized = String(val || '').replace(/,/g, '.');
  const filtered = normalized.replace(/[^0-9.]/g, '');
  const firstDot = filtered.indexOf('.');
  if (firstDot === -1) return filtered;
  return (
    filtered.slice(0, firstDot + 1) +
    filtered.slice(firstDot + 1).replace(/\./g, '')
  );
};

const formatNumberDisplay = (value: string | number) => {
  if (value === null || value === undefined || value === '') return '0';
  const num =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(/,/g, '.'));
  if (!Number.isFinite(num)) return '0';
  if (Number.isInteger(num)) {
    return new Intl.NumberFormat('id-ID').format(num);
  }
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
};

const formatThousandsId = (value: string | number) => {
  if (value === null || value === undefined || value === '') return '0';
  const rawStr = String(value).trim();
  const num = typeof value === 'number' ? value : Number(rawStr);
  if (!Number.isNaN(num) && !Number.isInteger(num)) {
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  }
  const cleaned = onlyDigits(rawStr);
  if (!cleaned) return '0';
  return new Intl.NumberFormat('id-ID').format(Number(cleaned));
};

const getGramasiByKain = (kainName: string): string => {
  const k = (kainName || '').toUpperCase();
  // 1. Ekstrak langsung rentang angka gramasi (misal: 140-150, 160-170/45, 250-260, 90-100, dll.)
  const rangeMatch = k.match(/(\d{2,3}\s*-\s*\d{2,3})/);
  if (rangeMatch) {
    return `${rangeMatch[1].replace(/\s+/g, '')} GR`;
  }
  // 2. Pemetaan jenis kain berdasarkan kode standar rajutan
  if (k.includes('30S') || k.includes('30 S')) return '140-150 GR';
  if (k.includes('24S') || k.includes('24 S')) return '175-185 GR';
  if (k.includes('20S') || k.includes('20 S')) return '190-200 GR';
  if (k.includes('LACOST') || k.includes('LACOSTE')) return '220-230 GR';
  if (k.includes('TC COM 28') || k.includes('TC 28')) return '150-160 GR';
  if (k.includes('DRYFIT') || k.includes('DRIFIT')) return '150-160 GR';
  if (k.includes('HYGIT') || k.includes('HYGET')) return '110-120 GR';
  if (k.includes('PE 20') || k.includes('PE 24')) return '170-180 GR';
  if (k.includes('PE 30')) return '130-140 GR';
  return '';
};

const getSablonUkuranDesc = (ketStr: string): string => {
  const upper = String(ketStr || '').toUpperCase();
  if (/\bA3\b/.test(upper)) {
    return '29.7 × 42 cm';
  }
  if (/\bA4\b/.test(upper)) {
    return '21 × 29.7 cm';
  }
  if (/\bA5\b/.test(upper)) {
    return '14.8 × 21 cm';
  }
  return '';
};

const toNumCurrency = (v: string | number) => {
  const raw = String(v ?? '');
  const onlyNum = onlyDigits(raw);
  if (!onlyNum) return 0;
  const n = Number(onlyNum);
  return Number.isFinite(n) ? n : 0;
};

const toNumDecimal = (v: string) => {
  const normalized = String(v || '')
    .replace(/,/g, '.')
    .replace(/[^0-9.]/g, '');
  if (!normalized) return 0;
  const firstDot = normalized.indexOf('.');
  const safe =
    firstDot === -1
      ? normalized
      : normalized.slice(0, firstDot + 1) +
        normalized.slice(firstDot + 1).replace(/\./g, '');
  const n = Number(safe);
  return Number.isFinite(n) ? n : 0;
};

const MAX_UPLOAD_BYTES = 1 * 1024 * 1024; // 1 MB
const COMPRESS_PRESETS = [
  { max: 1280, quality: 75 },
  { max: 1024, quality: 65 },
  { max: 1024, quality: 50 },
  { max: 800, quality: 50 },
];

type PhotoState = {
  uri: string;
  name: string;
  type: string;
  sizeBytes?: number;
};

const toFileUri = (uri: string) =>
  uri.startsWith('file://') ? uri : `file://${uri}`;
const stripFileScheme = (uri: string) => uri.replace('file://', '');

const safeFileName = (name: string | undefined, fallback: string) => {
  const n = (name || '').trim();
  if (!n) return fallback;
  return n.includes('.') ? n : `${n}.jpg`;
};

async function compressToUnderLimit(
  inputUri: string,
): Promise<{ uri: string; sizeBytes: number }> {
  const inputFileUri = toFileUri(inputUri);

  for (const preset of COMPRESS_PRESETS) {
    const resized = await ImageResizer.createResizedImage(
      inputFileUri,
      preset.max,
      preset.max,
      'JPEG',
      preset.quality,
      0,
    );

    const outUri = toFileUri(resized.uri);
    const stat = await RNBlobUtil.fs.stat(stripFileScheme(outUri));
    const sizeBytes = Number(stat.size || 0);

    if (sizeBytes > 0 && sizeBytes <= MAX_UPLOAD_BYTES) {
      return { uri: outUri, sizeBytes };
    }
  }

  const lastPreset = COMPRESS_PRESETS[COMPRESS_PRESETS.length - 1];
  const last = await ImageResizer.createResizedImage(
    inputFileUri,
    lastPreset.max,
    lastPreset.max,
    'JPEG',
    lastPreset.quality,
    0,
  );
  const lastUri = toFileUri(last.uri);
  const statLast = await RNBlobUtil.fs.stat(stripFileScheme(lastUri));
  const lastSize = Number(statLast.size || 0);

  return { uri: lastUri, sizeBytes: lastSize };
}

export default function PermintaanHargaFormScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const runGuardedPress = usePressGuard();
  const { user, token } = useAuth();

  const mode: 'create' | 'edit' =
    route?.params?.mode === 'edit' ? 'edit' : 'create';
  const initial = useMemo(
    () => route?.params?.initialData || {},
    [route?.params],
  );
  const [currentNomor, setCurrentNomor] = useState(
    String(route?.params?.nomor || initial?.mh_nomor || ''),
  );

  // WIZARD STEP: 1 = Spesifikasi, 2 = Kalkulasi, 3 = Review & Pengajuan
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Pra Order States (Opsional)
  const [mh_pro_nomor, setMhProNomor] = useState<string>(
    String(initial?.mh_pro_nomor || ''),
  );
  const [selectedPraOrderDetail, setSelectedPraOrderDetail] =
    useState<PraOrderDetail | null>(null);
  const [showPraOrderModal, setShowPraOrderModal] = useState<boolean>(false);
  const [praOrderSearchKeyword, setPraOrderSearchKeyword] =
    useState<string>('');
  const [praOrderList, setPraOrderList] = useState<PraOrderItem[]>([]);
  const [loadingPraOrder, setLoadingPraOrder] = useState<boolean>(false);
  const [fetchingPraOrderDetail, setFetchingPraOrderDetail] =
    useState<boolean>(false);

  // Form States (Langkah 1: Spesifikasi)
  const [mh_divisi, setMhDivisi] = useState(String(initial?.mh_divisi || '1'));
  const [mh_cus_kode, setMhCusKode] = useState(
    String(initial?.mh_cus_kode || ''),
  );
  const [mh_cus_nama, setMhCusNama] = useState(
    String(initial?.mh_cus_nama || ''),
  );
  const initialSalesKode = String(
    initial?.mh_sal_kode ||
      user?.sales_kode ||
      user?.sal_kode ||
      user?.kode_sales ||
      (user as any)?.kode ||
      '',
  );
  const [mh_sal_kode, _setMhSalKode] = useState(initialSalesKode);

  const initialLebarRaw = initial?.mh_lebar ? String(initial.mh_lebar) : '';
  const initialLebarParsed = toNumDecimal(initialLebarRaw);
  const initialLebarFormatted =
    String(initial?.mh_divisi || '1') === '1' &&
    initialLebarParsed > 0 &&
    initialLebarParsed < 10
      ? String(Math.round(initialLebarParsed * 100))
      : initialLebarRaw;

  const [mh_nama, setMhNama] = useState(String(initial?.mh_nama || ''));
  const [mh_jmlorder, setMhJmlorder] = useState(
    initial?.mh_jmlorder ? String(initial.mh_jmlorder) : '',
  );
  const [mh_harga, setMhHarga] = useState(
    initial?.mh_harga !== undefined &&
      initial?.mh_harga !== null &&
      initial?.mh_harga !== ''
      ? String(initial.mh_harga)
      : '0',
  );
  const [mh_ongkir, setMhOngkir] = useState(
    initial?.mh_ongkir ? String(initial.mh_ongkir) : '',
  );
  const [alokasiOngkir, setAlokasiOngkir] = useState<string>(() => {
    if (initial?.mh_ongkir_alokasi) return String(initial.mh_ongkir_alokasi);
    if (initial?.mh_ongkir && Number(initial.mh_ongkir) > 0) return 'Custom';
    return 'Tanpa Ongkir';
  });
  const [namaDaerahKirim, setNamaDaerahKirim] = useState<string>(() => {
    if (initial?.mh_ongkir_daerah) return String(initial.mh_ongkir_daerah);
    const m = String(initial?.mh_ket || '').match(
      /(?:include\s+)?(?:ongkir\s+)?kirim\s+ke\s+([^,;\n]+)/i,
    );
    if (m && m[1]) return m[1].trim();
    if (
      initial?.mh_ongkir_alokasi &&
      String(initial.mh_ongkir_alokasi).toLowerCase() !== 'tanpa ongkir' &&
      String(initial.mh_ongkir_alokasi).toLowerCase() !== 'custom'
    ) {
      return String(initial.mh_ongkir_alokasi);
    }
    return '';
  });
  const [isCustomOngkir, setIsCustomOngkir] = useState<boolean>(
    Boolean(
      initial?.mh_ongkir_is_custom ||
        (initial?.mh_ongkir &&
          Number(initial.mh_ongkir) > 0 &&
          !FALLBACK_ONGKIR_OPTIONS.some(
            o =>
              o.alokasi.toLowerCase() ===
              String(initial?.mh_ongkir_alokasi || '').toLowerCase(),
          )),
    ),
  );
  const [customOngkirVal, setCustomOngkirVal] = useState<string>(
    initial?.mh_ongkir ? String(initial.mh_ongkir) : '',
  );
  const [showOngkirPopover, setShowOngkirPopover] = useState<boolean>(false);
  const [showManualSpandukPopover, setShowManualSpandukPopover] =
    useState<boolean>(false);
  const [finishingInfoType, setFinishingInfoType] = useState<
    'tanpa_kalkulasi' | 'include_kalkulasi' | null
  >(null);
  const [showConfirmSubmitModal, setShowConfirmSubmitModal] =
    useState<boolean>(false);
  const [_mh_budget, setMhBudget] = useState(
    initial?.mh_budget ? String(initial.mh_budget) : '',
  );
  const [mh_dateorder, setMhDateOrder] = useState(
    String(initial?.mh_dateorder || ''),
  );
  const [mh_kain, setMhKain] = useState(String(initial?.mh_kain || ''));
  const [mh_panjang, setMhPanjang] = useState(
    initial?.mh_panjang ? String(initial.mh_panjang) : '',
  );
  const [mh_lebar, setMhLebar] = useState(initialLebarFormatted);
  const [mh_ukuran, setMhUkuran] = useState(String(initial?.mh_ukuran || ''));
  const [mh_gramasi, setMhGramasi] = useState(
    String(
      initial?.mh_gramasi ||
        getGramasiByKain(initial?.mh_kain || 'PE SINGLE 24'),
    ),
  );
  const [mh_finishing, setMhFinishing] = useState(
    String(initial?.mh_finishing || ''),
  );
  const [mh_sublim, setMhSublim] = useState<string>(
    String(initial?.mh_sublim || ''),
  );
  const [mh_ket, setMhKet] = useState(String(initial?.mh_ket || ''));

  // Helper sinkronisasi kata "Include kirim ke [Nama Daerah]" ke dalam mh_ket
  const syncOngkirKet = useCallback(
    (daerah: string, currentKet: string = '') => {
      const trimmed = (daerah || '').trim();
      const regex =
        /(?:[;,.\s]*\b(?:include\s+)?(?:ongkir\s+)?kirim\s+ke\s+[^,;\n]+|[;,.\s]*\b(?:include\s+)?ongkir\s+ke\s+[^,;\n]+)/gi;
      const cleanKet = (currentKet || '')
        .replace(regex, '')
        .trim()
        .replace(/^[;,.\s]+|[;,.\s]+$/g, '');

      if (!trimmed || trimmed.toLowerCase() === 'tanpa ongkir') {
        return cleanKet;
      }

      const includeStr = `Include kirim ke ${trimmed}`;
      if (!cleanKet) {
        return includeStr;
      }
      return `${cleanKet}; ${includeStr}`;
    },
    [],
  );

  const [mh_harga_kalkulasi, setMhHargaKalkulasi] = useState<number>(
    initial?.mh_harga_kalkulasi || 0,
  );

  // State Foto Lampiran Contoh Produk (1 Slot - Maks 1 MB)
  const [photo, setPhoto] = useState<PhotoState | null>(null);
  const [compressing, setCompressing] = useState<boolean>(false);

  const handleSelectPhoto = async (asset: Asset) => {
    if (!asset?.uri) return;
    setCompressing(true);
    try {
      Toast.show({
        type: 'glassSuccess',
        text1: 'Foto Dipilih',
        text2: 'Mengompres foto ke maks 1 MB...',
      });

      const { uri: compressedUri, sizeBytes } = await compressToUnderLimit(
        asset.uri,
      );
      const finalName = safeFileName(
        asset.fileName,
        `mintaharga_${Date.now()}.jpg`,
      );

      const photoObj: PhotoState = {
        uri: toFileUri(compressedUri),
        name: finalName,
        type: 'image/jpeg',
        sizeBytes,
      };

      setPhoto(photoObj);

      if (sizeBytes > MAX_UPLOAD_BYTES) {
        Toast.show({
          type: 'glassError',
          text1: 'Foto Masih > 1 MB',
          text2: `Ukuran: ${(sizeBytes / 1024 / 1024).toFixed(2)} MB.`,
        });
      } else {
        Toast.show({
          type: 'glassSuccess',
          text1: 'Foto Siap Diunggah',
          text2: `Ukuran ${(sizeBytes / 1024).toFixed(0)} KB (Maks. 1 MB)`,
        });
      }
    } catch (err: any) {
      Toast.show({
        type: 'glassError',
        text1: 'Gagal Memproses Foto',
        text2: err?.message || 'Error kompresi',
      });
    } finally {
      setCompressing(false);
    }
  };

  const pickFromCamera = async () => {
    const res = await launchCamera({
      mediaType: 'photo',
      quality: 0.8,
      saveToPhotos: false,
    });
    if (res.didCancel || !res.assets?.[0]?.uri) return;
    await handleSelectPhoto(res.assets[0]);
  };

  const pickFromGallery = async () => {
    const res = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 1,
    });
    if (res.didCancel || !res.assets?.[0]?.uri) return;
    await handleSelectPhoto(res.assets[0]);
  };

  // Inisialisasi PPN & Keterangan Kalkulasi
  const initialRawKet = String(initial?.mh_ket_kalkulasi || '');
  const initialHasIncPpn = initialRawKet
    ? initialRawKet.toUpperCase().includes('INC PPN')
    : true;

  const [isIncPpn, setIsIncPpn] = useState<boolean>(initialHasIncPpn);
  const [keteranganKalkulasi, setKeteranganKalkulasi] = useState<string>(
    initialRawKet ? initialRawKet : 'INC PPN',
  );

  // Toggle PPN yang langsung memperbarui teks di field keterangan kalkulasi & harga kalkulasi
  const handleTogglePpn = () => {
    setIsIncPpn(prevPpn => {
      const nextPpn = !prevPpn;
      setKeteranganKalkulasi(prevKet => {
        const clean = (prevKet || '')
          .replace(/^INC PPN[;,]?\s*/i, '')
          .replace(/^EXC PPN[;,]?\s*/i, '')
          .trim();
        if (nextPpn) {
          return clean ? `INC PPN; ${clean}` : 'INC PPN;';
        } else {
          return clean ? `EXC PPN; ${clean}` : 'EXC PPN;';
        }
      });

      // Update mh_harga_kalkulasi reaktif sesuai divisi aktif
      setMhHargaKalkulasi(currentHrg => {
        let rawDpp = 0;
        if (mh_divisi === '5' && mmtResult?.hargaSatuanPcs) {
          rawDpp =
            mmtResult.hargaSatuanPcs + (calculatedOngkir.ongkirPerPcs || 0);
        } else if (mh_divisi === '1' && spandukResult?.hargaSatuanPcs) {
          rawDpp =
            spandukResult.hargaSatuanPcs + (calculatedOngkir.ongkirPerPcs || 0);
        } else if (mh_divisi === '4' && garmenCalcResult) {
          const rawGarmen =
            garmenCalcResult.hargaUpPerPcs ||
            garmenCalcResult.hargaJualRevisi ||
            garmenCalcResult.hargaJualPerPcs ||
            garmenCalcResult.hargaJual ||
            0;
          rawDpp = rawGarmen + (calculatedOngkir.ongkirPerPcs || 0);
        } else if (currentHrg > 0) {
          rawDpp = prevPpn ? Math.round(currentHrg / 1.11) : currentHrg;
        }

        if (rawDpp > 0) {
          return nextPpn ? Math.round(rawDpp * 1.11) : Math.round(rawDpp);
        }
        return currentHrg;
      });

      // Sinkronkan calculatedParams agar tidak memicu stale palsu saat toggle PPN
      setSpandukCalculatedParams(prev => {
        if (!prev) return prev;
        const parts = prev.split('|');
        if (parts.length >= 7) {
          parts[5] = String(nextPpn);
          return parts.join('|');
        }
        return prev;
      });
      setMmtCalculatedParams(prev => {
        if (!prev) return prev;
        const parts = prev.split('|');
        if (parts.length >= 12) {
          parts[10] = String(nextPpn);
          return parts.join('|');
        }
        return prev;
      });
      setGarmenCalculatedParams(prev => {
        if (!prev) return prev;
        const parts = prev.split('|');
        if (parts.length >= 9) {
          parts[7] = String(nextPpn);
          return parts.join('|');
        }
        return prev;
      });

      return nextPpn;
    });
  };

  const [saving, setSaving] = useState(false);
  const [showDateOrderPicker, setShowDateOrderPicker] = useState(false);

  // Master options backend
  const [masterOptions, setMasterOptions] = useState<{
    spanduk: any[];
    spandukTambahan?: any[];
    mmt: any[];
    topping: any[];
    ongkir?: any[];
    sales?: any[];
  }>({ spanduk: [], spandukTambahan: [], mmt: [], topping: [], ongkir: [], sales: [] });

  const activeOngkirMasterList = useMemo<OngkirMasterItem[]>(() => {
    if (
      masterOptions?.ongkir &&
      Array.isArray(masterOptions.ongkir) &&
      masterOptions.ongkir.length > 0
    ) {
      return masterOptions.ongkir.map((o: any) => {
        const fallback = FALLBACK_ONGKIR_OPTIONS.find(
          f =>
            f.alokasi.toLowerCase() === String(o.alokasi || '').toLowerCase(),
        );
        return {
          ...o,
          coverage_desc: o.coverage_desc || fallback?.coverage_desc || '',
          alias_keywords: o.alias_keywords || fallback?.alias_keywords || [],
        };
      }) as OngkirMasterItem[];
    }
    return FALLBACK_ONGKIR_OPTIONS;
  }, [masterOptions?.ongkir]);

  const ongkirMasterRules = useMemo(() => {
    const sampleItem = activeOngkirMasterList[0] || FALLBACK_ONGKIR_OPTIONS[0];
    const freeGarmenItem =
      activeOngkirMasterList.find(o => Number(o.free_garmen_pcs) > 0) ||
      FALLBACK_ONGKIR_OPTIONS[0];
    const freeSpandukItem =
      activeOngkirMasterList.find(o => Number(o.free_spanduk_m) > 0) ||
      FALLBACK_ONGKIR_OPTIONS[0];
    const freeMmtItem =
      activeOngkirMasterList.find(o => Number(o.free_mmt_m2) > 0) ||
      FALLBACK_ONGKIR_OPTIONS[0];
    const jawaItem =
      activeOngkirMasterList.find(o => o.alokasi.toLowerCase() === 'jakarta') ||
      FALLBACK_ONGKIR_OPTIONS[0];
    const luarJawaItem =
      activeOngkirMasterList.find(o => Number(o.min_kg) >= 40) ||
      FALLBACK_ONGKIR_OPTIONS[7];

    return {
      spanduk_m_per_kg: sampleItem?.spanduk_m_per_kg || 10,
      mmt_m2_per_kg: sampleItem?.mmt_m2_per_kg || 2,
      garmen_med_pcs_per_kg: sampleItem?.garmen_med_pcs_per_kg || 5,
      garmen_prem_pcs_per_kg: sampleItem?.garmen_prem_pcs_per_kg || 3,
      min_kg_jawa: jawaItem?.min_kg || 20,
      min_kg_luar_jawa: luarJawaItem?.min_kg || 40,
      free_spanduk_m: freeSpandukItem?.free_spanduk_m || 1000,
      free_mmt_m2: freeMmtItem?.free_mmt_m2 || 500,
      free_garmen_pcs: freeGarmenItem?.free_garmen_pcs || 300,
    };
  }, [activeOngkirMasterList]);

  const calculatedOngkir = useMemo(() => {
    return hitungOngkirOtomatis({
      options: activeOngkirMasterList,
      alokasi: alokasiOngkir,
      divisi: mh_divisi,
      panjang: toNumDecimal(mh_panjang),
      lebar: toNumDecimal(mh_lebar),
      qty: toNumCurrency(mh_jmlorder),
      sublim: mh_sublim,
      customNominal: toNumCurrency(customOngkirVal),
      isCustom: isCustomOngkir || alokasiOngkir === 'Custom',
    });
  }, [
    activeOngkirMasterList,
    alokasiOngkir,
    mh_divisi,
    mh_panjang,
    mh_lebar,
    mh_jmlorder,
    mh_sublim,
    customOngkirVal,
    isCustomOngkir,
  ]);

  // Customer Modal States
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearchKeyword, setCustomerSearchKeyword] = useState('');
  const [customerList, setCustomerList] = useState<PenawaranMasterOption[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);

  // Sinkronisasi sales_kode langsung dari user login
  useEffect(() => {
    if (!mh_sal_kode && user) {
      const resolved =
        user?.sales_kode ||
        user?.sal_kode ||
        user?.kode_sales ||
        (user as any)?.kode ||
        '';
      if (resolved) {
        _setMhSalKode(String(resolved));
      }
    }
  }, [user, mh_sal_kode]);

  // Listener bila kembali dari Tambah Customer Screen
  useEffect(() => {
    if (route?.params?.selectedCustomer) {
      const sel = route.params.selectedCustomer;
      if (sel.kode) setMhCusKode(String(sel.kode));
      if (sel.nama) setMhCusNama(String(sel.nama));
    }
  }, [route?.params?.selectedCustomer]);

  // Fetch daftar customer
  const fetchCustomerData = useCallback(async (q: string = '') => {
    setCustomerLoading(true);
    try {
      const res = await getMasterCustomer(q);
      setCustomerList(res || []);
    } catch (err) {
      console.log('[PermintaanHargaForm] getMasterCustomer err:', err);
      setCustomerList([]);
    } finally {
      setCustomerLoading(false);
    }
  }, []);

  // Debouncing search customer (350ms)
  useEffect(() => {
    if (!showCustomerModal) return;
    const timer = setTimeout(() => {
      fetchCustomerData(customerSearchKeyword.trim());
    }, 350);

    return () => {
      clearTimeout(timer);
    };
  }, [customerSearchKeyword, fetchCustomerData, showCustomerModal]);

  const openCustomerPicker = () => {
    setShowCustomerModal(true);
    setCustomerSearchKeyword('');
    fetchCustomerData('');
  };

  const selectCustomerItem = (item: PenawaranMasterOption) => {
    setMhCusKode(item.kode || '');
    setMhCusNama(item.nama || '');
    setShowCustomerModal(false);
  };

  // Load detail Pra Order jika mode edit sudah memiliki mh_pro_nomor
  useEffect(() => {
    const existingNomor = initial?.mh_pro_nomor;
    if (existingNomor && !selectedPraOrderDetail) {
      getPraOrderDetailApi(String(existingNomor), token)
        .then(res => {
          if (res) setSelectedPraOrderDetail(res);
        })
        .catch(() => {});
    }
  }, [initial?.mh_pro_nomor, selectedPraOrderDetail, token]);

  // Fetch daftar Pra Order
  const fetchPraOrderData = useCallback(
    async (keyword: string = '') => {
      setLoadingPraOrder(true);
      try {
        const list = await getPraOrderListApi(keyword, token);
        setPraOrderList(list || []);
      } catch (err) {
        console.log('[PermintaanHargaForm] getPraOrderListApi err:', err);
        setPraOrderList([]);
      } finally {
        setLoadingPraOrder(false);
      }
    },
    [token],
  );

  // Debounce pencarian Pra Order (350ms)
  useEffect(() => {
    if (!showPraOrderModal) return;
    const timer = setTimeout(() => {
      fetchPraOrderData(praOrderSearchKeyword.trim());
    }, 350);

    return () => {
      clearTimeout(timer);
    };
  }, [praOrderSearchKeyword, fetchPraOrderData, showPraOrderModal]);

  const openPraOrderPicker = () => {
    setShowPraOrderModal(true);
    setPraOrderSearchKeyword('');
    fetchPraOrderData('');
  };

  // Autofill formulir saat Pra Order dipilih
  const handleSelectPraOrder = async (item: PraOrderItem) => {
    setFetchingPraOrderDetail(true);
    try {
      const detail = await getPraOrderDetailApi(item.nomor, token);
      const target: PraOrderDetail = detail || {
        nomor: item.nomor,
        cusKode: item.cusKode || '',
        cusNama: item.cusNama || '',
        salKode: item.salKode || '',
        salNama: item.salesNama || '',
        namaPekerjaan: item.namaPekerjaan || '',
        divisi: item.divisi || '1',
        divisiNama: item.divisiNama || '',
        finishing: item.finishing || '',
        spesifikasi: '',
        sampel: '',
        rencanaOrder: item.qtyRencana || 0,
        kain: '',
        ukuran: '',
        keterangan: '',
        catatanDeadline: '',
        imageUrl: null,
        sudahDipakaiOleh: item.sudahDipakaiOleh || null,
      };

      setSelectedPraOrderDetail(target);
      setMhProNomor(target.nomor);

      // Autofill field pada permintaan harga yang inputannya sama
      if (target.cusKode) setMhCusKode(target.cusKode);
      if (target.cusNama) setMhCusNama(target.cusNama);
      if (target.namaPekerjaan) setMhNama(target.namaPekerjaan);
      if (target.divisi) setMhDivisi(String(target.divisi));
      if (target.rencanaOrder) setMhJmlorder(String(target.rencanaOrder));
      if (target.finishing) setMhFinishing(target.finishing);
      if (target.kain) {
        setMhKain(target.kain);
        if (String(target.divisi) === '4') {
          setGarmenJenisKain(target.kain);
        }
      }
      if (target.ukuran) setMhUkuran(target.ukuran);

      const ketParts: string[] = [];
      if (target.spesifikasi)
        ketParts.push(`Spesifikasi: ${target.spesifikasi}`);
      if (target.keterangan) ketParts.push(`Ket: ${target.keterangan}`);
      if (target.catatanDeadline)
        ketParts.push(`Deadline: ${target.catatanDeadline}`);
      const ketCombined = ketParts.join(' | ');

      if (ketCombined) {
        setMhKet(prev => (prev ? `${prev}\n${ketCombined}` : ketCombined));
      }

      setShowPraOrderModal(false);
      Toast.show({
        type: 'glassSuccess',
        text1: 'Pra Order Diterapkan',
        text2: `${target.nomor} berhasil diterapkan.`,
      });
    } catch (err: any) {
      Toast.show({
        type: 'glassError',
        text1: 'Gagal Menerapkan Pra Order',
        text2: err?.message || 'Gagal menerapkan pra order.',
      });
    } finally {
      setFetchingPraOrderDetail(false);
    }
  };

  const handleClearPraOrder = () => {
    setMhProNomor('');
    setSelectedPraOrderDetail(null);
    Toast.show({
      type: 'glassSuccess',
      text1: 'Kaitan Pra Order Dilepas',
      text2: 'Nomor pra order tidak lagi ditautkan ke permintaan harga ini.',
    });
  };

  const [alasanPengajuan, setAlasanPengajuan] = useState<string>(() => {
    const rawKet = String(initial?.mh_ket_kalkulasi || '');
    const match = rawKet.match(/\[ALASAN:\s*([^\]]+)\]/i);
    return match ? match[1].trim() : '';
  });
  const [customerSoList, setCustomerSoList] = useState<CustomerSoHistoryItem[]>(
    [],
  );
  const [loadingSoHistory, setLoadingSoHistory] = useState<boolean>(false);
  const [isSoHistoryExpanded, setIsSoHistoryExpanded] = useState<boolean>(true);
  const [soSearchKeyword, setSoSearchKeyword] = useState<string>('');

  const filteredCustomerSoList = useMemo(() => {
    if (!soSearchKeyword.trim()) return customerSoList;
    const q = soSearchKeyword.toLowerCase().trim();
    return customerSoList.filter(so => {
      const matchNomor = (so.so_nomor || '').toLowerCase().includes(q);
      const matchNama = (so.so_nama || so.so_nama2 || '')
        .toLowerCase()
        .includes(q);
      const matchKain = (so.so_kain || '').toLowerCase().includes(q);
      const matchUkuran = (so.so_ukuran || '').toLowerCase().includes(q);
      const matchDivisi = (so.divisi_nama || '').toLowerCase().includes(q);
      const matchKet = (so.so_keterangan || '').toLowerCase().includes(q);
      const matchFinishing = (so.so_finishing || '').toLowerCase().includes(q);
      return (
        matchNomor ||
        matchNama ||
        matchKain ||
        matchUkuran ||
        matchDivisi ||
        matchKet ||
        matchFinishing
      );
    });
  }, [customerSoList, soSearchKeyword]);

  const fetchCustomerSoHistory = useCallback(
    async (cusKode: string) => {
      if (!cusKode) {
        setCustomerSoList([]);
        return;
      }
      setLoadingSoHistory(true);
      try {
        const res = await getCustomerSoHistoryApi(
          cusKode,
          { divisi: 'SEMUA', q: '', page: 1, limit: 20 },
          token,
        );
        setCustomerSoList(res?.data || []);
      } catch (err) {
        console.log('[PermintaanHargaForm] fetchCustomerSoHistory err:', err);
        setCustomerSoList([]);
      } finally {
        setLoadingSoHistory(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (mh_cus_kode) {
      fetchCustomerSoHistory(mh_cus_kode);
    } else {
      setCustomerSoList([]);
    }
  }, [mh_cus_kode, fetchCustomerSoHistory]);

  // Engine Kalkulasi State (Langkah 2)
  const [spandukMetode, setSpandukMetode] = useState<'MANUAL' | 'MACHINE'>(
    'MANUAL',
  );
  const [spandukLebar, setSpandukLebar] = useState<number>(90);
  const [spandukJenisKain, setSpandukJenisKain] =
    useState<string>('POLYESTER 50/36');
  const [spandukResult, setSpandukResult] = useState<any>(null);
  const [spandukLoading, setSpandukLoading] = useState<boolean>(false);
  const [showSpandukStrataTabel, setShowSpandukStrataTabel] =
    useState<boolean>(false);
  const [spandukCalculatedParams, setSpandukCalculatedParams] =
    useState<string>('');
  const [spandukFinishingIds, setSpandukFinishingIds] = useState<number[]>([]);

  const [mmtKategori, setMmtKategori] = useState<string>('VYNIL');
  const [mmtBahanKode, setMmtBahanKode] = useState<string>('260');
  const [mmtToppingKode, setMmtToppingKode] = useState<string>('');
  const [mmtToppingQty, _setMmtToppingQty] = useState<string>('1');
  // Ekstraksi alasan netto bila sedang edit / review dari initial data
  const initialNettoMatch = useMemo(() => {
    const rawKet = String(initial?.mh_ket_kalkulasi || '');
    const m =
      rawKet.match(/\[NETTO:\s*([^\]]+)\]/i) ||
      rawKet.match(/Netto\s*-\s*Alasan:\s*([^);]+)/i);
    return m ? m[1].trim() : '';
  }, [initial?.mh_ket_kalkulasi]);

  const [mmtAlasanNetto, setMmtAlasanNetto] =
    useState<string>(initialNettoMatch);
  const [mmtIsNetto, setMmtIsNetto] = useState<boolean>(
    Boolean(
      initialNettoMatch ||
        (initial?.mh_ket_kalkulasi &&
          String(initial.mh_ket_kalkulasi).toUpperCase().includes('NETTO')),
    ),
  );

  const initialSelongsongVert = useMemo(() => {
    const rawKet = String(initial?.mh_ket_kalkulasi || '').toUpperCase();
    return (
      rawKet.includes('SELONGSONG (V & H)') ||
      rawKet.includes('SELONGSONG VERTIKAL') ||
      rawKet.includes('SELONGSONG V')
    );
  }, [initial?.mh_ket_kalkulasi]);

  const initialSelongsongHoriz = useMemo(() => {
    const rawKet = String(initial?.mh_ket_kalkulasi || '').toUpperCase();
    return (
      rawKet.includes('SELONGSONG (V & H)') ||
      rawKet.includes('SELONGSONG HORIZONTAL') ||
      rawKet.includes('SELONGSONG H')
    );
  }, [initial?.mh_ket_kalkulasi]);

  const [mmtSelongsongVert, setMmtSelongsongVert] = useState<boolean>(
    initialSelongsongVert,
  );
  const [mmtSelongsongHoriz, setMmtSelongsongHoriz] = useState<boolean>(
    initialSelongsongHoriz,
  );

  const [mmtResult, setMmtResult] = useState<any>(null);
  const [mmtLoading, setMmtLoading] = useState<boolean>(false);
  const [showMmtStrataTabel, setShowMmtStrataTabel] = useState<boolean>(false);
  const [showToppingDropdown, setShowToppingDropdown] =
    useState<boolean>(false);
  const [mmtCalculatedParams, setMmtCalculatedParams] = useState<string>('');

  // Engine Kalkulasi Garmen State
  const [garmenKodeModel, setGarmenKodeModel] = useState<'KH-0001' | 'KH-0002'>(
    'KH-0001',
  );
  const [garmenJenisKain, setGarmenJenisKain] =
    useState<string>('PE SINGLE 24');
  const [garmenKategoriKain, setGarmenKategoriKain] = useState<string>('pe');
  const [garmenWarna, setGarmenWarna] = useState<string>('muda');
  const [garmenWorkshop, setGarmenWorkshop] = useState<'MEDIUM' | 'PREMIUM'>(
    () => {
      const raw = String(
        initial?.mh_workshop || initial?.garmen_workshop || '',
      ).toUpperCase();
      return raw === 'P04' || raw === 'PREMIUM' ? 'PREMIUM' : 'MEDIUM';
    },
  );
  const [garmenKainList, setGarmenKainList] = useState<any[]>([]);
  const [garmenLoadingKain, setGarmenLoadingKain] = useState<boolean>(false);
  const [modalGarmenKainVisible, setModalGarmenKainVisible] =
    useState<boolean>(false);
  const [searchGarmenKain, setSearchGarmenKain] = useState<string>('');

  const [showGarmenStrataTabel, setShowGarmenStrataTabel] =
    useState<boolean>(false);
  const [modalGarmenTambahanVisible, setModalGarmenTambahanVisible] =
    useState<boolean>(false);
  const [searchGarmenTambahan, setSearchGarmenTambahan] = useState<string>('');

  const [modalGarmenCetakVisible, setModalGarmenCetakVisible] =
    useState<boolean>(false);
  const [searchGarmenCetak, setSearchGarmenCetak] = useState<string>('');

  const [cetakActiveCategory, setCetakActiveCategory] = useState<
    'SABLON' | 'SUBLIM' | 'DTF' | 'BORDIR'
  >('SABLON');

  const [sablonSubCategory, setSablonSubCategory] = useState<
    'ALL' | 'MEDIUM' | 'RUBBER'
  >('ALL');

  const [garmenTambahanMaster, setGarmenTambahanMaster] = useState<any[]>([]);
  const [garmenCetakMaster, setGarmenCetakMaster] = useState<any[]>([]);

  // State Kalkulator Ukuran DTF & BORDIR (Murni: Panjang, Lebar, Tarif per cm2)
  const [dtfBordirPanjang, setDtfBordirPanjang] = useState<string>('10');
  const [dtfBordirLebar, setDtfBordirLebar] = useState<string>('8');
  const [dtfTarifCm, setDtfTarifCm] = useState<string>('');
  const [bordirTarifCm, setBordirTarifCm] = useState<string>('');

  const currentDtfBordirCalc = useMemo(() => {
    const isDtf = cetakActiveCategory === 'DTF';
    const isBordir = cetakActiveCategory === 'BORDIR';
    if (!isDtf && !isBordir) return null;

    const masterItem = garmenCetakMaster.find(
      (c: any) =>
        (c.mhb_jenis || c.jenis || '').toUpperCase() === cetakActiveCategory,
    );
    const defaultTarif = Number(masterItem?.mhb_cm || (isDtf ? 25 : 90));
    const minTarif = Number(masterItem?.mhb_min || (isDtf ? 1000 : 2500));

    const panjang = toNumDecimal(dtfBordirPanjang);
    const lebar = toNumDecimal(dtfBordirLebar);
    const luas = panjang * lebar;

    const currentTarifInput = isDtf ? dtfTarifCm : bordirTarifCm;
    const rawTarif =
      currentTarifInput !== '' ? toNumDecimal(currentTarifInput) : defaultTarif;
    const isTarifUnderDefault =
      currentTarifInput !== '' && rawTarif < defaultTarif;
    const tarifCm = Math.max(defaultTarif, rawTarif);

    const biayaMurni = luas * tarifCm;
    const isMinApplied = luas > 0 && biayaMurni < minTarif;
    const biayaPerPcs =
      luas > 0 ? (isMinApplied ? minTarif : Math.round(biayaMurni)) : 0;
    const qtyOrder = toNumCurrency(mh_jmlorder);
    const totalOrder = biayaPerPcs * qtyOrder;

    return {
      isDtf,
      isBordir,
      panjang,
      lebar,
      luas,
      tarifCm,
      rawTarif,
      isTarifUnderDefault,
      defaultTarif,
      minTarif,
      biayaMurni,
      isMinApplied,
      biayaPerPcs,
      totalOrder,
      qtyOrder,
    };
  }, [
    cetakActiveCategory,
    garmenCetakMaster,
    dtfBordirPanjang,
    dtfBordirLebar,
    dtfTarifCm,
    bordirTarifCm,
    mh_jmlorder,
  ]);
  const [garmenSelectedTambahan, setGarmenSelectedTambahan] = useState<
    Array<{ ket: string; tarif: number }>
  >([]);
  const [garmenSelectedCetak, setGarmenSelectedCetak] = useState<
    Array<{ jenis: string; ket: string; biaya: number }>
  >([]);
  const [garmenCalcResult, setGarmenCalcResult] = useState<any>(null);
  const [garmenLoadingCalc, setGarmenLoadingCalc] = useState<boolean>(false);

  // Deteksi Perubahan Data Pasca-Kalkulasi (Stale Calculation)
  const [garmenCalculatedParams, setGarmenCalculatedParams] =
    useState<string>('');

  const activeSpandukLebar =
    (toNumDecimal(mh_lebar) > 0 ? toNumDecimal(mh_lebar) : spandukLebar) || 90;
  const activeSpandukKain = spandukJenisKain || mh_kain || 'POLYESTER 50/36';
  const currentSpandukParamsKey = `${mh_panjang}|${mh_jmlorder}|${spandukMetode}|${activeSpandukLebar}|${activeSpandukKain}|${spandukFinishingIds
    .slice()
    .sort()
    .join(',')}|${isIncPpn}|${calculatedOngkir.ongkirPerPcs}`;
  const isSpandukStale = Boolean(
    spandukResult &&
      spandukCalculatedParams &&
      spandukCalculatedParams !== currentSpandukParamsKey,
  );

  const currentMmtParamsKey = `${mh_panjang}|${mh_lebar}|${mh_jmlorder}|${mmtKategori}|${mmtBahanKode}|${mmtToppingKode}|${mmtToppingQty}|${mmtIsNetto}|${mmtSelongsongVert}|${mmtSelongsongHoriz}|${isIncPpn}|${calculatedOngkir.ongkirPerPcs}`;
  const isMmtStale = Boolean(
    mmtResult &&
      mmtCalculatedParams &&
      mmtCalculatedParams !== currentMmtParamsKey,
  );

  const currentGarmenParamsKey = useMemo(() => {
    const tambahanKey = garmenSelectedTambahan
      .map(t => `${t.ket}:${t.tarif}`)
      .sort()
      .join(';');
    const cetakKey = garmenSelectedCetak
      .map(c => `${c.jenis}:${c.ket}:${c.biaya}`)
      .sort()
      .join(';');
    return `${garmenKodeModel}|${garmenJenisKain}|${garmenWarna}|${mh_jmlorder}|${garmenWorkshop}|${tambahanKey}|${cetakKey}|${isIncPpn}|${calculatedOngkir.ongkirPerPcs}`;
  }, [
    garmenKodeModel,
    garmenJenisKain,
    garmenWarna,
    mh_jmlorder,
    garmenWorkshop,
    garmenSelectedTambahan,
    garmenSelectedCetak,
    isIncPpn,
    calculatedOngkir.ongkirPerPcs,
  ]);

  const isGarmenStale = Boolean(
    garmenCalcResult &&
      garmenCalculatedParams &&
      garmenCalculatedParams !== currentGarmenParamsKey,
  );

  // Kategori & Pilihan Bahan Spanduk & MMT Dinamis dari Master Database
  const availableSpandukMetode = useMemo(() => {
    if (masterOptions?.spanduk && Array.isArray(masterOptions.spanduk)) {
      const list = Array.from(
        new Set(
          masterOptions.spanduk
            .map((s: any) =>
              String(s.metode || '')
                .trim()
                .toUpperCase(),
            )
            .filter(Boolean),
        ),
      );
      if (list.length > 0) return list;
    }
    return ['MANUAL', 'MACHINE'];
  }, [masterOptions?.spanduk]);

  const availableSpandukKain = useMemo(() => {
    if (masterOptions?.spanduk && Array.isArray(masterOptions.spanduk)) {
      const filtered = masterOptions.spanduk.filter(
        (s: any) =>
          String(s.metode || '')
            .trim()
            .toUpperCase() === spandukMetode.toUpperCase(),
      );
      const list = Array.from(
        new Set(
          filtered
            .map((s: any) => String(s.jenis_kain || '').trim())
            .filter(Boolean),
        ),
      );
      if (list.length > 0) return list;
    }
    if (spandukMetode === 'MACHINE') {
      return ['POLYESTER 50/36', 'OPTIC 70/40'];
    }
    return ['POLYESTER 50/36', 'OPTIC 70/40', 'TC 60/44'];
  }, [masterOptions?.spanduk, spandukMetode]);

  const availableSpandukLebar = useMemo(() => {
    const selectedKain = (
      spandukJenisKain ||
      mh_kain ||
      availableSpandukKain[0] ||
      ''
    )
      .trim()
      .toUpperCase();
    if (masterOptions?.spanduk && Array.isArray(masterOptions.spanduk)) {
      const filtered = masterOptions.spanduk.filter(
        (s: any) =>
          String(s.metode || '')
            .trim()
            .toUpperCase() === spandukMetode.toUpperCase() &&
          String(s.jenis_kain || '')
            .trim()
            .toUpperCase() === selectedKain,
      );
      const lebars = Array.from(
        new Set(
          filtered
            .map((s: any) => Number(s.lebar))
            .filter((l: number) => l > 0),
        ),
      ).sort((a: number, b: number) => a - b);
      if (lebars.length > 0) return lebars;
    }
    return [90, 115];
  }, [
    masterOptions?.spanduk,
    spandukMetode,
    spandukJenisKain,
    mh_kain,
    availableSpandukKain,
  ]);

  const handleSelectSpandukMetode = (metode: 'MANUAL' | 'MACHINE') => {
    setSpandukMetode(metode);
    if (masterOptions?.spanduk && Array.isArray(masterOptions.spanduk)) {
      const filteredKain = Array.from(
        new Set(
          masterOptions.spanduk
            .filter(
              (s: any) =>
                String(s.metode || '')
                  .trim()
                  .toUpperCase() === metode.toUpperCase(),
            )
            .map((s: any) => String(s.jenis_kain || '').trim())
            .filter(Boolean),
        ),
      );
      let targetKain = spandukJenisKain;
      if (filteredKain.length > 0) {
        const exists = filteredKain.some(
          k => k.toUpperCase() === targetKain.toUpperCase(),
        );
        if (!exists) {
          targetKain = filteredKain[0];
          setSpandukJenisKain(targetKain);
          setMhKain(targetKain);
        }
      }

      const filteredLebar = Array.from(
        new Set(
          masterOptions.spanduk
            .filter(
              (s: any) =>
                String(s.metode || '')
                  .trim()
                  .toUpperCase() === metode.toUpperCase() &&
                String(s.jenis_kain || '')
                  .trim()
                  .toUpperCase() === targetKain.toUpperCase(),
            )
            .map((s: any) => Number(s.lebar))
            .filter((l: number) => l > 0),
        ),
      ).sort((a: number, b: number) => a - b);

      if (filteredLebar.length > 0) {
        const currentLebar = toNumDecimal(mh_lebar) || spandukLebar;
        if (!filteredLebar.includes(currentLebar)) {
          setSpandukLebar(filteredLebar[0]);
          setMhLebar(String(filteredLebar[0]));
        }
      }
    }
  };

  const handleSelectSpandukKain = (kain: string) => {
    setSpandukJenisKain(kain);
    setMhKain(kain);
    if (masterOptions?.spanduk && Array.isArray(masterOptions.spanduk)) {
      const filtered = masterOptions.spanduk.filter(
        (s: any) =>
          String(s.metode || '')
            .trim()
            .toUpperCase() === spandukMetode.toUpperCase() &&
          String(s.jenis_kain || '')
            .trim()
            .toUpperCase() === kain.trim().toUpperCase(),
      );
      const lebars = Array.from(
        new Set(
          filtered
            .map((s: any) => Number(s.lebar))
            .filter((l: number) => l > 0),
        ),
      ).sort((a: number, b: number) => a - b);
      if (lebars.length > 0) {
        const currentLebar = toNumDecimal(mh_lebar) || spandukLebar;
        if (!lebars.includes(currentLebar)) {
          setSpandukLebar(lebars[0]);
          setMhLebar(String(lebars[0]));
        } else {
          setSpandukLebar(currentLebar);
          setMhLebar(String(currentLebar));
        }
      }
    }
  };

  const availableMmtKategori = useMemo(() => {
    if (masterOptions?.mmt && masterOptions.mmt.length > 0) {
      const list = Array.from(
        new Set(masterOptions.mmt.map((m: any) => m.kategori).filter(Boolean)),
      );
      if (list.length > 0) return list;
    }
    return ['VYNIL', 'HI-RES', 'STICKER'];
  }, [masterOptions?.mmt]);

  const currentMmtBahanList = useMemo(() => {
    if (masterOptions?.mmt && masterOptions.mmt.length > 0) {
      const filtered = masterOptions.mmt.filter(
        (m: any) => m.kategori === mmtKategori,
      );
      if (filtered.length > 0) {
        return filtered.map((m: any) => ({
          kode: String(m.bahan_kode || ''),
          nama: String(m.nama_bahan || m.bahan_kode || ''),
        }));
      }
    }
    if (mmtKategori === 'VYNIL') {
      return [
        { kode: '260', nama: 'Frontlite 260' },
        { kode: '280', nama: 'Frontlite 280' },
        { kode: '340', nama: 'Frontlite 340' },
        { kode: '440', nama: 'Frontlite 440' },
        { kode: 'KORCIN', nama: 'Frontlite Korcin' },
      ];
    }
    if (mmtKategori === 'HI-RES') {
      return [
        { kode: '340', nama: 'Hi-Res 340' },
        { kode: '440', nama: 'Hi-Res 440' },
        { kode: 'KORCIN', nama: 'Hi-Res Korcin' },
        { kode: 'BACKLITE', nama: 'Backlite' },
      ];
    }
    return [
      { kode: 'GRAFTAC', nama: 'Sticker Graftac' },
      { kode: 'RITRAMA', nama: 'Sticker Ritrama' },
      { kode: 'ORAJET', nama: 'Sticker Orajet' },
      { kode: 'TRANSPARAN', nama: 'Sticker Transparan' },
    ];
  }, [masterOptions?.mmt, mmtKategori]);

  // Load master lookup options
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const opts = await getKalkulasiMasterOptions(token);
        if (mounted && opts) {
          setMasterOptions(opts);
          if (
            mh_divisi === '1' &&
            initial?.mh_finishing &&
            opts.spandukTambahan &&
            opts.spandukTambahan.length > 0
          ) {
            const rawFinish = String(initial.mh_finishing).toLowerCase();
            const matched = opts.spandukTambahan
              .filter((it: any) =>
                rawFinish.includes(String(it.nama).toLowerCase()),
              )
              .map((it: any) => it.id);
            if (matched.length > 0) {
              setSpandukFinishingIds(matched);
            }
          }
        }
      } catch (err) {
        console.log('[PermintaanHargaForm] load master opts err:', err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token, mh_divisi, initial?.mh_finishing]);

  // Otomatis memuat data kain garmen saat model berubah
  useEffect(() => {
    if (mh_divisi !== '4') return;
    let isMounted = true;
    setGarmenLoadingKain(true);
    getJenisKainMintaHargaApi(garmenKodeModel, token)
      .then((data: any[]) => {
        if (!isMounted) return;
        const list = Array.isArray(data) ? data : [];
        setGarmenKainList(list);
        if (list.length > 0) {
          setGarmenJenisKain(currentKain => {
            const exists = list.find(
              (item: any) =>
                (item.mhk_kain || item.Jeniskain || item.nama) === currentKain,
            );
            if (exists) {
              setGarmenKategoriKain(
                exists.mhk_ktg || exists.Kategori || 'COTTON',
              );
              return currentKain;
            }
            const first = list[0];
            const kainName =
              first.mhk_kain || first.Jeniskain || first.nama || '';
            setGarmenKategoriKain(first.mhk_ktg || first.Kategori || 'COTTON');
            setMhKain(kainName);
            const autoGram = getGramasiByKain(kainName);
            if (autoGram) {
              setMhGramasi(autoGram);
            }
            return kainName;
          });
        }
      })
      .catch(err => {
        console.warn('Gagal memuat list kain garmen:', err?.message);
      })
      .finally(() => {
        if (isMounted) setGarmenLoadingKain(false);
      });
    return () => {
      isMounted = false;
    };
  }, [garmenKodeModel, mh_divisi, token]);

  // Helper tarif tambahan murni mengambil hasil kalkulasi filter dari backend
  const getTambahanTarif = (tItem: any) => {
    if (!tItem) return 0;
    return Number(tItem.tarif ?? tItem.biaya ?? tItem.mht_cotton ?? 0);
  };

  // Memuat opsi tambahan dari backend yang otomatis terfilter berdasarkan jenis kain & kategori
  useEffect(() => {
    if (mh_divisi !== '4') return;
    let isMounted = true;
    getTambahanOptionsApi(token, {
      jenisKain: garmenJenisKain,
      kodeModel: garmenKodeModel,
      kategori: garmenKategoriKain,
    })
      .then((data: any[]) => {
        if (!isMounted) return;
        const list = Array.isArray(data) ? data : [];
        setGarmenTambahanMaster(list);
        setGarmenSelectedTambahan(prev =>
          prev.map(selected => {
            const masterItem = list.find(
              (m: any) =>
                (m.mht_ket || m.mht_keterangan || m.nama || '') ===
                selected.ket,
            );
            if (masterItem) {
              return {
                ...selected,
                tarif: Number(masterItem.tarif ?? masterItem.biaya ?? 0),
              };
            }
            return selected;
          }),
        );
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [mh_divisi, garmenJenisKain, garmenKodeModel, token, garmenKategoriKain]);

  // Memuat master cetak / sablon terfilter berdasarkan jenis kain & kategori
  useEffect(() => {
    if (mh_divisi !== '4') return;
    let isMounted = true;
    getCetakOptionsApi(token, {
      jenisKain: garmenJenisKain,
      kategori: garmenKategoriKain,
    })
      .then((cetak: any[]) => {
        if (!isMounted) return;
        if (Array.isArray(cetak)) {
          setGarmenCetakMaster(cetak);
          const dtfItem = cetak.find(
            (c: any) => (c.mhb_jenis || c.jenis || '').toUpperCase() === 'DTF',
          );
          if (dtfItem?.mhb_cm) {
            setDtfTarifCm(String(dtfItem.mhb_cm));
          }
          const bordirItem = cetak.find(
            (c: any) =>
              (c.mhb_jenis || c.jenis || '').toUpperCase() === 'BORDIR',
          );
          if (bordirItem?.mhb_cm) {
            setBordirTarifCm(String(bordirItem.mhb_cm));
          }

          // Sinkronkan item cetak terpilih jika ada di master baru
          setGarmenSelectedCetak(prev =>
            prev.map(selected => {
              const matched = cetak.find(
                (c: any) =>
                  (c.mhb_ket || c.ket || c.nama || '') === selected.ket &&
                  (c.mhb_jenis || c.jenis || '').toUpperCase() ===
                    selected.jenis.toUpperCase(),
              );
              if (matched) {
                return {
                  ...selected,
                  biaya: Number(matched.biaya ?? matched.mhb_biaya ?? 0),
                };
              }
              return selected;
            }),
          );
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [mh_divisi, token, garmenJenisKain, garmenKategoriKain]);

  const handleHitungGarmen = async () => {
    const qty = toNumCurrency(mh_jmlorder);
    if (qty <= 0) {
      Toast.show({
        type: 'glassError',
        text1: 'Jumlah Order Belum Diisi',
        text2: 'Mohon masukkan jumlah order pakaian (Pcs)',
      });
      return;
    }
    if (!garmenJenisKain.trim()) {
      Toast.show({
        type: 'glassError',
        text1: 'Jenis Kain Belum Dipilih',
        text2: 'Silakan pilih jenis kain garmen',
      });
      return;
    }

    setGarmenLoadingCalc(true);
    try {
      const res = await calculateGarmenApi(
        {
          kodeModel: garmenKodeModel,
          jenisKain: garmenJenisKain,
          warna: garmenWarna,
          qty: qty,
          tambahanList: garmenSelectedTambahan.map(t => ({
            ket: t.ket,
            tarif: t.tarif,
          })),
          cetakList: garmenSelectedCetak.map(c => ({
            jenis: c.jenis,
            ket: c.ket,
            biaya: c.biaya,
          })),
        },
        token,
      );

      if (res) {
        setGarmenCalcResult(res);
        setGarmenCalculatedParams(currentGarmenParamsKey);
        const hargaJual =
          res.hargaUpPerPcs ||
          res.hargaJualRevisi ||
          res.hargaJualPerPcs ||
          res.hargaJual ||
          0;
        const hargaJualDenganOngkir =
          hargaJual + (calculatedOngkir.ongkirPerPcs || 0);
        const finalHargaGarmen = isIncPpn
          ? Math.round(hargaJualDenganOngkir * 1.11)
          : Math.round(hargaJualDenganOngkir);
        setMhHarga('0');
        setMhBudget('0');
        setMhHargaKalkulasi(finalHargaGarmen);

        setKeteranganKalkulasi(isIncPpn ? 'INC PPN' : 'EXC PPN');

        Toast.show({
          type: 'glassSuccess',
          text1: 'Kalkulasi Garmen Berhasil',
          text2: `Harga Jual: Rp ${Number(hargaJualDenganOngkir).toLocaleString(
            'id-ID',
          )}/pcs`,
        });
      }
    } catch (err: any) {
      Toast.show({
        type: 'glassError',
        text1: 'Gagal Kalkulasi Garmen',
        text2:
          err?.response?.data?.message ||
          err?.message ||
          'Terjadi kesalahan sistem',
      });
    } finally {
      setGarmenLoadingCalc(false);
    }
  };

  // Kalkulasi Spanduk
  const handleHitungSpanduk = useCallback(
    async (
      customLebar?: number,
      customKain?: string,
      customMetode?: 'MANUAL' | 'MACHINE',
      customFinishingIds?: number[],
    ) => {
      const numPanjang = toNumDecimal(mh_panjang);
      const numLebar = toNumDecimal(mh_lebar);
      const numQty = toNumCurrency(mh_jmlorder);
      if (numPanjang <= 0 || numQty <= 0) return;

      const activeMetode = customMetode || spandukMetode || 'MANUAL';
      const activeLebar =
        customLebar || (numLebar > 0 ? numLebar : spandukLebar) || 90;
      const totalLuasM2 = numPanjang * (activeLebar / 100) * numQty;
      const isManualAllowed = numQty >= 100 || totalLuasM2 >= 500;

      if (activeMetode === 'MANUAL' && !isManualAllowed) {
        Toast.show({
          type: 'glassError',
          text1: 'Minimal Order Cetak Manual',
          text2: `Cetak Spanduk Manual minimal 100 pcs atau total luas 500 m² (saat ini: ${numQty} pcs / ${totalLuasM2.toFixed(
            1,
          )} m²). Silakan pilih metode Cetak Machine.`,
        });
        return;
      }
      const activeKain =
        customKain || spandukJenisKain || mh_kain || 'POLYESTER 50/36';
      const activeFinishing = Array.isArray(customFinishingIds)
        ? customFinishingIds
        : spandukFinishingIds;

      setSpandukLoading(true);
      try {
        const res = await calculateSpandukApi(
          {
            metode: activeMetode,
            lebar: activeLebar,
            jenisKain: activeKain,
            panjang: numPanjang,
            qty: numQty,
            finishingIds: activeFinishing,
          },
          token,
        );
        setSpandukResult(res);
        setSpandukCalculatedParams(
          `${mh_panjang}|${mh_jmlorder}|${activeMetode}|${activeLebar}|${activeKain}|${activeFinishing
            .slice()
            .sort()
            .join(',')}|${isIncPpn}|${calculatedOngkir.ongkirPerPcs}`,
        );
        if (res?.hargaSatuanPcs) {
          const hargaSpandukDenganOngkir =
            res.hargaSatuanPcs + (calculatedOngkir.ongkirPerPcs || 0);
          const finalHargaSpanduk = isIncPpn
            ? Math.round(hargaSpandukDenganOngkir * 1.11)
            : hargaSpandukDenganOngkir;
          setMhHarga('0');
          setMhBudget('0');
          setMhHargaKalkulasi(finalHargaSpanduk);
          let finishingSpec = '';
          if (res?.finishing?.items && res.finishing.items.length > 0) {
            finishingSpec =
              ' + ' +
              res.finishing.items.map((it: any) => it.nama).join(' + ');
          }
          const spandukSpec = `Spanduk ${activeMetode} ${activeKain} L${activeLebar}cm${finishingSpec}`;
          setKeteranganKalkulasi(
            isIncPpn ? `INC PPN; ${spandukSpec}` : `EXC PPN; ${spandukSpec}`,
          );
        }
      } catch (err: any) {
        Toast.show({
          type: 'glassError',
          text1: 'Kalkulasi Spanduk Gagal',
          text2: err?.response?.data?.message || err?.message || 'Error hitung',
        });
      } finally {
        setSpandukLoading(false);
      }
    },
    [
      mh_panjang,
      mh_lebar,
      mh_jmlorder,
      mh_kain,
      spandukMetode,
      spandukLebar,
      spandukJenisKain,
      spandukFinishingIds,
      token,
      isIncPpn,
      calculatedOngkir.ongkirPerPcs,
    ],
  );

  const handleToggleSpandukFinishing = useCallback(
    (id: number) => {
      const next = spandukFinishingIds.includes(id)
        ? spandukFinishingIds.filter(x => x !== id)
        : [...spandukFinishingIds, id];
      setSpandukFinishingIds(next);

      if (
        masterOptions?.spandukTambahan &&
        masterOptions.spandukTambahan.length > 0
      ) {
        const selectedNames = masterOptions.spandukTambahan
          .filter((it: any) => next.includes(it.id))
          .map((it: any) => it.nama);
        setMhFinishing(selectedNames.join(', '));
      }

      handleHitungSpanduk(undefined, undefined, undefined, next);
    },
    [spandukFinishingIds, masterOptions?.spandukTambahan, handleHitungSpanduk],
  );

  // Kalkulasi MMT
  const handleHitungMmt = useCallback(
    async (
      customIsNetto?: any,
      customSelongsongVert?: boolean,
      customSelongsongHoriz?: boolean,
    ) => {
      const numPanjang = toNumDecimal(mh_panjang);
      const numLebar = toNumDecimal(mh_lebar);
      const numQty = toNumCurrency(mh_jmlorder);
      if (numPanjang <= 0 || numLebar <= 0 || numQty <= 0) return;

      const activeNetto =
        typeof customIsNetto === 'boolean' ? customIsNetto : mmtIsNetto;
      const activeSelongsongVert =
        typeof customSelongsongVert === 'boolean'
          ? customSelongsongVert
          : mmtSelongsongVert;
      const activeSelongsongHoriz =
        typeof customSelongsongHoriz === 'boolean'
          ? customSelongsongHoriz
          : mmtSelongsongHoriz;

      setMmtLoading(true);
      try {
        const res = await calculateMmtApi(
          {
            kategori: mmtKategori,
            bahanKode: mmtBahanKode,
            panjang: numPanjang,
            lebar: numLebar,
            qty: numQty,
            toppingKode: mmtToppingKode,
            toppingQty: toNumCurrency(mmtToppingQty) || 1,
            isNetto: activeNetto,
            selongsongVertical: activeSelongsongVert,
            selongsongHorizontal: activeSelongsongHoriz,
          },
          token,
        );
        setMmtResult(res);
        setMmtCalculatedParams(
          `${mh_panjang}|${mh_lebar}|${mh_jmlorder}|${mmtKategori}|${mmtBahanKode}|${mmtToppingKode}|${mmtToppingQty}|${activeNetto}|${activeSelongsongVert}|${activeSelongsongHoriz}|${isIncPpn}|${calculatedOngkir.ongkirPerPcs}`,
        );
        if (res?.hargaSatuanPcs) {
          const hargaMmtDenganOngkir =
            res.hargaSatuanPcs + (calculatedOngkir.ongkirPerPcs || 0);
          const finalHargaMmt = isIncPpn
            ? Math.round(hargaMmtDenganOngkir * 1.11)
            : hargaMmtDenganOngkir;
          setMhHarga('0');
          setMhBudget('0');
          setMhHargaKalkulasi(finalHargaMmt);
          const nettoSpec = activeNetto
            ? mmtAlasanNetto.trim()
              ? ` (Netto - Alasan: ${mmtAlasanNetto.trim()})`
              : ' (Netto)'
            : '';
          let selongsongText = '';
          if (activeSelongsongVert && activeSelongsongHoriz) {
            selongsongText = ' + Plus Selongsong (V & H)';
          } else if (activeSelongsongVert) {
            selongsongText = ' + Plus Selongsong Vertikal';
          } else if (activeSelongsongHoriz) {
            selongsongText = ' + Plus Selongsong Horizontal';
          }
          const mmtSpec = `MMT ${mmtKategori} ${mmtBahanKode}${nettoSpec}${
            res.topping ? ` + Top: ${res.topping.nama}` : ''
          }${selongsongText}`;
          setKeteranganKalkulasi(
            isIncPpn ? `INC PPN; ${mmtSpec}` : `EXC PPN; ${mmtSpec}`,
          );
        }
      } catch (err: any) {
        Toast.show({
          type: 'glassError',
          text1: 'Kalkulasi MMT Gagal',
          text2: err?.response?.data?.message || err?.message || 'Error hitung',
        });
      } finally {
        setMmtLoading(false);
      }
    },
    [
      mh_panjang,
      mh_lebar,
      mh_jmlorder,
      mmtKategori,
      mmtBahanKode,
      mmtToppingKode,
      mmtToppingQty,
      mmtIsNetto,
      mmtSelongsongVert,
      mmtSelongsongHoriz,
      mmtAlasanNetto,
      token,
      isIncPpn,
      calculatedOngkir.ongkirPerPcs,
    ],
  );

  const handleToggleNetto = () => {
    const nextNetto = !mmtIsNetto;
    setMmtIsNetto(nextNetto);
    if (!nextNetto) {
      setMmtAlasanNetto('');
    }
    setTimeout(() => {
      handleHitungMmt(nextNetto);
    }, 50);
  };

  const syncSelongsongKet = (isVert: boolean, isHoriz: boolean) => {
    const hasSelongsong = isVert || isHoriz;
    setMhKet(prevKet => {
      const current = (prevKet || '').trim();
      if (hasSelongsong) {
        if (!current.toLowerCase().includes('plus selongsong')) {
          return current ? `${current}, Plus Selongsong` : 'Plus Selongsong';
        }
        return current;
      } else {
        return current
          .replace(/,?\s*Plus Selongsong/gi, '')
          .replace(/^,\s*/, '')
          .trim();
      }
    });
  };

  const handleToggleSelongsongVert = () => {
    const nextVert = !mmtSelongsongVert;
    setMmtSelongsongVert(nextVert);
    syncSelongsongKet(nextVert, mmtSelongsongHoriz);
    setTimeout(() => {
      handleHitungMmt(mmtIsNetto, nextVert, mmtSelongsongHoriz);
    }, 50);
  };

  const handleToggleSelongsongHoriz = () => {
    const nextHoriz = !mmtSelongsongHoriz;
    setMmtSelongsongHoriz(nextHoriz);
    syncSelongsongKet(mmtSelongsongVert, nextHoriz);
    setTimeout(() => {
      handleHitungMmt(mmtIsNetto, mmtSelongsongVert, nextHoriz);
    }, 50);
  };

  const handleUpdateMmtAlasan = (alasan: string) => {
    setMmtAlasanNetto(alasan);
    if (mh_divisi === '5') {
      const topName =
        mmtResult?.topping?.nama || (mmtToppingKode ? mmtToppingKode : '');
      const nettoText = mmtIsNetto
        ? alasan.trim()
          ? ` (Netto - Alasan: ${alasan.trim()})`
          : ' (Netto)'
        : '';
      const topText = topName ? ` + Top: ${topName}` : '';
      let selText = '';
      if (mmtSelongsongVert && mmtSelongsongHoriz) {
        selText = ' + Plus Selongsong (V & H)';
      } else if (mmtSelongsongVert) {
        selText = ' + Plus Selongsong Vertikal';
      } else if (mmtSelongsongHoriz) {
        selText = ' + Plus Selongsong Horizontal';
      }
      const mmtSpec = `MMT ${mmtKategori} ${mmtBahanKode}${nettoText}${topText}${selText}`;
      setKeteranganKalkulasi(
        isIncPpn ? `INC PPN; ${mmtSpec}` : `EXC PPN; ${mmtSpec}`,
      );
    }
  };

  // Auto calculate saat melangkah ke Step 2
  const goToStep2Kalkulasi = () => {
    const activeSalesKode =
      mh_sal_kode ||
      user?.sales_kode ||
      user?.sal_kode ||
      user?.kode_sales ||
      (user as any)?.kode ||
      '';

    if (!activeSalesKode) {
      Toast.show({
        type: 'glassError',
        text1: 'Sales Tidak Terdeteksi',
        text2: 'Mohon login ulang atau hubungi admin',
      });
      return;
    }

    if (!mh_nama.trim()) {
      Toast.show({
        type: 'glassError',
        text1: 'Data Belum Lengkap',
        text2: 'Mohon isi Nama Pekerjaan terlebih dahulu',
      });
      return;
    }
    if (!mh_dateorder || !String(mh_dateorder).trim()) {
      Toast.show({
        type: 'glassError',
        text1: 'Data Belum Lengkap',
        text2: 'Mohon pilih Rencana Tanggal Order terlebih dahulu',
      });
      return;
    }
    if (toNumCurrency(mh_jmlorder) <= 0) {
      Toast.show({
        type: 'glassError',
        text1: 'Data Belum Lengkap',
        text2: 'Mohon masukkan Jumlah Order (Pcs)',
      });
      return;
    }

    if (mh_divisi === '4') {
      if (!garmenJenisKain) {
        Toast.show({
          type: 'glassError',
          text1: 'Data Belum Lengkap',
          text2: 'Mohon pilih Jenis Kain garmen terlebih dahulu',
        });
        return;
      }
      setMhKain(garmenJenisKain);
      setCurrentStep(2);
      setTimeout(() => handleHitungGarmen(), 100);
      return;
    }

    if (toNumDecimal(mh_panjang) <= 0) {
      Toast.show({
        type: 'glassError',
        text1: 'Data Belum Lengkap',
        text2: 'Mohon masukkan Panjang barang',
      });
      return;
    }

    if (mh_divisi === '1') {
      const numQty = toNumCurrency(mh_jmlorder);
      const numPanjang = toNumDecimal(mh_panjang);
      const numLebar = toNumDecimal(mh_lebar) || spandukLebar || 90;
      const totalLuasM2 = numPanjang * (numLebar / 100) * numQty;
      const isManualAllowed = numQty >= 100 || totalLuasM2 >= 500;

      if (spandukMetode === 'MANUAL' && !isManualAllowed) {
        Toast.show({
          type: 'glassError',
          text1: 'Minimal Order Cetak Manual',
          text2: `Cetak Spanduk Manual minimal 100 pcs atau total luas 500 m² (saat ini: ${numQty} pcs / ${totalLuasM2.toFixed(
            1,
          )} m²). Silakan gunakan metode Cetak Machine.`,
        });
        return;
      }
      if (numLebar <= 0) {
        Toast.show({
          type: 'glassError',
          text1: 'Data Belum Lengkap',
          text2: 'Mohon pilih Lebar kain spanduk (Cm)',
        });
        return;
      }
      const activeKain =
        mh_kain ||
        spandukJenisKain ||
        availableSpandukKain[0] ||
        'POLYESTER 50/36';
      setSpandukJenisKain(activeKain);
      setSpandukLebar(numLebar);
      setCurrentStep(2);
      setTimeout(
        () =>
          handleHitungSpanduk(
            numLebar,
            activeKain,
            spandukMetode,
            spandukFinishingIds,
          ),
        100,
      );
      return;
    }

    if (mh_divisi === '5') {
      if (toNumDecimal(mh_lebar) <= 0) {
        Toast.show({
          type: 'glassError',
          text1: 'Data Belum Lengkap',
          text2: 'Mohon masukkan Lebar spanduk/MMT (Mtr)',
        });
        return;
      }
      const activeMmt = masterOptions?.mmt?.find(
        (m: any) =>
          m.kategori === mmtKategori &&
          String(m.bahan_kode) === String(mmtBahanKode),
      );
      setMhKain(activeMmt?.nama_bahan || `${mmtKategori} ${mmtBahanKode}`);
      setCurrentStep(2);
      setTimeout(() => handleHitungMmt(), 100);
      return;
    }

    setCurrentStep(2);
  };

  const handleBypassDirectSubmit = () => {
    const activeSalesKode =
      mh_sal_kode ||
      user?.sales_kode ||
      user?.sal_kode ||
      user?.kode_sales ||
      (user as any)?.kode ||
      '';

    if (!activeSalesKode) {
      Toast.show({
        type: 'glassError',
        text1: 'Sales Tidak Terdeteksi',
        text2: 'Mohon login ulang atau hubungi admin',
      });
      return;
    }

    if (!mh_cus_nama && !mh_cus_kode) {
      Toast.show({
        type: 'glassError',
        text1: 'Data Belum Lengkap',
        text2: 'Mohon pilih Customer terlebih dahulu',
      });
      return;
    }

    if (!mh_nama.trim()) {
      Toast.show({
        type: 'glassError',
        text1: 'Data Belum Lengkap',
        text2: 'Mohon isi Nama Pekerjaan terlebih dahulu',
      });
      return;
    }

    if (!mh_dateorder || !String(mh_dateorder).trim()) {
      Toast.show({
        type: 'glassError',
        text1: 'Data Belum Lengkap',
        text2: 'Mohon pilih Rencana Tanggal Order terlebih dahulu',
      });
      return;
    }

    if (toNumCurrency(mh_jmlorder) <= 0) {
      Toast.show({
        type: 'glassError',
        text1: 'Data Belum Lengkap',
        text2: 'Mohon masukkan Jumlah Order (Pcs)',
      });
      return;
    }

    // Pastikan kalkulasi sistem dinolkan (murni tanpa kalkulasi sistem / Status BELUM)
    setMhHargaKalkulasi(0);
    setSpandukResult(null);
    setMmtResult(null);
    setGarmenCalcResult(null);

    // Langsung tampilkan pop up konfirmasi akhir
    setShowConfirmSubmitModal(true);
  };

  const goToStep3Review = () => {
    if (mh_divisi === '5' && mmtIsNetto && !mmtAlasanNetto.trim()) {
      Toast.show({
        type: 'glassError',
        text1: 'Alasan Netto Diperlukan',
        text2: 'Mohon isi alasan penggunaan Harga Netto terlebih dahulu',
      });
      return;
    }
    setCurrentStep(3);
  };

  // Submit Final (Langkah 3)
  const submitPermintaan = async () => {
    if (!mh_nama.trim()) {
      Toast.show({
        type: 'glassError',
        text1: 'Validasi Gagal',
        text2: 'Nama Pekerjaan wajib diisi',
      });
      return;
    }

    if (!mh_dateorder || !String(mh_dateorder).trim()) {
      Toast.show({
        type: 'glassError',
        text1: 'Validasi Gagal',
        text2: 'Rencana Tanggal Order wajib diisi',
      });
      return;
    }

    const activeSalesKode =
      mh_sal_kode ||
      user?.sales_kode ||
      user?.sal_kode ||
      user?.kode_sales ||
      (user as any)?.kode ||
      '';

    let finalSubmitKain = mh_kain;
    if (mh_divisi === '5') {
      const activeMmt = masterOptions?.mmt?.find(
        (m: any) =>
          m.kategori === mmtKategori &&
          String(m.bahan_kode) === String(mmtBahanKode),
      );
      finalSubmitKain =
        activeMmt?.nama_bahan || `${mmtKategori} ${mmtBahanKode}`;
    } else if (mh_divisi === '1') {
      finalSubmitKain = spandukJenisKain || mh_kain || 'POLYESTER 50/36';
    } else if (mh_divisi === '4') {
      finalSubmitKain = garmenJenisKain || mh_kain || 'COTTON COMBED 30S';
    }

    let finalHargaKalkulasi = Number(mh_harga_kalkulasi) || 0;
    if (mh_divisi === '1' && spandukResult?.hargaSatuanPcs) {
      const hrgSpandukDenganOngkir =
        spandukResult.hargaSatuanPcs + (calculatedOngkir.ongkirPerPcs || 0);
      finalHargaKalkulasi = isIncPpn
        ? Math.round(hrgSpandukDenganOngkir * 1.11)
        : Math.round(hrgSpandukDenganOngkir);
    } else if (mh_divisi === '5' && mmtResult?.hargaSatuanPcs) {
      const hrgMmtDenganOngkir =
        mmtResult.hargaSatuanPcs + (calculatedOngkir.ongkirPerPcs || 0);
      finalHargaKalkulasi = isIncPpn
        ? Math.round(hrgMmtDenganOngkir * 1.11)
        : Math.round(hrgMmtDenganOngkir);
    } else if (mh_divisi === '4' && garmenCalcResult) {
      const rawHrg =
        garmenCalcResult.hargaUpPerPcs ||
        garmenCalcResult.hargaJualRevisi ||
        garmenCalcResult.hargaJualPerPcs ||
        garmenCalcResult.hargaJual ||
        0;
      const hrgGarmenDenganOngkir =
        rawHrg + (calculatedOngkir.ongkirPerPcs || 0);
      finalHargaKalkulasi = isIncPpn
        ? Math.round(hrgGarmenDenganOngkir * 1.11)
        : Math.round(hrgGarmenDenganOngkir);
    }

    let finalHargaPengajuan = toNumCurrency(mh_harga);
    if (finalHargaPengajuan === 0 && finalHargaKalkulasi > 0) {
      finalHargaPengajuan = finalHargaKalkulasi;
    }

    if (mh_divisi === '5' && mmtIsNetto && !mmtAlasanNetto.trim()) {
      Toast.show({
        type: 'glassError',
        text1: 'Alasan Netto Diperlukan',
        text2: 'Mohon isi alasan penggunaan Harga Netto terlebih dahulu',
      });
      return;
    }

    if (
      finalHargaKalkulasi > 0 &&
      finalHargaPengajuan > 0 &&
      finalHargaPengajuan < finalHargaKalkulasi &&
      !alasanPengajuan.trim()
    ) {
      Toast.show({
        type: 'glassError',
        text1: 'Alasan Diperlukan',
        text2:
          'Mohon isi alasan permintaan harga karena harga yang diajukan di bawah kalkulasi standar.',
      });
      return;
    }

    let finalKetKalkulasi = keteranganKalkulasi.trim();
    if (mh_divisi === '5' && mmtIsNetto && mmtAlasanNetto.trim()) {
      if (!finalKetKalkulasi.includes(mmtAlasanNetto.trim())) {
        if (finalKetKalkulasi.includes('(Netto)')) {
          finalKetKalkulasi = finalKetKalkulasi.replace(
            /\(Netto\)/i,
            `(Netto - Alasan: ${mmtAlasanNetto.trim()})`,
          );
        } else {
          finalKetKalkulasi =
            `${finalKetKalkulasi} [Alasan Netto: ${mmtAlasanNetto.trim()}]`.trim();
        }
      }
    }
    // Bersihkan prefix PPN atau alasan lama jika ada
    let cleanKet = finalKetKalkulasi
      .replace(/^(INC|EXC)\s*PPN[;,]?\s*/i, '')
      .replace(/^\[ALASAN:[^\]]+\]\s*;?\s*/i, '')
      .trim();

    const ketParts: string[] = [];
    // 1. PPN selalu di paling depan
    ketParts.push(isIncPpn ? 'INC PPN' : 'EXC PPN');

    // 2. Alasan pengajuan sales di posisi kedua
    if (alasanPengajuan.trim()) {
      ketParts.push(`[ALASAN: ${alasanPengajuan.trim()}]`);
    }

    // 3. Rincian kalkulasi lainnya
    if (cleanKet) {
      ketParts.push(cleanKet);
    }

    finalKetKalkulasi = ketParts.join('; ');

    const payload: PermintaanHargaPayload = {
      mh_divisi,
      mh_cus_kode,
      mh_cus_nama,
      mh_sal_kode: activeSalesKode,
      mh_nama,
      mh_jmlorder: toNumCurrency(mh_jmlorder),
      mh_harga: finalHargaPengajuan,
      mh_ongkir: calculatedOngkir.totalOngkir,
      kald_rpkirim: calculatedOngkir.ongkirPerPcs,
      mh_harga_kalkulasi: finalHargaKalkulasi,
      mh_ket_kalkulasi: finalKetKalkulasi,
      mh_budget: 0,
      mh_dateorder,
      mh_kain: finalSubmitKain,
      mh_panjang: toNumDecimal(mh_panjang),
      mh_lebar: toNumDecimal(mh_lebar),
      mh_ukuran,
      mh_gramasi,
      mh_finishing,
      mh_sublim,
      mh_warna: mh_divisi === '4' ? garmenWarna.toUpperCase() : '',
      mh_ket,
      mh_pro_nomor: mh_pro_nomor ? mh_pro_nomor.trim() : undefined,
      ...(mh_divisi === '4'
        ? {
            kal_kh_kode: garmenKodeModel,
            kal_rpallowance: garmenCalcResult?.komponenBiaya?.allowanceRp || 0,
            kal_allowance:
              garmenCalcResult?.komponenBiaya?.allowancePersen || 0,
            kal_rplaba: garmenCalcResult?.strataAktif?.marginRp || 0,
            kal_laba: garmenCalcResult?.strataAktif?.persen || 0,
            kal_ketbeli: garmenCalcResult?.babaran?.body
              ? `${garmenJenisKain} ${garmenCalcResult.babaran.body}/kg`
              : garmenJenisKain,
            garmen_model: garmenKodeModel,
            garmen_kain: garmenJenisKain,
            garmen_warna: garmenWarna,
            garmen_tambahan: garmenSelectedTambahan,
            garmen_cetak: garmenSelectedCetak,
            mh_workshop: garmenWorkshop === 'PREMIUM' ? 'P04' : 'P01',
            garmen_workshop: garmenWorkshop === 'PREMIUM' ? 'P04' : 'P01',
          }
        : {}),
    };

    setSaving(true);
    try {
      let targetNomor = currentNomor;
      if (mode === 'edit') {
        await updatePermintaanHarga(currentNomor, payload, token);
      } else {
        const created: any = await createPermintaanHarga(payload, token);
        targetNomor = String(created?.nomor || created?.mh_nomor || '');
        setCurrentNomor(targetNomor);
      }

      // Upload Foto jika ada yang dipilih (1 slot)
      if (targetNomor && photo?.uri) {
        try {
          await uploadPermintaanHargaImage(targetNomor, 1, photo, token);
        } catch (imgErr) {
          console.log('[PermintaanHargaForm] Upload Foto err:', imgErr);
        }
      }

      const isAutoDone =
        finalHargaKalkulasi > 0 && finalHargaPengajuan >= finalHargaKalkulasi;

      Toast.show({
        type: 'glassSuccess',
        text1: 'Pengajuan Berhasil',
        text2:
          mode === 'edit'
            ? 'Permintaan harga berhasil diperbarui'
            : isAutoDone
            ? 'Permintaan harga berhasil diajukan (Status: DONE - Disetujui)'
            : finalHargaKalkulasi <= 0
            ? 'Permintaan harga berhasil diajukan (Status: BELUM)'
            : 'Permintaan harga berhasil diajukan (Status: NEGO - Menunggu Persetujuan Nego)',
      });
      setSaving(false);
      navigation.navigate('PermintaanHargaList');
    } catch (err: any) {
      Toast.show({
        type: 'glassError',
        text1: 'Gagal Menyimpan',
        text2:
          err?.response?.data?.message || 'Gagal menyimpan permintaan harga',
      });
      setSaving(false);
    }
  };

  const selectedDivisiLabel = useMemo(() => {
    const found = DIVISI_OPTIONS.find(d => d.kode === mh_divisi);
    return found ? found.label : `${mh_divisi} - DIVISI`;
  }, [mh_divisi]);

  const renderPengirimanDanKeteranganSection = () => {
    const isTanpaOngkir = alokasiOngkir.toLowerCase() === 'tanpa ongkir';
    const isKirimDaerah = !isTanpaOngkir;
    const isFree = calculatedOngkir.isFreeCharge;

    return (
      <>
        {/* PENGIRIMAN & ONGKOS KIRIM (Menyesuaikan dengan style field form lainnya) */}
        <View style={[styles.fieldWrap, { marginTop: 10 }]}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 4,
            }}
          >
            <Text style={styles.label}>
              Pengiriman & Ongkir <Text style={styles.req}>*</Text>
            </Text>
            <TouchableOpacity
              onPress={() => setShowOngkirPopover(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: `${THEME.primary}12`,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name="help-outline"
                size={13}
                color={THEME.primary}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: THEME.primary,
                }}
              >
                Ketentuan
              </Text>
            </TouchableOpacity>
          </View>

          {/* Toggle Mode: Tanpa Ongkir vs Kirim ke Daerah */}
          <View style={styles.divisiRow}>
            <TouchableOpacity
              style={[
                styles.divisiChip,
                isTanpaOngkir && styles.divisiChipActive,
              ]}
              onPress={() => {
                setAlokasiOngkir('Tanpa Ongkir');
                setIsCustomOngkir(false);
                setCustomOngkirVal('');
                setMhOngkir('0');
                setNamaDaerahKirim('');
                setMhKet(prev => syncOngkirKet('', prev));
              }}
              activeOpacity={0.8}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <MaterialIcons
                  name="delivery-dining"
                  size={15}
                  color={isTanpaOngkir ? THEME.primary : '#64748b'}
                />
                <Text
                  style={[
                    styles.divisiChipText,
                    isTanpaOngkir && styles.divisiChipTextActive,
                  ]}
                >
                  Tanpa Ongkir
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.divisiChip,
                isKirimDaerah && styles.divisiChipActive,
              ]}
              onPress={() => {
                if (isTanpaOngkir || !alokasiOngkir) {
                  setAlokasiOngkir('');
                  const defaultDaerah = namaDaerahKirim || '';
                  setNamaDaerahKirim(defaultDaerah);
                  setMhKet(prev => syncOngkirKet(defaultDaerah, prev));
                }
                setIsCustomOngkir(false);
              }}
              activeOpacity={0.8}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <MaterialIcons
                  name="local-shipping"
                  size={15}
                  color={isKirimDaerah ? THEME.primary : '#64748b'}
                />
                <Text
                  style={[
                    styles.divisiChipText,
                    isKirimDaerah && styles.divisiChipTextActive,
                  ]}
                >
                  Dengan Ongkir
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Konten Mode */}
          {isTanpaOngkir ? (
            <View
              style={{
                marginTop: 8,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#f0fdf4',
                borderWidth: 1,
                borderColor: '#bbf7d0',
                borderRadius: 8,
                padding: 10,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  flex: 1,
                }}
              >
                <MaterialIcons name="check-circle" size={20} color="#16a34a" />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 12.5,
                      fontWeight: '700',
                      color: '#15803d',
                    }}
                  >
                    Tanpa Ongkos Kirim
                  </Text>
                  <Text
                    style={{ fontSize: 11, color: '#166534', marginTop: 1 }}
                  >
                    Harga kalkulasi tanpa tambahan ongkos kirim.
                  </Text>
                </View>
              </View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '800',
                  color: '#15803d',
                }}
              >
                Rp 0
              </Text>
            </View>
          ) : (
            <View style={{ gap: 6, marginTop: 8 }}>
              {/* Input Kota Tujuan */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#f8fafc',
                  borderWidth: 1,
                  borderColor: namaDaerahKirim ? THEME.primary : '#cbd5e1',
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  height: 42,
                  gap: 8,
                }}
              >
                <MaterialIcons
                  name="search"
                  size={18}
                  color={namaDaerahKirim ? THEME.primary : '#94a3b8'}
                />
                <TextInput
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: THEME.ink,
                    paddingVertical: 0,
                  }}
                  placeholder="Ketik kota tujuan (misal: Malang, Jambi...)"
                  placeholderTextColor="#94a3b8"
                  value={namaDaerahKirim}
                  onChangeText={text => {
                    setNamaDaerahKirim(text);
                    setMhKet(prev => syncOngkirKet(text, prev));
                    if (text.trim()) {
                      const detected = detectAlokasiFromText(
                        text,
                        activeOngkirMasterList,
                      );
                      if (detected) {
                        setAlokasiOngkir(detected.alokasi);
                        setIsCustomOngkir(false);
                      }
                    }
                  }}
                  returnKeyType="done"
                />
                {namaDaerahKirim ? (
                  <TouchableOpacity
                    onPress={() => {
                      setNamaDaerahKirim('');
                      setMhKet(prev => syncOngkirKet('', prev));
                    }}
                    style={{ padding: 4 }}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="close" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Status Alokasi Terdeteksi */}
              {namaDaerahKirim ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: `${THEME.primary}0D`,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: `${THEME.primary}25`,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      flex: 1,
                    }}
                  >
                    <MaterialIcons
                      name="auto-fix-high"
                      size={14}
                      color={THEME.primary}
                    />
                    <Text
                      style={{
                        fontSize: 11.5,
                        color: '#334155',
                        flex: 1,
                      }}
                    >
                      Alokasi:{' '}
                      <Text
                        style={{
                          fontWeight: '700',
                          color: THEME.primary,
                        }}
                      >
                        {calculatedOngkir.alokasi}
                      </Text>
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: `${THEME.primary}18`,
                      borderRadius: 4,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10.5,
                        fontWeight: '700',
                        color: THEME.primary,
                      }}
                    >
                      Rp {formatThousandsId(calculatedOngkir.tarifPerKg)}/kg
                    </Text>
                  </View>
                </View>
              ) : (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: '#f8fafc',
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                  }}
                >
                  <MaterialIcons
                    name="info-outline"
                    size={14}
                    color="#64748b"
                  />
                  <Text style={{ fontSize: 11, color: '#64748b' }}>
                    Ketik nama kota — sistem mendeteksi tarif ongkir otomatis
                  </Text>
                </View>
              )}

              {/* Ringkasan Estimasi Ongkir */}
              <View
                style={{
                  backgroundColor: '#f8fafc',
                  borderWidth: 1,
                  borderColor: isFree ? '#bbf7d0' : '#e2e8f0',
                  borderRadius: 8,
                  padding: 10,
                  gap: 6,
                }}
              >
                {/* Baris Estimasi Berat */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 11.5, color: '#64748b' }}>
                    Estimasi Berat Pesanan
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: THEME.ink,
                      }}
                    >
                      {calculatedOngkir.totalBeratKg} kg
                    </Text>
                    {calculatedOngkir.beratDihitungKg >
                      calculatedOngkir.totalBeratKg && (
                      <View
                        style={{
                          backgroundColor: '#fef3c7',
                          borderRadius: 4,
                          paddingHorizontal: 5,
                          paddingVertical: 1,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: '700',
                            color: '#b45309',
                          }}
                        >
                          {calculatedOngkir.beratDihitungKg} kg (min)
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View
                  style={{
                    height: 1,
                    backgroundColor: isFree ? '#dcfce7' : '#f1f5f9',
                  }}
                />

                {/* Baris Total Ongkir */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <View>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: isFree ? '#15803d' : THEME.ink,
                      }}
                    >
                      {isFree ? 'Bebas Ongkir' : 'Biaya Ongkir'}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10.5,
                        color: isFree ? '#166534' : '#64748b',
                        marginTop: 1,
                      }}
                    >
                      {isFree
                        ? 'Memenuhi syarat bebas ongkir'
                        : `+Rp ${formatThousandsId(
                            calculatedOngkir.ongkirPerPcs,
                          )} / pcs`}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '800',
                      color: isFree ? '#15803d' : THEME.primary,
                    }}
                  >
                    Rp {formatThousandsId(calculatedOngkir.totalOngkir)}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* FIELD KETERANGAN BERADA DI BAWAH SENDIRI */}
        <View style={[styles.fieldWrap, { marginTop: 10 }]}>
          <Text style={styles.label}>
            Keterangan <Text style={styles.req}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, { height: 65, textAlignVertical: 'top' }]}
            value={mh_ket}
            onChangeText={setMhKet}
            placeholder="Tambahkan keterangan permintaan harga..."
            placeholderTextColor="#94a3b8"
            multiline
          />
        </View>
      </>
    );
  };

  return (
    <LinearGradient
      colors={['#f8fafc', '#f1f5f9']}
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Header Area */}
      <View style={styles.headerArea}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() =>
            runGuardedPress('ph-form-back', () => navigation.goBack())
          }
          activeOpacity={0.8}
        >
          <Text style={styles.backBtnText}>Kembali</Text>
        </TouchableOpacity>

        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>
            {mode === 'edit'
              ? 'Edit Permintaan Harga'
              : 'Buat Permintaan Harga'}
          </Text>
        </View>
        <View style={styles.headerRightSpacer} />
      </View>

      {/* Modern Stepper Progress Bar */}
      <View style={styles.stepperContainer}>
        {/* Step 1 */}
        <TouchableOpacity
          style={styles.stepItem}
          onPress={() => setCurrentStep(1)}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.stepBadge,
              currentStep >= 1 && styles.stepBadgeActive,
              currentStep > 1 && styles.stepBadgeCompleted,
            ]}
          >
            {currentStep > 1 ? (
              <MaterialIcons name="check" size={14} color="#fff" />
            ) : (
              <Text
                style={[
                  styles.stepNumber,
                  currentStep >= 1 && styles.stepNumberActive,
                ]}
              >
                1
              </Text>
            )}
          </View>
          <Text
            style={[
              styles.stepLabel,
              currentStep === 1 && styles.stepLabelActive,
            ]}
          >
            Spesifikasi
          </Text>
        </TouchableOpacity>

        <View
          style={[
            styles.stepConnector,
            currentStep >= 2 && styles.stepConnectorActive,
          ]}
        />

        {/* Step 2 */}
        <TouchableOpacity
          style={styles.stepItem}
          onPress={goToStep2Kalkulasi}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.stepBadge,
              currentStep >= 2 && styles.stepBadgeActive,
              currentStep > 2 && styles.stepBadgeCompleted,
            ]}
          >
            {currentStep > 2 ? (
              <MaterialIcons name="check" size={14} color="#fff" />
            ) : (
              <Text
                style={[
                  styles.stepNumber,
                  currentStep >= 2 && styles.stepNumberActive,
                ]}
              >
                2
              </Text>
            )}
          </View>
          <Text
            style={[
              styles.stepLabel,
              currentStep === 2 && styles.stepLabelActive,
            ]}
          >
            Kalkulasi Harga
          </Text>
        </TouchableOpacity>

        <View
          style={[
            styles.stepConnector,
            currentStep >= 3 && styles.stepConnectorActive,
          ]}
        />

        {/* Step 3 */}
        <TouchableOpacity
          style={styles.stepItem}
          onPress={() => {
            if (currentStep >= 2) goToStep3Review();
          }}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.stepBadge,
              currentStep === 3 && styles.stepBadgeActive,
            ]}
          >
            <Text
              style={[
                styles.stepNumber,
                currentStep === 3 && styles.stepNumberActive,
              ]}
            >
              3
            </Text>
          </View>
          <Text
            style={[
              styles.stepLabel,
              currentStep === 3 && styles.stepLabelActive,
            ]}
          >
            Review
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content ScrollView */}
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* WIZARD LANGKAH 1: DETAIL & SPESIFIKASI BARANG */}
        {currentStep === 1 && (
          <View>
            {/* Card Pra Order (Opsional) */}
            <View style={[styles.card, { marginBottom: 12 }]}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <MaterialIcons
                    name="playlist-add-check"
                    size={20}
                    color={THEME.primary}
                  />
                  <Text style={[styles.sectionHeading, { marginBottom: 0 }]}>
                    Pra Order
                  </Text>
                </View>
                <View style={styles.optionalBadge}>
                  <Text style={styles.optionalBadgeText}>Opsional</Text>
                </View>
              </View>
              {mh_pro_nomor ? (
                <View style={styles.praOrderSelectedBox}>
                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 4,
                      }}
                    >
                      <Text style={styles.praOrderNomorText}>
                        {mh_pro_nomor}
                      </Text>
                      {selectedPraOrderDetail?.divisiNama ? (
                        <View style={styles.praOrderDivisiBadge}>
                          <Text style={styles.praOrderDivisiBadgeText}>
                            {selectedPraOrderDetail.divisiNama}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {selectedPraOrderDetail?.namaPekerjaan ? (
                      <Text
                        style={styles.praOrderPekerjaanText}
                        numberOfLines={1}
                      >
                        {selectedPraOrderDetail.namaPekerjaan}
                      </Text>
                    ) : null}
                    {selectedPraOrderDetail?.cusNama ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          marginTop: 2,
                        }}
                      >
                        <MaterialIcons
                          name="person"
                          size={14}
                          color={THEME.muted}
                        />
                        <Text
                          style={[
                            styles.praOrderItemMetaText,
                            { flexShrink: 1 },
                          ]}
                          numberOfLines={1}
                        >
                          {selectedPraOrderDetail.cusNama}
                        </Text>
                      </View>
                    ) : null}
                    {selectedPraOrderDetail?.rencanaOrder ? (
                      <Text style={styles.praOrderQtyText}>
                        Rencana Order:{' '}
                        {formatThousandsId(selectedPraOrderDetail.rencanaOrder)}{' '}
                        pcs
                      </Text>
                    ) : (
                      <Text style={styles.praOrderQtyText}>
                        Rencana Order: -
                      </Text>
                    )}
                  </View>

                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      marginLeft: 8,
                    }}
                  >
                    <TouchableOpacity
                      style={styles.praOrderChangeBtn}
                      onPress={openPraOrderPicker}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons
                        name="sync"
                        size={15}
                        color={THEME.primary}
                      />
                      <Text style={styles.praOrderChangeBtnText}>Ganti</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.praOrderDeleteBtn}
                      onPress={handleClearPraOrder}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="close" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.praOrderPickerBtn}
                  onPress={openPraOrderPicker}
                  activeOpacity={0.8}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      flex: 1,
                    }}
                  >
                    <MaterialIcons
                      name="search"
                      size={20}
                      color={THEME.primary}
                    />
                    <Text style={styles.praOrderPickerBtnText}>
                      Cari Nomor Pra Order...
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.card}>
              {currentNomor ? (
                <View style={styles.nomorBadge}>
                  <Text style={styles.nomorBadgeText}>
                    No. MH: {currentNomor}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.sectionHeading}>1. Informasi Pekerjaan</Text>

              {/* Customer Picker with Modal & Add Button */}
              <View style={styles.fieldWrap}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 6,
                  }}
                >
                  <Text style={styles.label}>
                    Nama Customer <Text style={styles.req}>*</Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.addCusQuickBtn}
                    onPress={() => {
                      runGuardedPress('ph:add-customer-quick', () => {
                        navigation.navigate('TambahCustomerPermintaanHarga');
                      });
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons
                      name="person-add"
                      size={14}
                      color={THEME.primary}
                    />
                    <Text style={styles.addCusQuickText}>+ Customer Baru</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.customerPickerInput}
                  onPress={openCustomerPicker}
                  activeOpacity={0.85}
                >
                  <View style={{ flex: 1 }}>
                    {mh_cus_nama ? (
                      <View>
                        <Text
                          style={styles.customerSelectedName}
                          numberOfLines={1}
                        >
                          {mh_cus_nama}
                        </Text>
                        {mh_cus_kode ? (
                          <Text style={styles.customerSelectedCode}>
                            Kode: {mh_cus_kode}
                          </Text>
                        ) : null}
                      </View>
                    ) : (
                      <Text style={styles.customerPlaceholderText}>
                        Pilih customer...
                      </Text>
                    )}
                  </View>
                  <View style={styles.customerPickerIcons}>
                    {mh_cus_nama ? (
                      <TouchableOpacity
                        onPress={() => {
                          setMhCusKode('');
                          setMhCusNama('');
                        }}
                        style={{ padding: 4, marginRight: 4 }}
                      >
                        <MaterialIcons name="close" size={18} color="#94a3b8" />
                      </TouchableOpacity>
                    ) : null}
                    <MaterialIcons
                      name="search"
                      size={20}
                      color={THEME.primary}
                    />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Nama Pekerjaan */}
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>
                  Nama Pekerjaan<Text style={styles.req}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={mh_nama}
                  onChangeText={setMhNama}
                  placeholder="Contoh: Banner HUT RI 2x1m"
                />
              </View>

              {/* Rencana Tanggal Order */}
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>
                  Rencana Tanggal Order <Text style={styles.req}>*</Text>
                </Text>
                <TouchableOpacity
                  style={styles.datePickerBtn}
                  onPress={() => setShowDateOrderPicker(true)}
                >
                  <Text style={styles.datePickerBtnText}>
                    {formatDateOrderDisplay(mh_dateorder) ||
                      'Pilih tanggal rencana order'}
                  </Text>
                  <MaterialIcons name="event" size={18} color={THEME.muted} />
                </TouchableOpacity>
              </View>

              {/* Divisi Selector */}
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>
                  Divisi<Text style={styles.req}>*</Text>
                </Text>
                <View style={styles.divisiRow}>
                  {DIVISI_OPTIONS.map(d => (
                    <TouchableOpacity
                      key={d.kode}
                      style={[
                        styles.divisiChip,
                        mh_divisi === d.kode && styles.divisiChipActive,
                      ]}
                      onPress={() => {
                        setMhDivisi(d.kode);
                        if (d.kode === '1') {
                          setSpandukLebar(90);
                          setMhLebar('90');
                          setMhKain(spandukJenisKain);
                        } else if (d.kode === '5') {
                          const activeMmt = masterOptions?.mmt?.find(
                            (m: any) =>
                              m.kategori === mmtKategori &&
                              String(m.bahan_kode) === String(mmtBahanKode),
                          );
                          setMhKain(
                            activeMmt?.nama_bahan ||
                              `${mmtKategori} ${mmtBahanKode}`,
                          );
                        } else if (d.kode === '4') {
                          setMhKain(garmenJenisKain || 'COTTON COMBED 30S');
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.divisiChipText,
                          mh_divisi === d.kode && styles.divisiChipTextActive,
                        ]}
                      >
                        {d.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {mh_divisi === '4' ? (
              <View style={[styles.card, { marginTop: 12 }]}>
                <Text style={styles.sectionHeading}>2. Spesifikasi Garmen</Text>

                {/* Model (1 & 2 Warna) */}
                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>
                    Model<Text style={styles.req}>*</Text>
                  </Text>
                  <View style={styles.divisiRow}>
                    <TouchableOpacity
                      style={[
                        styles.divisiChip,
                        { flex: 1 },
                        garmenKodeModel === 'KH-0001' &&
                          styles.divisiChipActive,
                      ]}
                      onPress={() => setGarmenKodeModel('KH-0001')}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.divisiChipText,
                          garmenKodeModel === 'KH-0001' &&
                            styles.divisiChipTextActive,
                        ]}
                      >
                        1 Warna
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.divisiChip,
                        { flex: 1, marginLeft: 8 },
                        garmenKodeModel === 'KH-0002' &&
                          styles.divisiChipActive,
                      ]}
                      onPress={() => setGarmenKodeModel('KH-0002')}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.divisiChipText,
                          garmenKodeModel === 'KH-0002' &&
                            styles.divisiChipTextActive,
                        ]}
                      >
                        2 Warna
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Workshop Garmen (khusus GARMEN) - checklist MEDIUM/PREMIUM default MEDIUM */}
                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>
                    Workshop <Text style={styles.req}>*</Text>
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 24,
                      marginTop: 4,
                    }}
                  >
                    {(['MEDIUM', 'PREMIUM'] as const).map(ws => {
                      const isChecked = garmenWorkshop === ws;
                      return (
                        <TouchableOpacity
                          key={ws}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            paddingVertical: 4,
                          }}
                          activeOpacity={0.7}
                          onPress={() => setGarmenWorkshop(ws)}
                        >
                          <MaterialIcons
                            name={
                              isChecked
                                ? 'check-box'
                                : 'check-box-outline-blank'
                            }
                            size={22}
                            color={isChecked ? THEME.primary : '#94a3b8'}
                          />
                          <Text
                            style={{
                              fontSize: 14,
                              color: isChecked ? THEME.ink : '#64748b',
                              fontWeight: isChecked ? '700' : '500',
                            }}
                          >
                            {ws} {ws === 'MEDIUM' ? '(P01)' : '(P04)'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Jenis Kain (Lookup) */}
                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>
                    Jenis Kain <Text style={styles.req}>*</Text>
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.input,
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      },
                    ]}
                    onPress={() => setModalGarmenKainVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color: garmenJenisKain ? THEME.ink : '#94a3b8',
                        fontWeight: garmenJenisKain ? '600' : '400',
                      }}
                    >
                      {garmenJenisKain || 'Pilih Jenis Kain...'}
                    </Text>
                    <MaterialIcons
                      name="arrow-drop-down"
                      size={24}
                      color="#64748b"
                    />
                  </TouchableOpacity>
                </View>

                {/* Warna (Muda, Sedang, Tua) */}
                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>
                    Warna Kain <Text style={styles.req}>*</Text>
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['muda', 'sedang', 'tua'] as const).map(w => (
                      <TouchableOpacity
                        key={w}
                        style={[
                          styles.divisiChip,
                          { flex: 1 },
                          garmenWarna.toLowerCase() === w &&
                            styles.divisiChipActive,
                        ]}
                        onPress={() => setGarmenWarna(w)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.divisiChipText,
                            { textTransform: 'capitalize' },
                            garmenWarna.toLowerCase() === w &&
                              styles.divisiChipTextActive,
                          ]}
                        >
                          {w}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Rencana Order (Pcs) */}
                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>
                    Rencana Order (Pcs) <Text style={styles.req}>*</Text>
                  </Text>
                  <TextInput
                    style={[styles.input, { fontWeight: '700', fontSize: 15 }]}
                    value={mh_jmlorder}
                    onChangeText={val => {
                      const digits = onlyDigits(val);
                      setMhJmlorder(digits ? formatThousandsId(digits) : '');
                    }}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>

                {/* Rincian Ukuran / Size (Opsional) */}
                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>
                    Rincian Ukuran / Size{' '}
                    <Text
                      style={{
                        fontSize: 11,
                        color: '#94a3b8',
                        fontWeight: '400',
                      }}
                    >
                      (Opsional)
                    </Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={mh_ukuran}
                    onChangeText={setMhUkuran}
                    placeholder="Misal: XL= 3, L = 2, M = 5"
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                {/* Gramasi Kain (Otomatis dari Jenis Kain) */}
                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>
                    Gramasi{' '}
                    <Text
                      style={{
                        fontSize: 11,
                        color: '#94a3b8',
                        fontWeight: '400',
                      }}
                    >
                      (Otomatis / Opsional)
                    </Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={mh_gramasi}
                    onChangeText={setMhGramasi}
                    placeholder="Misal: 140-150 GR"
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                {/* Finishing Garmen */}
                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>
                    Finishing{' '}
                    <Text
                      style={{
                        fontSize: 11,
                        color: '#94a3b8',
                        fontWeight: '400',
                      }}
                    >
                      (Opsional)
                    </Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={mh_finishing}
                    onChangeText={setMhFinishing}
                    placeholder="Misal: Lipat rapi, packing plastik"
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                {/* Sublim Garmen (Checklist) */}
                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>
                    Sublim{' '}
                    <Text
                      style={{
                        fontSize: 11,
                        color: '#94a3b8',
                        fontWeight: '400',
                      }}
                    >
                      (Opsional)
                    </Text>
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 24,
                      marginTop: 4,
                    }}
                  >
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingVertical: 4,
                      }}
                      activeOpacity={0.7}
                      onPress={() =>
                        setMhSublim(prev =>
                          prev === 'PREMIUM' ? '' : 'PREMIUM',
                        )
                      }
                    >
                      <MaterialIcons
                        name={
                          mh_sublim === 'PREMIUM'
                            ? 'check-box'
                            : 'check-box-outline-blank'
                        }
                        size={22}
                        color={
                          mh_sublim === 'PREMIUM' ? THEME.primary : '#94a3b8'
                        }
                      />
                      <Text
                        style={{
                          fontSize: 14,
                          color:
                            mh_sublim === 'PREMIUM' ? THEME.ink : '#64748b',
                          fontWeight: mh_sublim === 'PREMIUM' ? '700' : '500',
                        }}
                      >
                        Premium
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingVertical: 4,
                      }}
                      activeOpacity={0.7}
                      onPress={() =>
                        setMhSublim(prev => (prev === 'MEDIUM' ? '' : 'MEDIUM'))
                      }
                    >
                      <MaterialIcons
                        name={
                          mh_sublim === 'MEDIUM'
                            ? 'check-box'
                            : 'check-box-outline-blank'
                        }
                        size={22}
                        color={
                          mh_sublim === 'MEDIUM' ? THEME.primary : '#94a3b8'
                        }
                      />
                      <Text
                        style={{
                          fontSize: 14,
                          color: mh_sublim === 'MEDIUM' ? THEME.ink : '#64748b',
                          fontWeight: mh_sublim === 'MEDIUM' ? '700' : '500',
                        }}
                      >
                        Medium
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Pengiriman & Ongkir di bawah Sublim, Keterangan di paling bawah */}
                {renderPengirimanDanKeteranganSection()}
              </View>
            ) : (
              <View style={[styles.card, { marginTop: 12 }]}>
                <Text style={styles.sectionHeading}>
                  2. Dimensi & Kuantitas
                </Text>

                {/* Pilihan Metode Cetak Spanduk (Divisi 1) */}
                {mh_divisi === '1' && (
                  <View style={styles.fieldWrap}>
                    <Text style={styles.label}>
                      Metode Cetak <Text style={styles.req}>*</Text>
                    </Text>
                    <View style={styles.divisiRow}>
                      {availableSpandukMetode.map(met => {
                        const isSel =
                          spandukMetode.toUpperCase() === met.toUpperCase();
                        return (
                          <TouchableOpacity
                            key={met}
                            style={[
                              styles.divisiChip,
                              { flex: 1 },
                              isSel && styles.divisiChipActive,
                            ]}
                            onPress={() =>
                              handleSelectSpandukMetode(
                                met as 'MANUAL' | 'MACHINE',
                              )
                            }
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.divisiChipText,
                                isSel && styles.divisiChipTextActive,
                              ]}
                            >
                              {met === 'MANUAL' ? 'Manual' : 'Machine'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Pilihan Jenis Kain Spanduk Dinamis berdasarkan Metode Cetak (Divisi 1) */}
                {mh_divisi === '1' && (
                  <View style={styles.fieldWrap}>
                    <Text style={styles.label}>
                      Jenis Kain Spanduk <Text style={styles.req}>*</Text>
                    </Text>
                    <View style={styles.radioRow}>
                      {availableSpandukKain.map(kain => {
                        const isSel =
                          (mh_kain || '').toUpperCase() ===
                            kain.toUpperCase() ||
                          spandukJenisKain.toUpperCase() === kain.toUpperCase();
                        return (
                          <TouchableOpacity
                            key={kain}
                            style={[
                              styles.chipBtn,
                              isSel && styles.chipBtnActive,
                            ]}
                            onPress={() => handleSelectSpandukKain(kain)}
                          >
                            <Text
                              style={[
                                styles.chipBtnText,
                                isSel && styles.chipBtnTextActive,
                              ]}
                            >
                              {kain}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Dimensi P x L */}
                <View style={styles.rowField2}>
                  <View style={[styles.fieldWrap, { flex: 1 }]}>
                    <Text style={styles.label}>
                      Panjang (Mtr) <Text style={styles.req}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={mh_panjang}
                      onChangeText={val =>
                        setMhPanjang(sanitizeDecimalInput(val))
                      }
                      placeholder="Misal: 2"
                      keyboardType="decimal-pad"
                    />
                  </View>
                  {mh_divisi !== '1' && (
                    <View
                      style={[styles.fieldWrap, { flex: 1, marginLeft: 10 }]}
                    >
                      <Text style={styles.label}>
                        Lebar (Mtr) <Text style={styles.req}>*</Text>
                      </Text>
                      <TextInput
                        style={styles.input}
                        value={mh_lebar}
                        onChangeText={val =>
                          setMhLebar(sanitizeDecimalInput(val))
                        }
                        placeholder="Misal: 1"
                        keyboardType="decimal-pad"
                      />
                    </View>
                  )}
                </View>

                {/* Pilihan Lebar Dinamis yang Difilter Berdasarkan Metode & Jenis Kain (Divisi 1) */}
                {mh_divisi === '1' && (
                  <View style={styles.fieldWrap}>
                    <Text style={styles.label}>
                      Lebar Spanduk (cm) <Text style={styles.req}>*</Text>
                    </Text>
                    <View style={styles.radioRow}>
                      {availableSpandukLebar.map(leb => {
                        const isSel =
                          toNumDecimal(mh_lebar) === leb ||
                          (!mh_lebar && spandukLebar === leb);
                        return (
                          <TouchableOpacity
                            key={leb}
                            style={[
                              styles.chipBtn,
                              isSel && styles.chipBtnActive,
                            ]}
                            onPress={() => {
                              setMhLebar(String(leb));
                              setSpandukLebar(leb);
                            }}
                          >
                            <Text
                              style={[
                                styles.chipBtnText,
                                isSel && styles.chipBtnTextActive,
                              ]}
                            >
                              {leb} cm
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Jumlah Order */}
                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>
                    Jumlah Order (Pcs) <Text style={styles.req}>*</Text>
                  </Text>
                  {(() => {
                    const numPanjang = toNumDecimal(mh_panjang);
                    const numLebar =
                      toNumDecimal(mh_lebar) || spandukLebar || 90;
                    const numQty = toNumCurrency(mh_jmlorder);
                    const totalLuasM2 = numPanjang * (numLebar / 100) * numQty;
                    const isManualAllowed = numQty >= 100 || totalLuasM2 >= 500;
                    const isManualNotAllowed =
                      mh_divisi === '1' &&
                      spandukMetode === 'MANUAL' &&
                      numQty > 0 &&
                      !isManualAllowed;

                    return (
                      <>
                        <TextInput
                          style={[
                            styles.input,
                            { fontWeight: '700', fontSize: 15 },
                            isManualNotAllowed && {
                              borderColor: '#ef4444',
                              backgroundColor: '#fef2f2',
                            },
                          ]}
                          value={mh_jmlorder}
                          onChangeText={val => {
                            const digits = onlyDigits(val);
                            setMhJmlorder(
                              digits ? formatThousandsId(digits) : '',
                            );
                          }}
                          placeholder="0"
                          keyboardType="numeric"
                        />

                        {/* Banner Informasi & Peringatan Batas Minimal Cetak Manual */}
                        {isManualNotAllowed && (
                          <View
                            style={{
                              marginTop: 8,
                              padding: 10,
                              backgroundColor: '#fffbeb',
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: '#fde68a',
                            }}
                          >
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
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
                                  name="warning"
                                  size={18}
                                  color="#d97706"
                                />
                                <Text
                                  style={{
                                    fontSize: 12,
                                    fontWeight: '700',
                                    color: '#b45309',
                                  }}
                                >
                                  Ketentuan Cetak Manual Belum Terpenuhi
                                </Text>
                                <TouchableOpacity
                                  onPress={() =>
                                    setShowManualSpandukPopover(true)
                                  }
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 2,
                                    backgroundColor: '#fef3c7',
                                    borderWidth: 1,
                                    borderColor: '#fde68a',
                                    borderRadius: 12,
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                  }}
                                  activeOpacity={0.7}
                                >
                                  <MaterialIcons
                                    name="info-outline"
                                    size={13}
                                    color="#b45309"
                                  />
                                </TouchableOpacity>
                              </View>
                            </View>
                            <TouchableOpacity
                              style={{
                                marginTop: 8,
                                alignSelf: 'flex-start',
                                backgroundColor: '#d97706',
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 6,
                              }}
                              onPress={() =>
                                handleSelectSpandukMetode('MACHINE')
                              }
                              activeOpacity={0.8}
                            >
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: '700',
                                  color: '#fff',
                                }}
                              >
                                Beralih ke Cetak Machine
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </>
                    );
                  })()}
                </View>

                {/* Pilihan Kategori & Bahan MMT Dinamis (Divisi 5) */}
                {mh_divisi === '5' && (
                  <View style={styles.fieldWrap}>
                    <Text style={styles.label}>Kategori Bahan</Text>
                    <View style={styles.radioRow}>
                      {availableMmtKategori.map(kat => (
                        <TouchableOpacity
                          key={kat}
                          style={[
                            styles.chipBtn,
                            mmtKategori === kat && styles.chipBtnActive,
                          ]}
                          onPress={() => {
                            setMmtKategori(kat);
                            const firstBahan = masterOptions?.mmt?.find(
                              (m: any) => m.kategori === kat,
                            );
                            if (firstBahan?.bahan_kode) {
                              setMmtBahanKode(firstBahan.bahan_kode);
                              setMhKain(
                                firstBahan.nama_bahan || firstBahan.bahan_kode,
                              );
                            } else if (kat === 'VYNIL') {
                              setMmtBahanKode('260');
                              setMhKain('Frontlite 260');
                            } else if (kat === 'HI-RES') {
                              setMmtBahanKode('340');
                              setMhKain('Hi-Res 340');
                            } else {
                              setMmtBahanKode('GRAFTAC');
                              setMhKain('Sticker Graftac');
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.chipBtnText,
                              mmtKategori === kat && styles.chipBtnTextActive,
                            ]}
                          >
                            {kat}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={[styles.label, { marginTop: 10 }]}>
                      Pilihan Bahan MMT <Text style={styles.req}>*</Text>
                    </Text>
                    <View style={styles.radioRow}>
                      {currentMmtBahanList.map(b => {
                        const isSel =
                          mmtBahanKode === b.kode ||
                          (mh_kain &&
                            (mh_kain.toLowerCase() === b.nama.toLowerCase() ||
                              mh_kain.toLowerCase() === b.kode.toLowerCase()));
                        return (
                          <TouchableOpacity
                            key={b.kode}
                            style={[
                              styles.chipBtn,
                              isSel && styles.chipBtnActive,
                            ]}
                            onPress={() => {
                              setMmtBahanKode(b.kode);
                              setMhKain(b.nama || b.kode);
                            }}
                          >
                            <Text
                              style={[
                                styles.chipBtnText,
                                isSel && styles.chipBtnTextActive,
                              ]}
                            >
                              {b.nama || b.kode}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Input Fallback untuk Divisi Lain */}
                {mh_divisi !== '1' &&
                  mh_divisi !== '5' &&
                  mh_divisi !== '4' && (
                    <View style={styles.fieldWrap}>
                      <Text style={styles.label}>Jenis Kain / Bahan</Text>
                      <TextInput
                        style={styles.input}
                        value={mh_kain}
                        onChangeText={setMhKain}
                        placeholder="Contoh: Polyester / Frontlite"
                      />
                    </View>
                  )}
                {/* Info Keterangan Luas Spesifikasi */}
                {(() => {
                  const numPanjang = toNumDecimal(mh_panjang);
                  const numLebar =
                    mh_divisi === '1'
                      ? (toNumDecimal(mh_lebar) || spandukLebar || 90) / 100
                      : toNumDecimal(mh_lebar);
                  const numQty = toNumCurrency(mh_jmlorder);
                  const luasPerPcs = numPanjang * numLebar;
                  const totalLuas = luasPerPcs * (numQty > 0 ? numQty : 1);

                  if (luasPerPcs <= 0) return null;

                  return (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: 12,
                        marginTop: -2,
                        paddingHorizontal: 2,
                      }}
                    >
                      <MaterialIcons
                        name="straighten"
                        size={14}
                        color="#64748b"
                        style={{ marginRight: 4 }}
                      />
                      <Text style={{ fontSize: 11.5, color: '#64748b' }}>
                        Luas:{' '}
                        <Text style={{ fontWeight: '600', color: THEME.ink }}>
                          {luasPerPcs.toFixed(2)} m²/pcs
                        </Text>
                        {numQty > 0 ? (
                          <Text>
                            {'  •  Total: '}
                            <Text
                              style={{
                                fontWeight: '700',
                                color: THEME.primary,
                              }}
                            >
                              {totalLuas.toFixed(1)} m²
                            </Text>
                          </Text>
                        ) : null}
                      </Text>
                    </View>
                  );
                })()}
                {/* Finishing & Keterangan */}
                <View style={styles.fieldWrap}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                    }}
                  >
                    <Text style={[styles.label, { marginBottom: 0 }]}>
                      Finishing (Tanpa Kalkulasi)
                    </Text>
                    <TouchableOpacity
                      onPress={() => setFinishingInfoType('tanpa_kalkulasi')}
                      style={{
                        paddingVertical: 2,
                        paddingHorizontal: 4,
                      }}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialIcons
                        name="help-outline"
                        size={17}
                        color="#64748b"
                      />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={mh_finishing}
                    onChangeText={setMhFinishing}
                    placeholder="Contoh: Mata ayam 4 pojok, Jahit selongsong"
                  />

                  {/* Pilihan Finishing Khusus Divisi Spanduk (Master) */}
                  {mh_divisi === '1' &&
                    masterOptions?.spandukTambahan &&
                    masterOptions.spandukTambahan.length > 0 && (
                      <View
                        style={{
                          marginTop: 10,
                          backgroundColor: '#f8fafc',
                          borderRadius: 10,
                          padding: 10,
                          borderWidth: 1,
                          borderColor: '#e2e8f0',
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 6,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '700',
                              color: '#0f172a',
                            }}
                          >
                            Pilihan Finishing Spanduk (Include Kalkulasi):
                          </Text>
                          <TouchableOpacity
                            onPress={() =>
                              setFinishingInfoType('include_kalkulasi')
                            }
                            style={{
                              paddingVertical: 2,
                              paddingHorizontal: 4,
                            }}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <MaterialIcons
                              name="help-outline"
                              size={16}
                              color="#0284c7"
                            />
                          </TouchableOpacity>
                        </View>
                        <View
                          style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: 6,
                          }}
                        >
                          {masterOptions.spandukTambahan.map((item: any) => {
                            const isSelected = spandukFinishingIds.includes(
                              item.id,
                            );
                            return (
                              <TouchableOpacity
                                key={item.id}
                                style={[
                                  styles.chipBtn,
                                  isSelected && styles.chipBtnActive,
                                ]}
                                onPress={() =>
                                  handleToggleSpandukFinishing(item.id)
                                }
                              >
                                <Text
                                  style={[
                                    styles.chipBtnText,
                                    isSelected && styles.chipBtnTextActive,
                                  ]}
                                >
                                  {item.nama} (Rp{' '}
                                  {formatThousandsId(item.tarif)}
                                  {item.satuan || ''})
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                  {/* Checklist Selongsong Khusus Divisi MMT */}
                  {mh_divisi === '5' && (
                    <View
                      style={{
                        marginTop: 10,
                        backgroundColor: '#f8fafc',
                        borderRadius: 10,
                        padding: 10,
                        borderWidth: 1,
                        borderColor: '#e2e8f0',
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 8,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '700',
                              color: '#334155',
                            }}
                          >
                            Finishing Selongsong
                          </Text>
                          <TouchableOpacity
                            onPress={() =>
                              setFinishingInfoType('include_kalkulasi')
                            }
                            style={{ padding: 2 }}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <MaterialIcons
                              name="help-outline"
                              size={16}
                              color="#0284c7"
                            />
                          </TouchableOpacity>
                        </View>
                        {(mmtSelongsongVert || mmtSelongsongHoriz) && (
                          <View
                            style={{
                              backgroundColor: '#e0f2fe',
                              borderRadius: 4,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: '700',
                                color: '#0369a1',
                              }}
                            >
                              Plus Selongsong
                            </Text>
                          </View>
                        )}
                      </View>

                      <View
                        style={{
                          flexDirection: 'row',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        {/* Selongsong Vertikal */}
                        <TouchableOpacity
                          style={[
                            styles.ppnCheckboxCard,
                            {
                              flex: 1,
                              minWidth: 140,
                              marginTop: 0,
                              paddingVertical: 8,
                              paddingHorizontal: 10,
                            },
                            mmtSelongsongVert && {
                              borderColor: '#0284c7',
                              backgroundColor: '#f0f9ff',
                            },
                          ]}
                          onPress={handleToggleSelongsongVert}
                          activeOpacity={0.8}
                        >
                          <View style={styles.ppnCheckboxLeft}>
                            <MaterialIcons
                              name={
                                mmtSelongsongVert
                                  ? 'check-box'
                                  : 'check-box-outline-blank'
                              }
                              size={20}
                              color={mmtSelongsongVert ? '#0284c7' : '#94a3b8'}
                            />
                            <View style={{ marginLeft: 6, flex: 1 }}>
                              <Text
                                style={[
                                  styles.ppnCheckboxLabel,
                                  { fontSize: 12 },
                                  mmtSelongsongVert && {
                                    color: '#0369a1',
                                    fontWeight: '700',
                                  },
                                ]}
                              >
                                Vertikal
                              </Text>
                              <Text
                                style={[
                                  styles.ppnCheckboxSub,
                                  { fontSize: 10 },
                                ]}
                              >
                                0.2 x P ({mh_panjang || 0} m)
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>

                        {/* Selongsong Horizontal */}
                        <TouchableOpacity
                          style={[
                            styles.ppnCheckboxCard,
                            {
                              flex: 1,
                              minWidth: 140,
                              marginTop: 0,
                              paddingVertical: 8,
                              paddingHorizontal: 10,
                            },
                            mmtSelongsongHoriz && {
                              borderColor: '#0284c7',
                              backgroundColor: '#f0f9ff',
                            },
                          ]}
                          onPress={handleToggleSelongsongHoriz}
                          activeOpacity={0.8}
                        >
                          <View style={styles.ppnCheckboxLeft}>
                            <MaterialIcons
                              name={
                                mmtSelongsongHoriz
                                  ? 'check-box'
                                  : 'check-box-outline-blank'
                              }
                              size={20}
                              color={mmtSelongsongHoriz ? '#0284c7' : '#94a3b8'}
                            />
                            <View style={{ marginLeft: 6, flex: 1 }}>
                              <Text
                                style={[
                                  styles.ppnCheckboxLabel,
                                  { fontSize: 12 },
                                  mmtSelongsongHoriz && {
                                    color: '#0369a1',
                                    fontWeight: '700',
                                  },
                                ]}
                              >
                                Horizontal
                              </Text>
                              <Text
                                style={[
                                  styles.ppnCheckboxSub,
                                  { fontSize: 10 },
                                ]}
                              >
                                0.2 x L ({mh_lebar || 0} m)
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>
                    Sublim{' '}
                    <Text
                      style={{
                        fontSize: 11,
                        color: '#94a3b8',
                        fontWeight: '400',
                      }}
                    >
                      (Opsional)
                    </Text>
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 24,
                      marginTop: 4,
                    }}
                  >
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingVertical: 4,
                      }}
                      activeOpacity={0.7}
                      onPress={() =>
                        setMhSublim(prev =>
                          prev === 'PREMIUM' ? '' : 'PREMIUM',
                        )
                      }
                    >
                      <MaterialIcons
                        name={
                          mh_sublim === 'PREMIUM'
                            ? 'check-box'
                            : 'check-box-outline-blank'
                        }
                        size={22}
                        color={
                          mh_sublim === 'PREMIUM' ? THEME.primary : '#94a3b8'
                        }
                      />
                      <Text
                        style={{
                          fontSize: 14,
                          color:
                            mh_sublim === 'PREMIUM' ? THEME.ink : '#64748b',
                          fontWeight: mh_sublim === 'PREMIUM' ? '700' : '500',
                        }}
                      >
                        Premium
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingVertical: 4,
                      }}
                      activeOpacity={0.7}
                      onPress={() =>
                        setMhSublim(prev => (prev === 'MEDIUM' ? '' : 'MEDIUM'))
                      }
                    >
                      <MaterialIcons
                        name={
                          mh_sublim === 'MEDIUM'
                            ? 'check-box'
                            : 'check-box-outline-blank'
                        }
                        size={22}
                        color={
                          mh_sublim === 'MEDIUM' ? THEME.primary : '#94a3b8'
                        }
                      />
                      <Text
                        style={{
                          fontSize: 14,
                          color: mh_sublim === 'MEDIUM' ? THEME.ink : '#64748b',
                          fontWeight: mh_sublim === 'MEDIUM' ? '700' : '500',
                        }}
                      >
                        Medium
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Pengiriman & Ongkir di bawah Sublim, Keterangan di paling bawah */}
                {renderPengirimanDanKeteranganSection()}
              </View>
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* WIZARD LANGKAH 2: KALKULASI & REVIEW HARGA */}
        {/* ========================================================================= */}
        {currentStep === 2 && (
          <View>
            {/* Box Ringkasan Spesifikasi yang diinput di Langkah 1 */}
            <View style={styles.specSummaryBox}>
              <View style={styles.specSummaryHeaderRow}>
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <MaterialIcons
                    name="assignment"
                    size={16}
                    color={THEME.primary}
                  />
                  <Text style={styles.specSummaryTitle}>
                    Spesifikasi Terinput
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.specEditBtn}
                  onPress={() => setCurrentStep(1)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="edit" size={13} color={THEME.primary} />
                  <Text style={styles.specEditText}>Ubah</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.specSummaryGrid}>
                {/* Baris 1: Customer & Nama Pekerjaan */}
                <View style={styles.specGridRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.specGridLabel}>Customer</Text>
                    <Text style={styles.specGridValue} numberOfLines={1}>
                      {mh_cus_nama || '-'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.specGridLabel}>Nama Pekerjaan</Text>
                    <Text style={styles.specGridValue} numberOfLines={1}>
                      {mh_nama || '-'}
                    </Text>
                  </View>
                </View>

                {/* Baris 2: Divisi & Rencana Tanggal Order */}
                <View style={[styles.specGridRow, { marginTop: 6 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.specGridLabel}>Divisi</Text>
                    <Text style={styles.specGridValue}>
                      {selectedDivisiLabel}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.specGridLabel}>Rencana Tgl Order</Text>
                    <Text style={styles.specGridValue}>
                      {formatDateOrderDisplay(mh_dateorder) || '-'}
                    </Text>
                  </View>
                </View>

                {/* Baris 3: Spesifikasi Bahan & Dimensi Ukuran */}
                <View style={[styles.specGridRow, { marginTop: 6 }]}>
                  {mh_divisi === '4' ? (
                    <>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.specGridLabel}>Model & Warna</Text>
                        <Text style={styles.specGridValue}>
                          {garmenKodeModel === 'KH-0001'
                            ? '1 Warna'
                            : '2 Warna'}{' '}
                          ({garmenWarna})
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.specGridLabel}>Jenis Kain</Text>
                        <Text style={styles.specGridValue} numberOfLines={1}>
                          {garmenJenisKain || '-'}
                        </Text>
                      </View>
                    </>
                  ) : mh_divisi === '1' ? (
                    <>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.specGridLabel}>Kain Spanduk</Text>
                        <Text style={styles.specGridValue} numberOfLines={1}>
                          {spandukJenisKain ||
                            mh_kain ||
                            availableSpandukKain[0] ||
                            '-'}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.specGridLabel}>Ukuran (P x L)</Text>
                        <Text style={styles.specGridValue}>
                          {mh_panjang || 0} m x {mh_lebar || spandukLebar || 0}{' '}
                          cm
                        </Text>
                      </View>
                    </>
                  ) : mh_divisi === '5' ? (
                    <>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.specGridLabel}>
                          Kategori & Bahan MMT
                        </Text>
                        <Text style={styles.specGridValue} numberOfLines={1}>
                          {mmtKategori} - {mmtBahanKode}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.specGridLabel}>Ukuran (P x L)</Text>
                        <Text style={styles.specGridValue}>
                          {mh_panjang || 0} m x {mh_lebar || 0} m
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.specGridLabel}>Bahan / Kain</Text>
                        <Text style={styles.specGridValue} numberOfLines={1}>
                          {mh_kain || '-'}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.specGridLabel}>Ukuran</Text>
                        <Text style={styles.specGridValue}>
                          {mh_panjang
                            ? `${mh_panjang} m x ${mh_lebar} m`
                            : mh_ukuran || '-'}
                        </Text>
                      </View>
                    </>
                  )}
                </View>

                {/* Baris 4: Kuantitas Order & Finishing */}
                <View style={[styles.specGridRow, { marginTop: 6 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.specGridLabel}>Jumlah Order</Text>
                    <Text
                      style={[
                        styles.specGridValue,
                        { fontWeight: '800', color: THEME.primary },
                      ]}
                    >
                      {formatThousandsId(mh_jmlorder || 0)} Pcs
                    </Text>
                  </View>
                  {mh_finishing ? (
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.specGridLabel}>Finishing</Text>
                      <Text style={styles.specGridValue} numberOfLines={1}>
                        {mh_finishing}
                      </Text>
                    </View>
                  ) : null}
                  {mh_sublim ? (
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.specGridLabel}>Sublim</Text>
                      <Text style={styles.specGridValue} numberOfLines={1}>
                        {mh_sublim}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Baris 5: Pengiriman & Estimasi Ongkir */}
                <View style={[styles.specGridRow, { marginTop: 6 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.specGridLabel}>Pengiriman</Text>
                    <Text style={styles.specGridValue} numberOfLines={1}>
                      {calculatedOngkir.alokasi}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.specGridLabel}>Estimasi Ongkir</Text>
                    <Text
                      style={[
                        styles.specGridValue,
                        {
                          color: calculatedOngkir.isFreeCharge
                            ? '#15803d'
                            : '#0284c7',
                          fontWeight: '700',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {calculatedOngkir.isFreeCharge
                        ? 'GRATIS'
                        : `Rp ${formatThousandsId(
                            calculatedOngkir.totalOngkir,
                          )} (+Rp ${formatThousandsId(
                            calculatedOngkir.ongkirPerPcs,
                          )}/pcs)`}
                    </Text>
                  </View>
                </View>

                {/* Baris 6: Keterangan Tambahan */}
                {mh_ket ? (
                  <View
                    style={{
                      marginTop: 6,
                      paddingTop: 6,
                      borderTopWidth: 1,
                      borderTopColor: '#dbeafe',
                    }}
                  >
                    <Text style={styles.specGridLabel}>Keterangan</Text>
                    <Text
                      style={[
                        styles.specGridValue,
                        { fontStyle: 'italic', fontSize: 11, color: '#475569' },
                      ]}
                    >
                      {mh_ket}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* KALKULASI DIVISI 1: SPANDUK KAIN */}
            {mh_divisi === '1' && (
              <View style={styles.card}>
                <View style={styles.engineCardHeaderRow}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      flex: 1,
                    }}
                  >
                    <MaterialIcons
                      name="view-in-ar"
                      size={20}
                      color={THEME.primary}
                    />
                    <Text style={styles.engineCardTitle}>Kalkulasi Harga</Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.recalcHeaderBtn,
                      isSpandukStale && styles.recalcHeaderBtnStale,
                    ]}
                    onPress={() => handleHitungSpanduk()}
                    disabled={spandukLoading}
                  >
                    {spandukLoading ? (
                      <ActivityIndicator
                        size="small"
                        color={isSpandukStale ? '#fff' : THEME.primary}
                      />
                    ) : (
                      <>
                        <MaterialIcons
                          name="sync"
                          size={15}
                          color={isSpandukStale ? '#fff' : THEME.primary}
                        />
                        <Text
                          style={[
                            styles.recalcHeaderBtnText,
                            isSpandukStale && styles.recalcHeaderBtnTextStale,
                          ]}
                        >
                          {isSpandukStale ? 'Hitung Ulang' : 'Hitung'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Metode Cetak */}
                <Text style={styles.label}>Metode Cetak</Text>
                <View style={styles.radioRow}>
                  <TouchableOpacity
                    style={[
                      styles.radioBtn,
                      spandukMetode === 'MANUAL' && styles.radioBtnActive,
                    ]}
                    onPress={() => handleSelectSpandukMetode('MANUAL')}
                  >
                    <Text
                      style={[
                        styles.radioBtnText,
                        spandukMetode === 'MANUAL' && styles.radioBtnTextActive,
                      ]}
                    >
                      MANUAL
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.radioBtn,
                      spandukMetode === 'MACHINE' && styles.radioBtnActive,
                    ]}
                    onPress={() => handleSelectSpandukMetode('MACHINE')}
                  >
                    <Text
                      style={[
                        styles.radioBtnText,
                        spandukMetode === 'MACHINE' &&
                          styles.radioBtnTextActive,
                      ]}
                    >
                      MACHINE
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Pilihan Jenis Kain Spanduk */}
                <Text style={[styles.label, { marginTop: 10 }]}>
                  Jenis Kain
                </Text>
                <View style={styles.radioRow}>
                  {availableSpandukKain.map(kain => (
                    <TouchableOpacity
                      key={kain}
                      style={[
                        styles.chipBtn,
                        spandukJenisKain === kain && styles.chipBtnActive,
                      ]}
                      onPress={() => handleSelectSpandukKain(kain)}
                    >
                      <Text
                        style={[
                          styles.chipBtnText,
                          spandukJenisKain === kain && styles.chipBtnTextActive,
                        ]}
                      >
                        {kain}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Lebar Bahan Kain yang Tersedia untuk Jenis Kain Terpilih */}
                <Text style={[styles.label, { marginTop: 10 }]}>
                  Lebar Bahan Kain (cm)
                </Text>
                <View style={styles.radioRow}>
                  {availableSpandukLebar.map(leb => (
                    <TouchableOpacity
                      key={leb}
                      style={[
                        styles.chipBtn,
                        spandukLebar === leb && styles.chipBtnActive,
                      ]}
                      onPress={() => {
                        setSpandukLebar(leb);
                        setMhLebar(String(leb));
                      }}
                    >
                      <Text
                        style={[
                          styles.chipBtnText,
                          spandukLebar === leb && styles.chipBtnTextActive,
                        ]}
                      >
                        {leb} cm
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Checklist Finishing Spanduk (Opsional) */}
                <View style={{ marginTop: 12 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                    }}
                  >
                    <Text style={[styles.label, { marginBottom: 0 }]}>
                      Finishing Spanduk (Include Kalkulasi)
                    </Text>
                    <TouchableOpacity
                      onPress={() => setFinishingInfoType('include_kalkulasi')}
                      style={{
                        paddingVertical: 2,
                        paddingHorizontal: 4,
                      }}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialIcons
                        name="help-outline"
                        size={16}
                        color="#0284c7"
                      />
                    </TouchableOpacity>
                  </View>
                  {masterOptions?.spandukTambahan &&
                  masterOptions.spandukTambahan.length > 0 ? (
                    masterOptions.spandukTambahan.map((item: any) => {
                      const isSelected = spandukFinishingIds.includes(item.id);
                      const matchedFinishingResult =
                        spandukResult?.finishing?.items?.find(
                          (fi: any) => fi.id === item.id,
                        );
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            styles.ppnCheckboxCard,
                            isSelected && {
                              borderColor: '#0284c7',
                              backgroundColor: '#f0f9ff',
                            },
                            { marginTop: 6 },
                          ]}
                          onPress={() => handleToggleSpandukFinishing(item.id)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.ppnCheckboxLeft}>
                            <MaterialIcons
                              name={
                                isSelected
                                  ? 'check-box'
                                  : 'check-box-outline-blank'
                              }
                              size={22}
                              color={isSelected ? '#0284c7' : '#94a3b8'}
                            />
                            <View style={{ marginLeft: 8, flex: 1 }}>
                              <Text
                                style={[
                                  styles.ppnCheckboxLabel,
                                  isSelected && {
                                    color: '#0369a1',
                                    fontWeight: '700',
                                  },
                                ]}
                              >
                                {item.nama}
                              </Text>
                              <Text style={styles.ppnCheckboxSub}>
                                Tarif: Rp {formatThousandsId(item.tarif)}{' '}
                                {item.satuan || ''}
                              </Text>
                            </View>
                          </View>
                          {Boolean(
                            isSelected &&
                              matchedFinishingResult?.biayaPerPcs > 0,
                          ) && (
                            <View
                              style={[
                                styles.ppnBadge,
                                {
                                  backgroundColor: '#e0f2fe',
                                  borderColor: '#bae6fd',
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.ppnBadgeText,
                                  { color: '#0369a1', fontWeight: '700' },
                                ]}
                              >
                                +Rp{' '}
                                {formatThousandsId(
                                  matchedFinishingResult.biayaPerPcs,
                                )}
                                /pcs
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text
                      style={{
                        fontSize: 12,
                        color: '#94a3b8',
                        fontStyle: 'italic',
                      }}
                    >
                      Memuat opsi finishing...
                    </Text>
                  )}
                </View>

                {/* BANNER DETEKSI DATA BERUBAH (SPANDUK) */}
                {isSpandukStale && (
                  <TouchableOpacity
                    style={styles.staleNoticeCard}
                    onPress={() => handleHitungSpanduk()}
                    activeOpacity={0.85}
                  >
                    <View style={styles.staleNoticeLeft}>
                      <MaterialIcons
                        name="sync-problem"
                        size={22}
                        color="#b45309"
                      />
                    </View>
                    <View style={styles.staleRecalcBtn}>
                      <MaterialIcons name="refresh" size={15} color="#fff" />
                      <Text style={styles.staleRecalcBtnText}>
                        Hitung Ulang
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Checklist PPN 11% (Di Atas Hasil Kalkulasi Card Spanduk) */}
                <TouchableOpacity
                  style={[
                    styles.ppnCheckboxCard,
                    isIncPpn && styles.ppnCheckboxCardActive,
                    { marginTop: 12 },
                  ]}
                  onPress={handleTogglePpn}
                  activeOpacity={0.8}
                >
                  <View style={styles.ppnCheckboxLeft}>
                    <MaterialIcons
                      name={isIncPpn ? 'check-box' : 'check-box-outline-blank'}
                      size={22}
                      color={isIncPpn ? '#16a34a' : '#94a3b8'}
                    />
                    <View style={{ marginLeft: 8, flex: 1 }}>
                      <Text
                        style={[
                          styles.ppnCheckboxLabel,
                          isIncPpn && { color: '#15803d', fontWeight: '700' },
                        ]}
                      >
                        + PPN 11% (INC PPN)
                      </Text>
                      <Text style={styles.ppnCheckboxSub}>
                        {isIncPpn
                          ? 'Kalkulasi sudah termasuk PPN 11%'
                          : 'Kalkulasi belum termasuk PPN'}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.ppnBadge,
                      isIncPpn ? styles.ppnBadgeInc : styles.ppnBadgeExc,
                    ]}
                  >
                    <Text
                      style={[
                        styles.ppnBadgeText,
                        isIncPpn
                          ? styles.ppnBadgeTextInc
                          : styles.ppnBadgeTextExc,
                      ]}
                    >
                      {isIncPpn ? 'INC PPN;' : 'EXC PPN;'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Hasil Kalkulasi Card Spanduk */}
                {spandukResult ? (
                  <View style={styles.resultBox}>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>
                        Total Panjang Kain:
                      </Text>
                      <Text style={styles.resultValue}>
                        {spandukResult.totalMeter} Meter
                      </Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Tarif Cetak Bahan:</Text>
                      <Text style={[styles.resultValue, { color: '#0284c7' }]}>
                        Rp{' '}
                        {formatThousandsId(
                          spandukResult.biayaCetakPerPcs ||
                            spandukResult.tarifPerMeter,
                        )}{' '}
                        /Pcs
                      </Text>
                    </View>
                    {spandukResult?.finishing?.items &&
                      spandukResult.finishing.items.map((fi: any) => (
                        <View key={fi.id} style={styles.resultRow}>
                          <Text style={styles.resultLabel}>
                            Finishing ({fi.nama}):
                          </Text>
                          <Text
                            style={[
                              styles.resultValue,
                              { color: '#0284c7', fontWeight: '600' },
                            ]}
                          >
                            +Rp {formatThousandsId(fi.biayaPerPcs)} /Pcs
                          </Text>
                        </View>
                      ))}
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>
                        Ongkir ({calculatedOngkir.alokasi}):
                      </Text>
                      <Text
                        style={[
                          styles.resultValue,
                          {
                            color: calculatedOngkir.isFreeCharge
                              ? '#15803d'
                              : '#0284c7',
                            fontWeight: '700',
                          },
                        ]}
                      >
                        {calculatedOngkir.isFreeCharge
                          ? 'GRATIS'
                          : `+Rp ${formatThousandsId(
                              calculatedOngkir.ongkirPerPcs,
                            )} /Pcs`}
                      </Text>
                    </View>
                    {(() => {
                      const dppPerPcs =
                        spandukResult.hargaSatuanPcs +
                        (calculatedOngkir.ongkirPerPcs || 0);
                      const finalPerPcs = isIncPpn
                        ? Math.round(dppPerPcs * 1.11)
                        : dppPerPcs;
                      const orderQty = toNumCurrency(mh_jmlorder) || 1;
                      const totalOrderKeseluruhan = finalPerPcs * orderQty;
                      const ppnTotal = isIncPpn
                        ? Math.round(dppPerPcs * 0.11) * orderQty
                        : 0;

                      return (
                        <>
                          <View
                            style={[styles.resultRow, styles.resultTotalRow]}
                          >
                            <Text style={styles.resultTotalLabel}>
                              Total Kalkulasi:
                            </Text>
                            <Text
                              style={[
                                styles.resultTotalValue,
                                {
                                  color: isIncPpn ? '#15803d' : '#0284c7',
                                  fontSize: 16,
                                },
                              ]}
                            >
                              Rp {formatThousandsId(finalPerPcs)} /Pcs
                            </Text>
                          </View>
                          {isIncPpn && (
                            <View style={styles.resultRow}>
                              <Text
                                style={[
                                  styles.resultLabel,
                                  { color: '#047857', fontWeight: '700' },
                                ]}
                              >
                                Biaya PPN 11%:
                              </Text>
                              <Text
                                style={[
                                  styles.resultValue,
                                  { color: '#047857', fontWeight: '800' },
                                ]}
                              >
                                +Rp {formatThousandsId(ppnTotal)}
                              </Text>
                            </View>
                          )}
                          <View style={styles.resultRow}>
                            <Text
                              style={[styles.resultLabel, { fontSize: 11 }]}
                            >
                              Total Order Keseluruhan (
                              {formatThousandsId(mh_jmlorder || 0)} pcs):
                            </Text>
                            <Text
                              style={[
                                styles.resultValue,
                                { fontSize: 11.5, fontWeight: '700' },
                              ]}
                            >
                              Rp {formatThousandsId(totalOrderKeseluruhan)}
                            </Text>
                          </View>
                        </>
                      );
                    })()}
                  </View>
                ) : null}

                {/* Accordion Tabel Strata Spanduk */}
                <TouchableOpacity
                  style={styles.strataAccordionHeader}
                  onPress={() => setShowSpandukStrataTabel(v => !v)}
                >
                  <View style={styles.row}>
                    <MaterialIcons
                      name="table-chart"
                      size={16}
                      color={THEME.primary}
                    />
                    <Text style={styles.strataAccordionTitle}>
                      Tabel Master Bahan Spanduk
                    </Text>
                  </View>
                  <MaterialIcons
                    name={
                      showSpandukStrataTabel ? 'expand-less' : 'expand-more'
                    }
                    size={20}
                    color={THEME.muted}
                  />
                </TouchableOpacity>

                {showSpandukStrataTabel && spandukResult?.tabelReferensi ? (
                  <View style={styles.strataTableBox}>
                    <View style={styles.strataTableHeader}>
                      <Text style={[styles.strataTh, { flex: 2 }]}>
                        Panjang
                      </Text>
                      <Text
                        style={[
                          styles.strataTh,
                          { flex: 1, textAlign: 'right' },
                        ]}
                      >
                        Tarif/Mtr
                      </Text>
                    </View>
                    {spandukResult.tabelReferensi.map((s: any, idx: number) => {
                      const isActive =
                        spandukResult.strataAktif &&
                        spandukResult.strataAktif.id === s.id;
                      return (
                        <View
                          key={`ref-${idx}`}
                          style={[
                            styles.strataTableRow,
                            isActive && styles.strataTableRowActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.strataTd,
                              { flex: 2 },
                              isActive && styles.strataTdActive,
                            ]}
                          >
                            {s.qmax >= 99999
                              ? `≥ ${formatThousandsId(s.qmin)} m`
                              : `${formatNumberDisplay(
                                  s.qmin,
                                )} - ${formatNumberDisplay(s.qmax)} m`}
                          </Text>
                          <Text
                            style={[
                              styles.strataTd,
                              { flex: 1, textAlign: 'right' },
                              isActive && styles.strataTdActive,
                            ]}
                          >
                            Rp {formatThousandsId(s.harga)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            )}

            {/* KALKULASI DIVISI 5: MMT BANNER */}
            {mh_divisi === '5' && (
              <View style={styles.card}>
                <View style={styles.engineCardHeaderRow}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      flex: 1,
                    }}
                  >
                    <MaterialIcons
                      name="view-in-ar"
                      size={20}
                      color={THEME.primary}
                    />
                    <Text style={styles.engineCardTitle}>Kalkulasi Harga</Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.recalcHeaderBtn,
                      isMmtStale && styles.recalcHeaderBtnStale,
                    ]}
                    onPress={() => handleHitungMmt()}
                    disabled={mmtLoading}
                  >
                    {mmtLoading ? (
                      <ActivityIndicator
                        size="small"
                        color={isMmtStale ? '#fff' : THEME.primary}
                      />
                    ) : (
                      <>
                        <MaterialIcons
                          name="sync"
                          size={15}
                          color={isMmtStale ? '#fff' : THEME.primary}
                        />
                        <Text
                          style={[
                            styles.recalcHeaderBtnText,
                            isMmtStale && styles.recalcHeaderBtnTextStale,
                          ]}
                        >
                          {isMmtStale ? 'Hitung Ulang' : 'Hitung'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Kategori MMT */}
                <Text style={styles.label}>Kategori Mesin / Resolusi</Text>
                <View style={styles.radioRow}>
                  {availableMmtKategori.map(kat => (
                    <TouchableOpacity
                      key={kat}
                      style={[
                        styles.chipBtn,
                        mmtKategori === kat && styles.chipBtnActive,
                      ]}
                      onPress={() => {
                        setMmtKategori(kat);
                        const firstBahan = masterOptions?.mmt?.find(
                          (m: any) => m.kategori === kat,
                        );
                        if (firstBahan?.bahan_kode) {
                          setMmtBahanKode(firstBahan.bahan_kode);
                          setMhKain(
                            firstBahan.nama_bahan || firstBahan.bahan_kode,
                          );
                        } else if (kat === 'VYNIL') {
                          setMmtBahanKode('260');
                          setMhKain('Frontlite 260');
                        } else if (kat === 'HI-RES') {
                          setMmtBahanKode('340');
                          setMhKain('Hi-Res 340');
                        } else {
                          setMmtBahanKode('GRAFTAC');
                          setMhKain('Sticker Graftac');
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.chipBtnText,
                          mmtKategori === kat && styles.chipBtnTextActive,
                        ]}
                      >
                        {kat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Pilihan Bahan dari Kolom Kode per Kategori */}
                <Text style={[styles.label, { marginTop: 10 }]}>
                  Pilihan Bahan
                </Text>
                <View style={styles.radioRow}>
                  {currentMmtBahanList.map(b => (
                    <TouchableOpacity
                      key={b.kode}
                      style={[
                        styles.chipBtn,
                        mmtBahanKode === b.kode && styles.chipBtnActive,
                      ]}
                      onPress={() => {
                        setMmtBahanKode(b.kode);
                        setMhKain(b.nama || b.kode);
                      }}
                    >
                      <Text
                        style={[
                          styles.chipBtnText,
                          mmtBahanKode === b.kode && styles.chipBtnTextActive,
                        ]}
                      >
                        {b.kode}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Topping Tambahan MMT */}
                <Text style={[styles.label, { marginTop: 10 }]}>
                  Aksesoris Tambahan (Opsional)
                </Text>
                <TouchableOpacity
                  style={styles.dropdownTrigger}
                  onPress={() => setShowToppingDropdown(v => !v)}
                >
                  <Text style={styles.dropdownTriggerText}>
                    {mmtToppingKode
                      ? masterOptions.topping.find(
                          t => t.kode === mmtToppingKode,
                        )?.nama || mmtToppingKode
                      : 'Tanpa Aksesoris Tambahan (Standard)'}
                  </Text>
                  <MaterialIcons
                    name={
                      showToppingDropdown ? 'arrow-drop-up' : 'arrow-drop-down'
                    }
                    size={24}
                    color={THEME.muted}
                  />
                </TouchableOpacity>

                {showToppingDropdown && (
                  <View style={styles.dropdownMenu}>
                    <TouchableOpacity
                      style={styles.dropdownMenuItem}
                      onPress={() => {
                        setMmtToppingKode('');
                        setShowToppingDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownMenuItemText}>
                        Tanpa Topping
                      </Text>
                    </TouchableOpacity>
                    {masterOptions.topping.map(top => {
                      const isSel = mmtToppingKode === top.kode;
                      return (
                        <TouchableOpacity
                          key={top.kode}
                          style={[
                            styles.dropdownMenuItem,
                            isSel && styles.dropdownMenuItemActive,
                          ]}
                          onPress={() => {
                            setMmtToppingKode(top.kode);
                            setShowToppingDropdown(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.dropdownMenuItemText,
                              isSel && styles.dropdownMenuItemTextActive,
                            ]}
                          >
                            {top.nama} (Rp {formatThousandsId(top.harga)}/pcs)
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* Checklist Finishing Selongsong (Opsional) */}
                <View style={{ marginTop: 12 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                    }}
                  >
                    <Text style={[styles.label, { marginBottom: 0 }]}>
                      Finishing Selongsong (Include Kalkulasi)
                    </Text>
                    <TouchableOpacity
                      onPress={() => setFinishingInfoType('include_kalkulasi')}
                      style={{
                        paddingVertical: 2,
                        paddingHorizontal: 4,
                      }}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialIcons
                        name="help-outline"
                        size={16}
                        color="#0284c7"
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Selongsong Vertikal */}
                  <TouchableOpacity
                    style={[
                      styles.ppnCheckboxCard,
                      mmtSelongsongVert && {
                        borderColor: '#0284c7',
                        backgroundColor: '#f0f9ff',
                      },
                      { marginTop: 4 },
                    ]}
                    onPress={handleToggleSelongsongVert}
                    activeOpacity={0.8}
                  >
                    <View style={styles.ppnCheckboxLeft}>
                      <MaterialIcons
                        name={
                          mmtSelongsongVert
                            ? 'check-box'
                            : 'check-box-outline-blank'
                        }
                        size={22}
                        color={mmtSelongsongVert ? '#0284c7' : '#94a3b8'}
                      />
                      <View style={{ marginLeft: 8, flex: 1 }}>
                        <Text
                          style={[
                            styles.ppnCheckboxLabel,
                            mmtSelongsongVert && {
                              color: '#0369a1',
                              fontWeight: '700',
                            },
                          ]}
                        >
                          Selongsong Vertikal
                        </Text>
                        <Text style={styles.ppnCheckboxSub}>
                          0,2 x P ({mh_panjang || 0} m) x tarif/m²
                        </Text>
                      </View>
                    </View>
                    {Boolean(
                      mmtResult?.selongsong?.biayaVerticalPerPcs > 0 &&
                        mmtSelongsongVert,
                    ) && (
                      <View
                        style={[
                          styles.ppnBadge,
                          {
                            backgroundColor: '#e0f2fe',
                            borderColor: '#bae6fd',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.ppnBadgeText,
                            { color: '#0369a1', fontWeight: '700' },
                          ]}
                        >
                          +Rp{' '}
                          {formatThousandsId(
                            mmtResult.selongsong.biayaVerticalPerPcs,
                          )}
                          /pcs
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Selongsong Horizontal */}
                  <TouchableOpacity
                    style={[
                      styles.ppnCheckboxCard,
                      mmtSelongsongHoriz && {
                        borderColor: '#0284c7',
                        backgroundColor: '#f0f9ff',
                      },
                      { marginTop: 8 },
                    ]}
                    onPress={handleToggleSelongsongHoriz}
                    activeOpacity={0.8}
                  >
                    <View style={styles.ppnCheckboxLeft}>
                      <MaterialIcons
                        name={
                          mmtSelongsongHoriz
                            ? 'check-box'
                            : 'check-box-outline-blank'
                        }
                        size={22}
                        color={mmtSelongsongHoriz ? '#0284c7' : '#94a3b8'}
                      />
                      <View style={{ marginLeft: 8, flex: 1 }}>
                        <Text
                          style={[
                            styles.ppnCheckboxLabel,
                            mmtSelongsongHoriz && {
                              color: '#0369a1',
                              fontWeight: '700',
                            },
                          ]}
                        >
                          Selongsong Horizontal
                        </Text>
                        <Text style={styles.ppnCheckboxSub}>
                          0,2 x L ({mh_lebar || 0} m) x tarif/m²
                        </Text>
                      </View>
                    </View>
                    {Boolean(
                      mmtResult?.selongsong?.biayaHorizontalPerPcs > 0 &&
                        mmtSelongsongHoriz,
                    ) && (
                      <View
                        style={[
                          styles.ppnBadge,
                          {
                            backgroundColor: '#e0f2fe',
                            borderColor: '#bae6fd',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.ppnBadgeText,
                            { color: '#0369a1', fontWeight: '700' },
                          ]}
                        >
                          +Rp{' '}
                          {formatThousandsId(
                            mmtResult.selongsong.biayaHorizontalPerPcs,
                          )}
                          /pcs
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* BANNER DETEKSI DATA BERUBAH (MMT) */}
                {isMmtStale && (
                  <TouchableOpacity
                    style={styles.staleNoticeCard}
                    onPress={() => handleHitungMmt()}
                    activeOpacity={0.85}
                  >
                    <View style={styles.staleNoticeLeft}>
                      <MaterialIcons
                        name="sync-problem"
                        size={22}
                        color="#b45309"
                      />
                    </View>
                    <View style={styles.staleRecalcBtn}>
                      <MaterialIcons name="refresh" size={15} color="#fff" />
                      <Text style={styles.staleRecalcBtnText}>
                        Hitung Ulang
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Checklist Harga Netto */}
                <TouchableOpacity
                  style={[
                    styles.ppnCheckboxCard,
                    mmtIsNetto && {
                      borderColor: '#a855f7',
                      backgroundColor: '#faf5ff',
                    },
                    { marginTop: 12 },
                  ]}
                  onPress={handleToggleNetto}
                  activeOpacity={0.8}
                >
                  <View style={styles.ppnCheckboxLeft}>
                    <MaterialIcons
                      name={
                        mmtIsNetto ? 'check-box' : 'check-box-outline-blank'
                      }
                      size={22}
                      color={mmtIsNetto ? '#9333ea' : '#94a3b8'}
                    />
                    <View style={{ marginLeft: 8, flex: 1 }}>
                      <Text
                        style={[
                          styles.ppnCheckboxLabel,
                          mmtIsNetto && { color: '#7e22ce', fontWeight: '700' },
                        ]}
                      >
                        Harga Netto
                      </Text>
                      <Text style={styles.ppnCheckboxSub}>
                        {mmtIsNetto
                          ? 'Menggunakan tarif Netto (flat rate)'
                          : 'Menggunakan tarif berstrata kuantiti'}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.ppnBadge,
                      mmtIsNetto
                        ? { backgroundColor: '#f3e8ff', borderColor: '#e9d5ff' }
                        : styles.ppnBadgeExc,
                    ]}
                  >
                    <Text
                      style={[
                        styles.ppnBadgeText,
                        mmtIsNetto
                          ? { color: '#7e22ce' }
                          : styles.ppnBadgeTextExc,
                      ]}
                    >
                      {mmtIsNetto ? 'NETTO' : 'REGULER'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Input Alasan Penggunaan Harga Netto (Wajib bila Netto aktif) */}
                {mmtIsNetto && (
                  <View
                    style={{
                      marginTop: 8,
                      padding: 12,
                      backgroundColor: '#faf5ff',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: '#e9d5ff',
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 6,
                      }}
                    >
                      <MaterialIcons
                        name="edit-note"
                        size={18}
                        color="#9333ea"
                      />
                      <Text
                        style={{
                          fontSize: 12.5,
                          fontWeight: '700',
                          color: '#6b21a8',
                        }}
                      >
                        Alasan Penggunaan Harga Netto{' '}
                        <Text style={{ color: '#dc2626' }}>*</Text>
                      </Text>
                    </View>
                    <TextInput
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: '#d8b4fe',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        fontSize: 13,
                        color: '#1e293b',
                        minHeight: 56,
                        textAlignVertical: 'top',
                      }}
                      multiline
                      numberOfLines={2}
                      placeholder="Wajib diisi: Berikan alasan penggunaan tarif Netto"
                      placeholderTextColor="#94a3b8"
                      value={mmtAlasanNetto}
                      onChangeText={handleUpdateMmtAlasan}
                    />
                  </View>
                )}

                {/* Checklist PPN 11% (Di Atas Hasil Kalkulasi Card MMT) */}
                <TouchableOpacity
                  style={[
                    styles.ppnCheckboxCard,
                    isIncPpn && styles.ppnCheckboxCardActive,
                    { marginTop: 8 },
                  ]}
                  onPress={handleTogglePpn}
                  activeOpacity={0.8}
                >
                  <View style={styles.ppnCheckboxLeft}>
                    <MaterialIcons
                      name={isIncPpn ? 'check-box' : 'check-box-outline-blank'}
                      size={22}
                      color={isIncPpn ? '#16a34a' : '#94a3b8'}
                    />
                    <View style={{ marginLeft: 8, flex: 1 }}>
                      <Text
                        style={[
                          styles.ppnCheckboxLabel,
                          isIncPpn && { color: '#15803d', fontWeight: '700' },
                        ]}
                      >
                        + PPN 11% (INC PPN)
                      </Text>
                      <Text style={styles.ppnCheckboxSub}>
                        {isIncPpn
                          ? 'Kalkulasi sudah termasuk PPN 11%'
                          : 'Kalkulasi belum termasuk PPN'}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.ppnBadge,
                      isIncPpn ? styles.ppnBadgeInc : styles.ppnBadgeExc,
                    ]}
                  >
                    <Text
                      style={[
                        styles.ppnBadgeText,
                        isIncPpn
                          ? styles.ppnBadgeTextInc
                          : styles.ppnBadgeTextExc,
                      ]}
                    >
                      {isIncPpn ? 'INC PPN;' : 'EXC PPN;'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Hasil Kalkulasi MMT */}
                {mmtResult ? (
                  <View style={styles.resultBox}>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>
                        Luas ({mh_panjang} m x {mh_lebar} m):
                      </Text>
                      <Text style={[styles.resultValue, { fontWeight: '700' }]}>
                        {mmtResult.luasPerPcs ||
                          Math.round(
                            toNumDecimal(mh_panjang) *
                              toNumDecimal(mh_lebar) *
                              100,
                          ) / 100}{' '}
                        m² / Pcs
                      </Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>
                        Total Luas ({mh_jmlorder || 0} pcs):
                      </Text>
                      <Text
                        style={[
                          styles.resultValue,
                          { color: '#0284c7', fontWeight: '700' },
                        ]}
                      >
                        {mmtResult.totalLuas} m²
                      </Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Tarif per m²:</Text>
                      <Text style={[styles.resultValue, { color: '#0284c7' }]}>
                        Rp {formatThousandsId(mmtResult.tarifPerM2)} /m²
                      </Text>
                    </View>
                    {mmtResult.topping && (
                      <View style={styles.resultRow}>
                        <Text style={styles.resultLabel}>Biaya Topping:</Text>
                        <Text
                          style={[styles.resultValue, { color: '#d97706' }]}
                        >
                          +Rp{' '}
                          {formatThousandsId(
                            mmtResult.topping.hargaSatuan ||
                              (mmtResult.topping.qty > 0
                                ? Math.round(
                                    mmtResult.topping.totalHarga /
                                      mmtResult.topping.qty,
                                  )
                                : mmtResult.topping.totalHarga),
                          )}{' '}
                          /pcs
                        </Text>
                      </View>
                    )}
                    {Boolean(mmtResult.selongsong?.isVertical) && (
                      <View style={styles.resultRow}>
                        <Text style={styles.resultLabel}>
                          Selongsong Vertikal (0,2 x {mh_panjang}m):
                        </Text>
                        <Text
                          style={[styles.resultValue, { color: '#0284c7' }]}
                        >
                          +Rp{' '}
                          {formatThousandsId(
                            mmtResult.selongsong.biayaVerticalPerPcs,
                          )}{' '}
                          /pcs
                        </Text>
                      </View>
                    )}
                    {Boolean(mmtResult.selongsong?.isHorizontal) && (
                      <View style={styles.resultRow}>
                        <Text style={styles.resultLabel}>
                          Selongsong Horizontal (0,2 x {mh_lebar}m):
                        </Text>
                        <Text
                          style={[styles.resultValue, { color: '#0284c7' }]}
                        >
                          +Rp{' '}
                          {formatThousandsId(
                            mmtResult.selongsong.biayaHorizontalPerPcs,
                          )}{' '}
                          /pcs
                        </Text>
                      </View>
                    )}
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>
                        Ongkir ({calculatedOngkir.alokasi}):
                      </Text>
                      <Text
                        style={[
                          styles.resultValue,
                          {
                            color: calculatedOngkir.isFreeCharge
                              ? '#15803d'
                              : '#0284c7',
                            fontWeight: '700',
                          },
                        ]}
                      >
                        {calculatedOngkir.isFreeCharge
                          ? 'GRATIS'
                          : `+Rp ${formatThousandsId(
                              calculatedOngkir.ongkirPerPcs,
                            )} /Pcs`}
                      </Text>
                    </View>
                    {(() => {
                      const dppPerPcs =
                        mmtResult.hargaSatuanPcs +
                        (calculatedOngkir.ongkirPerPcs || 0);
                      const finalPerPcs = isIncPpn
                        ? Math.round(dppPerPcs * 1.11)
                        : dppPerPcs;
                      const orderQty = toNumCurrency(mh_jmlorder) || 1;
                      const totalOrderKeseluruhan = finalPerPcs * orderQty;
                      const ppnTotal = isIncPpn
                        ? Math.round(dppPerPcs * 0.11) * orderQty
                        : 0;

                      return (
                        <>
                          <View
                            style={[styles.resultRow, styles.resultTotalRow]}
                          >
                            <Text style={styles.resultTotalLabel}>
                              Total Kalkulasi:
                            </Text>
                            <Text
                              style={[
                                styles.resultTotalValue,
                                {
                                  color: isIncPpn ? '#15803d' : '#0284c7',
                                  fontSize: 16,
                                },
                              ]}
                            >
                              Rp {formatThousandsId(finalPerPcs)} /Pcs
                            </Text>
                          </View>
                          {isIncPpn && (
                            <View style={styles.resultRow}>
                              <Text
                                style={[
                                  styles.resultLabel,
                                  { color: '#047857', fontWeight: '700' },
                                ]}
                              >
                                Biaya PPN 11%:
                              </Text>
                              <Text
                                style={[
                                  styles.resultValue,
                                  { color: '#047857', fontWeight: '800' },
                                ]}
                              >
                                +Rp {formatThousandsId(ppnTotal)}
                              </Text>
                            </View>
                          )}
                          <View style={styles.resultRow}>
                            <Text
                              style={[styles.resultLabel, { fontSize: 11 }]}
                            >
                              Total Order Keseluruhan (
                              {formatThousandsId(mh_jmlorder || 0)} pcs):
                            </Text>
                            <Text
                              style={[
                                styles.resultValue,
                                { fontSize: 11.5, fontWeight: '700' },
                              ]}
                            >
                              Rp {formatThousandsId(totalOrderKeseluruhan)}
                            </Text>
                          </View>
                        </>
                      );
                    })()}
                  </View>
                ) : null}

                {/* Accordion Tabel Strata MMT */}
                <TouchableOpacity
                  style={styles.strataAccordionHeader}
                  onPress={() => setShowMmtStrataTabel(v => !v)}
                >
                  <View style={styles.row}>
                    <MaterialIcons
                      name="table-chart"
                      size={16}
                      color={THEME.primary}
                    />
                    <Text style={styles.strataAccordionTitle}>
                      Tabel Master Bahan MMT
                    </Text>
                  </View>
                  <MaterialIcons
                    name={showMmtStrataTabel ? 'expand-less' : 'expand-more'}
                    size={20}
                    color={THEME.muted}
                  />
                </TouchableOpacity>

                {showMmtStrataTabel && mmtResult?.tabelReferensi ? (
                  <View style={styles.strataTableBox}>
                    <View style={styles.strataTableHeader}>
                      <Text style={[styles.strataTh, { flex: 2 }]}>
                        Rentang Luas
                      </Text>
                      <Text
                        style={[
                          styles.strataTh,
                          { flex: 1, textAlign: 'right' },
                        ]}
                      >
                        Tarif/m²
                      </Text>
                    </View>
                    {mmtResult.tabelReferensi.map((s: any, idx: number) => {
                      const isActive =
                        mmtResult.strataAktif &&
                        mmtResult.strataAktif.id === s.id;
                      return (
                        <View
                          key={`m-ref-${idx}`}
                          style={[
                            styles.strataTableRow,
                            isActive && styles.strataTableRowActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.strataTd,
                              { flex: 2 },
                              isActive && styles.strataTdActive,
                            ]}
                          >
                            {s.is_netto
                              ? 'Harga Netto'
                              : s.qmax >= 99999
                              ? `≥ ${formatNumberDisplay(s.qmin)} m²`
                              : `${formatNumberDisplay(
                                  s.qmin,
                                )} - ${formatNumberDisplay(s.qmax)} m²`}
                          </Text>
                          <Text
                            style={[
                              styles.strataTd,
                              { flex: 1, textAlign: 'right' },
                              isActive && styles.strataTdActive,
                            ]}
                          >
                            Rp {formatThousandsId(s.harga)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            )}

            {/* Jika Divisi Non-Standar Lainnya (Bukan Spanduk, MMT, maupun Garmen) */}
            {mh_divisi !== '1' && mh_divisi !== '5' && mh_divisi !== '4' && (
              <View style={styles.card}>
                <Text style={styles.sectionHeading}>
                  Estimasi Harga Manual (Produk Custom Lainnya)
                </Text>
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  Masukkan target harga per satuan pcs untuk produk garmen /
                  custom.
                </Text>

                {/* Target Harga Satuan */}
                <View style={[styles.fieldWrap, { marginTop: 12 }]}>
                  <Text style={styles.label}>Target Harga Satuan (Rp/Pcs)</Text>
                  <TextInput
                    style={[
                      styles.input,
                      { fontWeight: '700', fontSize: 15, color: '#0284c7' },
                    ]}
                    value={
                      mh_harga ? formatThousandsId(toNumCurrency(mh_harga)) : ''
                    }
                    onChangeText={val => {
                      const digits = onlyDigits(val);
                      setMhHarga(digits);
                    }}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
              </View>
            )}

            {/* KALKULASI DIVISI 4: GARMEN */}
            {mh_divisi === '4' && (
              <View style={styles.card}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
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
                      name="view-in-ar"
                      size={20}
                      color={THEME.primary}
                    />
                    <Text style={styles.engineCardTitle}>Kalkulasi Harga</Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.recalcHeaderBtn,
                      isGarmenStale && styles.recalcHeaderBtnStale,
                      !isGarmenStale && { borderColor: '#7c3aed' },
                    ]}
                    onPress={() => handleHitungGarmen()}
                    activeOpacity={0.8}
                    disabled={garmenLoadingCalc}
                  >
                    {garmenLoadingCalc ? (
                      <ActivityIndicator
                        size="small"
                        color={isGarmenStale ? '#fff' : '#7c3aed'}
                      />
                    ) : (
                      <>
                        <MaterialIcons
                          name="sync"
                          size={15}
                          color={isGarmenStale ? '#fff' : '#7c3aed'}
                        />
                        <Text
                          style={[
                            styles.recalcHeaderBtnText,
                            { color: isGarmenStale ? '#fff' : '#7c3aed' },
                            isGarmenStale && styles.recalcHeaderBtnTextStale,
                          ]}
                        >
                          {isGarmenStale ? 'Hitung Ulang' : 'Hitung'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* 1. FIELD DROPDOWN PILIHAN TAMBAHAN */}
                <View style={{ marginBottom: 16 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: 4,
                    }}
                  >
                    <Text style={styles.label}>Tambahan</Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.input,
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      },
                    ]}
                    onPress={() => setModalGarmenTambahanVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color:
                          garmenSelectedTambahan.length > 0
                            ? THEME.ink
                            : '#94a3b8',
                        fontWeight:
                          garmenSelectedTambahan.length > 0 ? '600' : '400',
                      }}
                      numberOfLines={1}
                    >
                      {garmenSelectedTambahan.length > 0
                        ? `${garmenSelectedTambahan.length} Tambahan Dipilih`
                        : 'Pilih Tambahan (Opsional)...'}
                    </Text>
                    <MaterialIcons
                      name="arrow-drop-down"
                      size={24}
                      color="#64748b"
                    />
                  </TouchableOpacity>

                  {/* Ringkasan Item Tambahan Terpilih */}
                  {garmenSelectedTambahan.length > 0 && (
                    <View style={{ marginTop: 8, gap: 6 }}>
                      {garmenSelectedTambahan.map((sItem, sIdx) => {
                        const qtyOrder = toNumCurrency(mh_jmlorder);
                        const sub = sItem.tarif * qtyOrder;
                        return (
                          <View
                            key={sIdx}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              backgroundColor: '#f5f3ff',
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: '#ddd6fe',
                            }}
                          >
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: '600',
                                  color: '#5b21b6',
                                }}
                              >
                                {sItem.ket}
                              </Text>
                              <Text style={{ fontSize: 11, color: '#64748b' }}>
                                Rp {sItem.tarif.toLocaleString('id-ID')}/pcs x{' '}
                                {qtyOrder} pcs
                              </Text>
                            </View>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: '700',
                                  color: '#7c3aed',
                                }}
                              >
                                Rp {sub.toLocaleString('id-ID')}
                              </Text>
                              <TouchableOpacity
                                onPress={() =>
                                  setGarmenSelectedTambahan(prev =>
                                    prev.filter(t => t.ket !== sItem.ket),
                                  )
                                }
                                style={{ padding: 4 }}
                              >
                                <MaterialIcons
                                  name="close"
                                  size={18}
                                  color="#ef4444"
                                />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* 2. FIELD DROPDOWN PILIHAN CETAK */}
                <View style={{ marginBottom: 16 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 4,
                    }}
                  >
                    <Text style={styles.label}>
                      Cetak (Sablon / DTF / Bordir / Sublim)
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.input,
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      },
                    ]}
                    onPress={() => setModalGarmenCetakVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color:
                          garmenSelectedCetak.length > 0
                            ? THEME.ink
                            : '#94a3b8',
                        fontWeight:
                          garmenSelectedCetak.length > 0 ? '600' : '400',
                      }}
                      numberOfLines={1}
                    >
                      {garmenSelectedCetak.length > 0
                        ? `${garmenSelectedCetak.length} Item Cetak Dipilih`
                        : 'Pilih Sablon / DTF / Bordir / Sublim...'}
                    </Text>
                    <MaterialIcons
                      name="arrow-drop-down"
                      size={24}
                      color="#64748b"
                    />
                  </TouchableOpacity>

                  {/* Ringkasan Item Cetak Terpilih */}
                  {garmenSelectedCetak.length > 0 && (
                    <View style={{ marginTop: 8, gap: 6 }}>
                      {garmenSelectedCetak.map((cItem, cIdx) => {
                        const qtyOrder = toNumCurrency(mh_jmlorder);
                        const sub = cItem.biaya * qtyOrder;
                        const ukDesc = getSablonUkuranDesc(cItem.ket);
                        return (
                          <View
                            key={cIdx}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              backgroundColor: '#faf5ff',
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: '#e9d5ff',
                            }}
                          >
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: '600',
                                  color: '#6b21a8',
                                }}
                              >
                                {cItem.jenis} - {cItem.ket}
                              </Text>
                              <Text style={{ fontSize: 11, color: '#64748b' }}>
                                Rp {cItem.biaya.toLocaleString('id-ID')}/pcs x{' '}
                                {qtyOrder} pcs
                                {ukDesc ? ` • Ukuran: ${ukDesc}` : ''}
                              </Text>
                            </View>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: '700',
                                  color: '#7c3aed',
                                }}
                              >
                                Rp {sub.toLocaleString('id-ID')}
                              </Text>
                              <TouchableOpacity
                                onPress={() =>
                                  setGarmenSelectedCetak(prev =>
                                    prev.filter((_, i) => i !== cIdx),
                                  )
                                }
                                style={{ padding: 4 }}
                              >
                                <MaterialIcons
                                  name="close"
                                  size={18}
                                  color="#ef4444"
                                />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* BANNER DETEKSI DATA BERUBAH (GARMEN) */}
                {isGarmenStale && (
                  <TouchableOpacity
                    style={styles.staleNoticeCard}
                    onPress={() => handleHitungGarmen()}
                    activeOpacity={0.85}
                  >
                    <View style={styles.staleNoticeLeft}>
                      <MaterialIcons
                        name="sync-problem"
                        size={22}
                        color="#b45309"
                      />
                    </View>
                    <View style={styles.staleRecalcBtn}>
                      <MaterialIcons name="refresh" size={15} color="#fff" />
                      <Text style={styles.staleRecalcBtnText}>
                        Hitung Ulang
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Checklist PPN 11% (Di Atas Hasil Kalkulasi Card Garmen) */}
                <TouchableOpacity
                  style={[
                    styles.ppnCheckboxCard,
                    isIncPpn && styles.ppnCheckboxCardActive,
                    { marginTop: 12 },
                  ]}
                  onPress={handleTogglePpn}
                  activeOpacity={0.8}
                >
                  <View style={styles.ppnCheckboxLeft}>
                    <MaterialIcons
                      name={isIncPpn ? 'check-box' : 'check-box-outline-blank'}
                      size={22}
                      color={isIncPpn ? '#16a34a' : '#94a3b8'}
                    />
                    <View style={{ marginLeft: 8, flex: 1 }}>
                      <Text
                        style={[
                          styles.ppnCheckboxLabel,
                          isIncPpn && { color: '#15803d', fontWeight: '700' },
                        ]}
                      >
                        + PPN 11% (INC PPN)
                      </Text>
                      <Text style={styles.ppnCheckboxSub}>
                        {isIncPpn
                          ? 'Kalkulasi sudah termasuk PPN 11%'
                          : 'Kalkulasi belum termasuk PPN'}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.ppnBadge,
                      isIncPpn ? styles.ppnBadgeInc : styles.ppnBadgeExc,
                    ]}
                  >
                    <Text
                      style={[
                        styles.ppnBadgeText,
                        isIncPpn
                          ? styles.ppnBadgeTextInc
                          : styles.ppnBadgeTextExc,
                      ]}
                    >
                      {isIncPpn ? 'INC PPN;' : 'EXC PPN;'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* HASIL RINCIAN KALKULASI GARMEN */}
                {garmenCalcResult && (
                  <View style={styles.resultBox}>
                    {(() => {
                      const activeTier = (
                        garmenCalcResult.tabelReferensi ||
                        garmenCalcResult.tanggaMargin ||
                        []
                      ).find(
                        (t: any) =>
                          (t.tier &&
                            t.tier === garmenCalcResult.strataAktif?.tier) ||
                          (t.qmin !== undefined &&
                            toNumCurrency(mh_jmlorder) >=
                              (t.qmin ?? t.minOrder ?? 0) &&
                            toNumCurrency(mh_jmlorder) <=
                              (t.qmax ?? t.maxOrder ?? 999999)),
                      );
                      const hargaBahanSatuan =
                        activeTier?.up ??
                        activeTier?.jual ??
                        activeTier?.hargaJual ??
                        garmenCalcResult.hpp +
                          (garmenCalcResult.strataAktif?.marginRp || 0);
                      const marginPersen =
                        garmenCalcResult.strataAktif?.persen ??
                        activeTier?.persen ??
                        activeTier?.marginPercent ??
                        Number(garmenCalcResult.marginPersen || 0) * 100;

                      return (
                        <View style={styles.resultRow}>
                          <Text style={styles.resultLabel}>
                            Margin Penjualan ({marginPersen}%)
                          </Text>
                          <Text
                            style={[
                              styles.resultValue,
                              { color: '#0284c7', fontWeight: '700' },
                            ]}
                          >
                            Rp {formatThousandsId(hargaBahanSatuan)} / Pcs{' '}
                          </Text>
                        </View>
                      );
                    })()}

                    {Number(
                      garmenCalcResult.tambahan?.totalPerPcs ||
                        garmenCalcResult.biayaTambahan ||
                        0,
                    ) > 0 && (
                      <View style={styles.resultRow}>
                        <Text style={styles.resultLabel}>Biaya Tambahan:</Text>
                        <Text
                          style={[
                            styles.resultValue,
                            { color: '#d97706', fontWeight: '700' },
                          ]}
                        >
                          +Rp{' '}
                          {formatThousandsId(
                            garmenCalcResult.tambahan?.totalPerPcs ||
                              garmenCalcResult.biayaTambahan ||
                              0,
                          )}{' '}
                          / Pcs
                        </Text>
                      </View>
                    )}

                    {Number(
                      garmenCalcResult.cetak?.totalPerPcs ||
                        garmenCalcResult.biayaCetak ||
                        0,
                    ) > 0 && (
                      <View style={styles.resultRow}>
                        <Text style={styles.resultLabel}>Biaya Cetak:</Text>
                        <Text
                          style={[
                            styles.resultValue,
                            { color: '#d97706', fontWeight: '700' },
                          ]}
                        >
                          +Rp{' '}
                          {formatThousandsId(
                            garmenCalcResult.cetak?.totalPerPcs ||
                              garmenCalcResult.biayaCetak ||
                              0,
                          )}{' '}
                          / Pcs
                        </Text>
                      </View>
                    )}

                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>
                        Ongkir ({calculatedOngkir.alokasi}):
                      </Text>
                      <Text
                        style={[
                          styles.resultValue,
                          {
                            color: calculatedOngkir.isFreeCharge
                              ? '#15803d'
                              : '#0284c7',
                            fontWeight: '700',
                          },
                        ]}
                      >
                        {calculatedOngkir.isFreeCharge
                          ? 'GRATIS'
                          : `+Rp ${formatThousandsId(
                              calculatedOngkir.ongkirPerPcs,
                            )} /Pcs`}
                      </Text>
                    </View>

                    {/* Total Kalkulasi per Pcs */}
                    {(() => {
                      const rawHrg =
                        garmenCalcResult.hargaUpPerPcs ||
                        garmenCalcResult.hargaJualRevisi ||
                        garmenCalcResult.hargaJualPerPcs ||
                        garmenCalcResult.hargaJual ||
                        0;
                      const dppPerPcs =
                        rawHrg + (calculatedOngkir.ongkirPerPcs || 0);
                      const finalPerPcs = isIncPpn
                        ? Math.round(dppPerPcs * 1.11)
                        : dppPerPcs;
                      const orderQty = toNumCurrency(mh_jmlorder) || 1;
                      const totalOrderKeseluruhan = finalPerPcs * orderQty;
                      const ppnTotal = isIncPpn
                        ? Math.round(dppPerPcs * 0.11) * orderQty
                        : 0;

                      return (
                        <>
                          <View
                            style={[styles.resultRow, styles.resultTotalRow]}
                          >
                            <Text style={styles.resultTotalLabel}>
                              Total Kalkulasi:
                            </Text>
                            <Text
                              style={[
                                styles.resultTotalValue,
                                {
                                  color: isIncPpn ? '#15803d' : '#0284c7',
                                  fontSize: 16,
                                },
                              ]}
                            >
                              Rp {formatThousandsId(finalPerPcs)} /Pcs
                            </Text>
                          </View>

                          {/* Row PPN 11% jika INC PPN aktif */}
                          {isIncPpn && (
                            <View style={styles.resultRow}>
                              <Text
                                style={[
                                  styles.resultLabel,
                                  { color: '#047857', fontWeight: '700' },
                                ]}
                              >
                                Biaya PPN 11%:
                              </Text>
                              <Text
                                style={[
                                  styles.resultValue,
                                  { color: '#047857', fontWeight: '800' },
                                ]}
                              >
                                +Rp {formatThousandsId(ppnTotal)}
                              </Text>
                            </View>
                          )}

                          {/* Total Order Keseluruhan */}
                          <View style={styles.resultRow}>
                            <Text
                              style={[styles.resultLabel, { fontSize: 11 }]}
                            >
                              Total Order Keseluruhan (
                              {formatThousandsId(mh_jmlorder || 0)} pcs):
                            </Text>
                            <Text
                              style={[
                                styles.resultValue,
                                { fontSize: 11.5, fontWeight: '700' },
                              ]}
                            >
                              Rp {formatThousandsId(totalOrderKeseluruhan)}
                            </Text>
                          </View>
                        </>
                      );
                    })()}
                  </View>
                )}

                {/* Accordion Tabel Referensi Strata Garmen (Sama persis Spanduk & MMT) */}
                {garmenCalcResult && (
                  <>
                    <TouchableOpacity
                      style={styles.strataAccordionHeader}
                      onPress={() => setShowGarmenStrataTabel(v => !v)}
                    >
                      <View style={styles.row}>
                        <MaterialIcons
                          name="table-chart"
                          size={16}
                          color={THEME.primary}
                        />
                        <Text style={styles.strataAccordionTitle}>
                          Tabel Master Bahan (
                          {garmenKodeModel === 'KH-0001'
                            ? '1 Warna'
                            : '2 Warna'}
                          {' - '}
                          {garmenWarna})
                        </Text>
                      </View>
                      <MaterialIcons
                        name={
                          showGarmenStrataTabel ? 'expand-less' : 'expand-more'
                        }
                        size={20}
                        color={THEME.muted}
                      />
                    </TouchableOpacity>

                    {showGarmenStrataTabel &&
                      (garmenCalcResult.tabelReferensi ||
                        garmenCalcResult.tanggaMargin) && (
                        <View style={styles.strataTableBox}>
                          <View style={styles.strataTableHeader}>
                            <Text style={[styles.strataTh, { flex: 1.2 }]}>
                              Rentang Qty
                            </Text>
                            <Text
                              style={[
                                styles.strataTh,
                                { flex: 1, textAlign: 'right' },
                              ]}
                            >
                              Harga / Pcs
                            </Text>
                          </View>
                          {(
                            garmenCalcResult.tabelReferensi ||
                            garmenCalcResult.tanggaMargin ||
                            []
                          )
                            .filter(
                              (item: any, i: number, arr: any[]) =>
                                arr.findIndex(
                                  (x: any) =>
                                    (x.qmin ?? x.minOrder ?? 0) ===
                                    (item.qmin ?? item.minOrder ?? 0),
                                ) === i,
                            )
                            .map((tier: any, idx: number) => {
                              const qmin = tier.qmin ?? tier.minOrder ?? 0;
                              const qmax = tier.qmax ?? tier.maxOrder ?? 999999;
                              const isActive =
                                (tier.tier &&
                                  tier.tier ===
                                    garmenCalcResult.strataAktif?.tier) ||
                                (toNumCurrency(mh_jmlorder) >= qmin &&
                                  toNumCurrency(mh_jmlorder) <= qmax);
                              const hargaTier =
                                tier.up ?? tier.jual ?? tier.hargaJual ?? 0;

                              return (
                                <View
                                  key={`g-ref-${idx}`}
                                  style={[
                                    styles.strataTableRow,
                                    isActive && styles.strataTableRowActive,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.strataTd,
                                      { flex: 1.2 },
                                      isActive && styles.strataTdActive,
                                    ]}
                                  >
                                    {tier.label ||
                                      `${formatThousandsId(qmin)} - ${
                                        qmax >= 999999
                                          ? '≥ 1000'
                                          : formatThousandsId(qmax)
                                      } pcs`}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.strataTd,
                                      { flex: 1, textAlign: 'right' },
                                      isActive && styles.strataTdActive,
                                    ]}
                                  >
                                    Rp {formatThousandsId(hargaTier)}
                                  </Text>
                                </View>
                              );
                            })}
                        </View>
                      )}
                  </>
                )}
              </View>
            )}

            {/* CARD KETERANGAN KALKULASI MANDIRI */}
            <View style={[styles.card, { marginTop: 12 }]}>
              <Text style={styles.sectionHeading}>Keterangan Kalkulasi</Text>
              <View style={[styles.fieldWrap, { marginTop: 8 }]}>
                <TextInput
                  style={[
                    styles.input,
                    { height: 60, textAlignVertical: 'top' },
                  ]}
                  value={keteranganKalkulasi}
                  onChangeText={setKeteranganKalkulasi}
                  placeholder="Ketik keterangan kalkulasi..."
                  multiline
                  numberOfLines={2}
                />
              </View>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* WIZARD LANGKAH 3: REVIEW & PENGAJUAN (FINAL INVOICE SUMMARY) */}
        {/* ========================================================================= */}
        {currentStep === 3 && (
          <View>
            <View style={styles.card}>
              <View style={styles.reviewHeaderBadge}>
                <MaterialIcons name="fact-check" size={18} color="#15803d" />
                <Text style={styles.reviewHeaderText}>
                  Resume Pengajuan Permintaan Harga
                </Text>
              </View>

              {/* Lampiran Foto Contoh Produk (1 Slot) */}
              <View style={styles.reviewSection}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <Text style={styles.reviewSectionTitle}>
                    Lampiran Foto Contoh Produk
                  </Text>
                  <View style={styles.photoLimitBadge}>
                    <Text style={styles.photoLimitText}>Maks. 1 MB</Text>
                  </View>
                </View>

                {photo ? (
                  <View style={styles.photoPreviewCardSingle}>
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.photoPreviewImg}
                    />
                    <TouchableOpacity
                      style={styles.photoDeleteBtn}
                      onPress={() => setPhoto(null)}
                    >
                      <MaterialIcons name="close" size={16} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.photoMetaBadge}>
                      <Text style={styles.photoMetaText}>
                        {photo.sizeBytes
                          ? `${(photo.sizeBytes / 1024).toFixed(
                              0,
                            )} KB (Siap Unggah)`
                          : 'Siap Unggah'}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.photoActionBoxSingle}>
                    <View
                      style={{ flexDirection: 'row', gap: 10, width: '100%' }}
                    >
                      <TouchableOpacity
                        style={[styles.photoBtn, { flex: 1 }]}
                        onPress={() => pickFromCamera()}
                        disabled={compressing}
                      >
                        <MaterialIcons
                          name="photo-camera"
                          size={18}
                          color={THEME.primary}
                        />
                        <Text style={styles.photoBtnText}>Kamera</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.photoBtn, { flex: 1 }]}
                        onPress={() => pickFromGallery()}
                        disabled={compressing}
                      >
                        <MaterialIcons
                          name="photo-library"
                          size={18}
                          color="#0284c7"
                        />
                        <Text
                          style={[styles.photoBtnText, { color: '#0284c7' }]}
                        >
                          Galeri
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text
                      style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}
                    >
                      * Unggah sample desain (Opsional)
                    </Text>
                  </View>
                )}

                {compressing && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    <ActivityIndicator size="small" color={THEME.primary} />
                    <Text
                      style={{
                        fontSize: 12,
                        color: THEME.primary,
                        fontWeight: '600',
                      }}
                    >
                      Mengompres foto ke batas 1 MB...
                    </Text>
                  </View>
                )}
              </View>

              {/* Customer & Job Info */}
              <View style={styles.reviewSection}>
                <Text style={styles.reviewSectionTitle}>
                  Customer & Pekerjaan
                </Text>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Customer:</Text>
                  <Text style={styles.reviewValBold}>{mh_cus_nama || '-'}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Nama Pekerjaan:</Text>
                  <Text style={styles.reviewValBold}>{mh_nama || '-'}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Divisi:</Text>
                  <Text style={styles.reviewVal}>{selectedDivisiLabel}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Rencana Tgl Order:</Text>
                  <Text style={styles.reviewValBold}>
                    {formatDateOrderDisplay(mh_dateorder) || '-'}
                  </Text>
                </View>
              </View>

              {/* Spesifikasi Detail (Compact) */}
              <View style={styles.reviewSection}>
                <Text style={styles.reviewSectionTitle}>
                  Spesifikasi Detail
                </Text>

                {mh_divisi === '4' ? (
                  <>
                    <View style={styles.reviewRow}>
                      <Text style={styles.reviewLabel}>Model:</Text>
                      <Text style={styles.reviewValBold}>
                        {garmenKodeModel === 'KH-0001'
                          ? '1 Warna (KH-0001)'
                          : '2 Warna (KH-0002)'}
                      </Text>
                    </View>
                    <View style={styles.reviewRow}>
                      <Text style={styles.reviewLabel}>Kain & Warna:</Text>
                      <Text style={styles.reviewVal}>
                        {garmenJenisKain || mh_kain || '-'} ({garmenWarna})
                      </Text>
                    </View>
                    {mh_ukuran ? (
                      <View style={styles.reviewRow}>
                        <Text style={styles.reviewLabel}>Rincian Ukuran:</Text>
                        <Text style={styles.reviewValBold}>{mh_ukuran}</Text>
                      </View>
                    ) : null}
                  </>
                ) : mh_divisi === '1' ? (
                  <>
                    <View style={styles.reviewRow}>
                      <Text style={styles.reviewLabel}>Kain Spanduk:</Text>
                      <Text style={styles.reviewValBold}>
                        {spandukJenisKain || mh_kain || 'POLYESTER 50/36'}
                      </Text>
                    </View>
                    <View style={styles.reviewRow}>
                      <Text style={styles.reviewLabel}>Ukuran (P x L):</Text>
                      <Text style={styles.reviewVal}>
                        {mh_panjang || 0} m x {mh_lebar || spandukLebar || 0} cm
                      </Text>
                    </View>
                    {spandukResult?.finishing?.items &&
                    spandukResult.finishing.items.length > 0 ? (
                      <View style={styles.reviewRow}>
                        <Text style={styles.reviewLabel}>Finishing Spanduk:</Text>
                        <Text style={styles.reviewValBold}>
                          {spandukResult.finishing.items
                            .map((it: any) => it.nama)
                            .join(', ')}
                        </Text>
                      </View>
                    ) : null}
                  </>
                ) : mh_divisi === '5' ? (
                  <>
                    <View style={styles.reviewRow}>
                      <Text style={styles.reviewLabel}>Kategori & Bahan:</Text>
                      <Text style={styles.reviewValBold}>
                        {mmtKategori} - {mh_kain || mmtBahanKode}
                      </Text>
                    </View>
                    <View style={styles.reviewRow}>
                      <Text style={styles.reviewLabel}>Ukuran (P x L):</Text>
                      <Text style={styles.reviewVal}>
                        {mh_panjang || 0} m x {mh_lebar || 0} m (
                        {Math.round(
                          toNumDecimal(mh_panjang) *
                            toNumDecimal(mh_lebar) *
                            100,
                        ) / 100}{' '}
                        m²/pcs)
                      </Text>
                    </View>
                    {mmtToppingKode ? (
                      <View style={styles.reviewRow}>
                        <Text style={styles.reviewLabel}>Topping:</Text>
                        <Text style={styles.reviewVal}>
                          {mmtToppingKode} ({mmtToppingQty || 1}x)
                        </Text>
                      </View>
                    ) : null}
                    <View style={styles.reviewRow}>
                      <Text style={styles.reviewLabel}>Tipe Tarif:</Text>
                      <Text
                        style={[
                          styles.reviewVal,
                          mmtIsNetto && { color: '#9333ea', fontWeight: '700' },
                        ]}
                      >
                        {mmtIsNetto ? 'Harga Netto' : 'Harga Standar (Strata)'}
                      </Text>
                    </View>
                    {mmtIsNetto && mmtAlasanNetto.trim() ? (
                      <View style={styles.reviewRow}>
                        <Text style={styles.reviewLabel}>Alasan Netto:</Text>
                        <Text
                          style={[
                            styles.reviewValBold,
                            { color: '#7e22ce', flex: 1, textAlign: 'right' },
                          ]}
                        >
                          {mmtAlasanNetto.trim()}
                        </Text>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <>
                    {mh_kain ? (
                      <View style={styles.reviewRow}>
                        <Text style={styles.reviewLabel}>Bahan / Kain:</Text>
                        <Text style={styles.reviewValBold}>{mh_kain}</Text>
                      </View>
                    ) : null}
                    <View style={styles.reviewRow}>
                      <Text style={styles.reviewLabel}>Ukuran (P x L):</Text>
                      <Text style={styles.reviewVal}>
                        {mh_panjang
                          ? `${mh_panjang} m x ${mh_lebar} m`
                          : mh_ukuran || '-'}
                      </Text>
                    </View>
                  </>
                )}

                {mh_gramasi ? (
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewLabel}>Gramasi:</Text>
                    <Text style={styles.reviewVal}>{mh_gramasi}</Text>
                  </View>
                ) : null}

                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Jumlah Order:</Text>
                  <Text
                    style={[
                      styles.reviewValBold,
                      { color: THEME.primary, fontSize: 13.5 },
                    ]}
                  >
                    {formatThousandsId(mh_jmlorder || 0)} Pcs
                  </Text>
                </View>

                {mh_finishing ? (
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewLabel}>Finishing:</Text>
                    <Text style={styles.reviewVal}>{mh_finishing}</Text>
                  </View>
                ) : null}

                {mh_sublim ? (
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewLabel}>Sublim:</Text>
                    <Text style={styles.reviewVal}>{mh_sublim}</Text>
                  </View>
                ) : null}

                {mh_ket ? (
                  <View
                    style={[
                      styles.reviewRow,
                      {
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        borderBottomWidth: 0,
                        paddingTop: 3,
                      },
                    ]}
                  >
                    <Text style={[styles.reviewLabel, { marginBottom: 1 }]}>
                      Keterangan:
                    </Text>
                    <Text
                      style={[
                        styles.reviewVal,
                        {
                          fontStyle: 'italic',
                          fontSize: 11.5,
                          color: '#475569',
                        },
                      ]}
                    >
                      {mh_ket}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Final Price Summary Box */}
              <View style={styles.reviewPriceBox}>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>
                    Estimasi Standar Kalkulasi / Pcs:
                  </Text>
                  <Text
                    style={[
                      styles.resultTotalValue,
                      {
                        color: isIncPpn ? '#15803d' : '#0284c7',
                        fontSize: 15,
                      },
                    ]}
                  >
                    Rp {formatThousandsId(mh_harga_kalkulasi || 0)} /Pcs
                  </Text>
                </View>

                {isIncPpn ? (
                  <View style={[styles.reviewRow, { marginTop: 4 }]}>
                    <Text style={[styles.reviewLabel, { color: '#15803d' }]}>
                      Biaya PPN (11%):
                    </Text>
                    <Text
                      style={[
                        styles.reviewValBold,
                        { fontSize: 14, color: '#15803d' },
                      ]}
                    >
                      Rp{' '}
                      {formatThousandsId(
                        (() => {
                          const unitPrice = mh_harga_kalkulasi || 0;
                          const qty = toNumCurrency(mh_jmlorder) || 1;
                          const dppUnit = Math.round(unitPrice / 1.11);
                          return Math.round((unitPrice - dppUnit) * qty);
                        })(),
                      )}
                    </Text>
                  </View>
                ) : null}

                {isIncPpn ? (
                  <View
                    style={[
                      styles.reviewRow,
                      {
                        marginTop: 6,
                        paddingTop: 6,
                        borderTopWidth: 1,
                        borderColor: '#bbf7d0',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.reviewLabel,
                        { fontWeight: '800', color: '#166534' },
                      ]}
                    >
                      Total Kalkulasi (INC PPN 11%):
                    </Text>
                    <Text
                      style={[
                        styles.reviewValBold,
                        { fontSize: 17, color: '#15803d' },
                      ]}
                    >
                      Rp{' '}
                      {formatThousandsId(
                        (mh_harga_kalkulasi || 0) * toNumCurrency(mh_jmlorder),
                      )}
                    </Text>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.reviewRow,
                      {
                        marginTop: 6,
                        paddingTop: 6,
                        borderTopWidth: 1,
                        borderColor: '#bbf7d0',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.reviewLabel,
                        { fontWeight: '800', color: '#334155' },
                      ]}
                    >
                      Total Kalkulasi (Non PPN):
                    </Text>
                    <Text
                      style={[
                        styles.reviewValBold,
                        { fontSize: 17, color: '#1e293b' },
                      ]}
                    >
                      Rp{' '}
                      {formatThousandsId(
                        (mh_harga_kalkulasi || 0) * toNumCurrency(mh_jmlorder),
                      )}
                    </Text>
                  </View>
                )}

                {/* Biaya Ongkir Review Row */}
                <View style={[styles.reviewRow, { marginTop: 4 }]}>
                  <Text
                    style={[
                      styles.reviewLabel,
                      {
                        color: calculatedOngkir.isFreeCharge
                          ? '#15803d'
                          : '#0369a1',
                      },
                    ]}
                  >
                    Ongkir ({calculatedOngkir.alokasi}):
                  </Text>
                  <Text
                    style={[
                      styles.reviewValBold,
                      {
                        fontSize: 13,
                        color: calculatedOngkir.isFreeCharge
                          ? '#15803d'
                          : '#0284c7',
                      },
                    ]}
                  >
                    {calculatedOngkir.isFreeCharge
                      ? 'GRATIS ONGKIR'
                      : `Rp ${formatThousandsId(
                          calculatedOngkir.totalOngkir,
                        )} (+Rp ${formatThousandsId(
                          calculatedOngkir.ongkirPerPcs,
                        )} /pcs)`}
                  </Text>
                </View>

                {/* Keterangan Kalkulasi Review */}
                <View
                  style={{
                    marginTop: 8,
                    paddingTop: 6,
                    borderTopWidth: 1,
                    borderColor: '#dcfce7',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      color: '#166534',
                      fontWeight: '700',
                    }}
                  >
                    Keterangan Kalkulasi:
                  </Text>
                  <Text
                    style={{ fontSize: 12, color: THEME.ink, marginTop: 2 }}
                  >
                    {keteranganKalkulasi.trim() || '—'}
                  </Text>
                </View>
              </View>
            </View>

            {/* RIWAYAT TRANSAKSI & HARGA LAMA SO CUSTOMER (DROPDOWN COLLAPSIBLE) */}
            <View style={[styles.card, { marginTop: 14 }]}>
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
                activeOpacity={0.7}
                onPress={() => setIsSoHistoryExpanded(prev => !prev)}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    flex: 1,
                  }}
                >
                  <MaterialIcons name="history" size={22} color="#0284c7" />
                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <Text style={styles.sectionHeadingNoMargin}>
                        Riwayat Order Customer
                      </Text>
                      <View style={styles.soCountBadge}>
                        <Text style={styles.soCountBadgeText}>
                          {customerSoList.length} SO
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.soCustomerSubText, { marginTop: 2 }]}>
                      <MaterialIcons
                        name="business"
                        size={12}
                        color={THEME.ink}
                      />{' '}
                      <Text style={{ fontWeight: '700', color: THEME.ink }}>
                        {mh_cus_nama || 'Belum dipilih'}
                      </Text>
                    </Text>
                  </View>
                </View>

                <View style={styles.soDropdownToggleBtn}>
                  <MaterialIcons
                    name={
                      isSoHistoryExpanded
                        ? 'keyboard-arrow-up'
                        : 'keyboard-arrow-down'
                    }
                    size={24}
                    color="#0284c7"
                  />
                </View>
              </TouchableOpacity>

              {/* Konten Dropdown (Hanya Tampil Saat Expanded) */}
              {isSoHistoryExpanded && (
                <View style={{ marginTop: 10 }}>
                  {/* Form Pencarian Riwayat SO */}
                  {customerSoList.length > 0 ? (
                    <View style={styles.soSearchInputWrap}>
                      <MaterialIcons
                        name="search"
                        size={18}
                        color="#64748b"
                        style={{ marginRight: 6 }}
                      />
                      <TextInput
                        style={styles.soSearchInputField}
                        placeholder="Cari nomor SO, pekerjaan, detail..."
                        placeholderTextColor="#94a3b8"
                        value={soSearchKeyword}
                        onChangeText={setSoSearchKeyword}
                        returnKeyType="search"
                      />
                      {soSearchKeyword.trim() ? (
                        <TouchableOpacity
                          onPress={() => setSoSearchKeyword('')}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{ padding: 2 }}
                        >
                          <MaterialIcons
                            name="cancel"
                            size={18}
                            color="#94a3b8"
                          />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}

                  {loadingSoHistory ? (
                    <View
                      style={{
                        paddingVertical: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ActivityIndicator size="small" color="#0284c7" />
                      <Text
                        style={{
                          fontSize: 12,
                          color: '#64748b',
                          marginTop: 6,
                        }}
                      >
                        Memuat riwayat SO pelanggan...
                      </Text>
                    </View>
                  ) : customerSoList.length === 0 ? (
                    <View style={styles.soEmptyBox}>
                      <MaterialIcons
                        name="receipt-long"
                        size={25}
                        color="#cbd5e1"
                      />
                      <Text style={styles.soEmptyTitle}>
                        Riwayat Tidak Ditemukan
                      </Text>
                      <Text style={styles.soEmptySub}>
                        Customer ini belum memiliki riwayat order sebelumnya.
                      </Text>
                    </View>
                  ) : filteredCustomerSoList.length === 0 ? (
                    <View style={styles.soEmptyBox}>
                      <MaterialIcons
                        name="search-off"
                        size={25}
                        color="#cbd5e1"
                      />
                      <Text style={styles.soEmptyTitle}>
                        Hasil Tidak Ditemukan
                      </Text>
                      <Text style={styles.soEmptySub}>
                        Tidak ada riwayat SO yang cocok dengan "
                        {soSearchKeyword}".
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 10 }}>
                      {filteredCustomerSoList.map((so, idx) => (
                        <View
                          key={`${so.so_nomor}-${idx}`}
                          style={styles.soItemCard}
                        >
                          {/* Header SO Item */}
                          <View style={styles.soItemHeaderRow}>
                            <View style={styles.soNomorBadge}>
                              <Text style={styles.soNomorBadgeText}>
                                {so.so_nomor}
                              </Text>
                            </View>
                            {so.divisi_nama ? (
                              <View style={styles.soDivisiBadge}>
                                <Text style={styles.soDivisiBadgeText}>
                                  {so.divisi_nama}
                                </Text>
                              </View>
                            ) : null}
                            <Text style={styles.soTanggalText}>
                              {so.so_tanggal_fmt || so.so_tanggal}
                            </Text>
                          </View>

                          {/* Nama Item Pekerjaan */}
                          <Text style={styles.soItemName} numberOfLines={2}>
                            {so.so_nama ||
                              so.so_nama2 ||
                              'Pekerjaan Tanpa Nama'}
                          </Text>

                          {/* Qty, Harga Satuan, & Total Nominal SO */}
                          {(() => {
                            const soJumlah = Number(so.so_jumlah) || 0;
                            const soHarga = Number(so.so_harga) || 0;
                            const soTotal = soJumlah * soHarga;

                            return (
                              <View style={styles.soItemPriceRow}>
                                <View style={styles.soPriceCol}>
                                  <Text style={styles.soItemQtyText}>
                                    Qty:{' '}
                                    <Text
                                      style={{
                                        fontWeight: '700',
                                        color: THEME.ink,
                                      }}
                                    >
                                      {formatThousandsId(soJumlah)}
                                    </Text>
                                  </Text>
                                </View>

                                <View style={styles.soPriceCol}>
                                  <Text style={styles.soItemUnitPriceText}>
                                    Rp {formatThousandsId(soHarga)}/pcs
                                  </Text>
                                </View>

                                <View style={styles.soPriceCol}>
                                  <Text style={styles.soItemPriceText}>
                                    Total: Rp {formatThousandsId(soTotal)}
                                  </Text>
                                </View>
                              </View>
                            );
                          })()}

                          {/* Spesifikasi Lengkap SO */}
                          <View style={styles.soItemSpecBox}>
                            {so.so_kain ? (
                              <Text style={styles.soItemSpecLine}>
                                •{' '}
                                <Text style={styles.soItemSpecLabel}>
                                  Bahan/Kain:
                                </Text>{' '}
                                {so.so_kain}
                              </Text>
                            ) : null}
                            {so.so_ukuran ? (
                              <Text style={styles.soItemSpecLine}>
                                •{' '}
                                <Text style={styles.soItemSpecLabel}>
                                  Ukuran:
                                </Text>{' '}
                                {so.so_ukuran}
                              </Text>
                            ) : so.so_panjang || so.so_lebar ? (
                              <Text style={styles.soItemSpecLine}>
                                •{' '}
                                <Text style={styles.soItemSpecLabel}>
                                  Ukuran:
                                </Text>{' '}
                                {so.so_panjang} x {so.so_lebar}
                              </Text>
                            ) : null}
                            {so.so_finishing ? (
                              <Text style={styles.soItemSpecLine}>
                                •{' '}
                                <Text style={styles.soItemSpecLabel}>
                                  Finishing:
                                </Text>{' '}
                                {so.so_finishing}
                              </Text>
                            ) : null}
                            {so.so_keterangan ? (
                              <Text
                                style={[
                                  styles.soItemSpecLine,
                                  { fontStyle: 'italic', color: '#64748b' },
                                ]}
                              >
                                •{' '}
                                <Text style={styles.soItemSpecLabel}>Ket:</Text>{' '}
                                {so.so_keterangan}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* PENGAJUAN HARGA SALES & STATUS APPROVAL */}
            <View style={[styles.card, { marginTop: 14 }]}>
              <View style={styles.reviewHeaderWithIcon}>
                <MaterialIcons
                  name="monetization-on"
                  size={20}
                  color={THEME.primary}
                />
                <Text style={styles.sectionHeadingNoMargin}>
                  Permintaan Harga Custom
                </Text>
              </View>

              {/* Info Pembanding Harga Standar Kalkulasi */}
              <View style={styles.calcStandardBox}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 8,
                  }}
                >
                  <Text style={styles.calcStandardLabel}>
                    Kalkulasi Sistem:
                  </Text>
                  <Text style={styles.calcStandardValue}>
                    Rp {formatThousandsId(mh_harga_kalkulasi || 0)} /pcs
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 8,
                    marginTop: 4,
                  }}
                >
                  <Text style={styles.calcStandardSubLabel}>
                    Total ({formatThousandsId(mh_jmlorder || 0)} Pcs):
                  </Text>
                  <Text style={styles.calcStandardSubValue}>
                    Rp{' '}
                    {formatThousandsId(
                      (mh_harga_kalkulasi || 0) * toNumCurrency(mh_jmlorder),
                    )}
                  </Text>
                </View>
              </View>

              {/* Input Harga Pengajuan Sales */}
              <View style={[styles.fieldWrap, { marginTop: 12 }]}>
                <Text style={styles.label}>
                  Ajukan Permintaan Harga Per Pcs
                  <Text style={styles.req}>*</Text>
                </Text>
                <View style={styles.currencyInputWrap}>
                  <Text style={styles.currencyPrefix}>Rp</Text>
                  <TextInput
                    style={styles.currencyInputField}
                    keyboardType="numeric"
                    value={
                      mh_harga !== ''
                        ? formatThousandsId(toNumCurrency(mh_harga))
                        : '0'
                    }
                    onChangeText={val => {
                      const numeric = val.replace(/[^0-9]/g, '');
                      setMhHarga(numeric);
                    }}
                    placeholder="Masukkan harga pengajuan..."
                    placeholderTextColor="#04080eff"
                  />
                </View>
                <Text style={styles.totalProposedText}>
                  Total Nilai Pengajuan: Rp{' '}
                  {formatThousandsId(
                    (toNumCurrency(mh_harga) || 0) * toNumCurrency(mh_jmlorder),
                  )}
                </Text>
              </View>

              {/* Input Alasan Permintaan (Masuk ke mh_ket_kalkulasi) */}
              <View style={[styles.fieldWrap, { marginTop: 12 }]}>
                <Text style={styles.label}>
                  Alasan Permintaan Harga{' '}
                  {toNumCurrency(mh_harga) < mh_harga_kalkulasi &&
                  mh_harga_kalkulasi > 0 ? (
                    <Text style={styles.req}>(Wajib Diisi)*</Text>
                  ) : (
                    <Text style={{ fontSize: 11, color: '#94a3b8' }}>
                      (Opsional)
                    </Text>
                  )}
                </Text>
                <TextInput
                  style={[styles.input, styles.textAreaInput]}
                  multiline
                  numberOfLines={3}
                  value={alasanPengajuan}
                  onChangeText={setAlasanPengajuan}
                  placeholder="Contoh: Diskon repeat order partai besar, menyesuaikan SO terakhir, penyesuaian budget klien..."
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            {/* ========================================================================= */}
            {/* TOMBOL AKSI DI PALING BAWAH REVIEW (AGAR SALES ME-REVIEW KESELURUHAN) */}
            {/* ========================================================================= */}
            <View style={styles.reviewBottomActionBox}>
              <TouchableOpacity
                style={styles.reviewBtnSecondary}
                onPress={() => setCurrentStep(2)}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="arrow-back"
                  size={16}
                  color={THEME.ink}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.reviewBtnSecondaryText}>Hitung Ulang</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.reviewBtnPrimary}
                onPress={() => setShowConfirmSubmitModal(true)}
                disabled={saving}
                activeOpacity={0.9}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.reviewBtnPrimaryText}>
                    {mode === 'edit' ? 'Simpan Perubahan' : 'Kirim Pengajuan'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* WIZARD FOOTER ACTION NAVIGATION BAR (HANYA UNTUK LANGKAH 1 & 2) */}
      {/* ========================================================================= */}
      {currentStep !== 3 && (
        <View style={styles.footerContainer}>
          {currentStep === 1 && (
            <View style={{ width: '100%' }}>
              <TouchableOpacity
                style={[
                  styles.navBtnPrimary,
                  { backgroundColor: THEME.primary },
                ]}
                onPress={goToStep2Kalkulasi}
                activeOpacity={0.9}
              >
                <Text style={styles.navBtnPrimaryText}>Kalkulasi Harga ➔</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.bypassBtnCard}
                onPress={handleBypassDirectSubmit}
                activeOpacity={0.8}
              >
                <Text style={styles.bypassBtnText}>
                  Buat Permintaan Harga (Tanpa Kalkulasi)
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {currentStep === 2 && (
            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <TouchableOpacity
                style={styles.navBtnSecondary}
                onPress={() => setCurrentStep(1)}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="arrow-back"
                  size={16}
                  color={THEME.ink}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.navBtnSecondaryText}>Ubah Spek</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.navBtnPrimary,
                  { flex: 1.6, backgroundColor: '#0284c7' },
                ]}
                onPress={goToStep3Review}
                activeOpacity={0.9}
              >
                <Text style={styles.navBtnPrimaryText}>Lanjut ke Review ➔</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Date Picker Modal */}
      {/* MODAL SEARCH & PILIH CUSTOMER */}
      <Modal
        visible={showCustomerModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCustomerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContentCard,
              {
                paddingTop: insets.top + 10,
                paddingBottom: insets.bottom + 16,
              },
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <View style={styles.modalHeaderIconWrap}>
                  <MaterialIcons
                    name="people"
                    size={20}
                    color={THEME.primary}
                  />
                </View>
                <View>
                  <Text style={styles.modalHeaderTitle}>Pilih Customer</Text>
                  <Text style={styles.modalHeaderSub}>
                    Cari customer terdaftar di sistem
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowCustomerModal(false)}
              >
                <MaterialIcons name="close" size={22} color={THEME.ink} />
              </TouchableOpacity>
            </View>

            {/* Search Bar & Tambah Customer Button */}
            <View style={styles.modalSearchArea}>
              <View style={styles.modalSearchBox}>
                <MaterialIcons
                  name="search"
                  size={20}
                  color="#64748b"
                  style={{ marginRight: 6 }}
                />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Ketik nama customer / kode..."
                  placeholderTextColor="#94a3b8"
                  value={customerSearchKeyword}
                  onChangeText={setCustomerSearchKeyword}
                  autoFocus={true}
                />
                {customerSearchKeyword ? (
                  <TouchableOpacity
                    onPress={() => setCustomerSearchKeyword('')}
                  >
                    <MaterialIcons name="cancel" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                ) : null}
              </View>

              <TouchableOpacity
                style={styles.modalAddCustomerBtn}
                onPress={() => {
                  setShowCustomerModal(false);
                  runGuardedPress('ph:modal-add-customer', () => {
                    navigation.navigate('TambahCustomerPermintaanHarga');
                  });
                }}
                activeOpacity={0.85}
              >
                <MaterialIcons name="person-add-alt-1" size={16} color="#fff" />
                <Text style={styles.modalAddCustomerText}>+ Customer Baru</Text>
              </TouchableOpacity>
            </View>

            {/* List Customer */}
            {customerLoading ? (
              <View style={styles.modalLoadingWrap}>
                <ActivityIndicator size="large" color={THEME.primary} />
                <Text style={styles.modalLoadingText}>
                  Memuat data customer...
                </Text>
              </View>
            ) : (
              <FlatList
                data={customerList}
                keyExtractor={(item, index) => item.kode || 'cus-' + index}
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  paddingBottom: 24,
                }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View style={styles.modalEmptyWrap}>
                    <MaterialIcons
                      name="person-off"
                      size={48}
                      color="#cbd5e1"
                    />
                    <Text style={styles.modalEmptyTitle}>
                      Customer Tidak Ditemukan
                    </Text>
                    <Text style={styles.modalEmptySub}>
                      Ketik kata kunci lain atau tambahkan sebagai customer baru
                    </Text>
                    <TouchableOpacity
                      style={styles.emptyAddBtn}
                      onPress={() => {
                        setShowCustomerModal(false);
                        navigation.navigate('TambahCustomerPermintaanHarga');
                      }}
                    >
                      <Text style={styles.emptyAddBtnText}>
                        + Tambah Customer Sekarang
                      </Text>
                    </TouchableOpacity>
                  </View>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.customerListItem}
                    onPress={() => selectCustomerItem(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.customerAvatar}>
                      <Text style={styles.customerAvatarText}>
                        {(item.nama || 'C').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.customerItemName}>{item.nama}</Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          marginTop: 2,
                        }}
                      >
                        {item.kode ? (
                          <View style={styles.customerCodeBadge}>
                            <Text style={styles.customerCodeBadgeText}>
                              {item.kode}
                            </Text>
                          </View>
                        ) : null}
                        {item.alamat ? (
                          <Text
                            style={styles.customerItemAddress}
                            numberOfLines={1}
                          >
                            {item.alamat}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <MaterialIcons
                      name="chevron-right"
                      size={22}
                      color="#cbd5e1"
                    />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL SEARCH & PILIH PRA ORDER */}
      <Modal
        visible={showPraOrderModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPraOrderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContentCard,
              {
                paddingTop: insets.top + 6,
                paddingBottom: insets.bottom + 16,
              },
            ]}
          >
            {/* Modal Header */}
            <View
              style={[
                styles.modalHeaderRow,
                {
                  paddingHorizontal: 20,
                },
              ]}
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <View
                  style={[
                    styles.modalHeaderIconWrap,
                    { width: 32, height: 32, borderRadius: 8 },
                  ]}
                >
                  <MaterialIcons
                    name="playlist-add-check"
                    size={18}
                    color={THEME.primary}
                  />
                </View>
                <View>
                  <Text style={[styles.modalHeaderTitle, { fontSize: 15 }]}>
                    Pilih Pra Order
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowPraOrderModal(false)}
              >
                <MaterialIcons name="close" size={20} color={THEME.ink} />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View
              style={[
                styles.modalSearchArea,
                {
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  marginBottom: 8,
                },
              ]}
            >
              <View
                style={[
                  styles.modalSearchBox,
                  {
                    flex: 1,
                    height: 36,
                    paddingHorizontal: 8,
                  },
                ]}
              >
                <MaterialIcons
                  name="search"
                  size={18}
                  color="#64748b"
                  style={{ marginRight: 6 }}
                />
                <TextInput
                  style={[styles.modalSearchInput, { fontSize: 12 }]}
                  placeholder="Ketik nomor, customer, atau pekerjaan..."
                  placeholderTextColor="#94a3b8"
                  value={praOrderSearchKeyword}
                  onChangeText={setPraOrderSearchKeyword}
                  autoFocus={true}
                />
                {praOrderSearchKeyword ? (
                  <TouchableOpacity
                    onPress={() => setPraOrderSearchKeyword('')}
                  >
                    <MaterialIcons name="cancel" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {/* List Pra Order */}
            {loadingPraOrder ? (
              <View style={styles.modalLoadingWrap}>
                <ActivityIndicator size="large" color={THEME.primary} />
                <Text style={styles.modalLoadingText}>
                  Memuat data pra order...
                </Text>
              </View>
            ) : (
              <FlatList
                data={praOrderList}
                keyExtractor={(item, index) => item.nomor || 'pra-' + index}
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  paddingBottom: 24,
                }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View style={styles.modalEmptyWrap}>
                    <MaterialIcons
                      name="search-off"
                      size={48}
                      color="#cbd5e1"
                    />
                    <Text style={styles.modalEmptyTitle}>
                      Pra Order Tidak Ditemukan
                    </Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.praOrderListItem}
                    onPress={() => handleSelectPraOrder(item)}
                    activeOpacity={0.7}
                    disabled={fetchingPraOrderDetail}
                  >
                    <View style={styles.praOrderItemHeader}>
                      <View style={{ flex: 1, alignItems: 'flex-start' }}>
                        <Text style={styles.praOrderItemNomor}>
                          {item.nomor}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.praOrderDivisiTag,
                          item.divisi === '4'
                            ? { backgroundColor: '#fef3c7' }
                            : item.divisi === '5'
                            ? { backgroundColor: '#ede9fe' }
                            : { backgroundColor: '#dcfce7' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.praOrderDivisiTagText,
                            item.divisi === '4'
                              ? { color: '#b45309' }
                              : item.divisi === '5'
                              ? { color: '#6d28d9' }
                              : { color: '#15803d' },
                          ]}
                        >
                          {item.divisiNama ||
                            (item.divisi === '4'
                              ? 'GARMEN'
                              : item.divisi === '5'
                              ? 'MMT'
                              : 'SPANDUK')}
                        </Text>
                      </View>

                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        {item.tanggal ? (
                          <Text
                            style={[
                              styles.praOrderItemDate,
                              { textAlign: 'right' },
                            ]}
                          >
                            {formatDateOrderDisplay(item.tanggal)}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    <Text style={styles.praOrderItemTitle}>
                      {item.namaPekerjaan || '-'}
                    </Text>

                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        marginBottom: 4,
                      }}
                    >
                      <MaterialIcons
                        name="person"
                        size={14}
                        color={THEME.ink}
                      />
                      <Text
                        style={styles.praOrderItemMetaText}
                        numberOfLines={1}
                      >
                        {item.cusNama}
                      </Text>
                    </View>

                    {item.qtyRencana ? (
                      <Text
                        style={[
                          styles.praOrderItemQtyText,
                          { marginBottom: 2 },
                        ]}
                      >
                        Rencana Order: {formatThousandsId(item.qtyRencana)} pcs
                      </Text>
                    ) : (
                      <Text style={styles.praOrderItemQtyText}>
                        Rencana Order: -
                      </Text>
                    )}

                    {item.sudahDipakaiOleh ? (
                      <View style={styles.praOrderUsedBadge}>
                        <MaterialIcons
                          name="link"
                          size={13}
                          color={THEME.info}
                        />
                        <Text style={styles.praOrderUsedBadgeText}>
                          Sudah terpakai pada {item.sudahDipakaiOleh}
                        </Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                )}
              />
            )}

            {fetchingPraOrderDetail && (
              <View style={styles.praOrderOverlayLoading}>
                <ActivityIndicator size="large" color="#ffffff" />
                <Text style={styles.praOrderOverlayLoadingText}>
                  Menerapkan Data Pra Order...
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL PEMILIHAN JENIS KAIN GARMEN */}
      <Modal
        visible={modalGarmenKainVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalGarmenKainVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContentCard,
              {
                paddingTop: insets.top + 10,
                paddingBottom: insets.bottom + 16,
              },
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <View
                  style={[
                    styles.modalHeaderIconWrap,
                    { backgroundColor: '#f5f3ff' },
                  ]}
                >
                  <MaterialIcons name="checkroom" size={20} color="#7c3aed" />
                </View>
                <View>
                  <Text style={styles.modalHeaderTitle}>
                    Pilih Jenis Kain Garmen
                  </Text>
                  <Text style={styles.modalHeaderSub}>
                    Katalog kain model{' '}
                    {garmenKodeModel === 'KH-0001' ? '1 Warna' : '2 Warna'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setModalGarmenKainVisible(false)}
              >
                <MaterialIcons name="close" size={22} color={THEME.ink} />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.modalSearchArea}>
              <View style={styles.modalSearchBox}>
                <MaterialIcons
                  name="search"
                  size={20}
                  color="#64748b"
                  style={{ marginRight: 6 }}
                />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Ketik nama kain garmen..."
                  placeholderTextColor="#94a3b8"
                  value={searchGarmenKain}
                  onChangeText={setSearchGarmenKain}
                />
                {searchGarmenKain ? (
                  <TouchableOpacity onPress={() => setSearchGarmenKain('')}>
                    <MaterialIcons name="cancel" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {/* Loading / List */}
            {garmenLoadingKain ? (
              <View style={styles.modalLoadingWrap}>
                <ActivityIndicator size="large" color="#7c3aed" />
                <Text style={styles.modalLoadingText}>
                  Memuat jenis kain garmen...
                </Text>
              </View>
            ) : (
              <FlatList
                data={garmenKainList.filter((k: any) => {
                  const name = (
                    k.mhk_kain ||
                    k.Jeniskain ||
                    k.nama ||
                    ''
                  ).toLowerCase();
                  return name.includes(searchGarmenKain.toLowerCase());
                })}
                keyExtractor={(item, index) =>
                  item.mhk_kain || item.Jeniskain || item.nama || String(index)
                }
                renderItem={({ item }) => {
                  const kainName =
                    item.mhk_kain || item.Jeniskain || item.nama || '';
                  const ktg = item.mhk_ktg || item.Kategori || '';
                  const isSelected = garmenJenisKain === kainName;
                  return (
                    <TouchableOpacity
                      style={[
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 12,
                          paddingHorizontal: 16,
                          borderBottomWidth: 1,
                          borderBottomColor: '#f1f5f9',
                          backgroundColor: isSelected ? '#f5f3ff' : '#ffffff',
                        },
                      ]}
                      onPress={() => {
                        setGarmenJenisKain(kainName);
                        setGarmenKategoriKain(ktg || 'cotton');
                        setMhKain(kainName);
                        const autoGram = getGramasiByKain(kainName);
                        if (autoGram) {
                          setMhGramasi(autoGram);
                        }
                        setModalGarmenKainVisible(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            {
                              fontSize: 14,
                              color: THEME.ink,
                              fontWeight: isSelected ? '700' : '500',
                            },
                            isSelected && { color: '#7c3aed' },
                          ]}
                        >
                          {kainName}
                        </Text>
                        {ktg ? (
                          <Text
                            style={{
                              fontSize: 11,
                              color: '#64748b',
                              marginTop: 2,
                              textTransform: 'uppercase',
                            }}
                          >
                            Kategori: {ktg}
                          </Text>
                        ) : null}
                      </View>
                      {isSelected && (
                        <MaterialIcons name="check" size={20} color="#7c3aed" />
                      )}
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.modalEmptyWrap}>
                    <Text style={styles.modalEmptyTitle}>
                      Kain tidak ditemukan
                    </Text>
                    <Text style={styles.modalEmptySub}>
                      Coba gunakan kata kunci pencarian yang lain
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL PEMILIHAN TAMBAHAN GARMEN */}
      <Modal
        visible={modalGarmenTambahanVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalGarmenTambahanVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContentCard,
              {
                paddingTop: insets.top + 10,
                paddingBottom: insets.bottom + 16,
              },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <View
                  style={[
                    styles.modalHeaderIconWrap,
                    { backgroundColor: '#f5f3ff' },
                  ]}
                >
                  <MaterialIcons
                    name="playlist-add"
                    size={20}
                    color="#7c3aed"
                  />
                </View>
                <View>
                  <Text style={styles.modalHeaderTitle}>Pilih Tambahan</Text>
                  <Text style={styles.modalHeaderSub}>
                    Tarif bahan {garmenKategoriKain.toUpperCase()} (x{' '}
                    {mh_jmlorder || 0} Pcs)
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setModalGarmenTambahanVisible(false)}
              >
                <MaterialIcons name="close" size={22} color={THEME.ink} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchArea}>
              <View style={styles.modalSearchBox}>
                <MaterialIcons
                  name="search"
                  size={20}
                  color="#64748b"
                  style={{ marginRight: 6 }}
                />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Cari item tambahan..."
                  placeholderTextColor="#94a3b8"
                  value={searchGarmenTambahan}
                  onChangeText={setSearchGarmenTambahan}
                />
                {searchGarmenTambahan ? (
                  <TouchableOpacity onPress={() => setSearchGarmenTambahan('')}>
                    <MaterialIcons name="cancel" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <FlatList
              data={garmenTambahanMaster.filter((tItem: any) => {
                const ket = (
                  tItem.mht_ket ||
                  tItem.mht_keterangan ||
                  tItem.nama ||
                  ''
                ).toLowerCase();
                return ket.includes(searchGarmenTambahan.toLowerCase());
              })}
              keyExtractor={(item, index) => item.mht_ket || String(index)}
              renderItem={({ item }) => {
                const ket =
                  item.mht_ket || item.mht_keterangan || item.nama || '';
                const tarif = getTambahanTarif(item);
                const isSelected = garmenSelectedTambahan.some(
                  t => t.ket === ket,
                );
                const qtyOrder = toNumCurrency(mh_jmlorder);
                const subtotal = tarif * qtyOrder;

                return (
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: '#f1f5f9',
                      backgroundColor: isSelected ? '#f5f3ff' : '#ffffff',
                    }}
                    onPress={() => {
                      if (isSelected) {
                        setGarmenSelectedTambahan(prev =>
                          prev.filter(t => t.ket !== ket),
                        );
                      } else {
                        setGarmenSelectedTambahan(prev => [
                          ...prev,
                          { ket, tarif },
                        ]);
                      }
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: isSelected ? '700' : '500',
                          color: isSelected ? '#7c3aed' : THEME.ink,
                        }}
                      >
                        {ket}
                      </Text>
                      <Text
                        style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}
                      >
                        Tarif: Rp {tarif.toLocaleString('id-ID')}/pcs{' '}
                        {qtyOrder > 0
                          ? `• Subtotal: Rp ${subtotal.toLocaleString('id-ID')}`
                          : ''}
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        borderWidth: 1.5,
                        borderColor: isSelected ? '#7c3aed' : '#cbd5e1',
                        backgroundColor: isSelected ? '#7c3aed' : '#ffffff',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      {isSelected && (
                        <MaterialIcons name="check" size={16} color="#fff" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.modalEmptyWrap}>
                  <Text style={styles.modalEmptyTitle}>
                    Tambahan tidak ditemukan
                  </Text>
                  <Text style={styles.modalEmptySub}>
                    Coba gunakan kata kunci pencarian yang lain
                  </Text>
                </View>
              }
            />

            <View style={{ paddingTop: 10 }}>
              <TouchableOpacity
                style={[
                  styles.modalCloseBtn,
                  {
                    width: '100%',
                    height: 44,
                    borderRadius: 8,
                    backgroundColor: '#7c3aed',
                    justifyContent: 'center',
                    alignItems: 'center',
                  },
                ]}
                onPress={() => setModalGarmenTambahanVisible(false)}
              >
                <Text
                  style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}
                >
                  Selesai ({garmenSelectedTambahan.length} Dipilih)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL PEMILIHAN CETAK / SABLON GARMEN (MINIMALIS & CLEAN) */}
      <Modal
        visible={modalGarmenCetakVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalGarmenCetakVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContentCard,
              {
                paddingTop: insets.top + 8,
                paddingBottom: insets.bottom + 12,
                maxHeight: '85%',
              },
            ]}
          >
            {/* Header Bersih Tanpa Ikon Berlebih */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingBottom: 10,
                borderBottomWidth: 1,
                borderBottomColor: '#f1f5f9',
              }}
            >
              <View>
                <Text style={styles.modalHeaderTitle}>
                  Pilih Sablon / Sublim / DTF / Bordir
                </Text>
                <Text style={styles.modalHeaderSub}>
                  Tarif bahan {garmenKategoriKain.toUpperCase()} (x{' '}
                  {mh_jmlorder || 0} Pcs)
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalGarmenCetakVisible(false)}
                style={{ padding: 4 }}
              >
                <MaterialIcons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Tab Kategori Minimalis (Sablon, Sublim, DTF, Bordir) */}
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: '#f1f5f9',
                borderRadius: 8,
                padding: 3,
                marginHorizontal: 16,
                marginTop: 10,
                marginBottom: 8,
                gap: 2,
              }}
            >
              {(
                [
                  { key: 'SABLON', label: 'Sablon' },
                  { key: 'SUBLIM', label: 'Sublim' },
                  { key: 'DTF', label: 'DTF' },
                  { key: 'BORDIR', label: 'Bordir' },
                ] as const
              ).map(tab => {
                const isActive = cetakActiveCategory === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={{
                      flex: 1,
                      paddingVertical: 7,
                      borderRadius: 6,
                      backgroundColor: isActive ? '#ffffff' : 'transparent',
                      alignItems: 'center',
                      shadowColor: isActive ? '#000' : 'transparent',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.08,
                      shadowRadius: 2,
                      elevation: isActive ? 1 : 0,
                    }}
                    onPress={() => {
                      setCetakActiveCategory(tab.key);
                      setSearchGarmenCetak('');
                      if (tab.key === 'DTF') {
                        const m = garmenCetakMaster.find(
                          (c: any) =>
                            (c.mhb_jenis || c.jenis || '').toUpperCase() ===
                            'DTF',
                        );
                        const defT = Number(m?.mhb_cm || 25);
                        if (!dtfTarifCm || Number(dtfTarifCm) < defT) {
                          setDtfTarifCm(String(defT));
                        }
                      } else if (tab.key === 'BORDIR') {
                        const m = garmenCetakMaster.find(
                          (c: any) =>
                            (c.mhb_jenis || c.jenis || '').toUpperCase() ===
                            'BORDIR',
                        );
                        const defT = Number(m?.mhb_cm || 90);
                        if (!bordirTarifCm || Number(bordirTarifCm) < defT) {
                          setBordirTarifCm(String(defT));
                        }
                      }
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: isActive ? '700' : '500',
                        color: isActive ? THEME.ink : '#64748b',
                      }}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* TAMPILAN 1: KALKULATOR UKURAN KHUSUS DTF & BORDIR (RINGKAS & FOKUS) */}
            {(cetakActiveCategory === 'DTF' ||
              cetakActiveCategory === 'BORDIR') &&
            currentDtfBordirCalc ? (
              <ScrollView
                style={{ maxHeight: 420 }}
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  paddingBottom: 16,
                }}
                keyboardShouldPersistTaps="handled"
              >
                {/* Input Tarif per cm² (Tidak bisa di bawah defaultTarif) */}
                <View
                  style={{
                    marginBottom: 12,
                    backgroundColor: currentDtfBordirCalc.isTarifUnderDefault
                      ? '#fff1f2'
                      : '#f8fafc',
                    padding: 10,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: currentDtfBordirCalc.isTarifUnderDefault
                      ? '#fca5a5'
                      : '#e2e8f0',
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: '#334155',
                        }}
                      >
                        Tarif / cm²
                      </Text>
                      <Text style={{ fontSize: 10, color: '#64748b' }}>
                        Minimal: Rp {currentDtfBordirCalc.defaultTarif} /cm²
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.input,
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          width: 110,
                          height: 38,
                          paddingHorizontal: 8,
                          paddingVertical: 0,
                          backgroundColor: '#ffffff',
                          borderColor: currentDtfBordirCalc.isTarifUnderDefault
                            ? '#ef4444'
                            : '#cbd5e1',
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: '#64748b',
                          marginRight: 4,
                        }}
                      >
                        Rp
                      </Text>
                      <TextInput
                        style={{
                          flex: 1,
                          height: '100%',
                          padding: 0,
                          fontSize: 14,
                          fontWeight: '700',
                          textAlign: 'right',
                          color: THEME.ink,
                        }}
                        keyboardType="numeric"
                        placeholder={formatThousandsId(
                          currentDtfBordirCalc.defaultTarif,
                        )}
                        placeholderTextColor="#94a3b8"
                        value={
                          (cetakActiveCategory === 'DTF'
                            ? dtfTarifCm
                            : bordirTarifCm) !== ''
                            ? formatThousandsId(
                                toNumCurrency(
                                  cetakActiveCategory === 'DTF'
                                    ? dtfTarifCm
                                    : bordirTarifCm,
                                ),
                              )
                            : formatThousandsId(
                                currentDtfBordirCalc.defaultTarif,
                              )
                        }
                        onChangeText={v => {
                          const digits = onlyDigits(v);
                          if (cetakActiveCategory === 'DTF') {
                            setDtfTarifCm(digits);
                          } else {
                            setBordirTarifCm(digits);
                          }
                        }}
                        onBlur={() => {
                          const currentVal =
                            cetakActiveCategory === 'DTF'
                              ? dtfTarifCm
                              : bordirTarifCm;
                          if (
                            currentVal !== '' &&
                            toNumCurrency(currentVal) <
                              currentDtfBordirCalc.defaultTarif
                          ) {
                            if (cetakActiveCategory === 'DTF') {
                              setDtfTarifCm(
                                String(currentDtfBordirCalc.defaultTarif),
                              );
                            } else {
                              setBordirTarifCm(
                                String(currentDtfBordirCalc.defaultTarif),
                              );
                            }
                            Toast.show({
                              type: 'glassError',
                              text1: 'Tarif di Bawah Standar Master',
                              text2: `Tarif per cm² minimal Rp ${formatThousandsId(
                                currentDtfBordirCalc.defaultTarif,
                              )}/cm²`,
                            });
                          }
                        }}
                      />
                    </View>
                  </View>
                  {currentDtfBordirCalc.isTarifUnderDefault && (
                    <Text
                      style={{
                        fontSize: 10.5,
                        color: '#b91c1c',
                        fontWeight: '600',
                        marginTop: 4,
                      }}
                    >
                      ⚠️ Tarif minimal Rp {currentDtfBordirCalc.defaultTarif}
                      /cm².
                    </Text>
                  )}
                </View>
                {/* Input Ukuran Panjang x Lebar */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: '#334155',
                        marginBottom: 4,
                      }}
                    >
                      Panjang (cm)
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          height: 42,
                          fontSize: 15,
                          fontWeight: '700',
                          textAlign: 'center',
                          backgroundColor: '#ffffff',
                        },
                      ]}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      value={dtfBordirPanjang}
                      onChangeText={v =>
                        setDtfBordirPanjang(sanitizeDecimalInput(v))
                      }
                    />
                  </View>

                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: '700',
                      color: '#94a3b8',
                      marginTop: 20,
                    }}
                  >
                    ×
                  </Text>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: '#334155',
                        marginBottom: 4,
                      }}
                    >
                      Lebar (cm)
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          height: 42,
                          fontSize: 15,
                          fontWeight: '700',
                          textAlign: 'center',
                          backgroundColor: '#ffffff',
                        },
                      ]}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      value={dtfBordirLebar}
                      onChangeText={v =>
                        setDtfBordirLebar(sanitizeDecimalInput(v))
                      }
                    />
                  </View>

                  <View style={{ flex: 1.1 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: '#334155',
                        marginBottom: 4,
                      }}
                    >
                      Luas Total
                    </Text>
                    <View
                      style={[
                        styles.input,
                        {
                          height: 42,
                          justifyContent: 'center',
                          alignItems: 'center',
                          backgroundColor: '#f1f5f9',
                          borderColor: '#cbd5e1',
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: '700',
                          color: '#475569',
                        }}
                      >
                        {currentDtfBordirCalc.luas} cm²
                      </Text>
                    </View>
                  </View>
                </View>
                {/* Box Live Hasil Kalkulasi */}
                <View
                  style={{
                    backgroundColor: '#f5f3ff',
                    borderRadius: 10,
                    padding: 12,
                    borderWidth: 1.5,
                    borderColor: '#c4b5fd',
                    marginBottom: 14,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: '#5b21b6',
                      }}
                    >
                      Biaya
                    </Text>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '800',
                        color: '#6d28d9',
                      }}
                    >
                      Rp{' '}
                      {currentDtfBordirCalc.biayaPerPcs.toLocaleString('id-ID')}{' '}
                      /Pcs
                    </Text>
                  </View>

                  {currentDtfBordirCalc.isMinApplied && (
                    <Text
                      style={{
                        fontSize: 10,
                        color: '#d97706',
                        fontWeight: '600',
                        marginBottom: 4,
                      }}
                    >
                      * Kena tarif minimum (Rp{' '}
                      {currentDtfBordirCalc.minTarif.toLocaleString('id-ID')})
                    </Text>
                  )}

                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTopWidth: 1,
                      borderTopColor: '#e9d5ff',
                      paddingTop: 6,
                      marginTop: 4,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: '#64748b' }}>
                      Subtotal (x {currentDtfBordirCalc.qtyOrder} pcs):
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: '#4c1d95',
                      }}
                    >
                      Rp{' '}
                      {currentDtfBordirCalc.totalOrder.toLocaleString('id-ID')}
                    </Text>
                  </View>
                </View>
                {/* Tombol Tambahkan ke Kalkulasi */}
                <TouchableOpacity
                  style={{
                    backgroundColor: '#7c3aed',
                    borderRadius: 10,
                    paddingVertical: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  disabled={currentDtfBordirCalc.biayaPerPcs <= 0}
                  onPress={() => {
                    if (currentDtfBordirCalc.biayaPerPcs <= 0) {
                      Toast.show({
                        type: 'glassError',
                        text1: 'Ukuran Belum Diisi',
                        text2: 'Mohon masukkan ukuran Panjang dan Lebar cetak',
                      });
                      return;
                    }

                    const activeTarifCurrent =
                      cetakActiveCategory === 'DTF'
                        ? dtfTarifCm
                        : bordirTarifCm;
                    if (
                      activeTarifCurrent !== '' &&
                      Number(activeTarifCurrent) <
                        currentDtfBordirCalc.defaultTarif
                    ) {
                      if (cetakActiveCategory === 'DTF') {
                        setDtfTarifCm(
                          String(currentDtfBordirCalc.defaultTarif),
                        );
                      } else {
                        setBordirTarifCm(
                          String(currentDtfBordirCalc.defaultTarif),
                        );
                      }
                      Toast.show({
                        type: 'glassError',
                        text1: 'Tarif di Bawah Standar Master',
                        text2: `Tarif per cm² minimal Rp ${currentDtfBordirCalc.defaultTarif}/cm² (tidak boleh lebih rendah)`,
                      });
                      return;
                    }

                    const jenis = cetakActiveCategory;
                    const ket = `${currentDtfBordirCalc.panjang}x${currentDtfBordirCalc.lebar} cm`;
                    const biaya = currentDtfBordirCalc.biayaPerPcs;
                    const panjang = currentDtfBordirCalc.panjang;
                    const lebar = currentDtfBordirCalc.lebar;
                    const tarifCm = currentDtfBordirCalc.tarifCm;

                    setGarmenSelectedCetak(prev => [
                      ...prev,
                      { jenis, ket, biaya, panjang, lebar, tarifCm },
                    ]);
                    setModalGarmenCetakVisible(false);
                    Toast.show({
                      type: 'glassSuccess',
                      text1: `${jenis} Berhasil Ditambahkan`,
                      text2: `${ket} - Rp ${biaya.toLocaleString('id-ID')}/pcs`,
                    });
                  }}
                >
                  <Text
                    style={{
                      color: '#ffffff',
                      fontSize: 14,
                      fontWeight: '700',
                    }}
                  >
                    Tambah {cetakActiveCategory}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              /* TAMPILAN 2: LIST ITEM UNTUK SABLON & SUBLIM */
              <>
                {/* Sub-filter sederhana khusus Sablon */}
                {cetakActiveCategory === 'SABLON' && (
                  <View
                    style={{
                      flexDirection: 'row',
                      paddingHorizontal: 16,
                      gap: 6,
                      marginBottom: 8,
                    }}
                  >
                    {(
                      [
                        { key: 'ALL', label: 'Semua' },
                        { key: 'MEDIUM', label: 'Medium' },
                        { key: 'RUBBER', label: 'Rubber' },
                      ] as const
                    ).map(sub => {
                      const isActive = sablonSubCategory === sub.key;
                      return (
                        <TouchableOpacity
                          key={sub.key}
                          onPress={() => setSablonSubCategory(sub.key)}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 6,
                            backgroundColor: isActive ? '#f5f3ff' : '#ffffff',
                            borderWidth: 1,
                            borderColor: isActive ? '#c4b5fd' : '#e2e8f0',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: isActive ? '700' : '500',
                              color: isActive ? '#6d28d9' : '#64748b',
                            }}
                          >
                            {sub.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* Kotak Pencarian Sederhana */}
                <View style={styles.modalSearchArea}>
                  <View style={styles.modalSearchBox}>
                    <MaterialIcons
                      name="search"
                      size={20}
                      color="#64748b"
                      style={{ marginRight: 6 }}
                    />
                    <TextInput
                      style={styles.modalSearchInput}
                      placeholder="Cari Jenis / Ukuran"
                      placeholderTextColor="#94a3b8"
                      value={searchGarmenCetak}
                      onChangeText={setSearchGarmenCetak}
                    />
                    {searchGarmenCetak ? (
                      <TouchableOpacity
                        onPress={() => setSearchGarmenCetak('')}
                      >
                        <MaterialIcons
                          name="cancel"
                          size={18}
                          color="#94a3b8"
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>

                {/* List Item Bersih & Ringan */}
                <FlatList
                  data={garmenCetakMaster.filter((cItem: any) => {
                    const j = (
                      cItem.mhb_jenis ||
                      cItem.jenis ||
                      ''
                    ).toUpperCase();
                    if (j !== cetakActiveCategory) return false;

                    const ket = (
                      cItem.mhb_ket ||
                      cItem.ket ||
                      cItem.nama ||
                      ''
                    ).toUpperCase();

                    if (cetakActiveCategory === 'SABLON') {
                      if (
                        sablonSubCategory !== 'ALL' &&
                        !ket.includes(sablonSubCategory)
                      ) {
                        return false;
                      }

                      // Jika tidak sedang melakukan pencarian teks manual, filter sesuai kategori kain aktif
                      if (!searchGarmenCetak.trim()) {
                        const curKtg = (
                          garmenKategoriKain || 'COTTON'
                        ).toUpperCase();
                        const isPe =
                          curKtg.includes('PE') ||
                          curKtg.includes('HYGIT') ||
                          curKtg.includes('DRYFIT');
                        const isLacost = curKtg.includes('LACOST');

                        if (isPe) {
                          if (!ket.endsWith(' PE')) return false;
                        } else if (isLacost) {
                          if (ket.endsWith(' PE') || ket.endsWith(' COTTON'))
                            return false;
                        } else {
                          // Cotton
                          if (ket.endsWith(' PE') || ket.endsWith(' LACOST'))
                            return false;
                        }
                      }
                    }

                    if (searchGarmenCetak.trim()) {
                      return ket
                        .toLowerCase()
                        .includes(searchGarmenCetak.toLowerCase());
                    }

                    return true;
                  })}
                  keyExtractor={(item, index) => String(item.mhb_id || index)}
                  contentContainerStyle={{ paddingHorizontal: 16 }}
                  renderItem={({ item }) => {
                    const jenis = (
                      item.mhb_jenis ||
                      item.jenis ||
                      ''
                    ).toUpperCase();
                    const ket = item.mhb_ket || item.ket || item.nama || jenis;
                    const biaya = Number(item.mhb_biaya || item.biaya || 0);
                    const ukDesc = getSablonUkuranDesc(ket);

                    return (
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 11,
                          borderBottomWidth: 1,
                          borderBottomColor: '#f1f5f9',
                        }}
                        onPress={() => {
                          const itemJenis = (
                            item.mhb_jenis ||
                            item.jenis ||
                            cetakActiveCategory ||
                            'CETAK'
                          ).toUpperCase();
                          const itemKet =
                            item.mhb_ket || item.ket || item.nama || itemJenis;
                          const itemBiaya = Number(
                            item.mhb_biaya || item.biaya || 0,
                          );

                          setGarmenSelectedCetak(prev => [
                            ...prev,
                            {
                              jenis: itemJenis,
                              ket: itemKet,
                              biaya: itemBiaya,
                            },
                          ]);
                          setModalGarmenCetakVisible(false);
                          Toast.show({
                            type: 'glassSuccess',
                            text1: `${itemJenis} Ditambahkan`,
                            text2: `${itemKet}${
                              ukDesc ? ` (${ukDesc})` : ''
                            } - Rp ${itemBiaya.toLocaleString('id-ID')}/pcs`,
                          });
                        }}
                      >
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: '600',
                              color: THEME.ink,
                            }}
                          >
                            {ket}
                          </Text>
                          {!!ukDesc && (
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                marginTop: 3,
                              }}
                            >
                              <View
                                style={{
                                  backgroundColor: '#f1f5f9',
                                  borderRadius: 4,
                                  paddingHorizontal: 6,
                                  paddingVertical: 1.5,
                                  borderWidth: 1,
                                  borderColor: '#e2e8f0',
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 10,
                                    fontWeight: '700',
                                    color: '#475569',
                                  }}
                                >
                                  Ukuran: {ukDesc}
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: '#6d28d9',
                          }}
                        >
                          Rp {biaya.toLocaleString('id-ID')}
                        </Text>
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={
                    <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, color: '#94a3b8' }}>
                        Item tidak ditemukan
                      </Text>
                    </View>
                  }
                />
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL KONFIRMASI PENGAJUAN / SIMPAN PERUBAHAN */}
      <Modal
        visible={showConfirmSubmitModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!saving) setShowConfirmSubmitModal(false);
        }}
      >
        <View style={styles.confirmModalOverlay}>
          <View style={styles.confirmModalCard}>
            <View style={styles.confirmModalHeader}>
              <Text style={styles.confirmModalTitle}>
                {mode === 'edit'
                  ? 'Konfirmasi Perubahan'
                  : 'Konfirmasi Permintaan Harga'}
              </Text>
            </View>

            {/* Box Ringkasan Data */}
            <View style={styles.confirmSummaryBox}>
              <View style={styles.confirmSummaryRow}>
                <Text style={styles.confirmSummaryLabel}>Customer</Text>
                <Text style={styles.confirmSummaryVal} numberOfLines={1}>
                  {mh_cus_nama || mh_cus_kode || '-'}
                </Text>
              </View>

              <View style={styles.confirmSummaryRow}>
                <Text style={styles.confirmSummaryLabel}>Pekerjaan</Text>
                <Text style={styles.confirmSummaryVal} numberOfLines={1}>
                  {mh_nama || '-'}
                </Text>
              </View>

              <View style={styles.confirmSummaryRow}>
                <Text style={styles.confirmSummaryLabel}>Jumlah Order</Text>
                <Text style={styles.confirmSummaryVal}>
                  {formatThousandsId(toNumCurrency(mh_jmlorder))} Pcs
                </Text>
              </View>

              <View style={styles.confirmSummaryRow}>
                <Text style={styles.confirmSummaryLabel}>Harga Permintaan</Text>
                <Text
                  style={[
                    styles.confirmSummaryVal,
                    { color: '#059669', fontWeight: '800' },
                  ]}
                >
                  Rp {formatThousandsId(toNumCurrency(mh_harga))} /pcs
                </Text>
              </View>

              {toNumCurrency(mh_ongkir) > 0 ? (
                <View
                  style={[
                    styles.confirmSummaryRow,
                    { borderBottomWidth: 0, paddingBottom: 0 },
                  ]}
                >
                  <Text style={styles.confirmSummaryLabel}>Ongkir</Text>
                  <Text style={styles.confirmSummaryVal}>
                    Rp {formatThousandsId(toNumCurrency(mh_ongkir))}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Keterangan Status DONE / WAIT / MINTA */}
            {(() => {
              const unitCalc = mh_harga_kalkulasi || 0;
              const unitProposed =
                toNumCurrency(mh_harga) || (unitCalc > 0 ? unitCalc : 0);
              const isUnderCalc = unitCalc > 0 && unitProposed < unitCalc;
              const diff = unitCalc - unitProposed;
              const totalDiff = diff * toNumCurrency(mh_jmlorder);

              if (unitCalc <= 0) {
                return (
                  <View
                    style={[
                      styles.confirmStatusNoticeBox,
                      { backgroundColor: '#f8fafc', borderColor: '#cbd5e1' },
                    ]}
                  >
                    <MaterialIcons name="info" size={18} color="#64748b" />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.confirmStatusNoticeTitle,
                          { color: '#334155' },
                        ]}
                      >
                        STATUS: BELUM
                      </Text>
                      <Text
                        style={[
                          styles.confirmStatusNoticeSub,
                          { color: '#64748b' },
                        ]}
                      >
                        Permintaan harga dibuat tanpa kalkulasi, akan melalui
                        MO terlebih dahulu.
                      </Text>
                    </View>
                  </View>
                );
              }

              if (isUnderCalc) {
                return (
                  <View
                    style={[
                      styles.confirmStatusNoticeBox,
                      { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
                    ]}
                  >
                    <MaterialIcons name="schedule" size={20} color="#d97706" />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.confirmStatusNoticeTitle,
                          { color: '#b45309' },
                        ]}
                      >
                        STATUS: NEGO (Memerlukan Persetujuan)
                      </Text>
                      <Text
                        style={[
                          styles.confirmStatusNoticeSub,
                          { color: '#92400e' },
                        ]}
                      >
                        Harga permintaan harga lebih rendah Rp{' '}
                        {formatThousandsId(diff)}/pcs ( - Rp{' '}
                        {formatThousandsId(totalDiff)} ) dari kalkulasi harga.
                      </Text>
                    </View>
                  </View>
                );
              }

              return (
                <View
                  style={[
                    styles.confirmStatusNoticeBox,
                    { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
                  ]}
                >
                  <MaterialIcons
                    name="check-circle"
                    size={20}
                    color="#16a34a"
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.confirmStatusNoticeTitle,
                        { color: '#15803d' },
                      ]}
                    >
                      STATUS: DONE (Otomatis Disetujui)
                    </Text>
                    <Text
                      style={[
                        styles.confirmStatusNoticeSub,
                        { color: '#166534' },
                      ]}
                    >
                      Harga permintaan memenuhi atau di atas standar kalkulasi
                      sistem.
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* Action Buttons */}
            <View style={styles.confirmModalActions}>
              <TouchableOpacity
                style={styles.confirmBtnCancel}
                onPress={() => setShowConfirmSubmitModal(false)}
                disabled={saving}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmBtnCancelText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmBtnSubmit,
                  saving ? { opacity: 0.7 } : null,
                ]}
                onPress={() => {
                  setShowConfirmSubmitModal(false);
                  submitPermintaan();
                }}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnSubmitText}>Konfirmasi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL KETENTUAN ONGKOS KIRIM & RUMUS */}
      <Modal
        visible={showOngkirPopover}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowOngkirPopover(false)}
      >
        <View style={styles.confirmModalOverlay}>
          <View
            style={[
              styles.confirmModalCard,
              { maxWidth: 420, maxHeight: '88%', padding: 18 },
            ]}
          >
            <View
              style={[
                styles.confirmModalHeader,
                { position: 'relative', width: '100%' },
              ]}
            >
              <TouchableOpacity
                onPress={() => setShowOngkirPopover(false)}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  padding: 4,
                  zIndex: 10,
                }}
                activeOpacity={0.7}
              >
                <MaterialIcons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
              <View
                style={[
                  styles.confirmModalIconWrap,
                  { backgroundColor: '#e0f2fe' },
                ]}
              >
                <MaterialIcons
                  name="local-shipping"
                  size={26}
                  color="#0284c7"
                />
              </View>
              <Text style={styles.confirmModalTitle}>
                Ketentuan & Rumus Ongkos Kirim
              </Text>
            </View>

            <ScrollView
              style={{ maxHeight: 340, marginBottom: 14 }}
              contentContainerStyle={{ paddingBottom: 4 }}
              showsVerticalScrollIndicator={true}
            >
              {/* Seksi 1: Rasio Berat */}
              <View style={styles.infoSectionCard}>
                <Text style={styles.infoSectionTitle}>
                  ⚖️ Ketentuan Konversi Berat (Kg):
                </Text>
                <Text style={styles.ongkirPopoverText}>
                  • <Text style={{ fontWeight: '700' }}>Spanduk:</Text>{' '}
                  {ongkirMasterRules.spanduk_m_per_kg} meter = 1 kg (
                  {(1 / ongkirMasterRules.spanduk_m_per_kg).toFixed(1)} kg/m)
                </Text>
                <Text style={styles.ongkirPopoverText}>
                  • <Text style={{ fontWeight: '700' }}>MMT:</Text>{' '}
                  {ongkirMasterRules.mmt_m2_per_kg} m² = 1 kg (
                  {(1 / ongkirMasterRules.mmt_m2_per_kg).toFixed(1)} kg/m²)
                </Text>
                <Text style={styles.ongkirPopoverText}>
                  • <Text style={{ fontWeight: '700' }}>Garmen Medium:</Text>{' '}
                  {ongkirMasterRules.garmen_med_pcs_per_kg} pcs = 1 kg
                </Text>
                <Text style={styles.ongkirPopoverText}>
                  • <Text style={{ fontWeight: '700' }}>Garmen Premium:</Text>{' '}
                  {ongkirMasterRules.garmen_prem_pcs_per_kg} pcs = 1 kg
                </Text>
              </View>

              {/* Seksi 2: Minimal Berat */}
              <View style={styles.infoSectionCard}>
                <Text style={styles.infoSectionTitle}>
                  📦 Ketentuan Minimal Berat Kirim:
                </Text>
                <Text style={styles.ongkirPopoverText}>
                  •{' '}
                  <Text style={{ fontWeight: '700', color: '#0369a1' }}>
                    Kota-Kota Jawa:
                  </Text>{' '}
                  Minimal berat dikenakan biaya adalah{' '}
                  <Text style={{ fontWeight: '700' }}>
                    {ongkirMasterRules.min_kg_jawa} Kg
                  </Text>
                  .
                </Text>
                <Text style={styles.ongkirPopoverText}>
                  •{' '}
                  <Text style={{ fontWeight: '700', color: '#b45309' }}>
                    Luar Pulau Jawa:
                  </Text>{' '}
                  Minimal berat dikenakan biaya adalah{' '}
                  <Text style={{ fontWeight: '700' }}>
                    {ongkirMasterRules.min_kg_luar_jawa} Kg
                  </Text>{' '}
                  (Sumatra, Sulawesi, Kalimantan, Bali, Nusa Tenggara).
                </Text>
              </View>

              {/* Seksi 3: Syarat Free Ongkir */}
              <View
                style={[
                  styles.infoSectionCard,
                  { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
                ]}
              >
                <Text style={[styles.infoSectionTitle, { color: '#15803d' }]}>
                  Syarat Bebas Ongkir:
                </Text>
                <Text style={[styles.ongkirPopoverText, { color: '#166534' }]}>
                  Berlaku untuk kota utama Jawa (Jakarta, Bandung, Yogya,
                  Sidoarjo, Surabaya, Surakarta):
                </Text>
                <Text style={[styles.ongkirPopoverText, { color: '#166534' }]}>
                  • Spanduk ≥{' '}
                  {formatThousandsId(ongkirMasterRules.free_spanduk_m)} Meter
                </Text>
                <Text style={[styles.ongkirPopoverText, { color: '#166534' }]}>
                  • MMT ≥ {formatThousandsId(ongkirMasterRules.free_mmt_m2)} m²
                </Text>
                <Text style={[styles.ongkirPopoverText, { color: '#166534' }]}>
                  • Garmen ≥{' '}
                  {formatThousandsId(ongkirMasterRules.free_garmen_pcs)} Pcs
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={{
                width: '100%',
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: '#0284c7',
                alignItems: 'center',
                justifyContent: 'center',
                ...PENAWARAN_SHADOW.softCard,
              }}
              onPress={() => setShowOngkirPopover(false)}
              activeOpacity={0.8}
            >
              <Text
                style={{ fontSize: 14, fontWeight: '800', color: '#ffffff' }}
              >
                Tutup
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL KETENTUAN CETAK MANUAL SPANDUK */}
      <Modal
        visible={showManualSpandukPopover}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowManualSpandukPopover(false)}
      >
        <View style={styles.confirmModalOverlay}>
          <View
            style={[
              styles.confirmModalCard,
              { maxWidth: 400, maxHeight: '88%', padding: 18 },
            ]}
          >
            <View
              style={[
                styles.confirmModalHeader,
                { position: 'relative', width: '100%', marginBottom: 12 },
              ]}
            >
              <TouchableOpacity
                onPress={() => setShowManualSpandukPopover(false)}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  padding: 4,
                  zIndex: 10,
                }}
                activeOpacity={0.7}
              >
                <MaterialIcons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
              <View
                style={[
                  styles.confirmModalIconWrap,
                  { backgroundColor: '#fffbeb' },
                ]}
              >
                <MaterialIcons name="info" size={26} color="#d97706" />
              </View>
              <Text style={styles.confirmModalTitle}>
                Ketentuan Cetak Spanduk Manual
              </Text>
            </View>

            <ScrollView
              style={{ maxHeight: 340, marginBottom: 14 }}
              contentContainerStyle={{ paddingBottom: 4 }}
              showsVerticalScrollIndicator={true}
            >
              <View
                style={[
                  styles.infoSectionCard,
                  { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
                ]}
              >
                <Text style={[styles.infoSectionTitle, { color: '#b45309' }]}>
                  Syarat Menggunakan Cetak Manual:
                </Text>
                <Text style={[styles.ongkirPopoverText, { color: '#92400e' }]}>
                  Pesanan harus memenuhi salah satu kriteria berikut:
                </Text>
                <Text style={[styles.ongkirPopoverText, { color: '#92400e' }]}>
                  • <Text style={{ fontWeight: '700' }}>Jumlah Order:</Text>{' '}
                  Minimal <Text style={{ fontWeight: '700' }}>100 Pcs</Text>
                </Text>
                <Text style={[styles.ongkirPopoverText, { color: '#92400e' }]}>
                  • <Text style={{ fontWeight: '700' }}>Total Luas:</Text>{' '}
                  Minimal <Text style={{ fontWeight: '700' }}>500 m²</Text>{' '}
                  (Panjang × Lebar × Qty)
                </Text>
              </View>

              {/* Ringkasan status saat ini */}
              {(() => {
                const numPanjang = toNumDecimal(mh_panjang);
                const numLebar = toNumDecimal(mh_lebar) || spandukLebar || 90;
                const numQty = toNumCurrency(mh_jmlorder);
                const totalLuas = numPanjang * (numLebar / 100) * numQty;
                const isLuasQualify = totalLuas >= 500;

                return (
                  <View
                    style={{
                      backgroundColor: '#f8fafc',
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      padding: 10,
                      gap: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontWeight: '700',
                        color: '#475569',
                      }}
                    >
                      Status Pesanan Saat Ini:
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingBottom: 6,
                        borderBottomWidth: 1,
                        borderBottomColor: '#f1f5f9',
                      }}
                    >
                      <Text style={{ fontSize: 11.5, color: '#64748b' }}>
                        Jumlah Order
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: numQty >= 100 ? '#15803d' : THEME.ink,
                        }}
                      >
                        {formatThousandsId(numQty)} Pcs{' '}
                        {numQty >= 100 ? '(≥ 100 Pcs)' : ''}
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingBottom: 6,
                        borderBottomWidth: 1,
                        borderBottomColor: '#f1f5f9',
                      }}
                    >
                      <Text style={{ fontSize: 11.5, color: '#64748b' }}>
                        Ukuran
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: numQty >= 100 ? '#15803d' : THEME.ink,
                        }}
                      >
                        {`${numPanjang} m x ${numLebar} cm`}
                      </Text>
                    </View>

                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11.5,
                          color: '#64748b',
                          flexShrink: 0,
                          marginTop: 1,
                        }}
                      >
                        Total Luas
                      </Text>
                      <View style={{ alignItems: 'flex-end', flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '700',
                            color: isLuasQualify ? '#15803d' : '#dc2626',
                            textAlign: 'right',
                          }}
                        >
                          {totalLuas.toFixed(1)} m²
                        </Text>
                        <Text
                          style={{
                            fontSize: 10.5,
                            fontWeight: '600',
                            color: isLuasQualify ? '#15803d' : '#dc2626',
                            textAlign: 'right',
                            marginTop: 1,
                          }}
                        >
                          {isLuasQualify
                            ? '(Memenuhi minimal 500 m²)'
                            : '(Belum mencapai 500 m²)'}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })()}
            </ScrollView>

            <TouchableOpacity
              style={{
                width: '100%',
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: '#d97706',
                alignItems: 'center',
                justifyContent: 'center',
                ...PENAWARAN_SHADOW.softCard,
              }}
              onPress={() => setShowManualSpandukPopover(false)}
              activeOpacity={0.8}
            >
              <Text
                style={{ fontSize: 14, fontWeight: '800', color: '#ffffff' }}
              >
                Mengerti
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL POPOVER KETERANGAN FINISHING */}
      <Modal
        visible={Boolean(finishingInfoType)}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setFinishingInfoType(null)}
      >
        <View style={styles.confirmModalOverlay}>
          <View
            style={[styles.confirmModalCard, { maxWidth: 360, padding: 18 }]}
          >
            <View
              style={[
                styles.confirmModalHeader,
                { position: 'relative', width: '100%', marginBottom: 12 },
              ]}
            >
              <TouchableOpacity
                onPress={() => setFinishingInfoType(null)}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  padding: 4,
                  zIndex: 10,
                }}
                activeOpacity={0.7}
              >
                <MaterialIcons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
              <View
                style={[
                  styles.confirmModalIconWrap,
                  {
                    backgroundColor:
                      finishingInfoType === 'include_kalkulasi'
                        ? '#e0f2fe'
                        : '#f1f5f9',
                  },
                ]}
              >
                <MaterialIcons
                  name={
                    finishingInfoType === 'include_kalkulasi'
                      ? 'calculate'
                      : 'edit-note'
                  }
                  size={26}
                  color={
                    finishingInfoType === 'include_kalkulasi'
                      ? '#0284c7'
                      : '#475569'
                  }
                />
              </View>
              <Text style={styles.confirmModalTitle}>
                {finishingInfoType === 'include_kalkulasi'
                  ? 'Finishing Include Kalkulasi'
                  : 'Finishing Tanpa Kalkulasi'}
              </Text>
            </View>

            <View
              style={[
                styles.infoSectionCard,
                {
                  backgroundColor:
                    finishingInfoType === 'include_kalkulasi'
                      ? '#f0f9ff'
                      : '#f8fafc',
                  borderColor:
                    finishingInfoType === 'include_kalkulasi'
                      ? '#bae6fd'
                      : '#e2e8f0',
                  padding: 14,
                  marginBottom: 16,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 13,
                  lineHeight: 20,
                  color:
                    finishingInfoType === 'include_kalkulasi'
                      ? '#0369a1'
                      : '#334155',
                  fontWeight: '600',
                }}
              >
                {finishingInfoType === 'include_kalkulasi'
                  ? 'Pilihan akan memengaruhi kalkulasi harga.'
                  : 'Inputan tidak akan memengaruhi kalkulasi harga.'}
              </Text>
            </View>

            <TouchableOpacity
              style={{
                width: '100%',
                paddingVertical: 11,
                borderRadius: 10,
                backgroundColor:
                  finishingInfoType === 'include_kalkulasi'
                    ? '#0284c7'
                    : '#475569',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => setFinishingInfoType(null)}
              activeOpacity={0.8}
            >
              <Text
                style={{ fontSize: 13.5, fontWeight: '700', color: '#ffffff' }}
              >
                Mengerti
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {showDateOrderPicker && (
        <DateTimePicker
          value={new Date()}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDateOrderPicker(false);
            if (selectedDate) setMhDateOrder(toYmd(selectedDate));
          }}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerArea: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  headerTextWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightSpacer: {
    minWidth: 74,
  },
  backBtn: {
    backgroundColor: THEME.soft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  backBtnText: {
    color: THEME.primary,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: THEME.ink,
    letterSpacing: 0.2,
    textAlign: 'center',
  },

  // Stepper Styles
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  stepItem: { alignItems: 'center' },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepBadgeActive: { backgroundColor: THEME.primary },
  stepBadgeCompleted: { backgroundColor: '#15803d' },
  stepNumber: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  stepNumberActive: { color: '#fff' },
  stepLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  stepLabelActive: { color: THEME.ink, fontWeight: '700' },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 8,
    marginBottom: 16,
  },
  stepConnectorActive: { backgroundColor: '#15803d' },

  content: { padding: 14, paddingBottom: 100 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    ...PENAWARAN_SHADOW.card,
  },
  nomorBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
  },
  nomorBadgeText: { fontSize: 11, fontWeight: '700', color: THEME.ink },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.ink,
    marginBottom: 8,
  },
  fieldWrap: { marginBottom: 10 },
  rowField2: { flexDirection: 'row' },
  label: { fontSize: 12, fontWeight: '600', color: '#334155', marginBottom: 4 },
  req: { color: '#ef4444' },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    color: THEME.ink,
  },
  divisiRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  divisiChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  divisiChipActive: {
    backgroundColor: `${THEME.primary}15`,
    borderColor: THEME.primary,
  },
  divisiChipText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  divisiChipTextActive: { color: THEME.primary, fontWeight: '700' },

  // Summary Box at Step 2
  specSummaryBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    ...PENAWARAN_SHADOW.card,
  },
  specSummaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#dbeafe',
    marginBottom: 8,
  },
  specSummaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e40af',
  },
  specEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  specEditText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.primary,
  },
  specSummaryGrid: {
    gap: 2,
  },
  specGridRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  specGridLabel: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  specGridValue: {
    fontSize: 12,
    color: '#1e293b',
    fontWeight: '700',
    marginTop: 1,
  },
  specSummaryBody: { marginTop: 4 },
  specSummaryItem: { fontSize: 11.5, color: '#334155', marginTop: 1 },
  specSummaryText: { fontSize: 12, color: THEME.ink },
  specSummarySubtext: { fontSize: 11, color: '#475569', marginTop: 2 },
  engineCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  engineCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
  engineCardTitle: { fontSize: 13.5, fontWeight: '700', color: THEME.ink },
  recalcHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${THEME.primary}12`,
    borderWidth: 1,
    borderColor: `${THEME.primary}30`,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  recalcHeaderBtnStale: {
    backgroundColor: '#ea580c',
    borderColor: '#c2410c',
    ...PENAWARAN_SHADOW.card,
  },
  recalcHeaderBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: THEME.primary,
  },
  recalcHeaderBtnTextStale: {
    color: '#fff',
  },
  // Stale Notification Banner
  staleNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    ...PENAWARAN_SHADOW.card,
  },
  staleNoticeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  staleNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400e',
  },
  staleNoticeSub: {
    fontSize: 11,
    color: '#b45309',
    marginTop: 1,
  },
  staleRecalcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ea580c',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  staleRecalcBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },

  // Kalkulasi Section
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  refreshEngineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  refreshEngineText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  radioRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  radioBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  radioBtnActive: {
    backgroundColor: `${THEME.primary}15`,
    borderColor: THEME.primary,
  },
  radioBtnText: { fontSize: 11.5, color: '#475569', fontWeight: '600' },
  radioBtnTextActive: { color: THEME.primary, fontWeight: '700' },
  chipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipBtnActive: {
    backgroundColor: `${THEME.primary}15`,
    borderColor: THEME.primary,
  },
  chipBtnText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  chipBtnTextActive: { color: THEME.primary, fontWeight: '700' },

  // Topping
  toppingOptionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 9,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 4,
  },
  toppingOptionCardActive: {
    borderColor: THEME.primary,
    backgroundColor: '#f0fdf4',
  },
  toppingOptionName: { fontSize: 12, color: THEME.ink },
  toppingOptionPrice: { fontSize: 12, fontWeight: '700', color: '#166534' },

  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
  },
  dropdownTriggerText: { fontSize: 12, fontWeight: '600', color: THEME.ink },
  dropdownMenu: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    marginTop: 4,
    ...PENAWARAN_SHADOW.card,
  },
  dropdownSelectorBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dropdownSelectorText: { fontSize: 12, fontWeight: '600', color: THEME.ink },
  dropdownMenuBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    marginTop: 4,
    ...PENAWARAN_SHADOW.card,
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
  dropdownMenuItemActive: { backgroundColor: '#f0fdf4' },
  dropdownMenuItemText: { fontSize: 12, color: THEME.ink },
  dropdownMenuItemTextActive: { color: '#15803d', fontWeight: '700' },
  dropdownMenuItemSub: { fontSize: 11, fontWeight: '700', color: '#15803d' },

  // Result Box
  resultBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  resultBadgeRow: { flexDirection: 'row', marginBottom: 6 },
  strataBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  strataBadgeText: { fontSize: 10.5, fontWeight: '700', color: '#166534' },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 3.5,
    gap: 8,
  },
  resultLabel: {
    fontSize: 12,
    color: '#475569',
    flex: 1,
    flexShrink: 1,
    marginRight: 4,
  },
  resultValue: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.ink,
    textAlign: 'right',
    flexShrink: 0,
  },
  resultTotalRow: {
    borderTopWidth: 1,
    borderColor: '#bbf7d0',
    paddingTop: 8,
    marginTop: 6,
    alignItems: 'flex-start',
    gap: 8,
  },
  resultTotalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
    flex: 1,
    flexShrink: 1,
    marginRight: 4,
  },
  resultTotalValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803d',
    textAlign: 'right',
    flexShrink: 0,
  },

  // Strata Accordion Table
  strataAccordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 10,
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  strataAccordionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.primary,
  },
  strataTableBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  strataTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  strataTh: { fontSize: 11, fontWeight: '700', color: '#475569' },
  strataTableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: '#f8fafc',
    alignItems: 'center',
  },
  strataTableRowActive: { backgroundColor: '#f0fdf4' },
  strataTd: { fontSize: 11, color: THEME.ink },
  strataTdActive: { color: '#166534', fontWeight: '700' },
  aktifBadge: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  aktifBadgeText: { color: '#fff', fontSize: 9.5, fontWeight: '700' },

  // Step 3 Review Styles
  reviewHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  reviewHeaderText: { fontSize: 13, fontWeight: '700', color: '#15803d' },
  reviewSection: {
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
  reviewSectionTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 4,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 3,
    gap: 8,
  },
  reviewLabel: {
    fontSize: 12,
    color: '#64748b',
    flex: 1,
    flexShrink: 1,
    marginRight: 4,
  },
  reviewVal: {
    fontSize: 12,
    color: THEME.ink,
    textAlign: 'right',
    flexShrink: 0,
  },
  reviewValBold: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.ink,
    textAlign: 'right',
    flexShrink: 0,
  },
  datePickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  datePickerBtnText: { fontSize: 12, color: THEME.ink },
  reviewPriceBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  reviewHeaderWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionHeadingNoMargin: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.ink,
  },
  calcStandardBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  calcStandardLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    flex: 1,
    flexShrink: 1,
    marginRight: 6,
  },
  calcStandardValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284c7',
    textAlign: 'right',
    flexShrink: 0,
  },
  calcStandardSubLabel: {
    fontSize: 11,
    color: '#94a3b8',
    flex: 1,
    flexShrink: 1,
    marginRight: 6,
  },
  calcStandardSubValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'right',
    flexShrink: 0,
  },
  currencyInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    overflow: 'hidden',
  },
  currencyPrefix: {
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '800',
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    borderRightWidth: 1,
    borderColor: '#e2e8f0',
  },
  currencyInputField: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '700',
    color: THEME.ink,
  },
  totalProposedText: {
    fontSize: 11.5,
    color: '#059669',
    fontWeight: '700',
    marginTop: 4,
  },
  statusNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
  },
  statusNoticeTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    marginBottom: 2,
  },
  statusNoticeSub: {
    fontSize: 11,
    lineHeight: 16,
  },
  textAreaInput: {
    height: 70,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  soCountBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  soDropdownToggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soSearchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 10,
  },
  soSearchInputField: {
    flex: 1,
    fontSize: 12,
    color: THEME.ink,
    paddingVertical: 0,
  },
  soCountBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284c7',
  },
  soCustomerSubText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  soEmptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  soEmptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginTop: 6,
  },
  soEmptySub: {
    fontSize: 11.5,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 2,
  },
  soItemCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
  },
  soItemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  soNomorBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  soNomorBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
  },
  soTanggalText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  soDivisiBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  soDivisiBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  soItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.ink,
    marginBottom: 6,
  },
  soItemPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 6,
  },
  soPriceCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  soItemQtyText: {
    fontSize: 11.5,
    color: '#64748b',
  },
  soItemUnitPriceText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0284c7',
  },
  soItemPriceText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
  soItemSpecBox: {
    backgroundColor: '#fff',
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    gap: 2,
  },
  soItemSpecLine: {
    fontSize: 11,
    color: '#475569',
  },
  soItemSpecLabel: {
    fontWeight: '700',
    color: '#334155',
  },

  // Footer Navigation
  footerContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    ...PENAWARAN_SHADOW.card,
  },
  // Photo Single Styles
  photoLimitBadge: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  photoLimitText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  photoActionBoxSingle: {
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    ...PENAWARAN_SHADOW.card,
  },
  photoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.primary,
  },
  photoPreviewCardSingle: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    height: 140,
    backgroundColor: '#000',
  },
  photoPreviewImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoDeleteBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoMetaBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  photoMetaText: {
    fontSize: 10.5,
    color: '#fff',
    fontWeight: '700',
  },
  navBtnPrimary: {
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  navBtnPrimaryText: { fontSize: 13.5, fontWeight: '700', color: '#fff' },
  navBtnSecondary: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  navBtnSecondaryText: { fontSize: 12.5, fontWeight: '700', color: THEME.ink },
  subActionText: {
    fontSize: 11.5,
    color: '#64748b',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  bypassBtnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    height: 40,
    marginTop: 8,
  },
  bypassBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
  },
  /* Customer Picker & Modal Styles */
  addCusQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${THEME.primary}12`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addCusQuickText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.primary,
  },
  customerPickerInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customerPlaceholderText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  customerSelectedName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: THEME.ink,
  },
  customerSelectedCode: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  customerPickerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContentCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '88%',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
  modalHeaderIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${THEME.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.ink,
  },
  modalHeaderSub: {
    fontSize: 11.5,
    color: '#64748b',
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  modalSearchArea: {
    padding: 14,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    gap: 8,
  },
  modalSearchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 12.5,
    color: THEME.ink,
    paddingVertical: 0,
  },
  modalAddCustomerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.primary,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
  },
  modalAddCustomerText: {
    color: '#fff',
    fontSize: 11.5,
    fontWeight: '700',
  },
  modalLoadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalLoadingText: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 10,
  },
  modalEmptyWrap: {
    alignItems: 'center',
    padding: 32,
    marginTop: 20,
  },
  modalEmptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.ink,
    marginTop: 12,
  },
  modalEmptySub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  emptyAddBtn: {
    marginTop: 16,
    backgroundColor: `${THEME.primary}15`,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.primary,
  },
  emptyAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.primary,
  },
  customerListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 10,
    marginVertical: 2,
  },
  customerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: `${THEME.primary}18`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerAvatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.primary,
  },
  customerItemName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: THEME.ink,
  },
  customerCodeBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  customerCodeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  customerItemAddress: {
    fontSize: 11.5,
    color: '#64748b',
    flex: 1,
  },
  /* PPN & Keterangan Kalkulasi Styles */
  ppnCheckboxCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  ppnCheckboxCardActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  ppnCheckboxLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  ppnCheckboxLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: THEME.ink,
  },
  ppnCheckboxSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  ppnBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ppnBadgeInc: {
    backgroundColor: '#dcfce7',
  },
  ppnBadgeExc: {
    backgroundColor: '#f1f5f9',
  },
  ppnBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  ppnBadgeTextInc: {
    color: '#166534',
  },
  ppnBadgeTextExc: {
    color: '#64748b',
  },
  ketKalkulasiPreviewBox: {
    marginTop: 6,
    backgroundColor: '#f1f5f9',
    padding: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: THEME.primary,
  },
  ketKalkulasiPreviewLabel: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '600',
  },
  ketKalkulasiPreviewVal: {
    fontSize: 11.5,
    color: THEME.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  infoIconBtn: {
    padding: 2,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ongkirPopoverBox: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#7dd3fc',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    ...PENAWARAN_SHADOW.card,
  },
  ongkirPopoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  ongkirPopoverTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1',
  },
  ongkirPopoverText: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 16,
    marginTop: 2,
  },

  helperText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },

  // Ongkir Element Styles
  ongkirCardIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ongkirSubheading: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.ink,
  },
  ongkirInfoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  ongkirInfoBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  ongkirModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  ongkirModeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  ongkirModeChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  ongkirModeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  ongkirModeChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  ongkirPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  ongkirPickerCityName: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.ink,
  },
  ongkirPickerCitySub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  ongkirCalcSummaryBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginTop: 4,
    gap: 8,
  },
  ongkirSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ongkirSummaryLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  ongkirSummaryVal: {
    fontSize: 12.5,
    color: THEME.ink,
    fontWeight: '700',
  },
  ongkirFreeNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 8,
    marginTop: 2,
  },
  ongkirFreeNoticeTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#15803d',
  },
  ongkirFreeNoticeSub: {
    fontSize: 10.5,
    color: '#166534',
    marginTop: 1,
    lineHeight: 14,
  },
  ongkirTotalHighlightRow: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    marginTop: 2,
  },
  ongkirTotalHighlightLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  ongkirTotalHighlightVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0284c7',
  },
  ongkirPerUnitText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
    marginTop: 1,
  },
  ongkirCityItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  ongkirCityItemCardActive: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  ongkirCityItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.ink,
  },
  ongkirCityItemBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#dcfce7',
  },
  ongkirCityItemBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
  },
  ongkirCityItemDetail: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
  },
  infoSectionCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  infoSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },

  // Step 3 Review Bottom Actions
  reviewBottomActionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    marginBottom: 36,
  },
  reviewBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingVertical: 14,
    ...PENAWARAN_SHADOW.softCard,
  },
  reviewBtnSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.ink,
  },
  reviewBtnPrimary: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15803d',
    borderRadius: 14,
    paddingVertical: 14,
    ...PENAWARAN_SHADOW.softCard,
  },
  reviewBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },

  // Confirm Modal Styles
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  confirmModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    ...PENAWARAN_SHADOW.card,
  },
  confirmModalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmModalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.ink,
    textAlign: 'center',
  },
  confirmModalSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
  confirmSummaryBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 18,
    gap: 8,
  },
  confirmSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  confirmSummaryLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    flex: 1,
  },
  confirmSummaryVal: {
    fontSize: 12,
    color: THEME.ink,
    fontWeight: '700',
    maxWidth: '55%',
    textAlign: 'right',
  },
  confirmStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  confirmStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  confirmStatusNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  confirmStatusNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  confirmStatusNoticeSub: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  confirmModalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmBtnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  confirmBtnSubmit: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#15803d',
    alignItems: 'center',
    justifyContent: 'center',
    ...PENAWARAN_SHADOW.softCard,
  },
  confirmBtnSubmitText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  optionalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  optionalBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  praOrderHelpText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 10,
    lineHeight: 16,
  },
  praOrderPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    borderStyle: 'dashed',
  },
  praOrderPickerBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  praOrderSelectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  praOrderNomorText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803d',
  },
  praOrderDivisiBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: '#dcfce7',
  },
  praOrderDivisiBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  praOrderPekerjaanText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.ink,
    marginTop: 2,
  },
  praOrderCustomerText: {
    fontSize: 11.5,
    color: THEME.ink,
    marginTop: 2,
  },
  praOrderQtyText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: THEME.muted,
    marginTop: 2,
  },
  praOrderChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#e0f2fe',
  },
  praOrderChangeBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: THEME.primary,
  },
  praOrderDeleteBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  praOrderListItem: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 10,
    marginVertical: 3,
    borderWidth: 1,
    ...PENAWARAN_SHADOW.softCard,
  },
  praOrderItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  praOrderItemNomor: {
    fontSize: 12.5,
    fontWeight: '800',
    color: THEME.primary,
  },
  praOrderItemDate: {
    fontSize: 11,
    color: THEME.muted,
  },
  praOrderDivisiTag: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  praOrderDivisiTagText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  praOrderItemTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: THEME.ink,
    marginBottom: 4,
  },
  praOrderItemMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  praOrderItemMetaText: {
    fontSize: 12,
    color: THEME.ink,
  },
  praOrderItemQtyText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.muted,
  },
  praOrderItemSubDetail: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  praOrderUsedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: THEME.soft,
    alignSelf: 'flex-start',
  },
  praOrderUsedBadgeText: {
    fontSize: 10.5,
    color: THEME.info,
    fontWeight: '600',
  },
  praOrderOverlayLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
  },
  praOrderOverlayLoadingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 8,
  },
});
