/* eslint-disable react-native/no-inline-styles */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createPenawaran,
  getMasterPerusahaan,
} from '../../services/penawaranApi';
import { useAuth } from '../../context/authContext';
import { usePressGuard } from '../../utils/usePressGuard';
import { PENAWARAN_SHADOW, PENAWARAN_THEME } from './penawaranTheme';

const THEME = PENAWARAN_THEME;

const DIVISI_OPTIONS = [
  { kode: '1', label: '1 - SPANDUK' },
  { kode: '3', label: '3 - KAOSAN' },
  { kode: '4', label: '4 - GARMEN' },
  { kode: '5', label: '5 - MMT' },
  { kode: '6', label: '6 - FIT U' },
];

type DraftDetail = {
  nama_barang: string;
  bahan: string;
  no_permintaan: string;
  ukuran: string;
  panjang: string;
  lebar: string;
  qty: string;
  harga: string;
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

const buildEmptyDetail = (): DraftDetail => ({
  nama_barang: '',
  bahan: '',
  no_permintaan: '',
  ukuran: '',
  panjang: '',
  lebar: '',
  qty: '',
  harga: '',
});

export default function PenawaranCreateScreen({ navigation, route }: any) {
  const { user, token } = useAuth();
  const insets = useSafeAreaInsets();
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDivisiOptions, setShowDivisiOptions] = useState(false);
  const [showTipeOptions, setShowTipeOptions] = useState(false);
  const [showPerusahaanOptions, setShowPerusahaanOptions] = useState(false);
  const [loadingPerusahaanOptions, setLoadingPerusahaanOptions] =
    useState(false);
  const [perusahaanOptions, setPerusahaanOptions] = useState<
    Array<{ kode: string; nama: string }>
  >([]);
  const [nomorPenawaranSearch, setNomorPenawaranSearch] = useState('');
  const [selectedExistingNomor, setSelectedExistingNomor] = useState('');

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

  const [details, setDetails] = useState<DraftDetail[]>(
    draftFromRoute?.details?.length
      ? draftFromRoute.details.map((d: any) => ({
          ...buildEmptyDetail(),
          ...d,
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

  const selectedDivisiLabel = useMemo(() => {
    const kode = String(divisi || '').trim();
    const found = DIVISI_OPTIONS.find(opt => opt.kode === kode);
    if (found) return found.label;
    return kode ? `${kode} - LAINNYA` : '-';
  }, [divisi]);

  const updateDetail = (index: number, patch: Partial<DraftDetail>) => {
    setDetails(prev =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
  };

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
    setDetails(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
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
        user: user?.kode || user?.nama || 'MOBILE',
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
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backBtnText}>Kembali</Text>
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
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Header</Text>

          <Text style={styles.label}>Tanggal</Text>
          <TouchableOpacity
            style={styles.inputButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.inputButtonText}>
              {formatDateLabel(tanggal)}
            </Text>
          </TouchableOpacity>

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

          <Text style={styles.label}>Divisi Tujuan</Text>
          <TouchableOpacity
            style={styles.inputButton}
            onPress={() => setShowDivisiOptions(prev => !prev)}
          >
            <View style={styles.dropdownTriggerRow}>
              <Text style={styles.inputButtonText}>{selectedDivisiLabel}</Text>
              <Text style={styles.dropdownArrowText}>
                {showDivisiOptions ? '▲' : '▼'}
              </Text>
            </View>
          </TouchableOpacity>
          {showDivisiOptions && (
            <View style={styles.dropdownWrap}>
              {DIVISI_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={`divisi-${opt.kode}`}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setDivisi(opt.kode);
                    setShowDivisiOptions(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.label}>Tipe</Text>
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

          <Text style={styles.label}>Up</Text>
          <TextInput
            value={up}
            onChangeText={setUp}
            style={styles.input}
            placeholder="Up"
            placeholderTextColor={THEME.muted}
          />

          <Text style={styles.label}>Customer</Text>
          <View style={styles.row}>
            <View style={[styles.inputWrap, { flex: 1, marginBottom: 0 }]}>
              <TextInput
                value={customer}
                onChangeText={t => {
                  setCustomer(toUpper(t));
                  if (customerKode) setCustomerKode('');
                }}
                placeholder="Pilih Customer"
                placeholderTextColor={THEME.muted}
                style={styles.input}
              />
            </View>

            <TouchableOpacity
              onPress={() =>
                runGuardedPress('penawaran-create:go-search-customer', () =>
                  navigation.navigate('CariCustomer', {
                    keyword: customer,
                    from: 'PENAWARAN_CREATE',
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

          {!!customerKode && (
            <Text style={styles.helper}>Kode: {customerKode}</Text>
          )}

          <Text style={styles.label}>Keterangan</Text>
          <TextInput
            value={keterangan}
            onChangeText={t => setKeterangan(t)}
            style={styles.input}
            placeholder="Keterangan"
            placeholderTextColor={THEME.muted}
          />

          <Text style={styles.label}>Note</Text>
          <TextInput
            value={note}
            onChangeText={t => setNote(t)}
            style={[styles.input, styles.noteInput]}
            placeholder="Note"
            placeholderTextColor={THEME.muted}
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Detail Item</Text>
          <View style={styles.addBtnWrap}>
            <TouchableOpacity style={styles.addBtn} onPress={addRow}>
              <Text style={styles.addBtnText}>+ Tambah</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={details}
            keyExtractor={(_, idx) => `draft-${idx}`}
            scrollEnabled={false}
            ItemSeparatorComponent={DetailSeparator}
            renderItem={({ item, index }) => (
              <View style={styles.detailBox}>
                <View style={styles.rowBetween}>
                  <Text style={styles.detailTitle}>Baris {index + 1}</Text>
                  {details.length > 1 && (
                    <TouchableOpacity onPress={() => removeRow(index)}>
                      <Text style={styles.removeText}>Hapus</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.detailFieldLabel}>No. Permintaan</Text>
                <TextInput
                  value={item.no_permintaan}
                  onChangeText={t =>
                    updateDetail(index, { no_permintaan: toUpper(t) })
                  }
                  style={styles.input}
                  placeholder="No. Permintaan item..."
                  placeholderTextColor={THEME.muted}
                />

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
                        placeholder="0"
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
                        placeholder="0"
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
                  Total: Rp.{' '}
                  {new Intl.NumberFormat('id-ID').format(
                    parseNum(item.qty) * parseNum(item.harga),
                  )}
                </Text>
              </View>
            )}
          />

          <Text style={styles.totalText}>
            Estimasi nominal:{' '}
            {new Intl.NumberFormat('id-ID').format(totalNominal)}
          </Text>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={submit}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.saveBtnText}>Ajukan Penawaran</Text>
          )}
        </TouchableOpacity>
      </View>

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
    color: THEME.ink,
    fontWeight: '900',
    fontSize: 18,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 170,
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
    color: THEME.muted,
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
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: 1,
    borderTopColor: THEME.line,
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
  saveBtnText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 14,
  },
});
