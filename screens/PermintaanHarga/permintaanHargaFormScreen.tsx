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
  { kode: '1', label: '1 - SPANDUK' },
  { kode: '5', label: '5 - MMT' },
  { kode: '4', label: '4 - GARMEN' },
];

const toYmd = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const onlyDigits = (value: string) =>
  String(value || '').replace(/[^0-9]/g, '');

const formatThousandsId = (value: string | number) => {
  const cleaned = onlyDigits(String(value ?? ''));
  if (!cleaned) return '0';
  return new Intl.NumberFormat('id-ID').format(Number(cleaned));
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
  const [mh_sal_kode, _setMhSalKode] = useState(
    String(initial?.mh_sal_kode || user?.sales_kode || ''),
  );
  const [mh_nama, setMhNama] = useState(String(initial?.mh_nama || ''));
  const [mh_jmlorder, setMhJmlorder] = useState(
    initial?.mh_jmlorder ? String(initial.mh_jmlorder) : '',
  );
  const [mh_harga, setMhHarga] = useState(
    initial?.mh_harga ? String(initial.mh_harga) : '',
  );
  const [mh_budget, _setMhBudget] = useState(
    initial?.mh_budget ? String(initial.mh_budget) : '',
  );
  const [mh_dateorder, setMhDateOrder] = useState(
    String(initial?.mh_dateorder || ''),
  );
  const [mh_kain, setMhKain] = useState(String(initial?.mh_kain || ''));
  const [mh_panjang, setMhPanjang] = useState(
    initial?.mh_panjang ? String(initial.mh_panjang) : '',
  );
  const [mh_lebar, setMhLebar] = useState(
    initial?.mh_lebar ? String(initial.mh_lebar) : '',
  );
  const [mh_ukuran, _setMhUkuran] = useState(String(initial?.mh_ukuran || ''));
  const [mh_gramasi, _setMhGramasi] = useState(
    String(initial?.mh_gramasi || ''),
  );
  const [mh_finishing, setMhFinishing] = useState(
    String(initial?.mh_finishing || ''),
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

  // Toggle PPN yang langsung memperbarui teks di field keterangan kalkulasi
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
      return nextPpn;
    });
  };

  const [saving, setSaving] = useState(false);
  const [showDateOrderPicker, setShowDateOrderPicker] = useState(false);

  // Customer Modal States
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearchKeyword, setCustomerSearchKeyword] = useState('');
  const [customerList, setCustomerList] = useState<PenawaranMasterOption[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);

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

  // Master options backend
  const [masterOptions, setMasterOptions] = useState<{
    spanduk: any[];
    mmt: any[];
    topping: any[];
  }>({ spanduk: [], mmt: [], topping: [] });

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
  const [mmtResult, setMmtResult] = useState<any>(null);
  const [mmtLoading, setMmtLoading] = useState<boolean>(false);
  const [showMmtStrataTabel, setShowMmtStrataTabel] = useState<boolean>(false);
  const [showToppingDropdown, setShowToppingDropdown] =
    useState<boolean>(false);
  const [mmtCalculatedParams, setMmtCalculatedParams] = useState<string>('');

  // Deteksi Perubahan Data Pasca-Kalkulasi (Stale Calculation)
  const currentSpandukParamsKey = `${mh_panjang}|${mh_jmlorder}|${spandukMetode}|${spandukLebar}|${spandukJenisKain}|${isIncPpn}`;
  const isSpandukStale = Boolean(
    spandukResult &&
      spandukCalculatedParams &&
      spandukCalculatedParams !== currentSpandukParamsKey,
  );

  const currentMmtParamsKey = `${mh_panjang}|${mh_lebar}|${mh_jmlorder}|${mmtKategori}|${mmtBahanKode}|${mmtToppingKode}|${mmtToppingQty}|${isIncPpn}`;
  const isMmtStale = Boolean(
    mmtResult &&
      mmtCalculatedParams &&
      mmtCalculatedParams !== currentMmtParamsKey,
  );

  // Kategori & Pilihan Bahan MMT Dinamis dari Master Database
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

  // Kalkulasi Spanduk
  const handleHitungSpanduk = useCallback(async () => {
    const numPanjang = toNumDecimal(mh_panjang);
    const numQty = toNumCurrency(mh_jmlorder);
    if (numPanjang <= 0 || numQty <= 0) return;

    setSpandukLoading(true);
    try {
      const res = await calculateSpandukApi(
        {
          metode: spandukMetode,
          lebar: spandukLebar,
          jenisKain: spandukJenisKain,
          panjang: numPanjang,
          qty: numQty,
        },
        token,
      );
      setSpandukResult(res);
      setSpandukCalculatedParams(
        `${mh_panjang}|${mh_jmlorder}|${spandukMetode}|${spandukLebar}|${spandukJenisKain}|${isIncPpn}`,
      );
      if (res?.hargaSatuanPcs) {
        setMhHarga(String(res.hargaSatuanPcs));
        setMhHargaKalkulasi(res.hargaSatuanPcs);
        const spandukSpec = `Spanduk ${spandukMetode} ${spandukJenisKain} L${spandukLebar}cm`;
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
  }, [
    mh_panjang,
    mh_jmlorder,
    spandukMetode,
    spandukLebar,
    spandukJenisKain,
    token,
    isIncPpn,
  ]);

  // Kalkulasi MMT
  const handleHitungMmt = useCallback(async () => {
    const numPanjang = toNumDecimal(mh_panjang);
    const numLebar = toNumDecimal(mh_lebar);
    const numQty = toNumCurrency(mh_jmlorder);
    if (numPanjang <= 0 || numLebar <= 0 || numQty <= 0) return;

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
        },
        token,
      );
      setMmtResult(res);
      setMmtCalculatedParams(
        `${mh_panjang}|${mh_lebar}|${mh_jmlorder}|${mmtKategori}|${mmtBahanKode}|${mmtToppingKode}|${mmtToppingQty}|${isIncPpn}`,
      );
      if (res?.hargaSatuanPcs) {
        setMhHarga(String(res.hargaSatuanPcs));
        setMhHargaKalkulasi(res.hargaSatuanPcs);
        const mmtSpec = `MMT ${mmtKategori} ${mmtBahanKode}${
          res.topping ? ` + Top: ${res.topping.nama}` : ''
        }`;
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
  }, [
    mh_panjang,
    mh_lebar,
    mh_jmlorder,
    mmtKategori,
    mmtBahanKode,
    mmtToppingKode,
    mmtToppingQty,
    token,
    isIncPpn,
  ]);

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
    if (toNumCurrency(mh_jmlorder) <= 0) {
      Toast.show({
        type: 'glassError',
        text1: 'Data Belum Lengkap',
        text2: 'Mohon masukkan Jumlah Order (Pcs)',
      });
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

    setCurrentStep(2);
    if (mh_divisi === '1') {
      setTimeout(() => handleHitungSpanduk(), 100);
    } else if (mh_divisi === '5') {
      setTimeout(() => handleHitungMmt(), 100);
    }
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

    const payload: PermintaanHargaPayload = {
      mh_divisi,
      mh_cus_kode,
      mh_cus_nama,
      mh_sal_kode,
      mh_nama,
      mh_jmlorder: toNumCurrency(mh_jmlorder),
      mh_harga: toNumCurrency(mh_harga),
      mh_harga_kalkulasi: mh_harga_kalkulasi || toNumCurrency(mh_harga),
      mh_ket_kalkulasi: keteranganKalkulasi.trim(),
      mh_budget: toNumCurrency(mh_budget),
      mh_dateorder,
      mh_kain,
      mh_panjang: toNumDecimal(mh_panjang),
      mh_lebar: toNumDecimal(mh_lebar),
      mh_ukuran,
      mh_gramasi,
      mh_finishing,
      mh_ket,
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
        >
          <MaterialIcons name="arrow-back" size={24} color={THEME.ink} />
          <Text style={styles.backBtnText}>Kembali</Text>
        </TouchableOpacity>

        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>
            {mode === 'edit'
              ? 'Edit Permintaan Harga'
              : 'Buat Permintaan Harga'}
          </Text>
        </View>
        <View style={{ width: 60 }} />
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
                        Pilih customer dari database...
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

              {/* Divisi Selector */}
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>
                  Divisi Produk <Text style={styles.req}>*</Text>
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

            <View style={[styles.card, { marginTop: 12 }]}>
              <Text style={styles.sectionHeading}>2. Dimensi & Kuantitas</Text>

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
                <View style={[styles.fieldWrap, { flex: 1, marginLeft: 10 }]}>
                  <Text style={styles.label}>
                    Lebar ({mh_divisi === '1' ? 'Cm' : 'Mtr'}){' '}
                    <Text style={styles.req}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={mh_lebar}
                    onChangeText={setMhLebar}
                    placeholder={mh_divisi === '1' ? 'Misal: 90' : 'Misal: 1'}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

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

              {/* Jenis Bahan / Kain */}
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Jenis Kain / Bahan</Text>
                <TextInput
                  style={styles.input}
                  value={mh_kain}
                  onChangeText={setMhKain}
                  placeholder="Contoh: Polyester 50/36 / Frontlite 260"
                />
              </View>

              {/* Finishing & Keterangan */}
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Finishing Tambahan</Text>
                <TextInput
                  style={styles.input}
                  value={mh_finishing}
                  onChangeText={setMhFinishing}
                  placeholder="Contoh: Mata ayam 4 pojok, Jahit selongsong"
                />
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Keterangan Permintaan Harga</Text>
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
          </View>
        )}

        {/* ========================================================================= */}
        {/* WIZARD LANGKAH 2: KALKULASI & REVIEW HARGA */}
        {/* ========================================================================= */}
        {currentStep === 2 && (
          <View>
            {/* Box Ringkasan Spesifikasi yang diinput di Langkah 1 */}
            <View style={styles.specSummaryBox}>
              <View style={styles.specSummaryHeader}>
                <MaterialIcons
                  name="inventory"
                  size={16}
                  color={THEME.primary}
                />
                <Text style={styles.specSummaryTitle}>
                  Spesifikasi Ter input
                </Text>
              </View>
              <View style={styles.specSummaryBody}>
                <Text style={styles.specSummaryItem}>
                  <Text style={{ fontWeight: '700' }}>Divisi:</Text>{' '}
                  {selectedDivisiLabel}
                </Text>
                <Text style={styles.specSummaryItem}>
                  <Text style={{ fontWeight: '700' }}>Ukuran:</Text>{' '}
                  {mh_panjang} m x {mh_lebar} {mh_divisi === '1' ? 'cm' : 'm'}
                </Text>
                <Text style={styles.specSummaryItem}>
                  <Text style={{ fontWeight: '700' }}>Jumlah Order:</Text>{' '}
                  {formatThousandsId(mh_jmlorder)} Pcs
                </Text>
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
                    <Text style={styles.engineCardTitle}>
                      Kalkulator Pabrik Spanduk
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.recalcHeaderBtn,
                      isSpandukStale && styles.recalcHeaderBtnStale,
                    ]}
                    onPress={handleHitungSpanduk}
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

                {/* Lebar Bahan Kain */}
                <Text style={[styles.label, { marginTop: 10 }]}>
                  Lebar Bahan Kain (cm)
                </Text>
                <View style={styles.radioRow}>
                  {[90, 115, 120].map(leb => (
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

                {/* Pilihan Jenis Kain */}
                <Text style={[styles.label, { marginTop: 10 }]}>
                  Jenis Kain
                </Text>
                <View style={styles.radioRow}>
                  {['POLYESTER 50/36', 'OPTIC 70/40', 'TC 60/44'].map(kain => (
                    <TouchableOpacity
                      key={kain}
                      style={[
                        styles.chipBtn,
                        spandukJenisKain === kain && styles.chipBtnActive,
                      ]}
                      onPress={() => {
                        setSpandukJenisKain(kain);
                        setMhKain(kain);
                      }}
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

                {/* BANNER DETEKSI DATA BERUBAH (SPANDUK) */}
                {isSpandukStale && (
                  <TouchableOpacity
                    style={styles.staleNoticeCard}
                    onPress={handleHitungSpanduk}
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
                      <Text style={styles.resultLabel}>Total Volume Kain:</Text>
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
                    onPress={handleHitungMmt}
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
                    onPress={handleHitungMmt}
                    activeOpacity={0.85}
                  >
                    <View style={styles.staleNoticeLeft}>
                      <MaterialIcons
                        name="sync-problem"
                        size={22}
                        color="#b45309"
                      />
                      <View style={{ marginLeft: 8, flex: 1 }}>
                        {/* <Text style={styles.staleNoticeTitle}>
                          Data Spesifikasi Berubah!
                        </Text>
                        <Text style={styles.staleNoticeSub}>
                          Tekan di sini untuk menghitung ulang tarif terbaru
                        </Text> */}
                      </View>
                    </View>
                    <View style={styles.staleRecalcBtn}>
                      <MaterialIcons name="refresh" size={15} color="#fff" />
                      <Text style={styles.staleRecalcBtnText}>
                        Hitung Ulang
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Checklist PPN 11% (Di Atas Hasil Kalkulasi Card MMT) */}
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

            {/* Jika Divisi Garmen / Non-Standar */}
            {mh_divisi !== '1' && mh_divisi !== '5' && (
              <View style={styles.card}>
                <Text style={styles.sectionHeading}>
                  Estimasi Harga Manual (Garmen/Custom)
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
              </View>

              {/* Fisik & Dimensi */}
              <View style={styles.reviewSection}>
                <Text style={styles.reviewSectionTitle}>Spesifikasi Fisik</Text>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Dimensi (P x L):</Text>
                  <Text style={styles.reviewVal}>
                    {mh_panjang} m x {mh_lebar} {mh_divisi === '1' ? 'cm' : 'm'}
                  </Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Jumlah Order:</Text>
                  <Text style={styles.reviewValBold}>
                    {formatThousandsId(mh_jmlorder)} Pcs
                  </Text>
                </View>
                {mh_kain ? (
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewLabel}>Bahan/Kain:</Text>
                    <Text style={styles.reviewVal}>{mh_kain}</Text>
                  </View>
                ) : null}
                {mh_finishing ? (
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewLabel}>Finishing:</Text>
                    <Text style={styles.reviewVal}>{mh_finishing}</Text>
                  </View>
                ) : null}
              </View>

              {/* Rencana Order Date */}
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Rencana Tanggal Order</Text>
                <TouchableOpacity
                  style={styles.datePickerBtn}
                  onPress={() => setShowDateOrderPicker(true)}
                >
                  <Text style={styles.datePickerBtnText}>
                    {mh_dateorder || 'Pilih tanggal rencana order'}
                  </Text>
                  <MaterialIcons name="event" size={18} color={THEME.muted} />
                </TouchableOpacity>
              </View>

              {/* Final Price Summary Box */}
              <View style={styles.reviewPriceBox}>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Estimasi Satuan / Pcs:</Text>
                  <Text style={[styles.reviewValBold, { color: '#0284c7' }]}>
                    Rp{' '}
                    {formatThousandsId(
                      mh_harga_kalkulasi || toNumCurrency(mh_harga),
                    )}
                  </Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Nilai Total DPP:</Text>
                  <Text style={[styles.reviewValBold, { fontSize: 15 }]}>
                    Rp{' '}
                    {formatThousandsId(
                      (mh_harga_kalkulasi || toNumCurrency(mh_harga)) *
                        toNumCurrency(mh_jmlorder),
                    )}
                  </Text>
                </View>
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
                        Math.round(
                          (mh_harga_kalkulasi || toNumCurrency(mh_harga)) *
                            toNumCurrency(mh_jmlorder) *
                            1.11,
                        ),
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backBtnText: {
    marginLeft: 4,
    color: THEME.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  headerTextWrap: { flex: 1, alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: THEME.ink },

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
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  specSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  specSummaryTitle: { fontSize: 12, fontWeight: '700', color: THEME.primary },
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
