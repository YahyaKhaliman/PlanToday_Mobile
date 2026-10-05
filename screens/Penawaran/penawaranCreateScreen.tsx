/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable react-native/no-inline-styles */
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import {
  createPenawaran,
  getMasterPermintaanHargaForPenawaran,
  getMasterPerusahaan,
  type PenawaranPermintaanHargaOption,
} from '../../services/penawaranApi';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/authContext';
import { usePressGuard } from '../../utils/usePressGuard';
import { PENAWARAN_SHADOW, PENAWARAN_THEME } from './penawaranTheme';

const THEME = PENAWARAN_THEME;

const DIVISI_OPTIONS = [
  { kode: '1', label: '1 - SPANDUK' },
  { kode: '4', label: '4 - GARMEN' },
  { kode: '5', label: '5 - MMT' },
];

type DraftDetail = {
  __rowId: string;
  nama_barang: string;
  bahan: string;
  no_permintaan: string;
  ukuran: string;
  panjang: string;
  lebar: string;
  qty: string;
  harga: string;
  nomor_kalkulasi?: string;
  is_include_ppn?: boolean;
};

type PenawaranDraftPayload = {
  tanggal?: string;
  divisi?: string;
  tipe?: string;
  perusahaan?: string;
  perusahaanKode?: string;
  up?: string;
  ttd?: string;
  ttd_jabatan?: string;
  customer?: string;
  customerKode?: string;
  sales?: string;
  salesKode?: string;
  keterangan?: string;
  note?: string;
  details?: DraftDetail[];
};

type SelectedCustomerPayload = {
  kode?: string;
  nama?: string;
};

type SelectedSalesPayload = {
  kode?: string;
  nama?: string;
};

type SelectedNomorPenawaranPayload = {
  kode?: string;
  nama?: string;
  customer?: string;
  perusahaan?: string;
};

const DetailSeparator = () => <View style={styles.detailSeparator} />;

const toYmd = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatDateLabel = (ymd: string) => {
  const [y, m, d] = String(ymd || '')
    .split('-')
    .map(Number);
  if (!y || !m || !d) return ymd || '-';
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const onlyDigits = (value: string) =>
  String(value || '').replace(/[^0-9]/g, '');

const parseNum = (value: string) => {
  const n = Number(onlyDigits(value) || 0);
  return Number.isFinite(n) ? n : 0;
};

const sanitizeDecimalInput = (value: string) => {
  const normalizedSeparators = String(value || '').replace(/,/g, '.');
  const cleaned = normalizedSeparators.replace(/[^0-9.]/g, '');
  const [intPart, ...fracParts] = cleaned.split('.');
  const fractional = fracParts.join('');

  if (!cleaned) return '';
  if (cleaned.startsWith('.')) {
    return `0.${fractional}`;
  }

  return fracParts.length > 0 ? `${intPart}.${fractional}` : intPart;
};

const parseOptionalDecimal = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  const n = Number(sanitizeDecimalInput(raw));
  if (!Number.isFinite(n)) return undefined;
  return n;
};

const formatThousandsId = (value: string) => {
  const cleaned = onlyDigits(value);
  if (!cleaned) return '';
  return new Intl.NumberFormat('id-ID').format(Number(cleaned));
};

const toUpper = (value: string) => String(value || '').toUpperCase();

const normalizePerusahaanLookupKey = (value: string) =>
  toUpper(String(value || '')).replace(/[^A-Z0-9]/g, '');

const PENAWARAN_TTD_MAP: Record<string, { ttd: string; ttd_jabatan: string }> =
  {
    [normalizePerusahaanLookupKey('CV.Kencana Print')]: {
      ttd: 'Tri Yuliani, S.I.Kom',
      ttd_jabatan: 'Supervisor Office Marketing',
    },
    [normalizePerusahaanLookupKey('PT.Jaya Abadi Mulia')]: {
      ttd: 'Widi Hariyanto',
      ttd_jabatan: 'Manager Marketing',
    },
    [normalizePerusahaanLookupKey('PT. Madani Production')]: {
      ttd: 'Ariyani Trikusumastuti, S.E.',
      ttd_jabatan: 'Chief Marketing Officer',
    },
    [normalizePerusahaanLookupKey('Retailer')]: {
      ttd: '',
      ttd_jabatan: '',
    },
    [normalizePerusahaanLookupKey('Sukiman')]: {
      ttd: '',
      ttd_jabatan: '',
    },
  };

const getPerusahaanTtdMapping = (perusahaanNama: string) => {
  const key = normalizePerusahaanLookupKey(perusahaanNama);
  return PENAWARAN_TTD_MAP[key] || { ttd: '', ttd_jabatan: '' };
};

