import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Platform,
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
import Geolocation from 'react-native-geolocation-service';
import {
  Asset,
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';
import RNBlobUtil from 'react-native-blob-util';
import ImageResizer from 'react-native-image-resizer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import api from '../../services/api';
import { useAuth } from '../../context/authContext';

const THEME = {
  primary: '#4F46E5',
  accent: '#06B6D4',
  ink: '#0F172A',
  muted: '#64748B',
  card: '#FFFFFF',
  line: 'rgba(15,23,42,0.08)',
  bgTop: '#F7F9FF',
  bgBottom: '#FFFFFF',
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

type PengirimanDetail = {
  id: number;
  sender?: string | null;
  receiver?: string | null;
  note?: string | null;
  catatan?: string | null;
  tanggal_plan?: string | null;
  jam_plan?: string | null;
  latitude?: string | null;
  longitude?: string | null;
};

const toFileUri = (uri: string) =>
  uri.startsWith('file://') ? uri : `file://${uri}`;

const stripFileScheme = (uri: string) => uri.replace('file://', '');

const safeFileName = (name: string | undefined, fallback: string) => {
  const value = (name || '').trim();
  if (!value) return fallback;
  return value.includes('.') ? value : `${value}.jpg`;
};

const dateToYmd = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const timeToHm = (date: Date) => {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
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
  return { uri: lastUri, sizeBytes: Number(statLast.size || 0) };
}

export default function KurirProsesPengirimanScreen({
  navigation,
  route,
}: any) {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const pengirimanId = Number(route?.params?.id || 0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sender, setSender] = useState('');
  const [receiver, setReceiver] = useState('');
  const [note, setNote] = useState('');
  const [catatan, setCatatan] = useState('');
  const [tanggalPlan, setTanggalPlan] = useState<string | null>(null);
  const [jamPlan, setJamPlan] = useState<string | null>(null);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [photo, setPhoto] = useState<PhotoState | null>(null);

  const canSubmit = useMemo(() => {
    return !!token && pengirimanId > 0 && !!sender.trim() && !!receiver.trim();
  }, [pengirimanId, receiver, sender, token]);

  useEffect(() => {
    const loadDetail = async () => {
      if (!token || pengirimanId < 1) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get(`/kurir/pengiriman/${pengirimanId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: PengirimanDetail = res.data?.data || {};
        setSender(String(data?.sender || ''));
        setReceiver(String(data?.receiver || ''));
        setNote(String(data?.note || ''));
        setCatatan(String(data?.catatan || ''));
        setTanggalPlan(
          data?.tanggal_plan ? String(data.tanggal_plan).slice(0, 10) : null,
        );
        setJamPlan(data?.jam_plan ? String(data.jam_plan).slice(0, 5) : null);
        setLatitude(String(data?.latitude || ''));
        setLongitude(String(data?.longitude || ''));
      } catch (err: any) {
        Toast.show({
          type: 'glassError',
          text1: 'Gagal memuat data',
          text2:
            err?.response?.data?.message ||
            'Detail pengiriman tidak dapat diambil',
        });
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [navigation, pengirimanId, token]);

  const requestLocationPermission = async () => {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Izin Lokasi',
        message: 'Aplikasi membutuhkan lokasi untuk realisasi pengiriman.',
        buttonPositive: 'OK',
        buttonNegative: 'Batal',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  const getLocation = async () => {
    const allowed = await requestLocationPermission();
    if (!allowed) {
      Toast.show({
        type: 'glassError',
        text1: 'Izin ditolak',
        text2: 'Lokasi belum diizinkan',
      });
      return;
    }

    Geolocation.getCurrentPosition(
      position => {
        setLatitude(String(position.coords.latitude));
        setLongitude(String(position.coords.longitude));
        Toast.show({
          type: 'glassSuccess',
          text1: 'Lokasi diambil',
          text2: 'Latitude dan longitude berhasil diperbarui',
        });
      },
      err => {
        Toast.show({
          type: 'glassError',
          text1: 'Gagal ambil lokasi',
          text2: err?.message || 'Tidak dapat mengambil lokasi',
        });
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 },
    );
  };

  const setPhotoFromAsset = async (asset: Asset) => {
    if (!asset?.uri) return;

    const compressed = await compressToUnderLimit(asset.uri);
    setPhoto({
      uri: toFileUri(compressed.uri),
      name: safeFileName(asset.fileName, `kiriman_${Date.now()}.jpg`),
      type: 'image/jpeg',
      sizeBytes: compressed.sizeBytes,
    });

    Toast.show({
      type:
        compressed.sizeBytes > MAX_UPLOAD_BYTES ? 'glassError' : 'glassSuccess',
      text1:
        compressed.sizeBytes > MAX_UPLOAD_BYTES
          ? 'Foto terlalu besar'
          : 'Foto siap diupload',
      text2:
        compressed.sizeBytes > MAX_UPLOAD_BYTES
          ? 'Ukuran foto masih melebihi 1 MB'
          : `Ukuran ${(compressed.sizeBytes / 1024).toFixed(0)} KB`,
    });
  };

  const pickFromCamera = async () => {
    const res = await launchCamera({
      mediaType: 'photo',
      quality: 0.8,
      saveToPhotos: true,
    });
    if (res.didCancel) return;
    if (res.errorCode) {
      Toast.show({
        type: 'glassError',
        text1: 'Kamera gagal',
        text2: res.errorMessage || 'Tidak dapat membuka kamera',
      });
      return;
    }
    const asset = res.assets?.[0];
    if (asset?.uri) await setPhotoFromAsset(asset);
  };

  const pickFromGallery = async () => {
    const res = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.8,
    });
    if (res.didCancel) return;
    if (res.errorCode) {
      Toast.show({
        type: 'glassError',
        text1: 'Galeri gagal',
        text2: res.errorMessage || 'Tidak dapat membuka galeri',
      });
      return;
    }
    const asset = res.assets?.[0];
    if (asset?.uri) await setPhotoFromAsset(asset);
  };

  const uploadPhoto = async () => {
    if (!photo?.uri || !token) return;
    if (photo.sizeBytes && photo.sizeBytes > MAX_UPLOAD_BYTES) {
      throw new Error('Foto masih melebihi 1 MB.');
    }

    const baseURL = (api as any)?.defaults?.baseURL;
    if (!baseURL) throw new Error('baseURL API belum tersedia');

    const response = await RNBlobUtil.fetch(
      'POST',
      `${baseURL}/kurir/pengiriman/${pengirimanId}/photo`,
      {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      [
        {
          name: 'file',
          filename: photo.name,
          type: photo.type || 'image/jpeg',
          data: RNBlobUtil.wrap(stripFileScheme(photo.uri)),
        },
      ],
    );

    const status = response.info().status;
    const text = response.data || '';
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = {};
    }

    if (status < 200 || status >= 300 || !json?.success) {
      throw new Error(json?.message || `Upload gagal (${status})`);
    }
  };

  const submit = async () => {
    if (!canSubmit || !token) return;

    setSaving(true);
    try {
      const now = new Date();
      const payload = {
        sender: sender.trim(),
        receiver: receiver.trim(),
        note: note.trim(),
        catatan: catatan.trim(),
        latitude: latitude.trim() || null,
        longitude: longitude.trim() || null,
        tanggal: dateToYmd(now),
        jam: timeToHm(now),
        tanggal_plan: tanggalPlan,
        jam_plan: jamPlan,
        status: 'delivered',
      };

      const res = await api.put(`/kurir/pengiriman/${pengirimanId}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Gagal memproses pengiriman');
      }

      if (photo?.uri) {
        await uploadPhoto();
      }

      Toast.show({
        type: 'glassSuccess',
        text1: 'Pengiriman selesai',
        text2: 'Data realisasi berhasil disimpan',
      });
      navigation.navigate('KurirPengiriman');
    } catch (err: any) {
      Toast.show({
        type: 'glassError',
        text1: 'Gagal memproses',
        text2:
          err?.response?.data?.message ||
          err?.message ||
          'Tidak dapat menyimpan realisasi kirim',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={THEME.primary} />
        </View>
      </LinearGradient>
    );
  }

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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: 28 + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Proses Kirim</Text>
            <Text style={styles.subtitle}>
              Realisasi pengiriman seperti di Delphi kiriman
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Pengirim</Text>
            <View style={[styles.inputWrap, styles.disabledWrap]}>
              <TextInput editable={false} value={sender} style={styles.input} />
            </View>

            <Text style={styles.label}>Penerima</Text>
            <View style={[styles.inputWrap, styles.disabledWrap]}>
              <TextInput
                editable={false}
                value={receiver}
                style={styles.input}
              />
            </View>

            {!!tanggalPlan && (
              <Text style={styles.helper}>
                Rencana: {tanggalPlan} {jamPlan || ''}
              </Text>
            )}

            <Text style={styles.label}>Uraian</Text>
            <View style={[styles.inputWrap, styles.disabledWrap]}>
              <TextInput editable={false} value={note} style={styles.input} />
            </View>

            <Text style={styles.label}>Catatan Kurir</Text>
            <View style={styles.textAreaWrap}>
              <TextInput
                value={catatan}
                onChangeText={setCatatan}
                placeholder="Catatan saat barang diterima"
                placeholderTextColor={THEME.muted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={[styles.input, styles.textAreaInput]}
              />
            </View>

            <Text style={styles.label}>Lokasi</Text>
            <View style={styles.row}>
              <View style={[styles.inputWrap, styles.halfWrap]}>
                <TextInput
                  editable={false}
                  value={latitude}
                  placeholder="Latitude"
                  placeholderTextColor={THEME.muted}
                  style={styles.input}
                />
              </View>
              <View
                style={[
                  styles.inputWrap,
                  styles.halfWrap,
                  styles.halfWrapRight,
                ]}
              >
                <TextInput
                  editable={false}
                  value={longitude}
                  placeholder="Longitude"
                  placeholderTextColor={THEME.muted}
                  style={styles.input}
                />
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={getLocation}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryBtnText}>AMBIL LOKASI</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Foto Bukti</Text>
            {photo?.uri ? (
              <>
                <Image
                  source={{ uri: photo.uri }}
                  style={styles.photo}
                  resizeMode="cover"
                />
                <Text style={styles.helper}>
                  Size:{' '}
                  {photo.sizeBytes
                    ? `${(photo.sizeBytes / 1024).toFixed(0)} KB`
                    : '-'}
                </Text>
              </>
            ) : (
              <View style={styles.photoEmpty}>
                <Text style={styles.photoEmptyText}>Belum ada foto</Text>
              </View>
            )}

            <View style={styles.row}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={pickFromCamera}
                style={[styles.secondaryBtn, styles.flexBtn]}
              >
                <Text style={styles.secondaryBtnText}>KAMERA</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={pickFromGallery}
                style={[styles.ghostBtn, styles.flexBtn, styles.flexBtnRight]}
              >
                <Text style={styles.ghostBtnText}>GALERI</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              disabled={!canSubmit || saving}
              onPress={submit}
              style={[
                styles.primaryBtn,
                (!canSubmit || saving) && styles.disabledBtn,
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>SELESAIKAN PENGIRIMAN</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              disabled={saving}
              onPress={() => navigation.goBack()}
              style={styles.ghostBtn}
            >
              <Text style={styles.ghostBtnText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 54 : 18,
  },
  header: { alignItems: 'center', marginBottom: 12 },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: THEME.ink,
    letterSpacing: 0.2,
  },
  subtitle: {
    color: THEME.muted,
    fontSize: 12,
    marginTop: 6,
    fontWeight: '700',
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  label: {
    color: THEME.ink,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 12,
  },
  helper: {
    color: THEME.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
  },
  inputWrap: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 12,
    minHeight: 50,
    justifyContent: 'center',
  },
  disabledWrap: { opacity: 0.75 },
  input: {
    color: THEME.ink,
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 12,
  },
  halfWrap: { flex: 1 },
  halfWrapRight: { marginLeft: 10 },
  textAreaWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.line,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
  },
  textAreaInput: {
    height: 110,
    paddingTop: 10,
  },
  photo: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
  },
  photoEmpty: {
    height: 140,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.line,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmptyText: {
    color: THEME.muted,
    fontWeight: '800',
  },
  flexBtn: { flex: 1 },
  flexBtnRight: { marginLeft: 10 },
  primaryBtn: {
    marginTop: 18,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: THEME.ok,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.4,
  },
  secondaryBtn: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  secondaryBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
  },
  ghostBtn: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.line,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  ghostBtnText: {
    color: THEME.muted,
    fontWeight: '800',
    fontSize: 13,
  },
  disabledBtn: { opacity: 0.55 },
});
