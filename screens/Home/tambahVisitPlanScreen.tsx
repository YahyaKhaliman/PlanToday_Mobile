/* eslint-disable react-native/no-inline-styles */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import api from '../../services/api';
import { useAuth } from '../../context/authContext';

const THEME = {
  primary: '#4F46E5',
  accent: '#06B6D4',
  ink: '#0F172A',
  muted: '#64748B',
  card: '#FFFFFF',
  soft: '#F1F5F9',
  line: 'rgba(15,23,42,0.08)',
  danger: '#EF4444',
  bgTop: '#F7F9FF',
  bgBottom: '#FFFFFF',
  wa: '#22C55E',
  ok: '#16A34A',
};

type SelectedCustomerPayload = {
  kode?: string;
  nama?: string;
  alamat?: string;
};

const ymdToDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
};

const dateToYmd = (dt: Date) => {
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatDisplayDate = (ymd: string) => {
  try {
    const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
    const dt = new Date(y, m - 1, d);
    const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${dt.getDate()} ${bulan[dt.getMonth()]} ${dt.getFullYear()}`;
  } catch {
    return ymd;
  }
};

export default function TambahVisitPlanScreen({ navigation, route }: any) {
  const { user } = useAuth();

  const cabang = String(user?.cabang || '');
  const namaSales = String(user?.nama || '');

  const [tanggal, setTanggal] = useState<string>('');

  const [customer, setCustomer] = useState('');
  const [customerKode, setCustomerKode] = useState('');

  const [note, setNote] = useState('');

  const [loading, setLoading] = useState(false);
  const [showDate, setShowDate] = useState(false);

  useEffect(() => {
    const selected: SelectedCustomerPayload | undefined = route?.params?.selectedCustomer;
    if (selected) {
      setCustomerKode(String(selected.kode || ''));
      setCustomer(String(selected.nama || ''));
    }
  }, [route?.params?.selectedCustomer]);

  const canSubmit = useMemo(() => {
    return customer.trim().length > 0 && customerKode.trim().length > 0 && tanggal.trim().length > 0 && !loading;
  }, [customer, customerKode, tanggal, loading]);

  const simpan = async () => {
    if (!customer.trim() || !customerKode.trim()) {
      Toast.show({ type: 'glassError', text1: 'Validasi', text2: 'Customer harus dipilih terlebih dahulu' });
      return;
    }
    if (!tanggal.trim()) {
      Toast.show({ type: 'glassError', text1: 'Validasi', text2: 'Tanggal plan wajib dipilih' });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        cus_kode: customerKode.trim(),
        note: note.trim() || '',
        tanggal_plan: tanggal,
        user: namaSales,
        cabang,
      };

      const res = await api.post('/visit-plan', payload);

      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Gagal menyimpan visit plan');
      }

      Toast.show({
        type: 'glassSuccess',
        text1: 'Simpan Berhasil',
        text2: res.data?.message || 'Rencana kunjungan tersimpan',
      });

      // reset form
      setCustomer('');
      setCustomerKode('');
      setNote('');
      setTanggal('');

      setTimeout(() => navigation.navigate('Home'), 400);
    } catch (err: any) {
      Toast.show({
        type: 'glassError',
        text1: 'Gagal Simpan',
        text2: err?.response?.data?.message || err?.message || 'Gagal koneksi ke server',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[THEME.bgTop, THEME.bgBottom]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Visit Plan</Text>
            <Text style={styles.subtitle}>Input Rencana Kunjungan</Text>
          </View>

          <View style={styles.card}>
            {/* Sales (Cabang) */}
            <Text style={styles.label}>Sales (Cabang)</Text>
            <View style={[styles.inputWrap, { opacity: 0.7 }]}>
              <TextInput value={`${namaSales} (${cabang})`} editable={false} style={styles.input} />
            </View>

            {/* Customer */}
            <Text style={styles.label}>Customer</Text>
            <View style={styles.row}>
              <View style={[styles.inputWrap, { flex: 1, marginBottom: 0 }]}>
                <TextInput
                  value={customer}
                  onChangeText={(t) => {
                    setCustomer(t);
                    if (customerKode) setCustomerKode('');
                  }}
                  placeholder="Pilih Customer"
                  placeholderTextColor={THEME.muted}
                  style={styles.input}
                />
              </View>

              <TouchableOpacity
                onPress={() => navigation.navigate('CariCustomer', { keyword: customer, from: 'TAMBAHVISITPLAN' })}
                style={styles.btnSoft}
                activeOpacity={0.9}
              >
                <Text style={styles.btnSoftText}>CARI</Text>
              </TouchableOpacity>
            </View>

            {!!customerKode && <Text style={styles.helper}>Kode: {customerKode}</Text>}

            {/* Tanggal Plan */}
            <Text style={styles.label}>Tanggal Rencana Visit</Text>
            <TouchableOpacity onPress={() => setShowDate(true)} activeOpacity={0.9} style={styles.selectWrap}>
              <Text style={[styles.selectText, !tanggal && { color: THEME.muted }]}>{tanggal ? formatDisplayDate(tanggal) : 'Pilih Tanggal'}</Text>
              <MaterialIcons name="edit-calendar" size={22} color={THEME.ink} />
            </TouchableOpacity>

            {showDate && (
              <DateTimePicker
                value={tanggal ? ymdToDate(tanggal) : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event: any, selected?: Date) => {
                  setShowDate(false);
                  if (selected) setTanggal(dateToYmd(selected));
                }}
              />
            )}
            
            {/* Catatan  */}
            <Text style={styles.label}>Catatan</Text>
            <View style={styles.textAreaWrap}>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Tulis Catatan..."
                placeholderTextColor={THEME.muted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={[styles.input, { height: 110, paddingTop: 10 }]}
              />
            </View>

            <TouchableOpacity
              onPress={simpan}
              disabled={!canSubmit}
              style={[styles.btnPrimary, !canSubmit && { opacity: 0.55 }]}
              activeOpacity={0.9}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>SIMPAN RENCANA</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate("VisitPlan")} disabled={loading} style={styles.btnGhost} activeOpacity={0.9}>
              <Text style={styles.btnGhostText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 54 : 18,
    paddingBottom: 28,
  },

  header: { alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: THEME.ink, letterSpacing: 0.2 },
  subtitle: { color: THEME.muted, fontSize: 12, marginTop: 6, fontWeight: '700' },

  card: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.line,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },

  label: {
    color: THEME.muted,
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 4,
    marginBottom: 6,
    marginTop: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.soft,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 12,
    height: 55,
    marginBottom: 12,
  },

  selectWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.soft,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 12,
    height: 55,
    marginBottom: 12,
  },

  input: { flex: 1, color: THEME.ink, fontSize: 15, fontWeight: '800' },
  selectText: { flex: 1, color: THEME.ink, fontSize: 14, fontWeight: '900' },

  row: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 10 },

  helper: { color: THEME.muted, fontSize: 12, fontWeight: '800', marginTop: -4, marginLeft: 4 },

  btnPrimary: {
    marginTop: 14,
    height: 52,
    borderRadius: 14,
    backgroundColor: THEME.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '900', letterSpacing: 0.4 },

  btnSoft: {
    height: 55,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(79,70,229,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSoftText: { color: THEME.primary, fontWeight: '900', letterSpacing: 0.4, fontSize: 12 },

  btnGhost: { marginTop: 10, alignItems: 'center', paddingVertical: 10 },
  btnGhostText: { color: THEME.muted, fontWeight: '900' },

  textAreaWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: THEME.soft,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 12,
    paddingTop: 10,
    marginBottom: 10,
  },
});
