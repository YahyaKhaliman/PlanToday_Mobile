/* eslint-disable no-useless-escape */
import React, { useMemo, useState } from 'react';
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
import { useAuth } from '../../context/authContext';
import { createPermintaanHargaCustomer } from '../../services/permintaanHargaApi';
import { usePressGuard } from '../../utils/usePressGuard';
import { PENAWARAN_SHADOW, PENAWARAN_THEME } from '../Penawaran/penawaranTheme';

const THEME = PENAWARAN_THEME;

const isBasicEmail = (value: string) => {
  const val = String(value || '').trim();
  if (val === '-') return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
};

const normalizeNpwp = (value: string) =>
  String(value || '').replace(/[^0-9.\-]/g, '');

const onlyDigits = (value: string) =>
  String(value || '').replace(/[^0-9\-]/g, '');

export default function TambahCalonCustomerScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const runGuardedPress = usePressGuard();
  const { token, user } = useAuth();

  const [saving, setSaving] = useState(false);
  const [nama, setNama] = useState('');
  const [alamat, setAlamat] = useState('');
  const [kota, setKota] = useState('');
  const [cus_telp, setCusTelp] = useState('');
  const [cus_cp, setCusCp] = useState('');
  const [cus_email, setCusEmail] = useState('');
  const [cus_korporasi, setCusKorporasi] = useState<'Y' | 'N'>('N');
  const [cus_jenisusaha, setCusJenisUsaha] = useState('');
  const [cus_npwp, setCusNpwp] = useState('');
  const [cus_nama_npwp, setCusNamaNpwp] = useState('');
  const [cus_alamat_npwp, setCusAlamatNpwp] = useState('');
  const [cus_kota_npwp, setCusKotaNpwp] = useState('');

  const isKorporasi = useMemo(() => cus_korporasi === 'Y', [cus_korporasi]);
  const emailIsValid = useMemo(
    () => isBasicEmail(String(cus_email || '').trim()),
    [cus_email],
  );

  const submit = async () => {
    const payload = {
      nama: String(nama || '').trim(),
      alamat: String(alamat || '').trim(),
      kota: String(kota || '').trim(),
      cus_telp: String(cus_telp || '').trim(),
      cus_cp: String(cus_cp || '').trim(),
      cus_email: String(cus_email || '').trim(),
      user_create: String(user?.nama || '').trim(),
      cus_korporasi,
      cus_jenisusaha: String(cus_jenisusaha || '').trim(),
      cus_npwp: String(cus_npwp || '').trim(),
      cus_nama_npwp: String(cus_nama_npwp || '').trim(),
      cus_alamat_npwp: String(cus_alamat_npwp || '').trim(),
      cus_kota_npwp: String(cus_kota_npwp || '').trim(),
    };

    if (
      !payload.nama ||
      !payload.alamat ||
      !payload.kota ||
      !payload.cus_telp ||
      !payload.cus_cp ||
      !payload.cus_email
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

    if (isKorporasi && (!payload.cus_jenisusaha || !payload.cus_npwp)) {
      Toast.show({
        type: 'glassError',
        text1: 'Validasi Korporasi',
        text2: 'Jenis Usaha dan NPWP wajib diisi untuk Korporasi',
      });
      return;
    }

    setSaving(true);
    try {
      const created = await createPermintaanHargaCustomer(payload, token);
      Toast.show({
        type: 'glassSuccess',
        text1: 'Berhasil',
        text2: `Customer ${created?.nama || payload.nama} berhasil ditambahkan`,
      });
      navigation.navigate('RekapCalonCustomer');
    } catch (err: any) {
      Toast.show({
        type: 'glassError',
        text1: 'Error',
        text2: err?.response?.data?.message || 'Gagal menambah customer',
      });
      setSaving(false);
      return;
    }
    setSaving(false);
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
        <Text style={styles.title}>Tambah Customer</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
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
            value={cus_telp}
            onChangeText={t => setCusTelp(onlyDigits(t))}
            keyboardType="phone-pad"
            placeholder="Nomor telepon"
            placeholderTextColor={THEME.muted}
          />

          <Text style={styles.label}>
            Contact Person <Text style={styles.requiredMark}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={cus_cp}
            onChangeText={setCusCp}
            placeholder="Nama contact person"
            placeholderTextColor={THEME.muted}
          />

          <Text style={styles.label}>
            Email <Text style={styles.requiredMark}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={cus_email}
            onChangeText={t =>
              setCusEmail(
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
          {cus_email && !emailIsValid ? (
            <Text style={styles.warningText}>Format email harus valid.</Text>
          ) : null}

          <Text style={styles.label}>
            Status <Text style={styles.requiredMark}>*</Text>
          </Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.pill, !isKorporasi ? styles.pillActive : null]}
              onPress={() => setCusKorporasi('N')}
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
              onPress={() => setCusKorporasi('Y')}
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
                value={cus_jenisusaha}
                onChangeText={setCusJenisUsaha}
                placeholder="Jenis usaha"
                placeholderTextColor={THEME.muted}
              />

              <Text style={styles.label}>
                NPWP <Text style={styles.requiredMark}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={cus_npwp}
                onChangeText={t => setCusNpwp(normalizeNpwp(t))}
                placeholder="NPWP"
                placeholderTextColor={THEME.muted}
              />

              <Text style={styles.label}>Nama NPWP</Text>
              <TextInput
                style={styles.input}
                value={cus_nama_npwp}
                onChangeText={setCusNamaNpwp}
                placeholder="Nama NPWP"
                placeholderTextColor={THEME.muted}
              />

              <Text style={styles.label}>Alamat NPWP</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                value={cus_alamat_npwp}
                onChangeText={setCusAlamatNpwp}
                placeholder="Alamat NPWP"
                placeholderTextColor={THEME.muted}
                multiline
              />

              <Text style={styles.label}>Kota NPWP</Text>
              <TextInput
                style={styles.input}
                value={cus_kota_npwp}
                onChangeText={setCusKotaNpwp}
                placeholder="Kota NPWP"
                placeholderTextColor={THEME.muted}
              />
            </>
          ) : null}

          <TouchableOpacity
            style={[styles.submitBtn, saving ? styles.submitBtnDisabled : null]}
            onPress={() =>
              runGuardedPress('calon:tambah-customer', submit)
            }
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Simpan Customer</Text>
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
    marginTop: 16,
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
