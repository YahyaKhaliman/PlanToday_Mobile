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
import { createPenawaran } from '../../services/penawaranApi';
import { useAuth } from '../../context/authContext';
import { usePressGuard } from '../../utils/usePressGuard';
import { PENAWARAN_SHADOW, PENAWARAN_THEME } from './penawaranTheme';

const THEME = PENAWARAN_THEME;

type DraftDetail = {
  nama_barang: string;
  qty: string;
  harga: string;
  bahan: string;
  ukuran: string;
  satuan: string;
};

type SelectedCustomerPayload = {
  kode?: string;
  nama?: string;
};

type SelectedPerusahaanPayload = {
  kode?: string;
  nama?: string;
};

type SelectedSalesPayload = {
  kode?: string;
  nama?: string;
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

const parseNum = (value: string) => {
  const normalized = String(value || '')
    .replace(/,/g, '.')
    .trim();
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

export default function PenawaranCreateScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const runGuardedPress = usePressGuard();
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [tanggal, setTanggal] = useState(toYmd(new Date()));
  const [divisi, setDivisi] = useState('1');
  const [tipe, setTipe] = useState('Medium');
  const [perusahaan, setPerusahaan] = useState('');
  const [perusahaanKode, setPerusahaanKode] = useState('');
  const [customer, setCustomer] = useState('');
  const [customerKode, setCustomerKode] = useState('');
  const [sales, setSales] = useState('');
  const [salesKode, setSalesKode] = useState(
    user?.sal_kode || user?.kode_sales || '',
  );
  const [keterangan, setKeterangan] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    const selected: SelectedCustomerPayload | undefined =
      route?.params?.selectedCustomer;
    if (selected) {
      setCustomerKode(String(selected.kode || ''));
      setCustomer(String(selected.nama || ''));
    }
  }, [route?.params?.selectedCustomer]);

  useEffect(() => {
    const selected: SelectedPerusahaanPayload | undefined =
      route?.params?.selectedPerusahaan;
    if (selected) {
      setPerusahaanKode(String(selected.kode || ''));
      setPerusahaan(String(selected.nama || ''));
    }
  }, [route?.params?.selectedPerusahaan]);

  useEffect(() => {
    const selected: SelectedSalesPayload | undefined =
      route?.params?.selectedSales;
    if (selected) {
      setSalesKode(String(selected.kode || ''));
      setSales(String(selected.nama || ''));
    }
  }, [route?.params?.selectedSales]);

  const [details, setDetails] = useState<DraftDetail[]>([
    {
      nama_barang: '',
      qty: '',
      harga: '',
      bahan: '',
      ukuran: '',
      satuan: 'PCS',
    },
  ]);

  const totalNominal = useMemo(() => {
    return details.reduce(
      (acc, d) => acc + parseNum(d.qty) * parseNum(d.harga),
      0,
    );
  }, [details]);

  const updateDetail = (index: number, patch: Partial<DraftDetail>) => {
    setDetails(prev =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
  };

  const addRow = () => {
    setDetails(prev => [
      ...prev,
      {
        nama_barang: '',
        qty: '',
        harga: '',
        bahan: '',
        ukuran: '',
        satuan: 'PCS',
      },
    ]);
  };

  const removeRow = (index: number) => {
    setDetails(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const submit = async () => {
    if (!perusahaan.trim() || !perusahaanKode.trim()) {
      Toast.show({
        type: 'glassError',
        text1: 'Validasi',
        text2: 'Perusahaan wajib dipilih dari pencarian',
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
        nama_barang: d.nama_barang.trim(),
        qty: parseNum(d.qty),
        harga: parseNum(d.harga),
        bahan: d.bahan.trim(),
        ukuran: d.ukuran.trim(),
        satuan: d.satuan.trim() || 'PCS',
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
        divisi,
        tipe,
        perusahaan_kode: perusahaanKode.trim().toUpperCase(),
        customer_kode: customerKode.trim().toUpperCase(),
        sales_kode: salesKode.trim().toUpperCase(),
        keterangan: keterangan.trim(),
        note: note.trim(),
        user: user?.kode || user?.nama || 'MOBILE',
        details: filtered,
      };

      const result = await createPenawaran(payload);
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
        <Text style={styles.title}>Buat Penawaran</Text>
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

          <Text style={styles.label}>Divisi</Text>
          <TextInput
            value={divisi}
            onChangeText={setDivisi}
            style={styles.input}
            placeholder="Contoh: 1"
            placeholderTextColor={THEME.muted}
          />

          <Text style={styles.label}>Tipe</Text>
          <TextInput
            value={tipe}
            onChangeText={setTipe}
            style={styles.input}
            placeholder="Medium / Premium"
            placeholderTextColor={THEME.muted}
          />

          <Text style={styles.label}>Perusahaan</Text>
          <View style={styles.row}>
            <View style={[styles.inputWrap, { flex: 1, marginBottom: 0 }]}>
              <TextInput
                value={perusahaan}
                onChangeText={t => {
                  setPerusahaan(t);
                  if (perusahaanKode) setPerusahaanKode('');
                }}
                placeholder="Pilih Perusahaan"
                placeholderTextColor={THEME.muted}
                style={styles.input}
              />
            </View>

            <TouchableOpacity
              onPress={() =>
                runGuardedPress('penawaran-create:go-search-perusahaan', () =>
                  navigation.navigate('CariPerusahaanPenawaran', {
                    keyword: perusahaan,
                  }),
                )
              }
              style={styles.btnSoft}
              activeOpacity={0.9}
            >
              <Text style={styles.btnSoftText}>CARI</Text>
            </TouchableOpacity>
          </View>

          {!!perusahaanKode && (
            <Text style={styles.helper}>Kode: {perusahaanKode}</Text>
          )}

          <Text style={styles.label}>Customer</Text>
          <View style={styles.row}>
            <View style={[styles.inputWrap, { flex: 1, marginBottom: 0 }]}>
              <TextInput
                value={customer}
                onChangeText={t => {
                  setCustomer(t);
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

          <Text style={styles.label}>Sales</Text>
          <View style={styles.row}>
            <View style={[styles.inputWrap, { flex: 1, marginBottom: 0 }]}>
              <TextInput
                value={sales}
                onChangeText={t => {
                  setSales(t);
                  if (salesKode) setSalesKode('');
                }}
                placeholder="Pilih Sales"
                placeholderTextColor={THEME.muted}
                style={styles.input}
              />
            </View>

            <TouchableOpacity
              onPress={() =>
                runGuardedPress('penawaran-create:go-search-sales', () =>
                  navigation.navigate('CariSalesPenawaran', {
                    keyword: sales,
                  }),
                )
              }
              style={styles.btnSoft}
              activeOpacity={0.9}
            >
              <Text style={styles.btnSoftText}>CARI</Text>
            </TouchableOpacity>
          </View>

          {!!salesKode && <Text style={styles.helper}>Kode: {salesKode}</Text>}

          <Text style={styles.label}>Keterangan</Text>
          <TextInput
            value={keterangan}
            onChangeText={setKeterangan}
            style={styles.input}
            placeholder="Keterangan"
            placeholderTextColor={THEME.muted}
          />

          <Text style={styles.label}>Note</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            style={styles.input}
            placeholder="Note"
            placeholderTextColor={THEME.muted}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Detail Item</Text>
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

                <TextInput
                  value={item.nama_barang}
                  onChangeText={t => updateDetail(index, { nama_barang: t })}
                  style={styles.input}
                  placeholder="Nama barang"
                  placeholderTextColor={THEME.muted}
                />
                <TextInput
                  value={item.bahan}
                  onChangeText={t => updateDetail(index, { bahan: t })}
                  style={styles.input}
                  placeholder="Bahan"
                  placeholderTextColor={THEME.muted}
                />
                <TextInput
                  value={item.ukuran}
                  onChangeText={t => updateDetail(index, { ukuran: t })}
                  style={styles.input}
                  placeholder="Ukuran"
                  placeholderTextColor={THEME.muted}
                />
                <View style={styles.row2}>
                  <TextInput
                    value={item.qty}
                    onChangeText={t => updateDetail(index, { qty: t })}
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Qty"
                    keyboardType="numeric"
                    placeholderTextColor={THEME.muted}
                  />
                  <TextInput
                    value={item.harga}
                    onChangeText={t => updateDetail(index, { harga: t })}
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Harga"
                    keyboardType="numeric"
                    placeholderTextColor={THEME.muted}
                  />
                </View>
                <TextInput
                  value={item.satuan}
                  onChangeText={t => updateDetail(index, { satuan: t })}
                  style={styles.input}
                  placeholder="Satuan"
                  placeholderTextColor={THEME.muted}
                />
              </View>
            )}
          />

          <Text style={styles.totalText}>
            Estimasi nominal:{' '}
            {new Intl.NumberFormat('id-ID').format(totalNominal)}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={submit}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.saveBtnText}>Simpan Penawaran</Text>
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
    flex: 1,
    color: THEME.ink,
    fontWeight: '900',
    fontSize: 18,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 100,
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
  helper: {
    color: THEME.muted,
    fontSize: 12,
    marginTop: 6,
    marginBottom: 2,
    fontWeight: '700',
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
  removeText: {
    color: THEME.danger,
    fontWeight: '700',
    fontSize: 12,
  },
  row2: {
    flexDirection: 'row',
    gap: 8,
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
    paddingVertical: 14,
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
