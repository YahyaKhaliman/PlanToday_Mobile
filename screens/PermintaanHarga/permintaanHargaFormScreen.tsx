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

const formatThousandsId = (value: string | number) => {
  const cleaned = onlyDigits(String(value ?? ''));
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
      user?.kode ||
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
    initial?.mh_harga ? String(initial.mh_harga) : '',
  );
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
          rawDpp = mmtResult.hargaSatuanPcs;
        } else if (mh_divisi === '1' && spandukResult?.hargaSatuanPcs) {
          rawDpp = spandukResult.hargaSatuanPcs;
        } else if (mh_divisi === '4' && garmenCalcResult) {
          rawDpp =
            garmenCalcResult.hargaUpPerPcs ||
            garmenCalcResult.hargaJualRevisi ||
            garmenCalcResult.hargaJualPerPcs ||
            garmenCalcResult.hargaJual ||
            0;
        } else if (currentHrg > 0) {
          rawDpp = prevPpn ? Math.round(currentHrg / 1.11) : currentHrg;
        }

        if (rawDpp > 0) {
          return nextPpn ? Math.round(rawDpp * 1.11) : Math.round(rawDpp);
        }
        return currentHrg;
      });

      return nextPpn;
    });
  };

  const [saving, setSaving] = useState(false);
  const [showDateOrderPicker, setShowDateOrderPicker] = useState(false);

  // Master options backend
  const [masterOptions, setMasterOptions] = useState<{
    spanduk: any[];
    mmt: any[];
    topping: any[];
    sales?: any[];
  }>({ spanduk: [], mmt: [], topping: [], sales: [] });

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
        user?.kode ||
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

  const [mmtKategori, setMmtKategori] = useState<string>('VYNIL');
  const [mmtBahanKode, setMmtBahanKode] = useState<string>('260');
  const [mmtToppingKode, setMmtToppingKode] = useState<string>('');
  const [mmtToppingQty, _setMmtToppingQty] = useState<string>('1');
  const [mmtIsNetto, setMmtIsNetto] = useState<boolean>(false);
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
  const [selectedCetakMasterItem, setSelectedCetakMasterItem] =
    useState<any>(null);
  const [cetakActiveCategory, setCetakActiveCategory] = useState<
    'SABLON' | 'SUBLIM'
  >('SABLON');
  const [sablonSubCategory, setSablonSubCategory] = useState<
    'ALL' | 'MEDIUM' | 'RUBBER'
  >('ALL');

  const [garmenTambahanMaster, setGarmenTambahanMaster] = useState<any[]>([]);
  const [garmenCetakMaster, setGarmenCetakMaster] = useState<any[]>([]);
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

  const currentSpandukParamsKey = `${mh_panjang}|${mh_jmlorder}|${spandukMetode}|${spandukLebar}|${spandukJenisKain}|${isIncPpn}`;
  const isSpandukStale = Boolean(
    spandukResult &&
      spandukCalculatedParams &&
      spandukCalculatedParams !== currentSpandukParamsKey,
  );

  const currentMmtParamsKey = `${mh_panjang}|${mh_lebar}|${mh_jmlorder}|${mmtKategori}|${mmtBahanKode}|${mmtToppingKode}|${mmtToppingQty}|${mmtIsNetto}|${isIncPpn}`;
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
    return `${garmenKodeModel}|${garmenJenisKain}|${garmenWarna}|${mh_jmlorder}|${tambahanKey}|${cetakKey}|${isIncPpn}`;
  }, [
    garmenKodeModel,
    garmenJenisKain,
    garmenWarna,
    mh_jmlorder,
    garmenSelectedTambahan,
    garmenSelectedCetak,
    isIncPpn,
  ]);

  const isGarmenStale = Boolean(
    garmenCalcResult &&
      garmenCalculatedParams &&
      garmenCalculatedParams !== currentGarmenParamsKey,
  );

  // Kategori & Pilihan Bahan MMT Dinamis dari Master Database
  const availableSpandukKain = useMemo(() => {
    if (masterOptions?.spanduk && Array.isArray(masterOptions.spanduk)) {
      const list = Array.from(
        new Set(
          masterOptions.spanduk
            .map((s: any) => String(s.jenis_kain || '').trim())
            .filter(Boolean),
        ),
      );
      if (list.length > 0) return list;
    }
    return ['POLYESTER 50/36', 'OPTIC 70/40', 'TC 60/44'];
  }, [masterOptions?.spanduk]);

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
  }, [masterOptions?.spanduk, spandukJenisKain, mh_kain, availableSpandukKain]);

  const handleSelectSpandukKain = (kain: string) => {
    setSpandukJenisKain(kain);
    setMhKain(kain);
    if (masterOptions?.spanduk && Array.isArray(masterOptions.spanduk)) {
      const filtered = masterOptions.spanduk.filter(
        (s: any) =>
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
        }
      } catch (err) {
        console.log('[PermintaanHargaForm] load master opts err:', err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

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

  // Memuat master cetak / sablon
  useEffect(() => {
    if (mh_divisi !== '4') return;
    let isMounted = true;
    getCetakOptionsApi(token)
      .then((cetak: any[]) => {
        if (!isMounted) return;
        if (Array.isArray(cetak)) setGarmenCetakMaster(cetak);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [mh_divisi, token]);

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
        const finalHargaGarmen = isIncPpn
          ? Math.round(hargaJual * 1.11)
          : Math.round(hargaJual);
        setMhHarga('0');
        setMhBudget('0');
        setMhHargaKalkulasi(finalHargaGarmen);

        setKeteranganKalkulasi(isIncPpn ? 'INC PPN' : 'EXC PPN');

        Toast.show({
          type: 'glassSuccess',
          text1: 'Kalkulasi Garmen Berhasil',
          text2: `Harga Jual: Rp ${Number(hargaJual).toLocaleString(
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
    ) => {
      const numPanjang = toNumDecimal(mh_panjang);
      const numLebar = toNumDecimal(mh_lebar);
      const numQty = toNumCurrency(mh_jmlorder);
      if (numPanjang <= 0 || numQty <= 0) return;

      const activeMetode = customMetode || spandukMetode || 'MANUAL';
      const activeLebar =
        customLebar || (numLebar > 0 ? numLebar : spandukLebar) || 90;
      const activeKain =
        customKain || spandukJenisKain || mh_kain || 'POLYESTER 50/36';

      setSpandukLoading(true);
      try {
        const res = await calculateSpandukApi(
          {
            metode: activeMetode,
            lebar: activeLebar,
            jenisKain: activeKain,
            panjang: numPanjang,
            qty: numQty,
          },
          token,
        );
        setSpandukResult(res);
        setSpandukCalculatedParams(
          `${mh_panjang}|${mh_jmlorder}|${activeMetode}|${activeLebar}|${activeKain}|${isIncPpn}`,
        );
        if (res?.hargaSatuanPcs) {
          const finalHargaSpanduk = isIncPpn
            ? Math.round(res.hargaSatuanPcs * 1.11)
            : res.hargaSatuanPcs;
          setMhHarga('0');
          setMhBudget('0');
          setMhHargaKalkulasi(finalHargaSpanduk);
          const spandukSpec = `Spanduk ${activeMetode} ${activeKain} L${activeLebar}cm`;
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
      token,
      isIncPpn,
    ],
  );

  // Kalkulasi MMT
  const handleHitungMmt = useCallback(
    async (customIsNetto?: any) => {
      const numPanjang = toNumDecimal(mh_panjang);
      const numLebar = toNumDecimal(mh_lebar);
      const numQty = toNumCurrency(mh_jmlorder);
      if (numPanjang <= 0 || numLebar <= 0 || numQty <= 0) return;

      const activeNetto =
        typeof customIsNetto === 'boolean' ? customIsNetto : mmtIsNetto;

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
          },
          token,
        );
        setMmtResult(res);
        setMmtCalculatedParams(
          `${mh_panjang}|${mh_lebar}|${mh_jmlorder}|${mmtKategori}|${mmtBahanKode}|${mmtToppingKode}|${mmtToppingQty}|${activeNetto}|${isIncPpn}`,
        );
        if (res?.hargaSatuanPcs) {
          const finalHargaMmt = isIncPpn
            ? Math.round(res.hargaSatuanPcs * 1.11)
            : res.hargaSatuanPcs;
          setMhHarga('0');
          setMhBudget('0');
          setMhHargaKalkulasi(finalHargaMmt);
          const mmtSpec = `MMT ${mmtKategori} ${mmtBahanKode}${
            activeNetto ? ' (Netto)' : ''
          }${res.topping ? ` + Top: ${res.topping.nama}` : ''}`;
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
      token,
      isIncPpn,
    ],
  );

  const handleToggleNetto = () => {
    const nextNetto = !mmtIsNetto;
    setMmtIsNetto(nextNetto);
    setTimeout(() => {
      handleHitungMmt(nextNetto);
    }, 50);
  };

  // Auto calculate saat melangkah ke Step 2
  const goToStep2Kalkulasi = () => {
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
      const numLebar = toNumDecimal(mh_lebar) || 90;
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
      setTimeout(() => handleHitungSpanduk(numLebar, activeKain), 100);
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

  const goToStep3Review = () => {
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
      user?.kode ||
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
      finalHargaKalkulasi = isIncPpn
        ? Math.round(spandukResult.hargaSatuanPcs * 1.11)
        : Math.round(spandukResult.hargaSatuanPcs);
    } else if (mh_divisi === '5' && mmtResult?.hargaSatuanPcs) {
      finalHargaKalkulasi = isIncPpn
        ? Math.round(mmtResult.hargaSatuanPcs * 1.11)
        : Math.round(mmtResult.hargaSatuanPcs);
    } else if (mh_divisi === '4' && garmenCalcResult) {
      const rawHrg =
        garmenCalcResult.hargaUpPerPcs ||
        garmenCalcResult.hargaJualRevisi ||
        garmenCalcResult.hargaJualPerPcs ||
        garmenCalcResult.hargaJual ||
        0;
      finalHargaKalkulasi = isIncPpn
        ? Math.round(rawHrg * 1.11)
        : Math.round(rawHrg);
    }

    let finalKetKalkulasi = keteranganKalkulasi.trim();
    if (isIncPpn && !finalKetKalkulasi.toUpperCase().includes('INC PPN')) {
      finalKetKalkulasi = `INC PPN; ${finalKetKalkulasi.replace(
        /^EXC PPN[;,]?\s*/i,
        '',
      )}`.trim();
    } else if (
      !isIncPpn &&
      !finalKetKalkulasi.toUpperCase().includes('EXC PPN')
    ) {
      finalKetKalkulasi = `EXC PPN; ${finalKetKalkulasi.replace(
        /^INC PPN[;,]?\s*/i,
        '',
      )}`.trim();
    }

    const payload: PermintaanHargaPayload = {
      mh_divisi,
      mh_cus_kode,
      mh_cus_nama,
      mh_sal_kode: activeSalesKode,
      mh_nama,
      mh_jmlorder: toNumCurrency(mh_jmlorder),
      mh_harga: 0,
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
      ...(mh_divisi === '4' && garmenCalcResult
        ? {
            kal_kh_kode: garmenKodeModel,
            kal_rpallowance: garmenCalcResult.komponenBiaya?.allowanceRp || 0,
            kal_allowance: garmenCalcResult.komponenBiaya?.allowancePersen || 0,
            kal_rplaba: garmenCalcResult.strataAktif?.marginRp || 0,
            kal_laba: garmenCalcResult.strataAktif?.persen || 0,
            kal_ketbeli: garmenCalcResult.babaran?.body
              ? `${garmenJenisKain} ${garmenCalcResult.babaran.body}/kg`
              : garmenJenisKain,
            garmen_model: garmenKodeModel,
            garmen_kain: garmenJenisKain,
            garmen_warna: garmenWarna,
            garmen_tambahan: garmenSelectedTambahan,
            garmen_cetak: garmenSelectedCetak,
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

      Toast.show({
        type: 'glassSuccess',
        text1: 'Pengajuan Berhasil',
        text2:
          mode === 'edit'
            ? 'Permintaan harga berhasil diperbarui'
            : 'Permintaan harga berhasil diajukan ke sistem (Status: WAIT)',
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
        {/* ========================================================================= */}
        {/* WIZARD LANGKAH 1: DETAIL & SPESIFIKASI BARANG */}
        {/* ========================================================================= */}
        {currentStep === 1 && (
          <View>
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
                    onChangeText={val => setMhJmlorder(val)}
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

                {/* Keterangan Garmen */}
                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>
                    Keterangan{' '}
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
                    style={[
                      styles.input,
                      { height: 65, textAlignVertical: 'top' },
                    ]}
                    value={mh_ket}
                    onChangeText={setMhKet}
                    placeholder="Tambahkan catatan / keterangan permintaan harga garmen..."
                    placeholderTextColor="#94a3b8"
                    multiline
                  />
                </View>
              </View>
            ) : (
              <View style={[styles.card, { marginTop: 12 }]}>
                <Text style={styles.sectionHeading}>
                  2. Dimensi & Kuantitas
                </Text>

                {/* Pilihan Jenis Kain Spanduk Terlebih Dahulu (Divisi 1) */}
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
                      onChangeText={setMhPanjang}
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
                        onChangeText={setMhLebar}
                        placeholder="Misal: 1"
                        keyboardType="decimal-pad"
                      />
                    </View>
                  )}
                </View>

                {/* Pilihan Lebar Dinamis yang Difilter Berdasarkan Jenis Kain (Divisi 1) */}
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
                  <TextInput
                    style={[styles.input, { fontWeight: '700', fontSize: 15 }]}
                    value={mh_jmlorder}
                    onChangeText={setMhJmlorder}
                    placeholder="0"
                    keyboardType="numeric"
                  />
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

                {/* Finishing & Keterangan */}
                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>Finishing</Text>
                  <TextInput
                    style={styles.input}
                    value={mh_finishing}
                    onChangeText={setMhFinishing}
                    placeholder="Contoh: Mata ayam 4 pojok, Jahit selongsong"
                  />
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

                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>Keterangan</Text>
                  <TextInput
                    style={[
                      styles.input,
                      { height: 60, textAlignVertical: 'top' },
                    ]}
                    value={mh_ket}
                    onChangeText={setMhKet}
                    placeholder="Tambahkan keterangan permintaan harga..."
                    multiline
                  />
                </View>
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

                {/* Baris 5: Keterangan Tambahan */}
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
                      name="calculate"
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
                    onPress={() => setSpandukMetode('MANUAL')}
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
                    onPress={() => setSpandukMetode('MACHINE')}
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
                      <Text style={styles.resultLabel}>Tarif per Meter:</Text>
                      <Text style={[styles.resultValue, { color: '#0284c7' }]}>
                        Rp {formatThousandsId(spandukResult.tarifPerMeter)} /Mtr
                      </Text>
                    </View>
                    <View style={[styles.resultRow, styles.resultTotalRow]}>
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
                        Rp{' '}
                        {formatThousandsId(
                          isIncPpn
                            ? Math.round(spandukResult.hargaSatuanPcs * 1.11)
                            : spandukResult.hargaSatuanPcs,
                        )}{' '}
                        /Pcs
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
                          +Rp{' '}
                          {formatThousandsId(
                            Math.round(spandukResult.totalHarga * 0.11),
                          )}
                        </Text>
                      </View>
                    )}
                    <View style={styles.resultRow}>
                      <Text style={[styles.resultLabel, { fontSize: 11 }]}>
                        Total Order Keseluruhan ({mh_jmlorder || 0} pcs):
                      </Text>
                      <Text
                        style={[
                          styles.resultValue,
                          { fontSize: 11.5, fontWeight: '700' },
                        ]}
                      >
                        Rp{' '}
                        {formatThousandsId(
                          isIncPpn
                            ? Math.round(spandukResult.totalHarga * 1.11)
                            : spandukResult.totalHarga,
                        )}
                      </Text>
                    </View>
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
                      Tabel Master Bahan
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
                        Rentang
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
                              : `${formatThousandsId(
                                  s.qmin,
                                )} - ${formatThousandsId(s.qmax)} m`}
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
                      : 'Tanpa Topping Tambahan (Standard)'}
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
                      borderColor: '#d97706',
                      backgroundColor: '#fffbeb',
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
                      color={mmtIsNetto ? '#d97706' : '#94a3b8'}
                    />
                    <View style={{ marginLeft: 8, flex: 1 }}>
                      <Text
                        style={[
                          styles.ppnCheckboxLabel,
                          mmtIsNetto && { color: '#b45309', fontWeight: '700' },
                        ]}
                      >
                        Harga Netto
                      </Text>
                      <Text style={styles.ppnCheckboxSub}>
                        {mmtIsNetto
                          ? 'Menggunakan tarif khusus Netto (flat rate)'
                          : 'Menggunakan tarif berstrata kuantiti'}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.ppnBadge,
                      mmtIsNetto
                        ? { backgroundColor: '#fef3c7', borderColor: '#fde68a' }
                        : styles.ppnBadgeExc,
                    ]}
                  >
                    <Text
                      style={[
                        styles.ppnBadgeText,
                        mmtIsNetto
                          ? { color: '#b45309' }
                          : styles.ppnBadgeTextExc,
                      ]}
                    >
                      {mmtIsNetto ? 'NETTO' : 'REGULER'}
                    </Text>
                  </View>
                </TouchableOpacity>

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
                      <Text style={styles.resultLabel}>Total Luas Cetak:</Text>
                      <Text style={styles.resultValue}>
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
                          +Rp {formatThousandsId(mmtResult.topping.totalHarga)}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.resultRow, styles.resultTotalRow]}>
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
                        Rp{' '}
                        {formatThousandsId(
                          isIncPpn
                            ? Math.round(mmtResult.hargaSatuanPcs * 1.11)
                            : mmtResult.hargaSatuanPcs,
                        )}{' '}
                        /Pcs
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
                          +Rp{' '}
                          {formatThousandsId(
                            Math.round(mmtResult.totalHarga * 0.11),
                          )}
                        </Text>
                      </View>
                    )}
                    <View style={styles.resultRow}>
                      <Text style={[styles.resultLabel, { fontSize: 11 }]}>
                        Total Order Keseluruhan ({mh_jmlorder || 0} pcs):
                      </Text>
                      <Text
                        style={[
                          styles.resultValue,
                          { fontSize: 11.5, fontWeight: '700' },
                        ]}
                      >
                        Rp{' '}
                        {formatThousandsId(
                          isIncPpn
                            ? Math.round(mmtResult.totalHarga * 1.11)
                            : mmtResult.totalHarga,
                        )}
                      </Text>
                    </View>
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
                      Tabel Referensi Strata MMT
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
                              ? `≥ ${formatThousandsId(s.qmin)} m²`
                              : `${formatThousandsId(
                                  s.qmin,
                                )} - ${formatThousandsId(s.qmax)} m²`}
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
                    value={mh_harga}
                    onChangeText={setMhHarga}
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
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: 4,
                    }}
                  >
                    <Text style={styles.label}>Cetak</Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {/* Trigger Dropdown Master Cetak */}
                    <TouchableOpacity
                      style={[
                        styles.input,
                        {
                          flex: 1,
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
                          fontSize: 12,
                          color: selectedCetakMasterItem
                            ? THEME.ink
                            : '#94a3b8',
                          fontWeight: selectedCetakMasterItem ? '600' : '400',
                        }}
                        numberOfLines={1}
                      >
                        {selectedCetakMasterItem
                          ? `[${
                              selectedCetakMasterItem.mhb_jenis || 'CETAK'
                            }] ${
                              selectedCetakMasterItem.mhb_ket ||
                              selectedCetakMasterItem.ket ||
                              ''
                            } (Rp ${Number(
                              selectedCetakMasterItem.mhb_biaya ||
                                selectedCetakMasterItem.biaya ||
                                0,
                            ).toLocaleString('id-ID')}/pcs)`
                          : 'Pilih Cetak / Sablon (Opsional)...'}
                      </Text>
                      <MaterialIcons
                        name="arrow-drop-down"
                        size={22}
                        color="#64748b"
                      />
                    </TouchableOpacity>

                    {/* Tombol Tambah */}
                    <TouchableOpacity
                      style={{
                        backgroundColor: '#7c3aed',
                        paddingHorizontal: 16,
                        borderRadius: 8,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                      onPress={() => {
                        if (!selectedCetakMasterItem) {
                          Toast.show({
                            type: 'glassError',
                            text1: 'Pilih Cetak Terlebih Dahulu',
                            text2:
                              'Silakan buka dropdown untuk memilih jenis cetak',
                          });
                          return;
                        }
                        const jenis =
                          selectedCetakMasterItem.mhb_jenis ||
                          selectedCetakMasterItem.jenis ||
                          'CETAK';
                        const ket =
                          selectedCetakMasterItem.mhb_ket ||
                          selectedCetakMasterItem.ket ||
                          selectedCetakMasterItem.nama ||
                          'Custom';
                        const biaya = Number(
                          selectedCetakMasterItem.mhb_biaya ||
                            selectedCetakMasterItem.biaya ||
                            0,
                        );

                        if (
                          garmenSelectedCetak.some(
                            c => c.jenis === jenis && c.ket === ket,
                          )
                        ) {
                          Toast.show({
                            type: 'glassError',
                            text1: 'Item Sudah Ada',
                            text2:
                              'Item cetak ini sudah ditambahkan sebelumnya',
                          });
                          return;
                        }

                        setGarmenSelectedCetak(prev => [
                          ...prev,
                          { jenis, ket, biaya },
                        ]);
                        setSelectedCetakMasterItem(null);
                        Toast.show({
                          type: 'glassSuccess',
                          text1: 'Item Cetak Ditambahkan',
                          text2: `${jenis} - ${ket} (Rp ${biaya.toLocaleString(
                            'id-ID',
                          )}/pcs)`,
                        });
                      }}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="add" size={22} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  {/* Ringkasan Item Cetak Terpilih */}
                  {garmenSelectedCetak.length > 0 && (
                    <View style={{ marginTop: 8, gap: 6 }}>
                      {garmenSelectedCetak.map((cItem, cIdx) => {
                        const qtyOrder = toNumCurrency(mh_jmlorder);
                        const sub = cItem.biaya * qtyOrder;
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
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Margin Penjualan:</Text>
                      <Text
                        style={[
                          styles.resultValue,
                          { color: '#0284c7', fontWeight: '700' },
                        ]}
                      >
                        {garmenCalcResult.strataAktif?.label
                          ? `${garmenCalcResult.strataAktif.label} (${garmenCalcResult.strataAktif.persen}%)`
                          : `${Number(
                              garmenCalcResult.strataAktif?.persen !== undefined
                                ? garmenCalcResult.strataAktif.persen
                                : Number(garmenCalcResult.marginPersen || 0) *
                                    100,
                            ).toFixed(1)}%`}
                      </Text>
                    </View>

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

                    {/* Total Kalkulasi / Harga UP per Pcs */}
                    <View style={[styles.resultRow, styles.resultTotalRow]}>
                      <Text style={styles.resultTotalLabel}>
                        Total Kalkulasi (Harga UP):
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
                        Rp{' '}
                        {formatThousandsId(
                          isIncPpn
                            ? Math.round(
                                (garmenCalcResult.hargaUpPerPcs ||
                                  garmenCalcResult.hargaJualRevisi ||
                                  garmenCalcResult.hargaJualPerPcs ||
                                  garmenCalcResult.hargaJual ||
                                  0) * 1.11,
                              )
                            : garmenCalcResult.hargaUpPerPcs ||
                                garmenCalcResult.hargaJualRevisi ||
                                garmenCalcResult.hargaJualPerPcs ||
                                garmenCalcResult.hargaJual ||
                                0,
                        )}{' '}
                        /Pcs
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
                          +Rp{' '}
                          {formatThousandsId(
                            Math.round(
                              (garmenCalcResult.totalHargaOrder ||
                                Number(
                                  garmenCalcResult.hargaUpPerPcs ||
                                    garmenCalcResult.hargaJual ||
                                    0,
                                ) * toNumCurrency(mh_jmlorder)) * 0.11,
                            ),
                          )}
                        </Text>
                      </View>
                    )}

                    {/* Total Order Keseluruhan */}
                    <View style={styles.resultRow}>
                      <Text style={[styles.resultLabel, { fontSize: 11 }]}>
                        Total Order Keseluruhan ({mh_jmlorder || 0} pcs):
                      </Text>
                      <Text
                        style={[
                          styles.resultValue,
                          { fontSize: 11.5, fontWeight: '700' },
                        ]}
                      >
                        Rp{' '}
                        {formatThousandsId(
                          isIncPpn
                            ? Math.round(
                                (garmenCalcResult.totalHargaOrder ||
                                  Number(
                                    garmenCalcResult.hargaUpPerPcs ||
                                      garmenCalcResult.hargaJual ||
                                      0,
                                  ) * toNumCurrency(mh_jmlorder)) * 1.11,
                              )
                            : garmenCalcResult.totalHargaOrder ||
                                Number(
                                  garmenCalcResult.hargaUpPerPcs ||
                                    garmenCalcResult.hargaJual ||
                                    0,
                                ) * toNumCurrency(mh_jmlorder),
                        )}
                      </Text>
                    </View>
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
                            <Text style={[styles.strataTh, { flex: 2 }]}>
                              Rentang Qty
                            </Text>
                            <Text
                              style={[
                                styles.strataTh,
                                { flex: 1, textAlign: 'center' },
                              ]}
                            >
                              Margin
                            </Text>
                            <Text
                              style={[
                                styles.strataTh,
                                { flex: 1.5, textAlign: 'right' },
                              ]}
                            >
                              Harga / Pcs
                            </Text>
                          </View>
                          {(
                            garmenCalcResult.tabelReferensi ||
                            garmenCalcResult.tanggaMargin
                          ).map((tier: any, idx: number) => {
                            const qmin = tier.qmin ?? tier.minOrder ?? 0;
                            const qmax = tier.qmax ?? tier.maxOrder ?? 999999;
                            const isActive =
                              (tier.tier &&
                                tier.tier ===
                                  garmenCalcResult.strataAktif?.tier) ||
                              (toNumCurrency(mh_jmlorder) >= qmin &&
                                toNumCurrency(mh_jmlorder) <= qmax);
                            const persen =
                              tier.persen ?? tier.marginPercent ?? 0;
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
                                    { flex: 2 },
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
                                    { flex: 1, textAlign: 'center' },
                                    isActive && styles.strataTdActive,
                                  ]}
                                >
                                  {persen}%
                                </Text>
                                <Text
                                  style={[
                                    styles.strataTd,
                                    { flex: 1.5, textAlign: 'right' },
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
                        {mh_panjang || 0} m x {mh_lebar || 0} m
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
                          mmtIsNetto && { color: '#d97706', fontWeight: '700' },
                        ]}
                      >
                        {mmtIsNetto ? 'Harga Netto' : 'Harga Standar (Strata)'}
                      </Text>
                    </View>
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
                  <Text style={styles.reviewLabel}>Estimasi Satuan / Pcs:</Text>
                  <Text
                    style={[
                      styles.resultTotalValue,
                      {
                        color: isIncPpn ? '#15803d' : '#0284c7',
                        fontSize: 15,
                      },
                    ]}
                  >
                    Rp{' '}
                    {formatThousandsId(
                      mh_harga_kalkulasi || toNumCurrency(mh_harga) || 0,
                    )}{' '}
                    /Pcs
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
                          const unitPrice =
                            mh_harga_kalkulasi || toNumCurrency(mh_harga) || 0;
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
                      Total Akhir (INC PPN 11%):
                    </Text>
                    <Text
                      style={[
                        styles.reviewValBold,
                        { fontSize: 17, color: '#15803d' },
                      ]}
                    >
                      Rp{' '}
                      {formatThousandsId(
                        (mh_harga_kalkulasi || toNumCurrency(mh_harga)) *
                          toNumCurrency(mh_jmlorder),
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
                      Total Akhir (Non PPN):
                    </Text>
                    <Text
                      style={[
                        styles.reviewValBold,
                        { fontSize: 17, color: '#1e293b' },
                      ]}
                    >
                      Rp{' '}
                      {formatThousandsId(
                        (mh_harga_kalkulasi || toNumCurrency(mh_harga)) *
                          toNumCurrency(mh_jmlorder),
                      )}
                    </Text>
                  </View>
                )}

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
          </View>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* WIZARD FOOTER ACTION NAVIGATION BAR */}
      {/* ========================================================================= */}
      <View style={styles.footerContainer}>
        {currentStep === 1 && (
          <View style={{ width: '100%' }}>
            <TouchableOpacity
              style={[styles.navBtnPrimary, { backgroundColor: THEME.primary }]}
              onPress={goToStep2Kalkulasi}
              activeOpacity={0.9}
            >
              <Text style={styles.navBtnPrimaryText}>Kalkulasi Harga ➔</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.bypassBtnCard}
              onPress={goToStep3Review}
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

        {currentStep === 3 && (
          <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
            <TouchableOpacity
              style={styles.navBtnSecondary}
              onPress={() => setCurrentStep(2)}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="arrow-back"
                size={16}
                color={THEME.ink}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.navBtnSecondaryText}>Hitung Ulang</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.navBtnPrimary,
                { flex: 1.8, backgroundColor: '#15803d' },
              ]}
              onPress={submitPermintaan}
              disabled={saving}
              activeOpacity={0.9}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.navBtnPrimaryText}>
                    {mode === 'edit' ? 'Simpan Perubahan' : 'Kirim Pengajuan'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

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
                  <Text style={styles.modalHeaderTitle}>
                    Pilih Opsi Tambahan
                  </Text>
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
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: THEME.ink,
                  }}
                >
                  Pilih Sablon / Sublim
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalGarmenCetakVisible(false)}
                style={{ padding: 4 }}
              >
                <MaterialIcons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Tab Kategori Minimalis (Sablon vs Sublim) */}
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: '#f1f5f9',
                borderRadius: 8,
                padding: 3,
                marginHorizontal: 16,
                marginTop: 10,
                marginBottom: 8,
              }}
            >
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 7,
                  borderRadius: 6,
                  backgroundColor:
                    cetakActiveCategory === 'SABLON'
                      ? '#ffffff'
                      : 'transparent',
                  alignItems: 'center',
                  shadowColor:
                    cetakActiveCategory === 'SABLON' ? '#000' : 'transparent',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.08,
                  shadowRadius: 2,
                  elevation: cetakActiveCategory === 'SABLON' ? 1 : 0,
                }}
                onPress={() => {
                  setCetakActiveCategory('SABLON');
                  setSearchGarmenCetak('');
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight:
                      cetakActiveCategory === 'SABLON' ? '700' : '500',
                    color:
                      cetakActiveCategory === 'SABLON' ? THEME.ink : '#64748b',
                  }}
                >
                  Sablon
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 7,
                  borderRadius: 6,
                  backgroundColor:
                    cetakActiveCategory === 'SUBLIM'
                      ? '#ffffff'
                      : 'transparent',
                  alignItems: 'center',
                  shadowColor:
                    cetakActiveCategory === 'SUBLIM' ? '#000' : 'transparent',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.08,
                  shadowRadius: 2,
                  elevation: cetakActiveCategory === 'SUBLIM' ? 1 : 0,
                }}
                onPress={() => {
                  setCetakActiveCategory('SUBLIM');
                  setSearchGarmenCetak('');
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight:
                      cetakActiveCategory === 'SUBLIM' ? '700' : '500',
                    color:
                      cetakActiveCategory === 'SUBLIM' ? THEME.ink : '#64748b',
                  }}
                >
                  Sublim
                </Text>
              </TouchableOpacity>
            </View>

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
            <View
              style={{
                marginHorizontal: 16,
                marginBottom: 6,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#f8fafc',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                paddingHorizontal: 10,
                height: 36,
              }}
            >
              <TextInput
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: THEME.ink,
                  paddingVertical: 0,
                }}
                placeholder="Cari jenis atau ukuran..."
                placeholderTextColor="#94a3b8"
                value={searchGarmenCetak}
                onChangeText={setSearchGarmenCetak}
              />
              {searchGarmenCetak ? (
                <TouchableOpacity onPress={() => setSearchGarmenCetak('')}>
                  <MaterialIcons name="close" size={16} color="#94a3b8" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* List Item Bersih & Ringan */}
            <FlatList
              data={garmenCetakMaster.filter((cItem: any) => {
                const j = (cItem.mhb_jenis || cItem.jenis || '').toUpperCase();
                if (j !== cetakActiveCategory) return false;

                const ket = (
                  cItem.mhb_ket ||
                  cItem.ket ||
                  cItem.nama ||
                  ''
                ).toUpperCase();

                if (
                  cetakActiveCategory === 'SABLON' &&
                  sablonSubCategory !== 'ALL'
                ) {
                  if (!ket.includes(sablonSubCategory)) return false;
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
                const ket = item.mhb_ket || item.ket || item.nama || '';
                const biaya = Number(item.mhb_biaya || item.biaya || 0);

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
                      setSelectedCetakMasterItem(item);
                      setModalGarmenCetakVisible(false);
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 13,
                        fontWeight: '500',
                        color: THEME.ink,
                        marginRight: 12,
                      }}
                    >
                      {ket}
                    </Text>
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
    fontSize: 18,
    fontWeight: '900',
    color: THEME.ink,
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
    paddingVertical: 3,
  },
  resultLabel: { fontSize: 12, color: '#475569' },
  resultValue: { fontSize: 12, fontWeight: '600', color: THEME.ink },
  resultTotalRow: {
    borderTopWidth: 1,
    borderColor: '#bbf7d0',
    paddingTop: 6,
    marginTop: 4,
  },
  resultTotalLabel: { fontSize: 13, fontWeight: '800', color: '#166534' },
  resultTotalValue: { fontSize: 14, fontWeight: '800', color: '#15803d' },

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
    paddingVertical: 2,
  },
  reviewLabel: { fontSize: 12, color: '#64748b' },
  reviewVal: { fontSize: 12, color: THEME.ink },
  reviewValBold: { fontSize: 12, fontWeight: '700', color: THEME.ink },
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
});