const createRowId = () =>
  `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const buildEmptyDetail = (): DraftDetail => ({
  __rowId: createRowId(),
  nama_barang: '',
  bahan: '',
  no_permintaan: '',
  ukuran: '',
  panjang: '',
  lebar: '',
  qty: '',
  harga: '',
  nomor_kalkulasi: '',
  is_include_ppn: false,
});

export default function PenawaranCreateScreen({ navigation, route }: any) {
  const { user, token } = useAuth();
  const runGuardedPress = usePressGuard();
  const isManager = useMemo(
    () =>
      toUpper(String(user?.jabatan || ''))
        .split(/[\s/_-]+/)
        .includes('MANAGER'),
    [user?.jabatan],
  );
  const loginSalesName = useMemo(
    () => toUpper(String(user?.nama || '').trim()),
    [user?.nama],
  );
  const loginSalesKode = useMemo(
    () =>
      toUpper(
        String(
          user?.sales_kode ||
            user?.sal_kode ||
            user?.kode_sales ||
            user?.spk_sal_kode ||
            '',
        ).trim(),
      ),
    [user?.sales_kode, user?.sal_kode, user?.kode_sales, user?.spk_sal_kode],
  );
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTipeOptions, setShowTipeOptions] = useState(false);
  const [showPerusahaanOptions, setShowPerusahaanOptions] = useState(false);
  const [loadingPerusahaanOptions, setLoadingPerusahaanOptions] =
    useState(false);
  const [perusahaanOptions, setPerusahaanOptions] = useState<
    Array<{ kode: string; nama: string }>
  >([]);
  const [nomorPenawaranSearch, setNomorPenawaranSearch] = useState('');
  const [selectedExistingNomor, setSelectedExistingNomor] = useState('');
  const [permintaanSearchByRow, setPermintaanSearchByRow] = useState<
    Record<number, string>
  >({});
  const [permintaanOptionsByRow, setPermintaanOptionsByRow] = useState<
    Record<number, PenawaranPermintaanHargaOption[]>
  >({});
  const [permintaanLoadingByRow, setPermintaanLoadingByRow] = useState<
    Record<number, boolean>
  >({});
  const [permintaanErrorByRow, setPermintaanErrorByRow] = useState<
    Record<number, string>
  >({});
  const [permintaanPopupRowIndex, setPermintaanPopupRowIndex] = useState<
    number | null
  >(null);
  const [showClearDetailConfirmModal, setShowClearDetailConfirmModal] =
    useState(false);

  const draftFromRoute: PenawaranDraftPayload | undefined =
    route?.params?.draft;

  const [tanggal, setTanggal] = useState(
    draftFromRoute?.tanggal || toYmd(new Date()),
  );
  const [divisi, setDivisi] = useState(toUpper(draftFromRoute?.divisi || '1'));
  const [tipe, setTipe] = useState(String(draftFromRoute?.tipe || ''));
  const [perusahaan, setPerusahaan] = useState(
    toUpper(draftFromRoute?.perusahaan || ''),
  );
  const [perusahaanKode, setPerusahaanKode] = useState(
    toUpper(draftFromRoute?.perusahaanKode || ''),
  );
  const [up, setUp] = useState(String(draftFromRoute?.up || ''));
  const [ttd, setTtd] = useState(String(draftFromRoute?.ttd || ''));
  const [ttdJabatan, setTtdJabatan] = useState(
    String(draftFromRoute?.ttd_jabatan || ''),
  );
  const [customer, setCustomer] = useState(
    toUpper(draftFromRoute?.customer || ''),
  );
  const [customerKode, setCustomerKode] = useState(
    toUpper(draftFromRoute?.customerKode || ''),
  );
  const [sales, setSales] = useState(toUpper(draftFromRoute?.sales || ''));
  const [salesKode, setSalesKode] = useState(
    toUpper(draftFromRoute?.salesKode || loginSalesKode),
  );
  const [keterangan, setKeterangan] = useState(
    String(draftFromRoute?.keterangan || ''),
  );
  const [note, setNote] = useState(String(draftFromRoute?.note || ''));

  const extractHariFromNote = (text: string): string => {
    const match = text.match(/surat penawaran berlaku\s+(\d+)\s+hari/i);
    return match ? match[1] : '';
  };

  const [berlakuHari, setBerlakuHari] = useState<string>(() =>
    extractHariFromNote(String(draftFromRoute?.note || '')),
  );

  const updateBerlakuHari = (hariInput: string) => {
    const cleanDigits = onlyDigits(hariInput);
    setBerlakuHari(cleanDigits);

    setNote(prevNote => {
      const regex = /surat penawaran berlaku\s+\d*\s*hari/i;
      if (!cleanDigits) {
        return prevNote.replace(regex, '').replace(/^\n+|\n+$/g, '');
      }
      const newSentence = `Surat penawaran berlaku ${cleanDigits} hari`;
      if (regex.test(prevNote)) {
        return prevNote.replace(regex, newSentence);
      }
      if (!prevNote.trim()) {
        return newSentence;
      }
      return `${newSentence}\n${prevNote.trim()}`;
    });
  };

  const handleNoteChange = (text: string) => {
    setNote(text);
    const parsedHari = extractHariFromNote(text);
    if (parsedHari !== berlakuHari) {
      setBerlakuHari(parsedHari);
    }
  };
  const [statusHarga, setStatusHarga] = useState<number>(() => {
    const raw = (draftFromRoute as any)?.status_harga;
    if (raw !== undefined && raw !== null) return Number(raw) || 0;
    const firstDetail = draftFromRoute?.details?.[0] as any;
    if (firstDetail?.is_include_ppn !== undefined) {
      return firstDetail.is_include_ppn ? 1 : 0;
    }
    return 0;
  });

  const [isCustomerLockedByPermintaan, setIsCustomerLockedByPermintaan] =
    useState(false);

  const [details, setDetails] = useState<DraftDetail[]>(
    draftFromRoute?.details?.length
      ? draftFromRoute.details.map((d: any) => ({
          ...buildEmptyDetail(),
          ...d,
          __rowId: String(d?.__rowId || createRowId()),
          no_permintaan: toUpper(
            String(d?.no_permintaan || d?.pcs || '').trim(),
          ),
        }))
      : [buildEmptyDetail()],
  );

  useEffect(() => {
    const selected: SelectedCustomerPayload | undefined =
      route?.params?.selectedCustomer;
    if (selected) {
      setCustomerKode(toUpper(String(selected.kode || '')));
      setCustomer(toUpper(String(selected.nama || '')));
    }
  }, [route?.params?.selectedCustomer]);

  useEffect(() => {
    const selected: SelectedSalesPayload | undefined =
      route?.params?.selectedSales;
    if (!isManager) return;
    if (selected) {
      setSalesKode(toUpper(String(selected.kode || '')));
      setSales(toUpper(String(selected.nama || '')));
    }
  }, [isManager, route?.params?.selectedSales]);

  useEffect(() => {
    if (!isManager) {
      setSales(loginSalesName);
      setSalesKode(loginSalesKode);
    }
  }, [isManager, loginSalesKode, loginSalesName]);

  useEffect(() => {
    let active = true;

    const loadPerusahaanOptions = async () => {
      setLoadingPerusahaanOptions(true);
      try {
        const data = await getMasterPerusahaan();
        if (!active) return;
        const normalized = (data || []).map(item => ({
          kode: toUpper(String(item?.kode || '')),
          nama: toUpper(String(item?.nama || '')),
        }));
        setPerusahaanOptions(normalized);
      } catch {
        if (!active) return;
        setPerusahaanOptions([]);
      } finally {
        if (active) setLoadingPerusahaanOptions(false);
      }
    };

    loadPerusahaanOptions();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!perusahaanOptions.length || perusahaanKode || !perusahaan) return;
    const matched = perusahaanOptions.find(
      item => toUpper(item.nama) === toUpper(perusahaan),
    );
    if (matched) {
      setPerusahaanKode(matched.kode);
      setPerusahaan(matched.nama);
    }
  }, [perusahaan, perusahaanKode, perusahaanOptions]);

  useEffect(() => {
    const mapped = getPerusahaanTtdMapping(perusahaan);
    setTtd(mapped.ttd);
    setTtdJabatan(mapped.ttd_jabatan);
  }, [perusahaan]);

  useEffect(() => {
    const selected: SelectedNomorPenawaranPayload | undefined =
      route?.params?.selectedNomorPenawaran;
    if (selected) {
      const picked = toUpper(String(selected.kode || selected.nama || ''));
      setSelectedExistingNomor(picked);
      setNomorPenawaranSearch(picked);
    }
  }, [route?.params?.selectedNomorPenawaran]);

  const totalNominal = useMemo(() => {
    return details.reduce(
      (acc, d) => acc + parseNum(d.qty) * parseNum(d.harga),
      0,
    );
  }, [details]);

  const selectedPermintaanNomorSet = useMemo(() => {
    const picked = new Set<string>();
    details.forEach(d => {
      const nomor = toUpper(String(d?.no_permintaan || '').trim());
      if (nomor) picked.add(nomor);
    });
    return picked;
  }, [details]);

  const isAllowedDivisiKode = (value: string) =>
    DIVISI_OPTIONS.some(opt => opt.kode === String(value || '').trim());

  const divisiDisplayLabel =
    DIVISI_OPTIONS.find(opt => opt.kode === String(divisi || '').trim())
      ?.label || divisi;

  const updateDetail = (index: number, patch: Partial<DraftDetail>) => {
    setDetails(prev =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
  };

  const handleBlockedCustomerChange = () => {
    Toast.show({
      type: 'glassError',
      text1: 'Customer terkunci',
      text2: 'Untuk ganti customer, reset detail terlebih dahulu.',
    });
  };

  const resetDetailAndUnlockCustomer = () => {
    setDetails(prev =>
      prev.map(it => ({
        ...buildEmptyDetail(),
        __rowId: it.__rowId,
      })),
    );
    setPermintaanSearchByRow({});
    setPermintaanOptionsByRow({});
    setPermintaanLoadingByRow({});
    setPermintaanErrorByRow({});
    setPermintaanPopupRowIndex(null);
    setIsCustomerLockedByPermintaan(false);
    setCustomer('');
    setCustomerKode('');
    Toast.show({
      type: 'glassSuccess',
      text1: 'Clear Berhasil',
      text2: 'Semua detail dibersihkan dan "customer" dibuka kembali.',
    });
  };

  const confirmResetDetailAndUnlockCustomer = () => {
    setShowClearDetailConfirmModal(true);
  };

  const getEffectiveSalesKodeForPermintaan = () => {
    if (isManager) {
      return toUpper(String(salesKode || '').trim());
    }
    return toUpper(String(loginSalesKode || '').trim());
  };

  const formatPermintaanUkuranRingkas = (
    ukuran?: string,
    panjang?: number,
    lebar?: number,
  ) => {
    const ukuranText = String(ukuran || '').trim();
    if (ukuranText) return ukuranText;

    const hasPanjang =
      panjang !== undefined &&
      panjang !== null &&
      Number.isFinite(Number(panjang));
    const hasLebar =
      lebar !== undefined && lebar !== null && Number.isFinite(Number(lebar));

    if (hasPanjang || hasLebar) {
      return `${hasPanjang ? Number(panjang) : 0} x ${
        hasLebar ? Number(lebar) : 0
      }`;
    }

    return '-';
  };

  const openPermintaanPopup = async (index: number) => {
    setPermintaanPopupRowIndex(index);
    const keyword =
      permintaanSearchByRow[index] ?? details[index]?.no_permintaan ?? '';
    await fetchPermintaanOptions(index, keyword);
  };

  const closePermintaanPopup = () => {
    setPermintaanPopupRowIndex(null);
  };

  const fetchPermintaanOptions = async (index: number, keyword?: string) => {
    const effectiveSalesKode = getEffectiveSalesKodeForPermintaan();
    if (!effectiveSalesKode) {
      setPermintaanErrorByRow(prev => ({
        ...prev,
        [index]: 'Sales tidak valid untuk pencarian no. permintaan',
      }));
      return;
    }

    setPermintaanLoadingByRow(prev => ({ ...prev, [index]: true }));
    setPermintaanErrorByRow(prev => ({ ...prev, [index]: '' }));
    try {
      const result = await getMasterPermintaanHargaForPenawaran(
        {
          search: String(keyword || '').trim(),
          sales_kode: effectiveSalesKode,
          customer_kode: customerKode.trim() || undefined,
          status: 'DONE',
          limit: 20,
          page: 1,
        },
        token,
      );

      const filteredOptions = (result.options || []).filter(opt => {
        const nomor = toUpper(String(opt?.nomor || '').trim());
        const status = toUpper(String(opt?.status || '').trim());
        const isDone = !status || status === 'DONE';
        return nomor && isDone ? !selectedPermintaanNomorSet.has(nomor) : false;
      });

      setPermintaanOptionsByRow(prev => ({
        ...prev,
        [index]: filteredOptions,
      }));
    } catch (err: any) {
      setPermintaanOptionsByRow(prev => ({ ...prev, [index]: [] }));
      setPermintaanErrorByRow(prev => ({
        ...prev,
        [index]: err?.response?.data?.message || 'Gagal memuat no. permintaan',
      }));
    } finally {
      setPermintaanLoadingByRow(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleApplyPermintaan = async (index: number, nomor: string) => {
    const effectiveSalesKode = getEffectiveSalesKodeForPermintaan();
    if (!effectiveSalesKode || !nomor) return;

    setPermintaanLoadingByRow(prev => ({ ...prev, [index]: true }));
    setPermintaanErrorByRow(prev => ({ ...prev, [index]: '' }));
    try {
      const result = await getMasterPermintaanHargaForPenawaran(
        {
          nomor,
          sales_kode: effectiveSalesKode,
          customer_kode: customerKode.trim() || undefined,
          status: 'DONE',
          limit: 1,
          page: 1,
        },
        token,
      );

      const selected = result.selected;
      if (!selected?.autofill) {
        throw new Error('Detail no. permintaan tidak ditemukan');
      }

      const selectedStatus = toUpper(String(selected?.status || '').trim());
      if (selectedStatus && selectedStatus !== 'DONE') {
        throw new Error(
          `Hanya permintaan harga berstatus DONE yang dapat diproses (Status saat ini: ${selectedStatus})`,
        );
      }

      const af = selected.autofill;
      const isIncPpn =
        af.is_include_ppn !== undefined
          ? Boolean(af.is_include_ppn)
          : /inc\s*ppn|incppn/i.test(af.ket_kalkulasi || '');

      updateDetail(index, {
        no_permintaan: toUpper(String(af.no_permintaan || nomor)),
        nama_barang: toUpper(String(af.nama_barang || '')),
        bahan: toUpper(String(af.bahan || '')),
        ukuran: String(af.ukuran || ''),
        panjang:
          af.panjang !== undefined && af.panjang !== null
            ? String(af.panjang)
            : '',
        lebar:
          af.lebar !== undefined && af.lebar !== null ? String(af.lebar) : '',
        qty:
          af.qty !== undefined && af.qty !== null
            ? String(Math.max(0, Number(af.qty) || 0))
            : '',
        harga:
          af.harga_referensi !== undefined && af.harga_referensi !== null
            ? formatThousandsId(String(af.harga_referensi))
            : '',
        nomor_kalkulasi: af.nomor_kalkulasi || '',
        is_include_ppn: isIncPpn,
      });

      // Otomatis sinkronkan status PPN penawaran mengikuti status PPN permintaan harga
      setStatusHarga(isIncPpn ? 1 : 0);

      const pickedCustomerKode = toUpper(
        String(selected.customer_kode || '').trim(),
      );
      const pickedCustomer = toUpper(String(selected.customer || '').trim());

      if (pickedCustomerKode) setCustomerKode(pickedCustomerKode);
      if (pickedCustomer) setCustomer(pickedCustomer);
      if (pickedCustomerKode || pickedCustomer) {
        setIsCustomerLockedByPermintaan(true);
      }

      const pickedDivisiKode = String(selected.divisi || '').trim();
      if (pickedDivisiKode && isAllowedDivisiKode(pickedDivisiKode)) {
        setDivisi(pickedDivisiKode);
      }

      setPermintaanOptionsByRow(prev => ({ ...prev, [index]: [] }));

      const infoMessage = String((selected as any).info || '').trim();
      const warningMessage = String(selected.warning || '').trim();

      if (infoMessage && warningMessage) {
        Toast.show({
          type: 'glassSuccess',
          text1: infoMessage,
          text2: warningMessage,
        });
      } else if (infoMessage) {
        Toast.show({
          type: 'glassSuccess',
          text1: 'Info',
          text2: infoMessage,
        });
      } else if (warningMessage) {
        Toast.show({
          type: 'glassSuccess',
          text1: 'Info',
          text2: warningMessage,
        });
      }
    } catch (err: any) {
      setPermintaanErrorByRow(prev => ({
        ...prev,
        [index]:
          err?.response?.data?.message ||
          err?.message ||
          'Gagal autofill no. permintaan',
      }));
    } finally {
      setPermintaanLoadingByRow(prev => ({ ...prev, [index]: false }));
    }
  };

  useEffect(() => {
    setPermintaanOptionsByRow({});
    setPermintaanErrorByRow({});
  }, [salesKode, isManager, loginSalesKode]);

  const adjustQty = (index: number, delta: number) => {
    setDetails(prev =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const current = parseNum(it.qty);
        const next = Math.max(0, current + delta);
        return { ...it, qty: String(next) };
      }),
    );
  };

  const addRow = () => {
    setDetails(prev => [...prev, buildEmptyDetail()]);
  };

  const removeRow = (index: number) => {
    const remapByRemovedIndex = <T,>(
      prev: Record<number, T>,
      removedIndex: number,
    ) => {
      const next: Record<number, T> = {};
      Object.entries(prev).forEach(([key, value]) => {
        const numericKey = Number(key);
        if (!Number.isFinite(numericKey)) return;
        if (numericKey === removedIndex) return;
        const targetKey =
          numericKey > removedIndex ? numericKey - 1 : numericKey;
        next[targetKey] = value;
      });
      return next;
    };

    console.log('[PenawaranCreate] removeRow:before', {
      index,
      detailsCount: details.length,
      detailsRowIds: details.map(d => d.__rowId),
      searchKeys: Object.keys(permintaanSearchByRow),
      optionKeys: Object.keys(permintaanOptionsByRow),
      errorKeys: Object.keys(permintaanErrorByRow),
      loadingKeys: Object.keys(permintaanLoadingByRow),
      popupRowIndex: permintaanPopupRowIndex,
    });

    setDetails(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });

    setPermintaanSearchByRow(prev => remapByRemovedIndex(prev, index));
    setPermintaanOptionsByRow(prev => remapByRemovedIndex(prev, index));
    setPermintaanErrorByRow(prev => remapByRemovedIndex(prev, index));
    setPermintaanLoadingByRow(prev => remapByRemovedIndex(prev, index));
    setPermintaanPopupRowIndex(prev => {
      if (prev === null) return prev;
      if (prev === index) return null;
      return prev > index ? prev - 1 : prev;
    });

    setTimeout(() => {
      console.log('[PenawaranCreate] removeRow:after', {
        index,
        detailsCount: details.length - 1,
        searchKeys: Object.keys(permintaanSearchByRow),
        optionKeys: Object.keys(permintaanOptionsByRow),
        errorKeys: Object.keys(permintaanErrorByRow),
        loadingKeys: Object.keys(permintaanLoadingByRow),
      });
    }, 0);
  };

  const buildDraft = (): PenawaranDraftPayload => ({
    tanggal,
    divisi,
    tipe,
    perusahaan,
    perusahaanKode,
    up,
    ttd,
    ttd_jabatan: ttdJabatan,
    customer,
    customerKode,
    sales,
    salesKode,
    keterangan,
    note,
    details,
  });

  const submit = async () => {
    const submitTraceId = `penawaran-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    console.log('[PenawaranCreate] submit:start', {
      submitTraceId,
      saving,
      selectedExistingNomor,
      detailsCount: details.length,
    });

    if (savingRef.current) {
      console.log('[PenawaranCreate] submit:blocked-saving-active', {
        submitTraceId,
      });
      return;
    }

    if (selectedExistingNomor) {
      Toast.show({
        type: 'glassSuccess',
        text1: 'Info',
        text2: `Membuka penawaran ${selectedExistingNomor}`,
      });
      navigation.replace('PenawaranDetail', { nomor: selectedExistingNomor });
      return;
    }

    if (!perusahaan.trim() || !perusahaanKode.trim()) {
      Toast.show({
        type: 'glassError',
        text1: 'Validasi',
        text2: 'Perusahaan wajib dipilih dari dropdown',
      });
      return;
    }
    if (!customer.trim() || !customerKode.trim()) {
      Toast.show({
        type: 'glassError',
        text1: 'Validasi',
        text2: 'Customer wajib dipilih dari pencarian',
      });
      return;
    }
    if (!sales.trim() || !salesKode.trim()) {
      Toast.show({
        type: 'glassError',
        text1: 'Validasi',
        text2: 'Sales wajib dipilih dari pencarian',
      });
      return;
    }

    const filtered = details
      .map(d => ({
        nama_barang: toUpper(d.nama_barang.trim()),
        qty: parseNum(d.qty),
        harga: parseNum(d.harga),
        bahan: toUpper(d.bahan.trim()),
        minta: d.no_permintaan.trim(),
        panjang: parseOptionalDecimal(d.panjang),
        lebar: parseOptionalDecimal(d.lebar),
        ukuran: d.ukuran.trim(),
        satuan: 'PCS',
      }))
      .filter(d => d.nama_barang !== '' || d.qty > 0 || d.harga > 0);

    if (filtered.length === 0) {
      Toast.show({
        type: 'glassError',
        text1: 'Validasi',
        text2: 'Detail item minimal 1 baris',
      });
      return;
    }

    const invalidIdx = filtered.findIndex(d => !d.nama_barang || d.qty <= 0);
    if (invalidIdx >= 0) {
      Toast.show({
        type: 'glassError',
        text1: 'Validasi',
        text2: `Nama barang dan qty baris ke-${invalidIdx + 1} wajib valid`,
      });
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const payload = {
        tanggal,
        divisi: toUpper(divisi.trim()),
        tipe: tipe.trim(),
        perusahaan_kode: perusahaanKode.trim().toUpperCase(),
        up,
        ttd,
        ttd_jabatan: ttdJabatan,
        customer_kode: customerKode.trim().toUpperCase(),
        sales_kode: salesKode.trim().toUpperCase(),
        keterangan: keterangan.trim(),
        note: note.trim(),
        status_harga: statusHarga,
        user: user?.kode || user?.nama || 'MOBILE',
        client_request_id: submitTraceId,
        details: filtered,
      };

      console.log('[PenawaranCreate] submit:payload', {
        submitTraceId,
        summary: {
          tanggal: payload.tanggal,
          divisi: payload.divisi,
          tipe: payload.tipe,
          perusahaan_kode: payload.perusahaan_kode,
          up: payload.up,
          ttd: payload.ttd,
          ttd_jabatan: payload.ttd_jabatan,
          customer_kode: payload.customer_kode,
          sales_kode: payload.sales_kode,
          keterangan: payload.keterangan,
          note: payload.note,
          detailsCount: payload.details.length,
        },
        details: payload.details,
      });

      const result = await createPenawaran(payload, token);
      console.log('[PenawaranCreate] submit:result', {
        submitTraceId,
        result,
      });
      Toast.show({
        type: 'glassSuccess',
        text1: 'Sukses',
        text2: `Nomor: ${result?.nomor || '-'}`,
      });

      if (result?.nomor) {
        navigation.replace('PenawaranDetail', { nomor: result.nomor });
      } else {
        navigation.goBack();
      }
    } catch (err: any) {
      Toast.show({
        type: 'glassError',
        text1: 'Error',
        text2: err?.response?.data?.message || 'Gagal menyimpan penawaran',
      });
      console.log('[PenawaranCreate] submit:error', {
        submitTraceId,
        message: err?.message,
        responseStatus: err?.response?.status,
        responseData: err?.response?.data,
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <LinearGradient
      colors={[THEME.bgTop, THEME.bgBottom]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      <View style={styles.headerArea}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.navigate('PenawaranList')}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name="arrow-back-ios-new"
            size={18}
            color={THEME.primary}
          />
        </TouchableOpacity>

        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Buat Penawaran</Text>
        </View>

        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* CARD 1: PERMINTAAN HARGA & ITEM PENAWARAN (DI ATAS) */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Permintaan Harga & Item Penawaran</Text>
              <Text style={styles.helperInfoText}>
                Pilih No. Permintaan Harga untuk mengisi otomatis data Penawaran.
              </Text>
            </View>
          </View>
          <View style={styles.addBtnWrap}>
            <TouchableOpacity style={styles.addBtn} onPress={addRow}>
              <Text style={styles.addBtnText}>+ Tambah Baris</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={details}
            keyExtractor={item => item.__rowId}
            scrollEnabled={false}
            ItemSeparatorComponent={DetailSeparator}
            renderItem={({ item, index }) => (
              <View style={styles.detailBox}>
                <View style={styles.rowBetween}>
                  <Text style={styles.detailTitle}>Baris {index + 1}</Text>
                  {details.length > 1 && (
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removeRow(index)}
                    >
                      <Text style={styles.removeText}>Hapus</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.detailFieldLabel}>No. Permintaan</Text>
                <View style={styles.row}>
                  {(() => {
                    const nomorPermintaanValue =
                      permintaanSearchByRow[index] ?? item.no_permintaan;
                    const hasNomorPermintaan = !!String(
                      nomorPermintaanValue || '',
                    ).trim();

                    return (
                      <>
                        <View
                          style={[
                            styles.inputWrap,
                            styles.noPermintaanInputWrap,
                            { flex: 1, marginBottom: 0 },
                          ]}
                        >
                          <TextInput
                            value={nomorPermintaanValue}
                            onChangeText={t => {
                              const upperValue = toUpper(t);
                              setPermintaanSearchByRow(prev => ({
                                ...prev,
                                [index]: upperValue,
                              }));
                              updateDetail(index, {
                                no_permintaan: upperValue,
                              });
                            }}
                            style={styles.input}
                            placeholder="Cari/pilih No. Permintaan"
                            placeholderTextColor={THEME.muted}
                          />
                          {hasNomorPermintaan && (
                            <TouchableOpacity
                              style={styles.noPermintaanClearButton}
                              onPress={confirmResetDetailAndUnlockCustomer}
                              activeOpacity={0.85}
                            >
                              <Text style={styles.noPermintaanClearButtonText}>
                                <MaterialIcons
                                  name="close"
                                  style={{ color: THEME.ink }}
                                />
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        {!hasNomorPermintaan && (
                          <TouchableOpacity
                            onPress={() => openPermintaanPopup(index)}
                            style={styles.btnSoft}
                            activeOpacity={0.9}
                            disabled={Boolean(permintaanLoadingByRow[index])}
                          >
                            <Text style={styles.btnSoftText}>
                              {permintaanLoadingByRow[index] ? '...' : 'CARI'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </>
                    );
                  })()}
                </View>

                {!!permintaanErrorByRow[index] && (
                  <Text style={styles.removeText}>
                    {permintaanErrorByRow[index]}
                  </Text>
                )}

                {/* Badge Referensi Kalkulasi & Status PPN */}
                {(!!item.nomor_kalkulasi || item.is_include_ppn !== undefined) && (
                  <View style={styles.kalkulasiBadgeRow}>
                    {!!item.nomor_kalkulasi && (
                      <View style={styles.kalkulasiBadge}>
                        <Text style={styles.kalkulasiBadgeText}>
                          Ref Kalkulasi: {item.nomor_kalkulasi}
                        </Text>
                      </View>
                    )}
                    <View
                      style={[
                        styles.ppnStatusPill,
                        item.is_include_ppn
                          ? styles.ppnStatusPillInc
                          : styles.ppnStatusPillExc,
                      ]}
                    >
                      <Text
                        style={[
                          styles.ppnStatusPillText,
                          item.is_include_ppn
                            ? styles.ppnStatusPillTextInc
                            : styles.ppnStatusPillTextExc,
                        ]}
                      >
                        {item.is_include_ppn ? 'INC PPN' : 'EXC PPN'}
                      </Text>
                    </View>
                  </View>
                )}

                <Text style={styles.detailFieldLabel}>Nama Barang</Text>
                <TextInput
                  value={item.nama_barang}
                  onChangeText={t =>
                    updateDetail(index, { nama_barang: toUpper(t) })
                  }
                  style={styles.input}
                  placeholder="Nama Barang..."
                  placeholderTextColor={THEME.muted}
                />

                <Text style={styles.detailFieldLabel}>Bahan</Text>
                <TextInput
                  value={item.bahan}
                  onChangeText={t => updateDetail(index, { bahan: toUpper(t) })}
                  style={styles.input}
                  placeholder="Bahan..."
                  placeholderTextColor={THEME.muted}
                />

                <Text style={styles.detailFieldLabel}>Ukuran</Text>
                <TextInput
                  value={item.ukuran}
                  onChangeText={t => updateDetail(index, { ukuran: t })}
                  style={styles.input}
                  placeholder="Contoh: L=40, XL=10"
                  placeholderTextColor={THEME.muted}
                />

                <View style={styles.row2}>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailFieldLabel}>Panjang</Text>
                    <View style={styles.unitInputWrap}>
                      <TextInput
                        value={item.panjang}
                        onChangeText={t =>
                          updateDetail(index, {
                            panjang: sanitizeDecimalInput(t),
                          })
                        }
                        style={[styles.input, styles.unitInput]}
                        placeholder="0.00"
                        keyboardType="decimal-pad"
                        placeholderTextColor={THEME.muted}
                      />
                      <Text style={styles.unitSuffix}>M</Text>
                    </View>
                  </View>

                  <View style={styles.detailCol}>
                    <Text style={styles.detailFieldLabel}>Lebar</Text>
                    <View style={styles.unitInputWrap}>
                      <TextInput
                        value={item.lebar}
                        onChangeText={t =>
                          updateDetail(index, {
                            lebar: sanitizeDecimalInput(t),
                          })
                        }
                        style={[styles.input, styles.unitInput]}
                        placeholder="0.00"
                        keyboardType="decimal-pad"
                        placeholderTextColor={THEME.muted}
                      />
                      <Text style={styles.unitSuffix}>M</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.row2}>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailFieldLabel}>Qty</Text>
                    <View style={styles.qtyInputWrap}>
                      <TextInput
                        value={item.qty}
                        onChangeText={t =>
                          updateDetail(index, { qty: onlyDigits(t) })
                        }
                        style={[styles.input, styles.qtyInput]}
                        placeholder="0"
                        keyboardType="numeric"
                        placeholderTextColor={THEME.muted}
                      />

                      <View style={styles.qtyStepperWrap}>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          style={styles.qtyStepperBtn}
                          onPress={() => adjustQty(index, 1)}
                        >
                          <Text style={styles.qtyStepperText}>▲</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          activeOpacity={0.85}
                          style={[
                            styles.qtyStepperBtn,
                            styles.qtyStepperBtnBottom,
                          ]}
                          onPress={() => adjustQty(index, -1)}
                        >
                          <Text style={styles.qtyStepperText}>▼</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View style={styles.detailCol}>
                    <Text style={styles.detailFieldLabel}>Harga / PCS</Text>
                    <View style={styles.moneyInputWrap}>
                      <Text style={styles.moneyPrefix}>Rp.</Text>
                      <TextInput
                        value={item.harga}
                        onChangeText={t =>
                          updateDetail(index, { harga: formatThousandsId(t) })
                        }
                        style={[styles.input, styles.moneyInput]}
                        placeholder="0"
                        keyboardType="numeric"
                        placeholderTextColor={THEME.muted}
                      />
                    </View>
                  </View>
                </View>

                <Text style={styles.lineTotalText}>
                  Estimasi: Rp.{' '}
                  {new Intl.NumberFormat('id-ID').format(
                    parseNum(item.qty) * parseNum(item.harga),
                  )}
                </Text>
              </View>
            )}
          />
        </View>

        {/* CARD 2: TUJUAN PENAWARAN */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tujuan Penawaran</Text>

          <Text style={styles.label}>Customer</Text>
          {!isCustomerLockedByPermintaan ? (
            <Text style={styles.helperInfoText}>
              "Customer" terisi otomatis dari No. Permintaan yang dipilih.
            </Text>
          ) : (
            <Text style={styles.helperLockedText}>
              "Customer" terkunci berdasarkan No. Permintaan
            </Text>
          )}
          <View style={styles.row}>
            <View style={[styles.inputWrap, { flex: 1, marginBottom: 0 }]}>
              <TextInput
                value={customer}
                onChangeText={t => {
                  if (isCustomerLockedByPermintaan) {
                    handleBlockedCustomerChange();
                    return;
                  }
                  setCustomer(toUpper(t));
                  if (customerKode) setCustomerKode('');
                }}
                placeholder="..."
                placeholderTextColor={THEME.muted}
                style={styles.input}
                editable={false}
              />
            </View>
          </View>

          <Text style={styles.label}>Divisi Tujuan</Text>
          {!isCustomerLockedByPermintaan ? (
            <Text style={styles.helperInfoText}>
              "Divisi Tujuan" terisi otomatis dari No. Permintaan yang dipilih.
            </Text>
          ) : (
            <Text style={styles.helperLockedText}>
              "Divisi Tujuan" terkunci berdasarkan No. Permintaan
            </Text>
          )}
          <View style={styles.row}>
            <View style={[styles.inputWrap, { flex: 1, marginBottom: 0 }]}>
              <TextInput
                value={divisiDisplayLabel}
                onChangeText={t => {
                  if (isCustomerLockedByPermintaan) {
                    handleBlockedCustomerChange();
                    return;
                  }
                  setDivisi(toUpper(t));
                }}
                placeholder="..."
                placeholderTextColor={THEME.muted}
                style={styles.input}
                editable={false}
              />
            </View>
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Kepada (Up)</Text>
          <TextInput
            value={up}
            onChangeText={setUp}
            style={styles.input}
            placeholder="Up (contoh: Bpk. Bambang)"
            placeholderTextColor={THEME.muted}
          />
        </View>

        {/* CARD 3: INFORMASI SURAT */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informasi Surat</Text>

          <Text style={styles.label}>Perusahaan</Text>
          <TouchableOpacity
            style={styles.inputButton}
            onPress={() => setShowPerusahaanOptions(prev => !prev)}
            disabled={loadingPerusahaanOptions}
          >
            <View style={styles.dropdownTriggerRow}>
              <Text style={styles.inputButtonText}>
                {loadingPerusahaanOptions
                  ? 'Memuat perusahaan...'
                  : perusahaan || 'Pilih Perusahaan'}
              </Text>
              <Text style={styles.dropdownArrowText}>
                {showPerusahaanOptions ? '▲' : '▼'}
              </Text>
            </View>
          </TouchableOpacity>
          {showPerusahaanOptions && (
            <View style={styles.dropdownWrap}>
              {perusahaanOptions.map(opt => (
                <TouchableOpacity
                  key={`perusahaan-${opt.kode}`}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setPerusahaanKode(opt.kode);
                    setPerusahaan(opt.nama);
                    setShowPerusahaanOptions(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{opt.nama}</Text>
                </TouchableOpacity>
              ))}
              {!loadingPerusahaanOptions && perusahaanOptions.length === 0 && (
                <View style={styles.dropdownItem}>
                  <Text style={styles.dropdownItemText}>
                    Data perusahaan tidak tersedia
                  </Text>
                </View>
              )}
            </View>
          )}

          {!!perusahaanKode && (
            <Text style={styles.helper}>Kode: {perusahaanKode}</Text>
          )}

          <Text style={styles.label}>Tanda Tangan</Text>
          <TextInput
            value={ttd}
            onChangeText={setTtd}
            style={styles.input}
            placeholder="Tanda Tangan"
            placeholderTextColor={THEME.muted}
          />

          <Text style={styles.label}>Jabatan Tanda Tangan</Text>
          <TextInput
            value={ttdJabatan}
            onChangeText={setTtdJabatan}
            editable
            style={styles.input}
            placeholder="Jabatan Tanda Tangan"
            placeholderTextColor={THEME.muted}
          />

          <Text style={styles.label}>Tipe Penawaran</Text>
          <TouchableOpacity
            style={styles.inputButton}
            onPress={() => setShowTipeOptions(prev => !prev)}
          >
            <View style={styles.dropdownTriggerRow}>
              <Text style={styles.inputButtonText}>{tipe || '-'}</Text>
              <Text style={styles.dropdownArrowText}>
                {showTipeOptions ? '▲' : '▼'}
              </Text>
            </View>
          </TouchableOpacity>
          {showTipeOptions && (
            <View style={styles.dropdownWrap}>
              {['', 'Medium', 'Premium'].map(opt => (
                <TouchableOpacity
                  key={`tipe-${opt || 'kosong'}`}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setTipe(opt);
                    setShowTipeOptions(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{opt || '-'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.label}>Tanggal Surat</Text>
          <TouchableOpacity
            style={styles.inputButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.inputButtonText}>
              {formatDateLabel(tanggal)}
            </Text>
          </TouchableOpacity>

          <Text style={styles.label}>
            No. Penawaran (kosongkan jika penawaran baru)
          </Text>
          <View style={styles.row}>
            <View style={[styles.inputWrap, { flex: 1, marginBottom: 0 }]}>
              <TextInput
                value={nomorPenawaranSearch}
                onChangeText={t => {
                  setNomorPenawaranSearch(toUpper(t));
                  if (
                    selectedExistingNomor &&
                    toUpper(t).trim() !== selectedExistingNomor
                  ) {
                    setSelectedExistingNomor('');
                  }
                }}
                style={styles.input}
                placeholder="Cari/pilih nomor penawaran"
                placeholderTextColor={THEME.muted}
              />
            </View>
            {!!nomorPenawaranSearch.trim() && (
              <TouchableOpacity
                onPress={() => {
                  setNomorPenawaranSearch('');
                  setSelectedExistingNomor('');
                }}
                style={styles.btnSoft}
                activeOpacity={0.9}
              >
                <Text style={styles.btnSoftText}>CLEAR</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() =>
                runGuardedPress('penawaran-create:go-search-nomor', () =>
                  navigation.navigate('CariNomorPenawaran', {
                    keyword: nomorPenawaranSearch,
                    draft: buildDraft(),
                  }),
                )
              }
              style={styles.btnSoft}
              activeOpacity={0.9}
            >
              <Text style={styles.btnSoftText}>CARI</Text>
            </TouchableOpacity>
          </View>

          {!!selectedExistingNomor && (
            <Text style={styles.helper}>
              Nomor terpilih: {selectedExistingNomor} (submit akan membuka data
              existing)
            </Text>
          )}

          <Text style={styles.label}>Sales</Text>
          <View style={styles.row}>
            <View style={[styles.inputWrap, { flex: 1, marginBottom: 0 }]}>
              <TextInput
                value={sales}
                editable={isManager}
                onChangeText={t => {
                  if (!isManager) return;
                  setSales(toUpper(t));
                  if (salesKode) setSalesKode('');
                }}
                placeholder="Pilih Sales"
                placeholderTextColor={THEME.muted}
                style={styles.input}
              />
            </View>

            {isManager && (
              <TouchableOpacity
                onPress={() =>
                  runGuardedPress('penawaran-create:go-search-sales', () =>
                    navigation.navigate('CariSalesPenawaran', {
                      keyword: sales,
                      draft: buildDraft(),
                    }),
                  )
                }
                style={styles.btnSoft}
                activeOpacity={0.9}
              >
                <Text style={styles.btnSoftText}>CARI</Text>
              </TouchableOpacity>
            )}
          </View>
          {!!salesKode && (
            <Text style={styles.helper}>Kode Sales: {salesKode}</Text>
          )}
        </View>

        {/* CARD 4: KETENTUAN & CATATAN */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ketentuan & Catatan</Text>

          {/* Pengaturan Status Pajak (PPN) */}
          <Text style={styles.label}>Status Pajak (PPN)</Text>
          <View style={styles.ppnSelectorWrap}>
            <TouchableOpacity
              style={[
                styles.ppnOptionCard,
                statusHarga === 1 && styles.ppnOptionCardActiveInc,
              ]}
              onPress={() => setStatusHarga(1)}
              activeOpacity={0.8}
            >
              <View style={styles.ppnOptionLeft}>
                <MaterialIcons
                  name={
                    statusHarga === 1
                      ? 'radio-button-checked'
                      : 'radio-button-unchecked'
                  }
                  size={20}
                  color={statusHarga === 1 ? '#16a34a' : '#94a3b8'}
                />
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text
                    style={[
                      styles.ppnOptionTitle,
                      statusHarga === 1 && {
                        color: '#15803d',
                        fontWeight: '700',
                      },
                    ]}
                  >
                    Include PPN (11%)
                  </Text>
                  <Text style={styles.ppnOptionSub}>
                    Harga penawaran sudah termasuk PPN
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.ppnBadge,
                  statusHarga === 1
                    ? styles.ppnBadgeInc
                    : styles.ppnBadgeInactive,
                ]}
              >
                <Text
                  style={[
                    styles.ppnBadgeText,
                    statusHarga === 1
                      ? styles.ppnBadgeTextInc
                      : styles.ppnBadgeTextInactive,
                  ]}
                >
                  INC PPN
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.ppnOptionCard,
                statusHarga === 0 && styles.ppnOptionCardActiveExc,
                { marginTop: 8 },
              ]}
              onPress={() => setStatusHarga(0)}
              activeOpacity={0.8}
            >
              <View style={styles.ppnOptionLeft}>
                <MaterialIcons
                  name={
                    statusHarga === 0
                      ? 'radio-button-checked'
                      : 'radio-button-unchecked'
                  }
                  size={20}
                  color={statusHarga === 0 ? '#0284c7' : '#94a3b8'}
                />
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text
                    style={[
                      styles.ppnOptionTitle,
                      statusHarga === 0 && {
                        color: '#0369a1',
                        fontWeight: '700',
                      },
                    ]}
                  >
                    Exclude PPN
                  </Text>
                  <Text style={styles.ppnOptionSub}>
                    Harga penawaran belum termasuk PPN
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.ppnBadge,
                  statusHarga === 0
                    ? styles.ppnBadgeExc
                    : styles.ppnBadgeInactive,
                ]}
              >
                <Text
                  style={[
                    styles.ppnBadgeText,
                    statusHarga === 0
                      ? styles.ppnBadgeTextExc
                      : styles.ppnBadgeTextInactive,
                  ]}
                >
                  EXC PPN
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          <Text style={styles.ppnNoteHint}>
            {statusHarga === 1
              ? '* Note pada PDF Penawaran: "Harga sudah termasuk PPN"'
              : '* Note pada PDF Penawaran: "Harga belum termasuk PPN"'}
          </Text>

          <Text style={[styles.label, { marginTop: 12 }]}>Keterangan</Text>
          <TextInput
            value={keterangan}
            onChangeText={t => setKeterangan(t)}
            style={styles.input}
            placeholder="Keterangan"
            placeholderTextColor={THEME.muted}
          />

          <Text style={styles.label}>Note</Text>
          <View style={styles.berlakuCard}>
            <View style={styles.berlakuRow}>
              <Text style={styles.berlakuLabel}>Surat penawaran berlaku</Text>
              <View style={styles.berlakuInputWrap}>
                <TextInput
                  value={berlakuHari}
                  onChangeText={updateBerlakuHari}
                  placeholder="..."
                  placeholderTextColor={THEME.muted}
                  keyboardType="numeric"
                  style={styles.berlakuInput}
                />
              </View>
              <Text style={styles.berlakuSuffix}>hari</Text>
            </View>

            <View style={styles.berlakuPresetRow}>
              {['3', '7', '14', '30'].map(val => (
                <TouchableOpacity
                  key={`preset-${val}`}
                  style={[
                    styles.berlakuPresetChip,
                    berlakuHari === val && styles.berlakuPresetChipActive,
                  ]}
                  onPress={() => updateBerlakuHari(val)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.berlakuPresetText,
                      berlakuHari === val && styles.berlakuPresetTextActive,
                    ]}
                  >
                    {val} Hari
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TextInput
            value={note}
            onChangeText={handleNoteChange}
            style={[styles.input, styles.noteInput, { marginTop: 8 }]}
            placeholder="Surat penawaran berlaku ... hari"
            placeholderTextColor={THEME.muted}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* CARD 5: RINGKASAN TOTAL & SUBMIT */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.totalCardLabel}>Total Estimasi:</Text>
            <Text style={styles.totalText}>
              Rp {new Intl.NumberFormat('id-ID').format(totalNominal)}
            </Text>
          </View>

          <View style={styles.totalStatusWrap}>
            <Text
              style={[
                styles.totalStatusText,
                { color: statusHarga === 1 ? '#15803d' : '#0369a1' },
              ]}
            >
              {statusHarga === 1
                ? 'Status: Harga Sudah Termasuk PPN (INC PPN)'
                : 'Status: Harga Belum Termasuk PPN (EXC PPN)'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, styles.saveBtnInCard]}
            onPress={() =>
              runGuardedPress('penawaran-create:submit', submit, 1000)
            }
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.saveBtnText}>Ajukan Penawaran</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={permintaanPopupRowIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={closePermintaanPopup}
      >
        <View style={styles.popupBackdrop}>
          <View style={styles.popupCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Pilih No. Permintaan</Text>
              <TouchableOpacity onPress={closePermintaanPopup}>
                <Text style={styles.removeText}>
                  <MaterialIcons
                    name="dangerous"
                    size={20}
                    color={THEME.danger}
                  />
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.nomorSearchWrap}>
              <TextInput
                value={
                  permintaanPopupRowIndex !== null
                    ? permintaanSearchByRow[permintaanPopupRowIndex] ?? ''
                    : ''
                }
                onChangeText={t => {
                  if (permintaanPopupRowIndex === null) return;
                  setPermintaanSearchByRow(prev => ({
                    ...prev,
                    [permintaanPopupRowIndex]: toUpper(t),
                  }));
                }}
                style={styles.nomorSearchInput}
                placeholder="..."
                placeholderTextColor={THEME.muted}
              />
              {permintaanPopupRowIndex !== null &&
                !!(
                  permintaanSearchByRow[permintaanPopupRowIndex] ?? ''
                ).trim() && (
                  <TouchableOpacity
                    style={styles.nomorClearButton}
                    onPress={() => {
                      if (permintaanPopupRowIndex === null) return;
                      setPermintaanSearchByRow(prev => ({
                        ...prev,
                        [permintaanPopupRowIndex]: '',
                      }));
                      setPermintaanOptionsByRow(prev => ({
                        ...prev,
                        [permintaanPopupRowIndex]: [],
                      }));
                      setPermintaanErrorByRow(prev => ({
                        ...prev,
                        [permintaanPopupRowIndex]: '',
                      }));
                    }}
                    disabled={permintaanPopupRowIndex === null}
                  >
                    <Text style={styles.nomorClearButtonText}>✕</Text>
                  </TouchableOpacity>
                )}
            </View>

            <View style={[styles.row, { marginTop: 8 }]}>
              <TouchableOpacity
                style={[styles.btnSoft, { flex: 1 }]}
                onPress={() => {
                  if (permintaanPopupRowIndex === null) return;
                  fetchPermintaanOptions(
                    permintaanPopupRowIndex,
                    permintaanSearchByRow[permintaanPopupRowIndex] ?? '',
                  );
                }}
                disabled={
                  permintaanPopupRowIndex === null ||
                  Boolean(
                    permintaanPopupRowIndex !== null &&
                      permintaanLoadingByRow[permintaanPopupRowIndex],
                  )
                }
              >
                <Text style={styles.btnSoftText}>Cari</Text>
              </TouchableOpacity>
            </View>

            {permintaanPopupRowIndex !== null &&
              permintaanLoadingByRow[permintaanPopupRowIndex] && (
                <View style={styles.popupStateWrap}>
                  <ActivityIndicator color={THEME.primary} />
                  <Text style={styles.searchResultMeta}>
                    Memuat data no. permintaan...
                  </Text>
                </View>
              )}

            {permintaanPopupRowIndex !== null &&
              !permintaanLoadingByRow[permintaanPopupRowIndex] &&
              !(permintaanOptionsByRow[permintaanPopupRowIndex] || [])
                .length && (
                <View style={styles.popupStateWrap}>
                  <Text style={styles.searchResultMeta}>
                    Data tidak ditemukan
                  </Text>
                </View>
              )}

            {permintaanPopupRowIndex !== null &&
              !!(permintaanOptionsByRow[permintaanPopupRowIndex] || [])
                .length && (
                <ScrollView
                  style={styles.popupListWrap}
                  contentContainerStyle={{ paddingBottom: 2 }}
                  keyboardShouldPersistTaps="handled"
                >
                  {(permintaanOptionsByRow[permintaanPopupRowIndex] || []).map(
                    opt => {
                      const ukuranRingkas = formatPermintaanUkuranRingkas(
                        opt.ukuran,
                        opt.panjang,
                        opt.lebar,
                      );
                      const hargaLabel =
                        opt.harga_referensi !== undefined &&
                        opt.harga_referensi !== null &&
                        Number(opt.harga_referensi) > 0
                          ? `Rp ${new Intl.NumberFormat('id-ID').format(
                              Number(opt.harga_referensi) || 0,
                            )}`
                          : '-';

                      return (
                        <TouchableOpacity
                          key={`popup-permintaan-${permintaanPopupRowIndex}-${opt.nomor}`}
                          style={styles.popupListItem}
                          onPress={() => {
                            if (permintaanPopupRowIndex === null) return;
                            const rowIndex = permintaanPopupRowIndex;
                            const picked = toUpper(String(opt.nomor || ''));
                            if (selectedPermintaanNomorSet.has(picked)) {
                              Toast.show({
                                type: 'glassError',
                                text1: 'Info',
                                text2:
                                  'No. Permintaan sudah dipilih di baris lain',
                              });
                              return;
                            }
                            setPermintaanSearchByRow(prev => ({
                              ...prev,
                              [rowIndex]: picked,
                            }));
                            updateDetail(rowIndex, { no_permintaan: picked });
                            closePermintaanPopup();
                            handleApplyPermintaan(rowIndex, picked);
                          }}
                        >
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: 2,
                            }}
                          >
                            <Text style={styles.searchResultNomor}>
                              {opt.nomor || '-'}
                            </Text>
                            <View
                              style={{
                                backgroundColor: '#dcfce7',
                                borderColor: '#86efac',
                                borderWidth: 1,
                                borderRadius: 4,
                                paddingHorizontal: 6,
                                paddingVertical: 1,
                              }}
                            >
                              <Text
                                style={{
                                  color: '#15803d',
                                  fontSize: 10,
                                  fontWeight: '800',
                                }}
                              >
                                DONE
                              </Text>
                            </View>
                          </View>
                          {(!!opt.nomor_kalkulasi || opt.is_include_ppn !== undefined) && (
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: 6,
                                marginTop: 2,
                                marginBottom: 4,
                              }}
                            >
                              {!!opt.nomor_kalkulasi && (
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: '#e0f2fe',
                                    borderRadius: 4,
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    gap: 3,
                                  }}
                                >
                                  <MaterialIcons
                                    name="calculate"
                                    size={12}
                                    color="#0284c7"
                                  />
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      fontWeight: '700',
                                      color: '#0369a1',
                                    }}
                                  >
                                    Kalkulasi: {opt.nomor_kalkulasi}
                                  </Text>
                                </View>
                              )}
                              <View
                                style={{
                                  backgroundColor: opt.is_include_ppn ? '#dcfce7' : '#f1f5f9',
                                  borderRadius: 4,
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderWidth: 1,
                                  borderColor: opt.is_include_ppn ? '#86efac' : '#cbd5e1',
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 10,
                                    fontWeight: '700',
                                    color: opt.is_include_ppn ? '#15803d' : '#64748b',
                                  }}
                                >
                                  {opt.is_include_ppn ? 'INC PPN' : 'EXC PPN'}
                                </Text>
                              </View>
                            </View>
                          )}
                          <Text style={styles.searchResultMeta}>
                            Nama Pekerjaan: {opt.nama_barang || '-'}
                          </Text>
                          <Text style={styles.searchResultMeta}>
                            Customer: {opt.customer || '-'}
                          </Text>
                          <Text style={styles.searchResultMeta}>
                            Kain: {opt.bahan || '-'}
                          </Text>
                          <Text style={styles.searchResultMeta}>
                            Ukuran: {ukuranRingkas}
                          </Text>
                          <Text style={styles.searchResultMeta}>
                            Jumlah Order: {opt.qty || 0}
                          </Text>
                          <Text style={styles.searchResultMeta}>
                            Estimasi harga / PCS: {hargaLabel}
                          </Text>
                        </TouchableOpacity>
                      );
                    },
                  )}
                </ScrollView>
              )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showClearDetailConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClearDetailConfirmModal(false)}
      >
        <View style={styles.clearConfirmOverlay}>
          <View style={styles.clearConfirmCard}>
            <View style={styles.clearConfirmIndicator} />
            <Text style={styles.clearConfirmTitle}>Konfirmasi</Text>
            <Text style={styles.clearConfirmSubtitle}>
              Semua detail akan dibersihkan dan "customer" akan dibuka kembali.
            </Text>

            <View style={styles.clearConfirmActionRow}>
              <TouchableOpacity
                style={styles.clearConfirmBtnCancel}
                onPress={() => setShowClearDetailConfirmModal(false)}
                activeOpacity={0.9}
              >
                <Text style={styles.clearConfirmTextCancel}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.clearConfirmBtnSubmit}
                onPress={() => {
                  setShowClearDetailConfirmModal(false);
                  resetDetailAndUnlockCustomer();
                }}
                activeOpacity={0.9}
              >
                <Text style={styles.clearConfirmTextSubmit}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showDatePicker && (
        <DateTimePicker
          value={new Date(tanggal)}
          mode="date"
          display="default"
          onChange={(_, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setTanggal(toYmd(selectedDate));
          }}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerArea: {
    paddingTop: 44,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 8,
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
  title: {
    color: THEME.ink,
    fontWeight: '900',
    fontSize: 20,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 34,
    gap: 12,
  },
  card: {
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 18,
    padding: 14,
    ...PENAWARAN_SHADOW.softCard,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: THEME.ink,
    marginBottom: 10,
  },
  label: {
    color: THEME.ink,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  input: {
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: THEME.ink,
    fontSize: 14,
    fontWeight: '700',
    backgroundColor: THEME.soft,
  },
  inputWrap: {
    marginBottom: 10,
  },
  noPermintaanInputWrap: {
    position: 'relative',
  },
  noPermintaanClearButton: {
    position: 'absolute',
    right: 10,
    top: '50%',
    marginTop: -11,
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(100,116,139,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPermintaanClearButtonText: {
    color: THEME.ink,
    fontWeight: '900',
    fontSize: 11,
    lineHeight: 12,
  },
  inputButton: {
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 11,
    backgroundColor: THEME.soft,
  },
  inputButtonText: {
    color: THEME.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  dropdownTriggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dropdownArrowText: {
    color: THEME.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  dropdownWrap: {
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 12,
    marginTop: 6,
    overflow: 'hidden',
    backgroundColor: THEME.soft,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
  },
  dropdownItemText: {
    color: THEME.ink,
    fontWeight: '700',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  qtyInputWrap: {
    position: 'relative',
  },
  qtyInput: {
    paddingRight: 34,
  },
  qtyStepperWrap: {
    position: 'absolute',
    top: 1,
    right: 1,
    bottom: 1,
    width: 28,
    borderTopRightRadius: 11,
    borderBottomRightRadius: 11,
    backgroundColor: THEME.soft,
    borderLeftWidth: 1,
    borderLeftColor: THEME.line,
    overflow: 'hidden',
  },
  qtyStepperBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 20,
  },
  qtyStepperBtnBottom: {
    borderTopWidth: 1,
    borderTopColor: THEME.line,
  },
  qtyStepperText: {
    color: THEME.primary,
    fontWeight: '900',
    fontSize: 10,
  },
  helper: {
    color: THEME.sub,
    fontSize: 12,
    marginTop: 6,
    marginBottom: 2,
    fontWeight: '500',
  },
  helperInfoText: {
    color: THEME.accent,
    fontSize: 11,
    marginBottom: 4,
    fontWeight: '500',
  },
  helperLockedText: {
    color: THEME.danger,
    fontSize: 11,
    marginBottom: 4,
    fontWeight: '500',
  },
  resetDetailWrap: {
    marginTop: 8,
    alignItems: 'flex-start',
  },
  resetDetailBtn: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.danger,
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetDetailBtnDisabled: {
    opacity: 0.55,
  },
  resetDetailBtnText: {
    color: THEME.danger,
    fontWeight: '900',
    letterSpacing: 0.2,
    fontSize: 12,
  },
  resetDetailInfoText: {
    color: THEME.muted,
    fontSize: 11,
    marginTop: -4,
    marginBottom: 8,
    fontWeight: '600',
  },
  searchResultWrap: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  nomorSearchWrap: {
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 12,
    paddingHorizontal: 10,
    minHeight: 46,
    backgroundColor: THEME.soft,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nomorSearchInput: {
    flex: 1,
    color: THEME.ink,
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 10,
    paddingHorizontal: 0,
  },
  nomorClearButton: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(100,116,139,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  nomorClearButtonText: {
    color: THEME.muted,
    fontWeight: '900',
    fontSize: 11,
    lineHeight: 12,
  },
  searchResultItem: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
  },
  searchResultNomor: {
    color: THEME.ink,
    fontWeight: '900',
    fontSize: 12,
  },
  searchResultMeta: {
    marginTop: 2,
    color: THEME.muted,
    fontWeight: '600',
    fontSize: 11,
  },
  btnSoft: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    backgroundColor: THEME.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSoftText: {
    color: THEME.primary,
    fontWeight: '900',
    letterSpacing: 0.4,
    fontSize: 12,
  },
  addBtnWrap: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(79,70,229,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.28)',
  },
  addBtnText: {
    color: THEME.primary,
    fontWeight: '900',
    fontSize: 12,
  },
  detailBox: {
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 14,
    backgroundColor: THEME.soft,
    gap: 8,
  },
  detailSeparator: {
    height: 12,
  },
  detailTitle: {
    color: THEME.ink,
    fontWeight: '800',
    fontSize: 12,
  },
  detailFieldLabel: {
    color: THEME.muted,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: -2,
  },
  removeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 500,
    backgroundColor: THEME.soft,
    borderWidth: 1,
    borderColor: THEME.danger,
  },
  removeText: {
    color: THEME.danger,
    fontWeight: '700',
    fontSize: 12,
  },
  row2: {
    flexDirection: 'row',
    gap: 8,
  },
  detailCol: {
    flex: 1,
    gap: 6,
  },
  unitInputWrap: {
    flex: 1,
    position: 'relative',
  },
  unitInput: {
    paddingRight: 30,
  },
  unitSuffix: {
    position: 'absolute',
    right: 10,
    top: '50%',
    marginTop: -8,
    color: THEME.muted,
    fontSize: 13,
    fontWeight: '800',
    includeFontPadding: false,
  },
  moneyInputWrap: {
    position: 'relative',
  },
  moneyPrefix: {
    position: 'absolute',
    left: 10,
    top: '50%',
    marginTop: -8,
    color: THEME.muted,
    fontSize: 13,
    fontWeight: '800',
    zIndex: 1,
    includeFontPadding: false,
  },
  moneyInput: {
    paddingLeft: 34,
  },
  noteInput: {
    minHeight: 110,
    paddingTop: 10,
  },
  lineTotalText: {
    color: THEME.primary,
    fontWeight: '900',
    fontSize: 12,
  },
  totalText: {
    marginTop: 10,
    color: THEME.primary,
    fontWeight: '900',
    fontSize: 13,
  },
  saveBtn: {
    height: 46,
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.primary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  saveBtnInCard: {
    marginTop: 14,
  },
  saveBtnText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 14,
  },
  popupBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  popupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.line,
    padding: 14,
    maxHeight: '76%',
    ...PENAWARAN_SHADOW.softCard,
  },
  popupStateWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  popupListWrap: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 12,
    backgroundColor: THEME.soft,
  },
  popupListItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
  },
  clearConfirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  clearConfirmCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.16)',
    ...PENAWARAN_SHADOW.softCard,
  },
  clearConfirmIndicator: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(79,70,229,0.24)',
    alignSelf: 'center',
    marginBottom: 10,
  },
  clearConfirmTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.ink,
    textAlign: 'center',
  },
  clearConfirmSubtitle: {
    marginTop: 8,
    textAlign: 'center',
    color: THEME.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  clearConfirmActionRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  clearConfirmBtnCancel: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.danger,
    backgroundColor: THEME.danger,
    paddingVertical: 12,
    alignItems: 'center',
  },
  clearConfirmBtnSubmit: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: THEME.primary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  clearConfirmTextCancel: {
    color: '#fff',
    fontWeight: '800',
  },
  clearConfirmTextSubmit: {
    color: '#fff',
    fontWeight: '900',
  },
  kalkulasiBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
    marginBottom: 8,
  },
  kalkulasiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e0f2fe',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  kalkulasiBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369a1',
  },
  ppnStatusPill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  ppnStatusPillInc: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  ppnStatusPillExc: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  ppnStatusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  ppnStatusPillTextInc: {
    color: '#15803d',
  },
  ppnStatusPillTextExc: {
    color: '#64748b',
  },
  ppnSelectorWrap: {
    marginTop: 4,
  },
  ppnOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    backgroundColor: '#fff',
  },
  ppnOptionCardActiveInc: {
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
  },
  ppnOptionCardActiveExc: {
    borderColor: '#7dd3fc',
    backgroundColor: '#f0f9ff',
  },
  ppnOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  ppnOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.ink,
  },
  ppnOptionSub: {
    fontSize: 11,
    color: THEME.muted,
    marginTop: 1,
  },
  ppnBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  ppnBadgeInc: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  ppnBadgeExc: {
    backgroundColor: '#e0f2fe',
    borderColor: '#bae6fd',
  },
  ppnBadgeInactive: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  ppnBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  ppnBadgeTextInc: {
    color: '#15803d',
  },
  ppnBadgeTextExc: {
    color: '#0369a1',
  },
  ppnBadgeTextInactive: {
    color: '#94a3b8',
  },
  ppnNoteHint: {
    marginTop: 6,
    fontSize: 11,
    fontStyle: 'italic',
    color: THEME.muted,
    lineHeight: 16,
  },
  totalCardLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.ink,
  },
  totalStatusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: THEME.line,
  },
  totalStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  berlakuCard: {
    backgroundColor: THEME.soft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    padding: 10,
    marginTop: 2,
    marginBottom: 4,
  },
  berlakuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  berlakuLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.ink,
  },
  berlakuInputWrap: {
    width: 54,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  berlakuInput: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.ink,
    textAlign: 'center',
    padding: 0,
    margin: 0,
  },
  berlakuSuffix: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.ink,
  },
  berlakuPresetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  berlakuPresetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: THEME.line,
  },
  berlakuPresetChipActive: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  berlakuPresetText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.ink,
  },
  berlakuPresetTextActive: {
    color: '#fff',
  },
});
