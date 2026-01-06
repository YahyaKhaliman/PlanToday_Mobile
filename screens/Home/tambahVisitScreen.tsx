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
  Image,
  PermissionsAndroid,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import Geolocation from 'react-native-geolocation-service';
import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';
import RNBlobUtil from 'react-native-blob-util';
import ImageResizer from 'react-native-image-resizer';
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

const MAX_UPLOAD_BYTES = 1 * 1024 * 1024;
const COMPRESS_PRESETS = [
  { max: 1280, quality: 75 },
  { max: 1024, quality: 65 },
  { max: 1024, quality: 55 },
  { max: 800, quality: 55 },
];

type PhotoState = {
  uri: string;
  name: string;
  type: string;
  sizeBytes?: number;
};

const toFileUri = (uri: string) => (uri.startsWith('file://') ? uri : `file://${uri}`);
const stripFileScheme = (uri: string) => uri.replace('file://', '');

const safeFileName = (name: string | undefined, fallback: string) => {
  const n = (name || '').trim();
  if (!n) return fallback;
  return n.includes('.') ? n : `${n}.jpg`;
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

async function compressToUnderLimit(inputUri: string): Promise<{ uri: string; sizeBytes: number }> {
  const inputFileUri = toFileUri(inputUri);

  for (const preset of COMPRESS_PRESETS) {
    const resized = await ImageResizer.createResizedImage(inputFileUri, preset.max, preset.max, 'JPEG', preset.quality, 0);

    const outUri = toFileUri(resized.uri);
    const stat = await RNBlobUtil.fs.stat(stripFileScheme(outUri));
    const sizeBytes = Number(stat.size || 0);

    if (sizeBytes > 0 && sizeBytes <= MAX_UPLOAD_BYTES) {
      return { uri: outUri, sizeBytes };
    }
  }

  const lastPreset = COMPRESS_PRESETS[COMPRESS_PRESETS.length - 1];
  const last = await ImageResizer.createResizedImage(inputFileUri, lastPreset.max, lastPreset.max, 'JPEG', lastPreset.quality, 0);
  const lastUri = toFileUri(last.uri);
  const statLast = await RNBlobUtil.fs.stat(stripFileScheme(lastUri));
  const lastSize = Number(statLast.size || 0);

  return { uri: lastUri, sizeBytes: lastSize };
}

export default function VisitScreen({ navigation, route }: any) {
  const { user } = useAuth();

  const cabang = String(user?.cabang || '');
  const namaSales = String(user?.nama || '');

  const [tanggal, setTanggal] = useState<string>('');

  const [customer, setCustomer] = useState('');
  const [customerKode, setCustomerKode] = useState('');

  const [note, setNote] = useState('');
  const [catatan, setCatatan] = useState('');

  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  const [photo, setPhoto] = useState<PhotoState | null>(null);

  const [loading, setLoading] = useState(false);
  const [showDate, setShowDate] = useState(false);

  // untuk upload ulang
  const [lastVisitId, setLastVisitId] = useState<number | null>(null);
  const [uploadPending, setUploadPending] = useState(false);

  const [existingVisitId, setExistingVisitId] = useState<number | null>(null);
  const [visitLoaded, setVisitLoaded] = useState(false);

  const loadDraftIfAny = async (cusKode: string, ymdTanggal: string) => {
    try {
      const resp = await api.get('/visit/draft', {
        params: { user: namaSales, cus_kode: cusKode, tanggal: ymdTanggal },
      });

      const found = resp.data?.data;

      if (found?.id) {
        setExistingVisitId(Number(found.id));
        setNote(String(found.note || ''));
        setCatatan(String(found.catatan || ''));
        setVisitLoaded(true);

        Toast.show({
          type: 'glassSuccess',
          text1: 'Visit Plan ditemukan',
          text2: 'Form terisi dari visit plan.',
        });
        return true;
      }
    } catch {}
    return false;
  };

  // Ambil data VISIT yang sudah DONE (pakai endpoint backend kamu: /rekap-visit)
  const loadVisitIfAny = async (cusKode: string, ymdTanggal: string) => {
    if (!cusKode?.trim() || !ymdTanggal?.trim()) return;

    // reset dulu supaya gak nyangkut state lama
    setExistingVisitId(null);
    setVisitLoaded(false);

    try {
      // 1) cek DONE (Y)
      const resp = await api.get('/rekap-visit', {
        params: { user: namaSales, tanggal: ymdTanggal },
      });

      const rows = resp.data?.data || [];
      const foundDone = rows.find((x: any) => String(x?.cus_kode || '').trim() === String(cusKode).trim());

      if (foundDone) {
        setExistingVisitId(Number(foundDone.id));
        setNote(String(foundDone.note || ''));
        setCatatan(String(foundDone.catatan || ''));
        setVisitLoaded(true);
        Toast.show({ type: 'glassSuccess', text1: 'Visit ditemukan', text2: 'Form terisi dari visit (DONE)' });
        return;
      }
    } catch {
      // ignore, lanjut coba draft
    }

    // 2) kalau DONE tidak ketemu, cek DRAFT (N)
    await loadDraftIfAny(cusKode, ymdTanggal);
  };

  useEffect(() => {
    const selected = route?.params?.selectedCustomer;
    if (selected) {
      setCustomerKode(String(selected.kode || ''));
      setCustomer(String(selected.nama || ''));
      setExistingVisitId(null);
      setVisitLoaded(false);
      setNote('');
      setCatatan('');
    }
  }, [route?.params?.selectedCustomer]);

  useEffect(() => {
    console.log('trigger load', { customerKode, tanggal });
    if (customerKode && tanggal) loadVisitIfAny(customerKode, tanggal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerKode, tanggal]);

  const canSubmit = useMemo(() => {
    return customer.trim().length > 0 && customerKode.trim().length > 0 && tanggal.trim().length > 0 && !loading;
  }, [customer, customerKode, tanggal, loading]);

  // Location
  const requestLocationPermission = async () => {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
      title: 'Izin Lokasi',
      message: 'Aplikasi membutuhkan izin lokasi untuk mengisi latitude & longitude.',
      buttonPositive: 'OK',
      buttonNegative: 'Batal',
    });
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  const ambilLokasi = async () => {
    const ok = await requestLocationPermission();
    if (!ok) {
      Toast.show({ type: 'glassError', text1: 'Izin Ditolak', text2: 'Location permission not granted' });
      return;
    }

    Geolocation.getCurrentPosition(
      (pos: any) => {
        setLatitude(String(pos.coords.latitude));
        setLongitude(String(pos.coords.longitude));
        Toast.show({ type: 'glassSuccess', text1: 'Lokasi Ditemukan', text2: 'Latitude & Longitude berhasil diambil' });
      },
      (err: any) => {
        Toast.show({ type: 'glassError', text1: 'Gagal Ambil Lokasi', text2: err?.message || 'Tidak bisa mengambil lokasi' });
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
    );
  };

  // Foto
  const setPhotoFromAsset = async (asset: Asset) => {
    if (!asset?.uri) return;

    Toast.show({ type: 'glassSuccess', text1: 'Foto dipilih', text2: 'Mengompres foto...' });

    const { uri: compressedUri, sizeBytes } = await compressToUnderLimit(asset.uri);
    const finalName = safeFileName(asset.fileName, `visit_${Date.now()}.jpg`);

    setPhoto({
      uri: toFileUri(compressedUri),
      name: finalName,
      type: 'image/jpeg',
      sizeBytes,
    });

    if (sizeBytes > MAX_UPLOAD_BYTES) {
      Toast.show({
        type: 'glassError',
        text1: 'Foto masih terlalu besar',
        text2: `Hasil kompres ${(sizeBytes / 1024 / 1024).toFixed(2)} MB > 1 MB.`,
      });
    } else {
      Toast.show({
        type: 'glassSuccess',
        text1: 'Foto siap diupload',
        text2: `Ukuran ${(sizeBytes / 1024).toFixed(0)} KB`,
      });
    }
  };

  const pickFromCamera = async () => {
    const res = await launchCamera({ mediaType: 'photo', quality: 0.8, saveToPhotos: true });
    if (res.didCancel) return;
    if (res.errorCode) {
      Toast.show({ type: 'glassError', text1: 'Kamera Gagal', text2: res.errorMessage || 'Gagal membuka kamera' });
      return;
    }
    const asset = res.assets?.[0];
    if (!asset?.uri) return;
    await setPhotoFromAsset(asset);
  };

  const pickFromGallery = async () => {
    const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 1 });
    if (res.didCancel) return;
    if (res.errorCode) {
      Toast.show({ type: 'glassError', text1: 'Galeri Gagal', text2: res.errorMessage || 'Gagal membuka galeri' });
      return;
    }
    const asset = res.assets?.[0];
    if (!asset?.uri) return;
    await setPhotoFromAsset(asset);
  };

  const uploadPhoto = async (visitId: number) => {
    if (!photo?.uri) return;

    if (photo.sizeBytes && photo.sizeBytes > MAX_UPLOAD_BYTES) {
      throw new Error('Ukuran foto masih > 1MB.');
    }

    const baseURL = (api as any)?.defaults?.baseURL;
    if (!baseURL) throw new Error('baseURL api belum ter-set');

    const url = `${baseURL}/visits/${visitId}/photo`;
    const filePath = stripFileScheme(photo.uri);

    const resp = await RNBlobUtil.fetch(
      'POST',
      url,
      { Accept: 'application/json' },
      [
        {
          name: 'file',
          filename: photo.name,
          type: photo.type || 'image/jpeg',
          data: RNBlobUtil.wrap(filePath),
        },
      ]
    );

    const status = resp.info().status;
    const text = resp.data || '';
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      // ignore
    }

    if (status < 200 || status >= 300 || !json?.success) {
      throw new Error(json?.message || `Upload gagal (${status})`);
    }
  };

  // Simpan / Update visit
  const resetForm = () => {
    setCustomer('');
    setCustomerKode('');
    setNote('');
    setCatatan('');
    setLatitude('');
    setLongitude('');
    setPhoto(null);
    setUploadPending(false);
    setLastVisitId(null);
    setExistingVisitId(null);
    setVisitLoaded(false);
    setTanggal('');
  };

  const simpan = async () => {
    if (!customer.trim() || !customerKode.trim()) {
      Toast.show({ type: 'glassError', text1: 'Validasi', text2: 'Customer harus dipilih terlebih dahulu' });
      return;
    }
    if (!tanggal.trim()) {
      Toast.show({ type: 'glassError', text1: 'Validasi', text2: 'Tanggal Visit wajib dipilih' });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        cus_kode: customerKode.trim(),
        tanggal,
        user: namaSales,
        latitude: latitude?.trim() || null,
        longitude: longitude?.trim() || null,
        note: note.trim() || '',
        catatan: catatan.trim() || '',
      };

      let visitId: number | null = null;

      if (existingVisitId) {
        const res = await api.put(`/visits/${existingVisitId}`, payload);
        if (!res.data?.success) throw new Error(res.data?.message || 'Gagal update visit');
        visitId = existingVisitId;

        Toast.show({ type: 'glassSuccess', text1: 'Update Berhasil', text2: 'Visit diperbarui' });
      } else {
        const res = await api.post('/visits', payload);
        if (!res.data?.success) throw new Error(res.data?.message || 'Gagal menyimpan visit');
        visitId = Number(res.data?.data?.id || 0) || null;

        Toast.show({ type: 'glassSuccess', text1: 'Simpan Berhasil', text2: 'Visit tersimpan' });
      }

      setLastVisitId(visitId);

      // upload foto (opsional)
      if (visitId && photo?.uri) {
        try {
          await uploadPhoto(visitId);
          setUploadPending(false);
          setPhoto(null);
        } catch (e: any) {
          setUploadPending(true);
          Toast.show({
            type: 'glassError',
            text1: 'Data tersimpan',
            text2: e?.message || 'Foto belum terupload. Silakan Upload Ulang.',
          });
        }
      } else {
        setUploadPending(false);
      }

      resetForm();
      setTimeout(() => navigation.navigate('Home'), 400);
    } catch (err: any) {
      Toast.show({
        type: 'glassError',
        text1: 'Gagal',
        text2: err?.response?.data?.message || err?.message || 'Gagal koneksi ke server',
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadUlang = async () => {
    if (!lastVisitId) {
      Toast.show({ type: 'glassError', text1: 'Tidak Ada ID', text2: 'ID visit tidak ditemukan' });
      return;
    }
    if (!photo?.uri) {
      Toast.show({ type: 'glassError', text1: 'Foto Kosong', text2: 'Silakan pilih foto dulu' });
      return;
    }

    setLoading(true);
    try {
      await uploadPhoto(lastVisitId);
      setUploadPending(false);
      setPhoto(null);
      Toast.show({ type: 'glassSuccess', text1: 'Upload Berhasil', text2: 'Foto berhasil diupload' });
    } catch (e: any) {
      Toast.show({ type: 'glassError', text1: 'Upload Gagal', text2: e?.message || 'Gagal upload foto' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[THEME.bgTop, THEME.bgBottom]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Visit</Text>
            <Text style={styles.subtitle}>Input Kunjungan</Text>
          </View>

          <View style={styles.card}>
            {/* Sales */}
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
                    setExistingVisitId(null);
                    setVisitLoaded(false);
                  }}
                  placeholder="Pilih Customer"
                  placeholderTextColor={THEME.muted}
                  style={styles.input}
                />
              </View>

              <TouchableOpacity
                onPress={() => navigation.navigate('CariCustomer', { keyword: customer, from: 'TAMBAHVISIT' })}
                style={styles.btnSoft}
                activeOpacity={0.9}
              >
                <Text style={styles.btnSoftText}>CARI</Text>
              </TouchableOpacity>
            </View>

            {!!customerKode && <Text style={styles.helper}>Kode: {customerKode}</Text>}
            {visitLoaded && (
              <Text style={styles.helperOk}>
                • Mode: <Text style={{ fontWeight: '900' }}>UPDATE</Text>
              </Text>
            )}

            {/* Tanggal */}
            <Text style={styles.label}>Tanggal Visit</Text>
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

            {/* Lokasi */}
            <Text style={[styles.label, { marginTop: 14 }]}>Lokasi</Text>
            <View style={styles.row}>
              <View style={[styles.inputWrap, { flex: 1, marginBottom: 0 }]}>
                <TextInput value={latitude} editable={false} placeholder="Latitude" placeholderTextColor={THEME.muted} style={styles.input} />
              </View>
              <View style={[styles.inputWrap, { flex: 1, marginBottom: 0 }]}>
                <TextInput value={longitude} editable={false} placeholder="Longitude" placeholderTextColor={THEME.muted} style={styles.input} />
              </View>
            </View>

            <TouchableOpacity onPress={ambilLokasi} style={styles.btnAccent} activeOpacity={0.9}>
              <Text style={styles.btnAccentText}>AMBIL LOKASI</Text>
            </TouchableOpacity>

            {/* Foto */}
            <Text style={styles.label}>Foto</Text>

            {photo?.uri ? (
              <>
                <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="cover" />
                <Text style={styles.photoMeta}>Size: {photo.sizeBytes ? `${(photo.sizeBytes / 1024).toFixed(0)} KB` : '-'}</Text>
              </>
            ) : (
              <View style={styles.photoEmpty}>
                <Text style={{ color: THEME.muted, fontWeight: '800' }}>Belum ada foto</Text>
              </View>
            )}

            {uploadPending && (
              <TouchableOpacity onPress={uploadUlang} disabled={loading} style={[styles.btnPrimary, { marginTop: 10 }]} activeOpacity={0.9}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>UPLOAD ULANG FOTO</Text>}
              </TouchableOpacity>
            )}

            <View style={styles.row}>
              <TouchableOpacity onPress={pickFromCamera} style={[styles.btnSoft, { flex: 1 }]} activeOpacity={0.9}>
                <Text style={styles.btnSoftText}>KAMERA</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={pickFromGallery} style={[styles.btnSoft, { flex: 1 }]} activeOpacity={0.9}>
                <Text style={styles.btnSoftText}>GALERI</Text>
              </TouchableOpacity>
            </View>

            {/* Catatan */}
            <Text style={styles.label}>Catatan</Text>
            <View style={[styles.textAreaWrap]}>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Tulis catatan..."
                placeholderTextColor={THEME.muted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                style={[styles.input, { height: 90, paddingTop: 10 }]}
              />
            </View>

            {/* Keperluan */}
            <Text style={styles.label}>Keperluan</Text>
            <View style={[styles.textAreaWrap]}>
              <TextInput
                value={catatan}
                onChangeText={setCatatan}
                placeholder="Tulis keperluan..."
                placeholderTextColor={THEME.muted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={[styles.input, { height: 110, paddingTop: 10 }]}
              />
            </View>

            <TouchableOpacity onPress={simpan} disabled={!canSubmit} style={[styles.btnPrimary, !canSubmit && { opacity: 0.55 }]} activeOpacity={0.9}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>{existingVisitId ? 'UPDATE VISIT' : 'SIMPAN VISIT'}</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate("Visit")} disabled={loading} style={styles.btnGhost} activeOpacity={0.9}>
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

  leadingIcon: { fontSize: 16, marginRight: 10 },
  input: { flex: 1, color: THEME.ink, fontSize: 15, fontWeight: '800' },
  selectText: { flex: 1, color: THEME.ink, fontSize: 14, fontWeight: '900' },

  row: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 10 },

  helper: { color: THEME.muted, fontSize: 12, fontWeight: '800', marginTop: -4, marginLeft: 4 },
  helperOk: { color: THEME.ok, fontSize: 11, fontWeight: '800', marginTop: 6, marginLeft: 4 },

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

  btnAccent: {
    marginTop: 4,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(6,182,212,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  btnAccentText: { color: THEME.ink, fontWeight: '900', letterSpacing: 0.3, fontSize: 12 },

  btnGhost: { marginTop: 10, alignItems: 'center', paddingVertical: 10 },
  btnGhostText: { color: THEME.muted, fontWeight: '900' },

  photo: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.line,
    marginTop: 6,
  },
  photoMeta: { color: THEME.muted, fontSize: 12, marginTop: 8, fontWeight: '800' },

  photoEmpty: {
    width: '100%',
    height: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.line,
    backgroundColor: THEME.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 6,
  },

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
