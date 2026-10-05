import React, { useEffect, useMemo, useState } from 'react';
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
import LinearGradient from 'react-native-linear-gradient';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import api from '../../services/api';
import { PENAWARAN_SHADOW, PENAWARAN_THEME } from '../Penawaran/penawaranTheme';

const THEME = PENAWARAN_THEME;

const isBasicEmail = (value: string) => {
  const val = String(value || '').trim();
  if (val === '-') return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
};

const normalizeNpwp = (value: string) =>
  String(value || '').replace(/[^0-9.\\-]/g, '');

const onlyDigits = (value: string) =>
  String(value || '').replace(/[^0-9\\-]/g, '');

type CalonCustomer = {
  id: number;
  cc_kode?: string;
  cc_nama?: string;
  cc_alamat?: string;
  cc_cp?: string;
  cc_telp?: string;
  cc_kota?: string;
  cc_email?: string;
  cc_korporasi?: 'Y' | 'N';
  cc_jenisusaha?: string;
  cc_npwp?: string;
  cc_nama_npwp?: string;
  cc_alamat_npwp?: string;
  cc_kota_npwp?: string;
};

export default function EditCalonCustomerScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const initial: CalonCustomer | undefined = route?.params?.data;

  const cc_kode = useMemo(
    () => String(initial?.cc_kode || '').trim() || null,
    [initial?.cc_kode],
  );

  const [kode, setKode] = useState('');
  const [nama, setNama] = useState('');
  const [kota, setKota] = useState('');
  const [alamat, setAlamat] = useState('');
  const [cp, setCp] = useState('');
  const [telp, setTelp] = useState('');

  const [email, setEmail] = useState('');
  const [korporasi, setKorporasi] = useState<'Y' | 'N'>('N');
  const [jenisusaha, setJenisusaha] = useState('');
  const [npwp, setNpwp] = useState('');
  const [namaNpwp, setNamaNpwp] = useState('');
  const [alamatNpwp, setAlamatNpwp] = useState('');
  const [kotaNpwp, setKotaNpwp] = useState('');

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setKode(String(initial?.cc_kode || ''));
    setNama(String(initial?.cc_nama || ''));
    setKota(String(initial?.cc_kota || ''));
    setAlamat(String(initial?.cc_alamat || ''));
    setCp(String(initial?.cc_cp || ''));
    setTelp(String(initial?.cc_telp || ''));
    setEmail(String(initial?.cc_email || ''));
    setKorporasi(initial?.cc_korporasi === 'Y' ? 'Y' : 'N');
    setJenisusaha(String(initial?.cc_jenisusaha || ''));
    setNpwp(String(initial?.cc_npwp || ''));
    setNamaNpwp(String(initial?.cc_nama_npwp || ''));
    setAlamatNpwp(String(initial?.cc_alamat_npwp || ''));
    setKotaNpwp(String(initial?.cc_kota_npwp || ''));
  }, [initial]);

  const isKorporasi = useMemo(() => korporasi === 'Y', [korporasi]);
  const emailIsValid = useMemo(
    () => isBasicEmail(String(email || '').trim()),
    [email],
  );

  const simpan = async () => {
    if (loading) return;

    if (!cc_kode) {
      Toast.show({
        type: 'glassError',
        text1: 'Validasi',
        text2: 'ID customer tidak ditemukan',
      });
      return;
    }

    if (
      !nama.trim() ||
      !alamat.trim() ||
      !kota.trim() ||
      !telp.trim() ||
      !cp.trim() ||
      !email.trim()
    ) {
      Toast.show({
        type: 'glassError',
        text1: 'Validasi',
        text2:
          'Nama, alamat, kota, no telp, contact person, dan email wajib diisi',
      });
      return;
    }

    if (!emailIsValid) {
      Toast.show({
        type: 'glassError',
        text1: 'Validasi Email',
        text2: 'Format email tidak valid',
      });
      return;
    }

    if (isKorporasi && (!jenisusaha.trim() || !npwp.trim())) {
      Toast.show({
        type: 'glassError',
        text1: 'Validasi Korporasi',
        text2: 'Jenis Usaha dan NPWP wajib diisi untuk Korporasi',
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        cc_nama: nama.trim(),
        cc_kota: kota.trim(),
        cc_alamat: alamat.trim(),
        cc_cp: cp.trim(),
        cc_telp: telp.trim(),
        cc_email: email.trim(),
        cc_korporasi: korporasi,
        cc_jenisusaha: jenisusaha.trim(),
        cc_npwp: npwp.trim(),
        cc_nama_npwp: namaNpwp.trim(),
        cc_alamat_npwp: alamatNpwp.trim(),
        cc_kota_npwp: kotaNpwp.trim(),
      };

      const res = await api.put(`/update-customer/${cc_kode}`, payload);

      if (!res.data?.success)
        throw new Error(res.data?.message || 'Gagal update calon customer');

      Toast.show({
        type: 'glassSuccess',
        text1: 'Berhasil',
        text2: 'Data calon customer diperbarui',
      });

      setTimeout(() => navigation.goBack(), 250);
    } catch (err: any) {
      Toast.show({
        type: 'glassError',
        text1: 'Gagal',
        text2:
          err?.response?.data?.message ||
          err?.message ||
          'Gagal koneksi ke server',
      });
    } finally {
      setLoading(false);
    }
  };

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
      <View style={styles.headerArea}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.9}
        >
          <MaterialIcons
            name="arrow-back-ios-new"
            size={18}
            color={THEME.primary}
          />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Data Customer</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>Kode</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={kode}
            editable={false}
          />

          <Text style={styles.label}>
            Nama <Text style={styles.requiredMark}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={nama}
            onChangeText={setNama}
            placeholder="Nama customer"
            placeholderTextColor={THEME.muted}
          />

          <Text style={styles.label}>
            Alamat <Text style={styles.requiredMark}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={alamat}
            onChangeText={setAlamat}
            placeholder="Alamat"
            placeholderTextColor={THEME.muted}
            multiline
          />

          <Text style={styles.label}>
            Kota <Text style={styles.requiredMark}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={kota}
            onChangeText={setKota}
            placeholder="Kota"
            placeholderTextColor={THEME.muted}
          />

          <Text style={styles.label}>
            No. Telp<Text style={styles.requiredMark}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={telp}
            onChangeText={t => setTelp(onlyDigits(t))}
            keyboardType="phone-pad"
            placeholder="Nomor telepon"
            placeholderTextColor={THEME.muted}
          />

          <Text style={styles.label}>
            Contact Person <Text style={styles.requiredMark}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={cp}
            onChangeText={setCp}
            placeholder="Nama contact person"
            placeholderTextColor={THEME.muted}
          />

          <Text style={styles.label}>
            Email <Text style={styles.requiredMark}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={t =>
              setEmail(
                String(t || '')
                  .trim()
                  .toLowerCase(),
              )
            }
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Email"
            placeholderTextColor={THEME.muted}
          />
          {email && !emailIsValid ? (
            <Text style={styles.warningText}>Format email harus valid.</Text>
          ) : null}

          <Text style={styles.label}>
            Status <Text style={styles.requiredMark}>*</Text>
          </Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.pill, !isKorporasi ? styles.pillActive : null]}
              onPress={() => setKorporasi('N')}
            >
              <Text
                style={[
                  styles.pillText,
                  !isKorporasi ? styles.pillTextActive : null,
                ]}
              >
                Perorangan
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pill, isKorporasi ? styles.pillActive : null]}
              onPress={() => setKorporasi('Y')}
            >
              <Text
                style={[
                  styles.pillText,
                  isKorporasi ? styles.pillTextActive : null,
                ]}
              >
                Korporasi
              </Text>
            </TouchableOpacity>
          </View>

          {isKorporasi ? (
            <>
              <Text style={styles.label}>
                Jenis Usaha <Text style={styles.requiredMark}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={jenisusaha}
                onChangeText={setJenisusaha}
                placeholder="Jenis usaha"
                placeholderTextColor={THEME.muted}
              />

              <Text style={styles.label}>
                NPWP <Text style={styles.requiredMark}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={npwp}
                onChangeText={t => setNpwp(normalizeNpwp(t))}
                placeholder="NPWP"
                placeholderTextColor={THEME.muted}
              />

              <Text style={styles.label}>Nama NPWP</Text>
              <TextInput
                style={styles.input}
                value={namaNpwp}
                onChangeText={setNamaNpwp}
                placeholder="Nama NPWP"
                placeholderTextColor={THEME.muted}
              />

              <Text style={styles.label}>Alamat NPWP</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                value={alamatNpwp}
                onChangeText={setAlamatNpwp}
                placeholder="Alamat NPWP"
                placeholderTextColor={THEME.muted}
                multiline
              />

              <Text style={styles.label}>Kota NPWP</Text>
              <TextInput
                style={styles.input}
                value={kotaNpwp}
                onChangeText={setKotaNpwp}
                placeholder="Kota NPWP"
                placeholderTextColor={THEME.muted}
              />
            </>
          ) : null}

          <TouchableOpacity
            style={[
              styles.submitBtn,
              loading ? styles.submitBtnDisabled : null,
            ]}
            onPress={simpan}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Simpan Perubahan</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerArea: {
    marginTop: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: THEME.ink,
    fontWeight: '900',
    fontSize: 20,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  headerRightSpacer: { width: 38 },
  content: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 16,
    padding: 14,
    ...PENAWARAN_SHADOW.softCard,
  },
  label: { color: THEME.muted, fontSize: 12, fontWeight: '700', marginTop: 10 },
  requiredMark: { color: '#DC2626', fontWeight: '900' },
  warningText: {
    marginTop: 6,
    color: '#B45309',
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: THEME.ink,
    backgroundColor: THEME.soft,
    fontWeight: '600',
  },
  inputDisabled: {
    opacity: 0.6,
    backgroundColor: '#E2E8F0',
  },
  inputMulti: { minHeight: 84, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  pill: {
    flex: 1,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 12,
    backgroundColor: THEME.soft,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  pillText: {
    color: THEME.ink,
    fontWeight: '800',
    fontSize: 12,
  },
  pillTextActive: {
    color: '#fff',
  },
  submitBtn: {
    marginTop: 20,
    backgroundColor: THEME.primary,
    borderRadius: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontWeight: '800' },
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
});
