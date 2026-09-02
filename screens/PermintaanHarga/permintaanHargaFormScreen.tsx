/* eslint-disable react-native/no-inline-styles */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
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
} from '../../services/permintaanHargaApi';
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

const toUpper = (v: string) => String(v || '').toUpperCase();

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

  // --- STATE TABS ---
  const [activeTab, setActiveTab] = useState<'permintaan' | 'kalkulasi'>(
    'permintaan',
  );

  // --- STATE TAB 1: PERMINTAAN HARGA ---
  const [saving, setSaving] = useState(false);
  const [showDateOrderPicker, setShowDateOrderPicker] = useState(false);
  const [showDivisiOptions, setShowDivisiOptions] = useState(false);

  const [mh_divisi, setMhDivisi] = useState(String(initial?.mh_divisi || '1'));
  const [mh_cus_kode, setMhCusKode] = useState(
    String(initial?.mh_cus_kode || ''),
  );
  const [mh_cus_nama, setMhCusNama] = useState(
    toUpper(String(initial?.mh_cus_nama || '')),
  );
  const [mh_sal_kode, setMhSalKode] = useState(
    toUpper(String(initial?.mh_sal_kode || loginSalesKode)),
  );
  const [mh_sal_nama, setMhSalNama] = useState(
    toUpper(String(initial?.sales_nama || loginSalesName)),
  );
  const [mh_nama, setMhNama] = useState(String(initial?.mh_nama || ''));
  const [mh_jmlorder, setMhJmlOrder] = useState(
    String(initial?.mh_jmlorder ?? ''),
  );
  const [mh_harga_kalkulasi, setMhHargaKalkulasi] = useState<number>(
    Number(initial?.mh_harga_kalkulasi) || 0,
  );
  const [mh_harga, setMhHarga] = useState(
    formatThousandsId(String(initial?.mh_harga ?? '')),
  );
  const [mh_budget, setMhBudget] = useState(
    formatThousandsId(String(initial?.mh_budget ?? '')),
  );
  const [mh_dateorder, setMhDateOrder] = useState(
    String(initial?.mh_dateorder || '')
      .trim()
      .slice(0, 10) || toYmd(new Date()),
  );
  const [mh_kain, setMhKain] = useState(String(initial?.mh_kain || ''));
  const [mh_panjang, setMhPanjang] = useState(
    String(initial?.mh_panjang ?? ''),
  );
  const [mh_lebar, setMhLebar] = useState(String(initial?.mh_lebar ?? ''));
  const [mh_ukuran, setMhUkuran] = useState(String(initial?.mh_ukuran || ''));
  const [mh_gramasi, setMhGramasi] = useState(
    String(initial?.mh_gramasi || ''),
  );
  const [mh_finishing, setMhFinishing] = useState(
    String(initial?.mh_finishing || ''),
  );
  const [mh_ket, setMhKet] = useState(String(initial?.mh_ket || ''));

  // --- STATE KALKULATOR DIVISI 1: SPANDUK ---
  const [spandukMetode, setSpandukMetode] = useState<'MANUAL' | 'MACHINE'>(
    'MANUAL',
  );
  const [spandukLebar, setSpandukLebar] = useState<number>(90);
  const [spandukKain, setSpandukKain] = useState<string>('POLYESTER 50/36');
  const [spandukLoading, setSpandukLoading] = useState(false);
  const [spandukResult, setSpandukResult] = useState<any>(null);
  const [showSpandukStrataTabel, setShowSpandukStrataTabel] = useState(false);

  // --- STATE KALKULATOR DIVISI 5: MMT ---
  const [mmtKategori, setMmtKategori] = useState<'VYNIL' | 'NON_VYNIL'>(
    'VYNIL',
  );
  const [mmtBahanKode, setMmtBahanKode] = useState<string>('260');
  const [mmtToppingKode, setMmtToppingKode] = useState<string>('');
  const [mmtToppingQty, setMmtToppingQty] = useState<string>('');
  const [mmtLoading, setMmtLoading] = useState(false);
  const [mmtResult, setMmtResult] = useState<any>(null);
  const [showMmtStrataTabel, setShowMmtStrataTabel] = useState(false);
  const [masterToppingList, setMasterToppingList] = useState<any[]>([]);

  // Update customer dan sales bila dipilih dari navigation screen lain
  useEffect(() => {
    const selectedCustomer = route?.params?.selectedCustomer;
    if (selectedCustomer) {
      setMhCusKode(toUpper(String(selectedCustomer?.kode || '')));
      setMhCusNama(toUpper(String(selectedCustomer?.nama || '')));
    }
  }, [route?.params?.selectedCustomer]);

  useEffect(() => {
    const selectedSales = route?.params?.selectedSales;
    if (!isManager) return;
    if (selectedSales) {
      setMhSalKode(toUpper(String(selectedSales?.kode || '')));
      setMhSalNama(toUpper(String(selectedSales?.nama || '')));
    }
  }, [isManager, route?.params?.selectedSales]);

  useEffect(() => {
    if (!isManager) {
      setMhSalNama(loginSalesName);
      setMhSalKode(loginSalesKode);
    }
  }, [isManager, loginSalesKode, loginSalesName]);

  // Load Master Options saat buka layar
  useEffect(() => {
    const loadMaster = async () => {
      try {
        const resOptions = await getKalkulasiMasterOptions(token);
        if (resOptions?.topping) {
          setMasterToppingList(resOptions.topping);
        }
      } catch (e) {
        console.log('[Kalkulasi][MasterLoad][Error]', e);
      }
    };
    loadMaster();
  }, [token]);

  // --- TRIGGER ENGINE KALKULASI SPANDUK (BE) ---
  const handleHitungSpanduk = useCallback(async () => {
    setSpandukLoading(true);
    try {
      const res = await calculateSpandukApi(
        {
          metode: spandukMetode,
          lebar: spandukLebar,
          jenisKain: spandukKain,
          panjang: toNumDecimal(mh_panjang),
          qty: toNumCurrency(mh_jmlorder),
        },
        token,
      );
      setSpandukResult(res);
      Toast.show({
        type: 'glassSuccess',
        text1: 'Kalkulasi Spanduk Berhasil',
        text2: `Harga: Rp ${formatThousandsId(res?.hargaSatuanPcs)} /pcs`,
      });
    } catch (e: any) {
      Toast.show({
        type: 'glassError',
        text1: 'Gagal Kalkulasi Spanduk',
        text2: e?.response?.data?.message || e?.message || 'Error',
      });
    } finally {
      setSpandukLoading(false);
    }
  }, [
    spandukMetode,
    spandukLebar,
    spandukKain,
    mh_panjang,
    mh_jmlorder,
    token,
  ]);

  // --- TRIGGER ENGINE KALKULASI MMT (BE) ---
  const handleHitungMmt = useCallback(async () => {
    setMmtLoading(true);
    try {
      const res = await calculateMmtApi(
        {
          kategori: mmtKategori,
          bahanKode: mmtBahanKode,
          panjang: toNumDecimal(mh_panjang),
          lebar: toNumDecimal(mh_lebar),
          qty: toNumCurrency(mh_jmlorder),
          toppingKode: mmtToppingKode,
          toppingQty: toNumCurrency(mmtToppingQty),
        },
        token,
      );
      setMmtResult(res);
      Toast.show({
        type: 'glassSuccess',
        text1: 'Kalkulasi MMT Berhasil',
        text2: `Harga: Rp ${formatThousandsId(res?.hargaSatuanPcs)} /pcs`,
      });
    } catch (e: any) {
      Toast.show({
        type: 'glassError',
        text1: 'Gagal Kalkulasi MMT',
        text2: e?.response?.data?.message || e?.message || 'Error',
      });
    } finally {
      setMmtLoading(false);
    }
  }, [
    mmtKategori,
    mmtBahanKode,
    mh_panjang,
    mh_lebar,
    mh_jmlorder,
    mmtToppingKode,
    mmtToppingQty,
    token,
  ]);

  // Terapkan Harga Kalkulasi ke Form Permintaan Harga (Tab 1)
  const applyPriceToTab1 = (hargaPcs: number) => {
    setMhHarga(formatThousandsId(hargaPcs));
    setMhHargaKalkulasi(hargaPcs);
    setActiveTab('permintaan');
    Toast.show({
      type: 'glassSuccess',
      text1: 'Harga Kalkulasi Diterapkan',
      text2: `Harga Rp ${formatThousandsId(
        hargaPcs,
      )} /pcs (+ PPN 11%) berhasil dipasang di Tab 1`,
    });
  };

  // Simpan Permintaan Harga (Tab 1)
  const submitPermintaan = async () => {
    if (mh_cus_nama && !mh_cus_kode) {
      Toast.show({
        type: 'glassError',
        text1: 'Validasi Customer',
        text2: 'Customer belum valid. Pilih dari tombol Cari.',
      });
      return;
    }

    if (
      !mh_divisi ||
      !mh_cus_kode ||
      !mh_cus_nama ||
      !mh_sal_kode ||
      !mh_nama
    ) {
      Toast.show({
        type: 'glassError',
        text1: 'Validasi',
        text2: 'Divisi, customer, sales, dan nama wajib diisi',
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
    let nomorSaved = currentNomor;

    try {
      if (mode === 'edit') {
        await updatePermintaanHarga(currentNomor, payload, token);
      } else {
        const created = await createPermintaanHarga(payload, token);
        nomorSaved = String(created?.nomor || '');
        setCurrentNomor(nomorSaved);
      }
    } catch (err: any) {
      Toast.show({
        type: 'glassError',
        text1: 'Error',
        text2:
          err?.response?.data?.message || 'Gagal menyimpan permintaan harga',
      });
      setSaving(false);
      return;
    }

    Toast.show({
      type: 'glassSuccess',
      text1: 'Berhasil',
      text2:
        mode === 'edit'
          ? 'Permintaan harga berhasil diperbarui'
          : 'Permintaan harga berhasil ditambah',
    });
    setSaving(false);
    navigation.navigate('PermintaanHargaList');
  };

  const selectedDivisiLabel = useMemo(() => {
    const found = DIVISI_OPTIONS.find(d => d.kode === mh_divisi);
    return found ? found.label : `${mh_divisi} - DIVISI`;
  }, [mh_divisi]);

  const nonVynilOptions = [
    {
      kode: 'ALBATROS_MT',
      nama: 'Albatros (Normal Hi-Res - MT)',
      harga: 45000,
    },
    { kode: 'ALBATROS_MI', nama: 'Albatros (Super Hi-Res - MI)', harga: 55000 },
    {
      kode: 'STICKER_ONEWAY',
      nama: 'Sticker One Way (Super Hi-Res - MI)',
      harga: 65000,
    },
    {
      kode: 'STICKER_CHINA',
      nama: 'Sticker China Glossy (Super Hi-Res - MI)',
      harga: 50000,
    },
    {
      kode: 'STICKER_RITRAMA',
      nama: 'Sticker Ritrama (Super Hi-Res - MI)',
      harga: 65000,
    },
  ];

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

      {/* Header Area */}
      <View style={styles.headerArea}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.navigate('PermintaanHargaList')}
          activeOpacity={0.8}
        >
          <MaterialIcons name="arrow-back" size={20} color={THEME.ink} />
          <Text style={styles.backBtnText}>Kembali</Text>
        </TouchableOpacity>

        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>
            {mode === 'edit' ? 'Edit Permintaan' : 'Buat Permintaan'}
          </Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      {/* Segmented Tab Bar */}
      <View style={styles.tabBarWrap}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'permintaan' && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab('permintaan')}
          activeOpacity={0.9}
        >
          <MaterialIcons
            name="description"
            size={18}
            color={activeTab === 'permintaan' ? THEME.primary : THEME.muted}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'permintaan' && styles.tabButtonTextActive,
            ]}
          >
            1. Permintaan
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'kalkulasi' && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab('kalkulasi')}
          activeOpacity={0.9}
        >
          <MaterialIcons
            name="calculate"
            size={18}
            color={activeTab === 'kalkulasi' ? THEME.primary : THEME.muted}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'kalkulasi' && styles.tabButtonTextActive,
            ]}
          >
            2. Kalkulasi (
            {mh_divisi === '1'
              ? 'Spanduk'
              : mh_divisi === '5'
              ? 'MMT'
              : 'Garmen'}
            )
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content ScrollView */}
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* ==================== TAB 1: PERMINTAAN HARGA ==================== */}
        {activeTab === 'permintaan' ? (
          <View style={styles.card}>
            {currentNomor ? (
              <View style={styles.nomorBadge}>
                <Text style={styles.nomorBadgeText}>
                  No. MH: {currentNomor}
                </Text>
              </View>
            ) : null}

            {/* Sales Field */}
            <Text style={[styles.label, { marginTop: 8 }]}>Sales</Text>
            <View style={styles.row}>
              <TextInput
                style={[
                  styles.input,
                  styles.rowInput,
                  !isManager && styles.inputDisabled,
                ]}
                value={mh_sal_nama}
                editable={isManager}
                onChangeText={t => {
                  if (isManager) {
                    setMhSalNama(toUpper(t));
                    setMhSalKode('');
                  }
                }}
                placeholder="Pilih Sales"
                placeholderTextColor={THEME.muted}
              />
              {isManager ? (
                <TouchableOpacity
                  style={styles.searchButton}
                  onPress={() =>
                    runGuardedPress('permintaan:sales', () =>
                      navigation.navigate('CariSalesPenawaran', {
                        from: 'PERMINTAAN_HARGA_FORM',
                        keyword: mh_sal_nama,
                      }),
                    )
                  }
                >
                  <Text style={styles.btnSoftText}>Cari</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Customer Field */}
            <Text style={[styles.label, { marginTop: 10 }]}>Customer</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.rowInput]}
                value={mh_cus_nama}
                onChangeText={t => {
                  if (mode !== 'edit') {
                    setMhCusNama(toUpper(t));
                    setMhCusKode('');
                  }
                }}
                placeholder="Pilih Customer"
                placeholderTextColor={THEME.muted}
                editable={mode !== 'edit'}
              />
              {mode !== 'edit' ? (
                <TouchableOpacity
                  style={styles.searchButton}
                  onPress={() =>
                    runGuardedPress('permintaan:cust', () =>
                      navigation.navigate('CariCustomer', {
                        from: 'PERMINTAAN_HARGA_FORM',
                        keyword: mh_cus_nama,
                      }),
                    )
                  }
                >
                  <Text style={styles.btnSoftText}>Cari</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Nama Pekerjaan */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Nama Pekerjaan</Text>
              <TextInput
                style={styles.input}
                value={mh_nama}
                onChangeText={setMhNama}
                placeholder="Nama Pekerjaan"
                placeholderTextColor={THEME.muted}
              />
            </View>

            {/* Divisi Tujuan */}
            <Text style={[styles.label, { marginTop: 10 }]}>Divisi Tujuan</Text>
            <TouchableOpacity
              style={styles.inputButton}
              onPress={() => setShowDivisiOptions(v => !v)}
            >
              <Text style={styles.inputButtonText}>{selectedDivisiLabel}</Text>
              <Text style={styles.dropdownArrowText}>
                {showDivisiOptions ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>
            {showDivisiOptions ? (
              <View style={styles.dropdownWrap}>
                {DIVISI_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={`divisi-${opt.kode}`}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setMhDivisi(opt.kode);
                      setShowDivisiOptions(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {/* Rencana Jumlah Order */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Rencana Jumlah Order (Pcs)</Text>
              <TextInput
                style={[styles.input, { fontWeight: '700' }]}
                value={mh_jmlorder}
                onChangeText={t => setMhJmlOrder(onlyDigits(t))}
                keyboardType="numeric"
                placeholder=""
                placeholderTextColor={THEME.muted}
              />
            </View>

            {/* Dimensi Panjang & Lebar */}
            <View style={styles.rowField2}>
              <View style={[styles.fieldWrap, { flex: 1 }]}>
                <Text style={styles.label}>Panjang (Mtr)</Text>
                <TextInput
                  style={styles.input}
                  value={mh_panjang}
                  onChangeText={setMhPanjang}
                  keyboardType="numeric"
                  placeholder=""
                />
              </View>
              <View style={[styles.fieldWrap, { flex: 1, marginLeft: 10 }]}>
                <Text style={styles.label}>Lebar (Mtr)</Text>
                <TextInput
                  style={styles.input}
                  value={mh_lebar}
                  onChangeText={setMhLebar}
                  keyboardType="numeric"
                  placeholder=""
                />
              </View>
            </View>

            {/* Harga & Budget */}
            <View style={styles.rowField2}>
              <View style={[styles.fieldWrap, { flex: 1 }]}>
                <Text style={styles.label}>Harga Satuan (Rp)</Text>
                <TextInput
                  style={[
                    styles.input,
                    { fontWeight: '700', color: THEME.primary },
                  ]}
                  value={mh_harga}
                  onChangeText={t => setMhHarga(formatThousandsId(t))}
                  keyboardType="numeric"
                  placeholder=""
                />
              </View>
              <View style={[styles.fieldWrap, { flex: 1, marginLeft: 10 }]}>
                <Text style={styles.label}>Harga Budget (Rp)</Text>
                <TextInput
                  style={styles.input}
                  value={mh_budget}
                  onChangeText={t => setMhBudget(formatThousandsId(t))}
                  keyboardType="numeric"
                  placeholder=""
                />
              </View>
            </View>

            {/* Field Total Harga Kalkulasi & Harga Kalkulasi (PPN 11%) */}
            <View
              style={[
                styles.sectionBox,
                {
                  backgroundColor: '#f0fdf4',
                  borderColor: '#bbf7d0',
                  marginTop: 10,
                },
              ]}
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
                  style={{ fontSize: 12, fontWeight: '700', color: '#166534' }}
                >
                  Hasil Kalkulasi Harga
                </Text>
                <TouchableOpacity
                  onPress={() => setActiveTab('kalkulasi')}
                  style={{
                    backgroundColor: '#dcfce7',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: '#15803d',
                    }}
                  >
                    ⚙️ Buka Kalkulator
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.rowField2}>
                <View style={[styles.fieldWrap, { flex: 1, marginTop: 0 }]}>
                  <Text style={[styles.labelSmall, { color: '#166534' }]}>
                    Harga Kalkulasi
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: '#fff',
                        fontWeight: '700',
                        color: '#15803d',
                      },
                    ]}
                    value={`Rp ${formatThousandsId(
                      (mh_harga_kalkulasi || toNumCurrency(mh_harga)) *
                        toNumCurrency(mh_jmlorder),
                    )}`}
                    editable={false}
                  />
                </View>
                <View
                  style={[
                    styles.fieldWrap,
                    { flex: 1, marginLeft: 10, marginTop: 0 },
                  ]}
                >
                  <Text style={[styles.labelSmall, { color: '#166534' }]}>
                    + PPN 11%
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: '#fff',
                        fontWeight: '800',
                        color: '#047857',
                      },
                    ]}
                    value={`Rp ${formatThousandsId(
                      Math.round(
                        (mh_harga_kalkulasi || toNumCurrency(mh_harga)) *
                          toNumCurrency(mh_jmlorder) *
                          1.11,
                      ),
                    )}`}
                    editable={false}
                  />
                </View>
              </View>
              <Text
                style={{
                  fontSize: 10,
                  color: '#15803d',
                  marginTop: 4,
                  fontStyle: 'italic',
                }}
              >
                * PPN 11%: Rp{' '}
                {formatThousandsId(
                  Math.round(
                    (mh_harga_kalkulasi || toNumCurrency(mh_harga)) *
                      toNumCurrency(mh_jmlorder) *
                      0.11,
                  ),
                )}
              </Text>
            </View>

            {/* Kain / Bahan */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Kain / Bahan</Text>
              <TextInput
                style={styles.input}
                value={mh_kain}
                onChangeText={setMhKain}
                placeholder="Contoh: Polyester 50/36 / Vynil 280"
              />
            </View>

            {/* Ukuran, Gramasi & Finishing */}
            <View style={styles.rowField2}>
              <View style={[styles.fieldWrap, { flex: 1 }]}>
                <Text style={styles.label}>Ket. Ukuran</Text>
                <TextInput
                  style={styles.input}
                  value={mh_ukuran}
                  onChangeText={setMhUkuran}
                  placeholder="Ukuran"
                />
              </View>
              <View style={[styles.fieldWrap, { flex: 1, marginLeft: 10 }]}>
                <Text style={styles.label}>Gramasi</Text>
                <TextInput
                  style={styles.input}
                  value={mh_gramasi}
                  onChangeText={setMhGramasi}
                  placeholder="Gramasi"
                />
              </View>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Finishing</Text>
              <TextInput
                style={styles.input}
                value={mh_finishing}
                onChangeText={setMhFinishing}
                placeholder="Finishing"
              />
            </View>

            {/* Keterangan */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Keterangan Tambahan</Text>
              <TextInput
                style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                value={mh_ket}
                onChangeText={setMhKet}
                placeholder="Tulis catatan atau instruksi khusus..."
                multiline
              />
            </View>
          </View>
        ) : (
          /* ==================== TAB 2: KALKULASI HARGA ==================== */
          <View>
            {/* 1. JIKA DIVISI 1: SPANDUK KAIN */}
            {mh_divisi === '1' ? (
              <View style={styles.card}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.kalkulasiTitle}>Kalkulasi Harga</Text>
                    <Text style={styles.kalkulasiSubtitle}>
                      Perhitungan harga per meter panjang
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.refreshEngineBtn}
                    onPress={handleHitungSpanduk}
                    disabled={spandukLoading}
                  >
                    {spandukLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <MaterialIcons name="refresh" size={16} color="#fff" />
                        <Text style={styles.refreshEngineText}>
                          Hitung Ulang
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Metode Cetak */}
                <Text style={[styles.label, { marginTop: 12 }]}>
                  Metode Cetak
                </Text>
                <View style={styles.radioRow}>
                  {[
                    { val: 'MANUAL', label: 'Manual Printing' },
                    { val: 'MACHINE', label: 'Machine Printing (MX)' },
                  ].map(m => (
                    <TouchableOpacity
                      key={`metode-${m.val}`}
                      style={[
                        styles.radioChip,
                        spandukMetode === m.val && styles.radioChipActive,
                      ]}
                      onPress={() => setSpandukMetode(m.val as any)}
                    >
                      <Text
                        style={[
                          styles.radioChipText,
                          spandukMetode === m.val && styles.radioChipTextActive,
                        ]}
                      >
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Lebar Bahan */}
                <Text style={[styles.label, { marginTop: 10 }]}>
                  Lebar Bahan
                </Text>
                <View style={styles.radioRow}>
                  {[90, 115].map(l => (
                    <TouchableOpacity
                      key={`lebar-${l}`}
                      style={[
                        styles.radioChip,
                        spandukLebar === l && styles.radioChipActive,
                      ]}
                      onPress={() => {
                        setSpandukLebar(l);
                        setMhLebar(l === 90 ? '0.9' : '1.15');
                        setMhUkuran(`Lebar ${l} cm`);
                      }}
                    >
                      <Text
                        style={[
                          styles.radioChipText,
                          spandukLebar === l && styles.radioChipTextActive,
                        ]}
                      >
                        Lebar {l} CM
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Pilihan Jenis Kain Spanduk */}
                <Text style={[styles.label, { marginTop: 10 }]}>
                  Jenis Kain Spanduk
                </Text>
                <View style={styles.radioRow}>
                  {['POLYESTER 50/36', 'OPTIC 70/40', 'TC 60/44'].map(k => (
                    <TouchableOpacity
                      key={`kain-sp-${k}`}
                      style={[
                        styles.radioChip,
                        spandukKain === k && styles.radioChipActive,
                      ]}
                      onPress={() => {
                        setSpandukKain(k);
                        setMhKain(k);
                      }}
                    >
                      <Text
                        style={[
                          styles.radioChipText,
                          spandukKain === k && styles.radioChipTextActive,
                        ]}
                      >
                        {k}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Input Sinkron Panjang & Qty */}
                <View style={styles.rowField2}>
                  <View style={[styles.fieldWrap, { flex: 1 }]}>
                    <Text style={styles.labelSmall}>Panjang (Mtr)</Text>
                    <TextInput
                      style={styles.input}
                      value={mh_panjang}
                      onChangeText={setMhPanjang}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.fieldWrap, { flex: 1, marginLeft: 10 }]}>
                    <Text style={styles.labelSmall}>Qty Order (Pcs)</Text>
                    <TextInput
                      style={styles.input}
                      value={mh_jmlorder}
                      onChangeText={t => setMhJmlOrder(onlyDigits(t))}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Tombol Trigger Hitung */}
                <TouchableOpacity
                  style={styles.bigCalcBtn}
                  onPress={handleHitungSpanduk}
                  disabled={spandukLoading}
                >
                  {spandukLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <MaterialIcons name="calculate" size={20} color="#fff" />
                      <Text style={styles.bigCalcBtnText}>
                        Hitung Kalkulasi
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Card Hasil Perhitungan Spanduk */}
                {spandukResult ? (
                  <View style={styles.resultCard}>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Total Meter Order:</Text>
                      <Text style={styles.resultValue}>
                        {spandukResult.totalMeter} Meter
                      </Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>
                        Tarif Strata per Meter:
                      </Text>
                      <Text style={[styles.resultValue, { color: '#0284c7' }]}>
                        Rp {formatThousandsId(spandukResult.tarifPerMeter)} /Mtr
                      </Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>
                        Estimasi Harga Satuan:
                      </Text>
                      <Text
                        style={[
                          styles.resultValue,
                          { color: '#16a34a', fontWeight: '800' },
                        ]}
                      >
                        Rp {formatThousandsId(spandukResult.hargaSatuanPcs)}{' '}
                        /Pcs
                      </Text>
                    </View>
                    <View style={[styles.resultRow, styles.resultTotalRow]}>
                      <Text style={styles.resultTotalLabel}>
                        Total Nilai Order:
                      </Text>
                      <Text style={styles.resultTotalValue}>
                        Rp {formatThousandsId(spandukResult.totalHarga)}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.applyBtn}
                      onPress={() =>
                        applyPriceToTab1(spandukResult.hargaSatuanPcs)
                      }
                    >
                      <MaterialIcons name="check" size={16} color="#fff" />
                      <Text style={styles.applyBtnText}>
                        Terapkan Harga ke Tab 1
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* Accordion Tabel Strata Referensi Spanduk */}
                <TouchableOpacity
                  style={styles.strataAccordionHeader}
                  onPress={() => setShowSpandukStrataTabel(v => !v)}
                >
                  <View style={styles.row}>
                    <MaterialIcons
                      name="table-chart"
                      size={18}
                      color={THEME.primary}
                    />
                    <Text style={styles.strataAccordionTitle}>
                      Tabel Referensi Strata Spanduk
                    </Text>
                  </View>
                  <MaterialIcons
                    name={
                      showSpandukStrataTabel ? 'expand-less' : 'expand-more'
                    }
                    size={22}
                    color={THEME.muted}
                  />
                </TouchableOpacity>

                {showSpandukStrataTabel && spandukResult?.tabelReferensi ? (
                  <View style={styles.strataTableBox}>
                    <View style={styles.strataTableHeader}>
                      <Text style={[styles.strataTh, { flex: 2 }]}>
                        Rentang Qty
                      </Text>
                      <Text
                        style={[
                          styles.strataTh,
                          { flex: 1, textAlign: 'right' },
                        ]}
                      >
                        Tarif/Mtr
                      </Text>
                      <Text
                        style={[
                          styles.strataTh,
                          { width: 60, textAlign: 'center' },
                        ]}
                      >
                        Status
                      </Text>
                    </View>
                    {spandukResult.tabelReferensi.map((s: any, idx: number) => {
                      const isActive =
                        spandukResult.strataAktif &&
                        spandukResult.strataAktif.id === s.id;
                      return (
                        <View
                          key={`s-ref-${idx}`}
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
                            {s.qmin} - {s.qmax >= 999999 ? '> 10.000' : s.qmax}{' '}
                            meter
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
                          <View style={{ width: 60, alignItems: 'center' }}>
                            {isActive ? (
                              <View style={styles.activeBadge}>
                                <Text style={styles.activeBadgeText}>
                                  Aktif
                                </Text>
                              </View>
                            ) : (
                              <Text
                                style={{ fontSize: 11, color: THEME.muted }}
                              >
                                -
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : mh_divisi === '5' ? (
              /* 2. JIKA DIVISI 5: MMT & BANNER */
              <View style={styles.card}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.kalkulasiTitle}>Kalkulasi Harga</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.refreshEngineBtn}
                    onPress={handleHitungMmt}
                    disabled={mmtLoading}
                  >
                    {mmtLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <MaterialIcons name="refresh" size={16} color="#fff" />
                        <Text style={styles.refreshEngineText}>
                          Hitung Ulang
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Switch Kategori: Vynil vs Non-Vynil */}
                <Text style={[styles.label, { marginTop: 12 }]}>
                  Kategori Bahan
                </Text>
                <View style={styles.radioRow}>
                  {[
                    { val: 'VYNIL', label: 'Vynil Gramasi' },
                    { val: 'NON_VYNIL', label: 'Bahan Non-Vynil' },
                  ].map(k => (
                    <TouchableOpacity
                      key={`mmt-kat-${k.val}`}
                      style={[
                        styles.radioChip,
                        mmtKategori === k.val && styles.radioChipActive,
                      ]}
                      onPress={() => {
                        setMmtKategori(k.val as any);
                        if (k.val === 'NON_VYNIL') {
                          setMmtBahanKode('ALBATROS_MT');
                        } else {
                          setMmtBahanKode('260');
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.radioChipText,
                          mmtKategori === k.val && styles.radioChipTextActive,
                        ]}
                      >
                        {k.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Pilihan Bahan */}
                {mmtKategori === 'VYNIL' ? (
                  <>
                    <Text style={[styles.label, { marginTop: 10 }]}>
                      Pilihan Gramasi Vynil
                    </Text>
                    <View style={styles.radioRow}>
                      {['260', '280', '300', '340', '380'].map(g => (
                        <TouchableOpacity
                          key={`vynil-${g}`}
                          style={[
                            styles.radioChip,
                            mmtBahanKode === g && styles.radioChipActive,
                          ]}
                          onPress={() => {
                            setMmtBahanKode(g);
                            setMhGramasi(`${g} Gram`);
                            setMhKain(`Vynil Bahan ${g} Gram`);
                          }}
                        >
                          <Text
                            style={[
                              styles.radioChipText,
                              mmtBahanKode === g && styles.radioChipTextActive,
                            ]}
                          >
                            {g} Gram
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={[styles.label, { marginTop: 10 }]}>
                      Pilihan Bahan Non-Vynil
                    </Text>
                    <View style={{ gap: 6, marginTop: 4 }}>
                      {nonVynilOptions.map(opt => (
                        <TouchableOpacity
                          key={`nonv-${opt.kode}`}
                          style={[
                            styles.nonVynilOptionRow,
                            mmtBahanKode === opt.kode &&
                              styles.nonVynilOptionActive,
                          ]}
                          onPress={() => {
                            setMmtBahanKode(opt.kode);
                            setMhKain(opt.nama);
                            setMhGramasi('-');
                          }}
                        >
                          <Text
                            style={[
                              styles.nonVynilOptionText,
                              mmtBahanKode === opt.kode &&
                                styles.nonVynilOptionTextActive,
                            ]}
                          >
                            {opt.nama}
                          </Text>
                          <Text style={styles.nonVynilPrice}>
                            Rp {formatThousandsId(opt.harga)} /m²
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                {/* Input Sinkron Panjang, Lebar, & Qty di MMT */}
                <View style={styles.rowField2}>
                  <View style={[styles.fieldWrap, { flex: 1 }]}>
                    <Text style={styles.labelSmall}>Panjang (Mtr)</Text>
                    <TextInput
                      style={styles.input}
                      value={mh_panjang}
                      onChangeText={setMhPanjang}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.fieldWrap, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.labelSmall}>Lebar (Mtr)</Text>
                    <TextInput
                      style={styles.input}
                      value={mh_lebar}
                      onChangeText={setMhLebar}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.fieldWrap, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.labelSmall}>Qty (Pcs)</Text>
                    <TextInput
                      style={styles.input}
                      value={mh_jmlorder}
                      onChangeText={t => setMhJmlOrder(onlyDigits(t))}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Topping Standing / Display Banner (Opsional) */}
                <View style={styles.sectionBox}>
                  <Text style={styles.sectionTitle}>Tambahan (Opsional)</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={true}
                    style={{ marginTop: 4 }}
                  >
                    <TouchableOpacity
                      style={[
                        styles.radioChip,
                        mmtToppingKode === '' && styles.radioChipActive,
                      ]}
                      onPress={() => {
                        setMmtToppingKode('');
                        setMmtToppingQty('0');
                      }}
                    >
                      <Text
                        style={[
                          styles.radioChipText,
                          mmtToppingKode === '' && styles.radioChipTextActive,
                        ]}
                      >
                        Tanpa Topping
                      </Text>
                    </TouchableOpacity>
                    {masterToppingList.map((t: any) => (
                      <TouchableOpacity
                        key={`top-${t.kode}`}
                        style={[
                          styles.radioChip,
                          mmtToppingKode === t.kode && styles.radioChipActive,
                        ]}
                        onPress={() => {
                          setMmtToppingKode(t.kode);
                          if (toNumCurrency(mmtToppingQty) === 0) {
                            setMmtToppingQty(mh_jmlorder || '1');
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.radioChipText,
                            mmtToppingKode === t.kode &&
                              styles.radioChipTextActive,
                          ]}
                        >
                          {t.nama} (+Rp {formatThousandsId(t.harga)})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {mmtToppingKode ? (
                    <View style={[styles.rowField2, { alignItems: 'center' }]}>
                      <Text style={[styles.label, { flex: 1 }]}>
                        Jumlah Qty Topping (Pcs):
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          { width: 100, fontWeight: '700' },
                        ]}
                        value={mmtToppingQty}
                        onChangeText={t => setMmtToppingQty(onlyDigits(t))}
                        keyboardType="numeric"
                      />
                    </View>
                  ) : null}
                </View>

                {/* Tombol Trigger Hitung MMT */}
                <TouchableOpacity
                  style={styles.bigCalcBtn}
                  onPress={handleHitungMmt}
                  disabled={mmtLoading}
                >
                  {mmtLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <MaterialIcons name="calculate" size={20} color="#fff" />
                      <Text style={styles.bigCalcBtnText}>
                        Hitung Kalkulasi
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Card Hasil Perhitungan MMT */}
                {mmtResult ? (
                  <View style={styles.resultCard}>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Luas per Pcs:</Text>
                      <Text style={styles.resultValue}>
                        {mmtResult.luasPerPcs} m²
                      </Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Total Luas Order:</Text>
                      <Text style={styles.resultValue}>
                        {mmtResult.totalLuas} m²
                      </Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>
                        Tarif Strata Bahan:
                      </Text>
                      <Text style={[styles.resultValue, { color: '#0284c7' }]}>
                        Rp {formatThousandsId(mmtResult.tarifPerM2)} /m²
                      </Text>
                    </View>
                    {mmtResult.topping ? (
                      <View style={styles.resultRow}>
                        <Text style={styles.resultLabel}>
                          Biaya Topping ({mmtResult.topping.qty} pcs):
                        </Text>
                        <Text style={styles.resultValue}>
                          +Rp {formatThousandsId(mmtResult.topping.totalHarga)}
                        </Text>
                      </View>
                    ) : null}
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>
                        Estimasi Harga Satuan:
                      </Text>
                      <Text
                        style={[
                          styles.resultValue,
                          { color: '#16a34a', fontWeight: '800' },
                        ]}
                      >
                        Rp {formatThousandsId(mmtResult.hargaSatuanPcs)} /Pcs
                      </Text>
                    </View>
                    <View style={[styles.resultRow, styles.resultTotalRow]}>
                      <Text style={styles.resultTotalLabel}>
                        Total Nilai Order:
                      </Text>
                      <Text style={styles.resultTotalValue}>
                        Rp {formatThousandsId(mmtResult.totalHarga)}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.applyBtn}
                      onPress={() => applyPriceToTab1(mmtResult.hargaSatuanPcs)}
                    >
                      <MaterialIcons name="check" size={16} color="#fff" />
                      <Text style={styles.applyBtnText}>
                        Terapkan Harga Kalkulasi
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* Accordion Tabel Strata Referensi MMT */}
                <TouchableOpacity
                  style={styles.strataAccordionHeader}
                  onPress={() => setShowMmtStrataTabel(v => !v)}
                >
                  <View style={styles.row}>
                    <MaterialIcons
                      name="table-chart"
                      size={18}
                      color={THEME.primary}
                    />
                    <Text style={styles.strataAccordionTitle}>
                      Tabel Referensi Strata MMT
                    </Text>
                  </View>
                  <MaterialIcons
                    name={showMmtStrataTabel ? 'expand-less' : 'expand-more'}
                    size={22}
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
                      <Text
                        style={[
                          styles.strataTh,
                          { width: 60, textAlign: 'center' },
                        ]}
                      >
                        Status
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
                              : `${s.qmin} - ${
                                  s.qmax >= 999999 ? '> 10.000' : s.qmax
                                } m²`}
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
                          <View style={{ width: 60, alignItems: 'center' }}>
                            {isActive ? (
                              <View style={styles.activeBadge}>
                                <Text style={styles.activeBadgeText}>
                                  Aktif
                                </Text>
                              </View>
                            ) : (
                              <Text
                                style={{ fontSize: 11, color: THEME.muted }}
                              >
                                -
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : (
              /* 3. JIKA DIVISI 4: GARMEN */
              <View style={styles.card}>
                <Text style={styles.kalkulasiTitle}>
                  Kalkulasi Biaya Garmen
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Floating Bottom Summary Price Bar */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <View style={styles.bottomPriceWrap}>
          <View style={styles.priceColumn}>
            <Text style={styles.bottomPriceLabel}>Harga Satuan</Text>
            <Text
              style={[
                styles.bottomPriceValue,
                { color: THEME.primary, fontWeight: '800' },
              ]}
            >
              Rp {mh_harga || '0'}
            </Text>
          </View>
          <View style={styles.priceColumn}>
            <Text style={styles.bottomPriceLabel}>Total Order</Text>
            <Text style={[styles.bottomPriceValue, { fontWeight: '800' }]}>
              Rp{' '}
              {formatThousandsId(
                toNumCurrency(mh_harga) * toNumCurrency(mh_jmlorder),
              )}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.submitBtn}
          onPress={submitPermintaan}
          disabled={saving}
          activeOpacity={0.9}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>
              {mode === 'edit' ? 'Simpan Perubahan' : 'Buat Permintaan'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Date Picker */}
      {showDateOrderPicker ? (
        <DateTimePicker
          value={new Date()}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDateOrderPicker(false);
            if (selectedDate) setMhDateOrder(toYmd(selectedDate));
          }}
        />
      ) : null}
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
    paddingVertical: 10,
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
  tabBarWrap: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#e8edf3',
    borderRadius: 10,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#fff',
    ...PENAWARAN_SHADOW.softCard,
  },
  tabButtonText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.muted,
  },
  tabButtonTextActive: {
    color: THEME.primary,
    fontWeight: '700',
  },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    ...PENAWARAN_SHADOW.card,
  },
  nomorBadge: {
    backgroundColor: '#e3f2fd',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  nomorBadgeText: { fontSize: 12, fontWeight: '700', color: '#1565c0' },
  label: { fontSize: 12, fontWeight: '600', color: THEME.ink, marginBottom: 4 },
  labelSmall: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.muted,
    marginBottom: 2,
  },
  fieldWrap: { marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowInput: { flex: 1 },
  rowField2: { flexDirection: 'row', marginTop: 10 },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#cfd8dc',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: THEME.ink,
    backgroundColor: '#fafafa',
  },
  inputDisabled: { backgroundColor: '#f0f0f0', color: '#888' },
  searchButton: {
    backgroundColor: THEME.soft,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  btnSoftText: { color: THEME.primary, fontWeight: '700', fontSize: 12 },
  inputButton: {
    height: 40,
    borderWidth: 1,
    borderColor: '#cfd8dc',
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fafafa',
  },
  inputButtonText: { fontSize: 13, color: THEME.ink },
  dropdownArrowText: { fontSize: 11, color: THEME.muted },
  dropdownWrap: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  dropdownItemText: { fontSize: 13, color: THEME.ink },
  radioRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  radioChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cfd8dc',
    backgroundColor: '#f8fafc',
  },
  radioChipActive: {
    borderColor: THEME.primary,
    backgroundColor: THEME.soft,
  },
  radioChipText: { fontSize: 12, color: THEME.muted, fontWeight: '600' },
  radioChipTextActive: { color: THEME.primary, fontWeight: '700' },
  kalkulasiTitle: { fontSize: 15, fontWeight: '700', color: THEME.ink },
  kalkulasiSubtitle: { fontSize: 11, color: THEME.muted },
  refreshEngineBtn: {
    backgroundColor: THEME.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  refreshEngineText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  bigCalcBtn: {
    backgroundColor: THEME.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 10,
    marginTop: 14,
  },
  bigCalcBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  sectionBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.ink,
    marginBottom: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: '#eee',
    paddingBottom: 8,
  },
  nonVynilOptionRow: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#fafafa',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nonVynilOptionActive: {
    borderColor: THEME.primary,
    backgroundColor: '#eef2ff',
  },
  nonVynilOptionText: { fontSize: 12, fontWeight: '600', color: THEME.ink },
  nonVynilOptionTextActive: { color: THEME.primary, fontWeight: '700' },
  nonVynilPrice: { fontSize: 12, fontWeight: '700', color: '#16a34a' },
  resultCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  resultLabel: { fontSize: 12, color: THEME.ink, fontWeight: '500' },
  resultValue: { fontSize: 13, fontWeight: '700', color: THEME.ink },
  resultTotalRow: {
    borderTopWidth: 1,
    borderColor: '#86efac',
    paddingTop: 8,
    marginTop: 4,
  },
  resultTotalLabel: { fontSize: 13, fontWeight: '800', color: THEME.ink },
  resultTotalValue: { fontSize: 16, fontWeight: '800', color: '#15803d' },
  applyBtn: {
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: 6,
    marginTop: 10,
  },
  applyBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  strataAccordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 10,
    marginTop: 14,
  },
  strataAccordionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.ink,
    marginLeft: 6,
  },
  strataTableBox: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    marginTop: 6,
    overflow: 'hidden',
  },
  strataTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  strataTh: { fontSize: 11, fontWeight: '700', color: THEME.muted },
  strataTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
  strataTableRowActive: {
    backgroundColor: '#dcfce7',
  },
  strataTd: { fontSize: 12, color: THEME.ink },
  strataTdActive: { fontWeight: '700', color: '#15803d' },
  activeBadge: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    paddingTop: 10,
    paddingHorizontal: 16,
    ...PENAWARAN_SHADOW.card,
  },
  bottomPriceWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceColumn: { flex: 1 },
  bottomPriceLabel: { fontSize: 11, color: THEME.muted },
  bottomPriceValue: { fontSize: 14, fontWeight: '700', color: THEME.ink },
  submitBtn: {
    backgroundColor: THEME.primary,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
