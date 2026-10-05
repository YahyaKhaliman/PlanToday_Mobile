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
  Modal,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import Geolocation from 'react-native-geolocation-service';
import {
  launchCamera,
  launchImageLibrary,
  Asset,
} from 'react-native-image-picker';
import RNBlobUtil from 'react-native-blob-util';
import ImageResizer from 'react-native-image-resizer';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePressGuard } from '../../utils/usePressGuard';

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

type RekapVisitItem = {
  id?: number;
  cus_kode?: string;
  cus_nama?: string;
  cc_nama?: string;
  customer_text?: string;

  cus_alamat?: string;
  cc_alamat?: string;
  cus_alamat_text?: string;

  note?: string;
  catatan?: string;
  status?: string;
  tanggal?: string;

  latitude?: string | number | null;
  longitude?: string | number | null;

  foto?: string | null;
  foto_url?: string | null;
};

const normalizeYmd = (v: string) => String(v || '').slice(0, 10);

const toFileUri = (uri: string) =>
  uri.startsWith('file://') ? uri : `file://${uri}`;
const stripFileScheme = (uri: string) => uri.replace('file://', '');

const safeFileName = (name: string | undefined, fallback: string) => {
  const n = (name || '').trim();
  if (!n) return fallback;
  return n.includes('.') ? n : `${n}.jpg`;
};

const ymdToDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(n => parseInt(n, 10));
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
    const [y, m, d] = ymd.split('-').map(n => parseInt(n, 10));
    const dt = new Date(y, m - 1, d);
    const bulan = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'Mei',
      'Jun',
      'Jul',
      'Agu',
      'Sep',
      'Okt',
      'Nov',
      'Des',
    ];
    return `${dt.getDate()} ${bulan[dt.getMonth()]} ${dt.getFullYear()}`;
  } catch {
    return ymd;
  }
};

const joinUrl = (base: string, path: string) => {
  const b = String(base || '').replace(/\/+$/, '');
  const p = String(path || '');
  if (!p) return b;
  return `${b}${p.startsWith('/') ? '' : '/'}${p}`;
};

const getApiBase = () => {
  const baseURL = (api as any)?.defaults?.baseURL;
  if (!baseURL) return '';
  return String(baseURL).replace(/\/+$/, '');
};

const resolvePhotoUrl = (maybeUrlOrPath: string | null | undefined) => {
  const raw = String(maybeUrlOrPath || '').trim();
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;

  const base = getApiBase();
  if (!base) return raw;

  // kalau base mengandung "/api", ambil origin-nya (http://localhost:3001/api -> http://localhost:3001)
  const origin = base.replace(/\/api\/?$/i, '');
  return joinUrl(origin, raw);
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

export default function EditVisitScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const isManager = String(user?.jabatan || '').toUpperCase() === 'MANAGER';
  const insets = useSafeAreaInsets();
  const runGuardedPress = usePressGuard();

  const cabang = String(user?.cabang || '');
  const namaSales = String(user?.nama || '');

  const today = useMemo(() => dateToYmd(new Date()), []);

  const initialData: RekapVisitItem | undefined = route?.params?.data;
  const visitId = useMemo(
    () => Number(initialData?.id || 0) || null,
    [initialData?.id],
  );

  // form state
  const [tanggal, setTanggal] = useState<string>('');
  const [customer, setCustomer] = useState('');
  const [customerKode, setCustomerKode] = useState('');

  const [note, setNote] = useState('');
  const [catatan, setCatatan] = useState('');

  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  const [photo, setPhoto] = useState<PhotoState | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [showDate, setShowDate] = useState(false);

  const [uploadPending, setUploadPending] = useState(false);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  // Prefill dari route params
  useEffect(() => {
    const nama =
      initialData?.cus_nama ||
      initialData?.cc_nama ||
      initialData?.customer_text ||
      '';
    const kode = String(initialData?.cus_kode || '').trim();
    const tgl = normalizeYmd(String(initialData?.tanggal || '').trim());

    setCustomer(nama);
    setCustomerKode(kode);
    setTanggal(tgl);

    setNote(String(initialData?.note || ''));
    setCatatan(String(initialData?.catatan || ''));

    setLatitude(
      initialData?.latitude != null ? String(initialData.latitude) : '',
    );
    setLongitude(
      initialData?.longitude != null ? String(initialData.longitude) : '',
    );

    const url = resolvePhotoUrl(initialData?.foto_url || initialData?.foto);
    setExistingPhotoUrl(url);

    setPhoto(null);
    setUploadPending(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.data]);

  const canSubmit = useMemo(() => {
    return (
      !!visitId &&
      customer.trim().length > 0 &&
      customerKode.trim().length > 0 &&
      tanggal.trim().length > 0 &&
      !loading
    );
  }, [visitId, customer, customerKode, tanggal, loading]);

  // Location
  const requestLocationPermission = async () => {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Izin Lokasi',
        message:
          'Aplikasi membutuhkan izin lokasi untuk mengisi latitude & longitude.',
        buttonPositive: 'OK',
        buttonNegative: 'Batal',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  const ambilLokasi = async () => {
    const ok = await requestLocationPermission();
    if (!ok) {
      Toast.show({
        type: 'glassError',
        text1: 'Izin Ditolak',
        text2: 'Location permission not granted',
      });
      return;
    }

    Geolocation.getCurrentPosition(
      (pos: any) => {
        setLatitude(String(pos.coords.latitude));
        setLongitude(String(pos.coords.longitude));
        Toast.show({
          type: 'glassSuccess',
          text1: 'Lokasi Ditemukan',
          text2: 'Latitude & Longitude berhasil diambil',
        });
      },
      (err: any) => {
        Toast.show({
          type: 'glassError',
          text1: 'Gagal Ambil Lokasi',
          text2: err?.message || 'Tidak bisa mengambil lokasi',
        });
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 },
    );
  };

  const latNum = useMemo(() => parseFloat(String(latitude || '')), [latitude]);
  const lngNum = useMemo(
    () => parseFloat(String(longitude || '')),
    [longitude],
  );
  const hasValidCoord = useMemo(
    () =>
      !isNaN(latNum) &&
      !isNaN(lngNum) &&
      latNum !== 0 &&
      lngNum !== 0 &&
      latNum >= -90 &&
      latNum <= 90 &&
      lngNum >= -180 &&
      lngNum <= 180,
    [latNum, lngNum],
  );

  const bukaGoogleMaps = () => {
    if (!hasValidCoord) {
      Toast.show({
        type: 'glassError',
        text1: 'Koordinat Tidak Valid',
        text2: 'Latitude dan Longitude belum tersedia',
      });
      return;
    }
    const label = encodeURIComponent(customer || 'Lokasi Visit');
    const url = Platform.select({
      ios: `maps:0,0?q=${latNum},${lngNum}`,
      android: `geo:${latNum},${lngNum}?q=${latNum},${lngNum}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${latNum},${lngNum}`,
    });

    Linking.canOpenURL(url)
      .then(supported => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Linking.openURL(
            `https://www.google.com/maps/search/?api=1&query=${latNum},${lngNum}`,
          );
        }
      })
      .catch(() => {
        Linking.openURL(
          `https://www.google.com/maps/search/?api=1&query=${latNum},${lngNum}`,
        );
      });
  };

  const mapHtml = useMemo(() => {
    if (!hasValidCoord) return '';
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body, #map { width: 100%; height: 100%; background: #f1f5f9; }
          .leaflet-control-attribution { display: none !important; }
          .leaflet-touch .leaflet-control-zoom-in,
          .leaflet-touch .leaflet-control-zoom-out {
            font-size: 16px;
            width: 32px;
            height: 32px;
            line-height: 30px;
          }
          .custom-popup .leaflet-popup-content-wrapper {
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          try {
            var map = L.map('map', {
              center: [${latNum}, ${lngNum}],
              zoom: 16,
              zoomControl: true,
              attributionControl: false,
              scrollWheelZoom: true,
              touchZoom: true
            });
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              maxZoom: 19
            }).addTo(map);
            var marker = L.marker([${latNum}, ${lngNum}]).addTo(map);
            // marker.bindPopup("<b>" ${latNum} + ", " + ${lngNum}).openPopup();
          } catch(e) {
            document.body.innerHTML = '<div style="padding:20px;text-align:center;color:#64748b;font-family:sans-serif;">Peta gagal dimuat</div>';
          }
        </script>
      </body>
      </html>
    `;
  }, [hasValidCoord, latNum, lngNum]);

  // Foto
  const setPhotoFromAsset = async (asset: Asset) => {
    if (!asset?.uri) return;

    Toast.show({
      type: 'glassSuccess',
      text1: 'Foto dipilih',
      text2: 'Mengompres foto...',
    });

    // ImageResizer output file:// sehingga aman untuk RNBlobUtil.wrap
    const { uri: compressedUri, sizeBytes } = await compressToUnderLimit(
      asset.uri,
    );
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
        text2: `Hasil kompres ${(sizeBytes / 1024 / 1024).toFixed(
          2,
        )} MB > 1 MB.`,
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
    const res = await launchCamera({
      mediaType: 'photo',
      quality: 0.8,
      saveToPhotos: true,
    });
    if (res.didCancel) return;
    if (res.errorCode) {
      Toast.show({
        type: 'glassError',
        text1: 'Kamera Gagal',
        text2: res.errorMessage || 'Gagal membuka kamera',
      });
      return;
    }
    const asset = res.assets?.[0];
    if (!asset?.uri) return;
    await setPhotoFromAsset(asset);
  };

  const pickFromGallery = async () => {
    const res = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 1,
    });
    if (res.didCancel) return;
    if (res.errorCode) {
      Toast.show({
        type: 'glassError',
        text1: 'Galeri Gagal',
        text2: res.errorMessage || 'Gagal membuka galeri',
      });
      return;
    }
    const asset = res.assets?.[0];
    if (!asset?.uri) return;
    await setPhotoFromAsset(asset);
  };

  const uploadPhoto = async (id: number) => {
    if (!photo?.uri) return;

    if (photo.sizeBytes && photo.sizeBytes > MAX_UPLOAD_BYTES) {
      throw new Error('Ukuran foto masih > 1MB.');
    }

    const base = getApiBase();
    if (!base) throw new Error('baseURL api belum ter-set');

    // endpoint upload mengikuti baseURL API
    const url = joinUrl(base, `/visits/${id}/photo`);
    const filePath = stripFileScheme(toFileUri(photo.uri));

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
      ],
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

  const simpan = async () => {
    if (loading) return;

    if (!visitId) {
      Toast.show({
        type: 'glassError',
        text1: 'Validasi',
        text2: 'ID Visit tidak ditemukan',
      });
      return;
    }
    if (!customer.trim() || !customerKode.trim()) {
      Toast.show({
        type: 'glassError',
        text1: 'Validasi',
        text2: 'Customer harus dipilih terlebih dahulu',
      });
      return;
    }
    if (!tanggal.trim()) {
      Toast.show({
        type: 'glassError',
        text1: 'Validasi',
        text2: 'Tanggal Visit wajib dipilih',
      });
      return;
    }

    if (tanggal < today) {
      Toast.show({
        type: 'glassError',
        text1: 'Validasi',
        text2: 'Tanggal visit tidak boleh kurang dari hari ini',
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        cus_kode: customerKode.trim(),
        tanggal: normalizeYmd(tanggal),
        user: namaSales,
        latitude: latitude?.trim() || null,
        longitude: longitude?.trim() || null,
        note: note.trim() || '',
        catatan: catatan.trim() || '',
      };

      const res = await api.put(`/visits/${visitId}`, payload);
      if (!res.data?.success)
        throw new Error(res.data?.message || 'Gagal update visit');

      Toast.show({
        type: 'glassSuccess',
        text1: 'Update Berhasil',
        text2: 'Visit diperbarui',
      });

      // upload foto (opsional)
      if (photo?.uri) {
        try {
          await uploadPhoto(visitId);
          setUploadPending(false);
          setPhoto(null);
          Toast.show({
            type: 'glassSuccess',
            text1: 'Foto terupload',
            text2: 'Upload foto berhasil',
          });
        } catch (e: any) {
          setUploadPending(true);
          Toast.show({
            type: 'glassError',
            text1: 'Data terupdate',
            text2: e?.message || 'Foto belum terupload. Silakan Upload Ulang.',
          });
        }
      } else {
        setUploadPending(false);
      }

      setTimeout(() => navigation.goBack(), 300);
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

  const uploadUlang = async () => {
    if (!visitId) {
      Toast.show({
        type: 'glassError',
        text1: 'Tidak Ada ID',
        text2: 'ID visit tidak ditemukan',
      });
      return;
    }
    if (!photo?.uri) {
      Toast.show({
        type: 'glassError',
        text1: 'Foto Kosong',
        text2: 'Silakan pilih foto dulu',
      });
      return;
    }

    setLoading(true);
    try {
      await uploadPhoto(visitId);
      setUploadPending(false);
      setPhoto(null);
      Toast.show({
        type: 'glassSuccess',
        text1: 'Upload Berhasil',
        text2: 'Foto berhasil diupload',
      });
    } catch (e: any) {
      Toast.show({
        type: 'glassError',
        text1: 'Upload Gagal',
        text2: e?.message || 'Gagal upload foto',
      });
    } finally {
      setLoading(false);
    }
  };

  const photoPreviewUri = useMemo(() => {
    if (photo?.uri) return photo.uri;
    if (existingPhotoUrl) return existingPhotoUrl;
    return null;
  }, [photo?.uri, existingPhotoUrl]);

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
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop:
                Platform.OS === 'android'
                  ? (StatusBar.currentHeight || 0) + 4
                  : (insets.top || 0) + 4,
              paddingBottom: 28 + insets.bottom,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerTop}>
            <View style={styles.headerTopRow}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() =>
                  runGuardedPress('edit-visit:header-back', () =>
                    navigation.navigate('Visit'),
                  )
                }
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="arrow-back-ios-new"
                  size={18}
                  color={THEME.primary}
                />
              </TouchableOpacity>
              <View style={styles.headerTitleWrap}>
                <Text style={styles.title}>
                  {isManager ? 'Detail Visit' : 'Visit'}
                </Text>
                <Text style={styles.subtitle}>
                  {isManager ? 'Informasi kunjungan sales' : 'Edit Kunjungan'}
                </Text>
              </View>
              <View style={styles.headerRightSpacer} />
            </View>
          </View>

          {/* Sales (cabang) */}
          <View style={styles.card}>
            <Text style={styles.label}>Sales (Cabang)</Text>
            <View style={[styles.inputWrap, { opacity: 0.7 }]}>
              <TextInput
                value={`${namaSales} (${cabang})`}
                editable={false}
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>Tanggal Visit</Text>
            <TouchableOpacity
              onPress={() => !isManager && setShowDate(true)}
              activeOpacity={isManager ? 1 : 0.9}
              style={styles.selectWrap}
            >
              <Text
                style={[styles.selectText, !tanggal && { color: THEME.muted }]}
              >
                {tanggal ? formatDisplayDate(tanggal) : 'Pilih Tanggal'}
              </Text>
              {!isManager && (
                <MaterialIcons
                  name="edit-calendar"
                  size={22}
                  color={THEME.ink}
                />
              )}
            </TouchableOpacity>

            {showDate && (
              <DateTimePicker
                value={tanggal ? ymdToDate(normalizeYmd(tanggal)) : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={(event: any, selected?: Date) => {
                  setShowDate(false);
                  if (selected) setTanggal(dateToYmd(selected));
                }}
              />
            )}

            {/* Customer */}
            <Text style={styles.label}>Customer</Text>
            <View style={styles.row}>
              <View
                style={[
                  styles.inputWrap,
                  { flex: 1, marginBottom: 0, opacity: 1 },
                ]}
              >
                <TextInput
                  value={customer}
                  editable={false}
                  selectTextOnFocus={false}
                  placeholder="Customer"
                  placeholderTextColor={THEME.muted}
                  style={styles.input}
                />
              </View>
            </View>

            {!!customerKode && (
              <Text style={styles.helper}>Kode: {customerKode}</Text>
            )}

            {/* LOKASI */}
            <Text style={[styles.label, { marginTop: 14 }]}>Lokasi</Text>
            <View style={styles.row}>
              <View style={[styles.inputWrap, { flex: 1, marginBottom: 0 }]}>
                <TextInput
                  value={latitude}
                  editable={false}
                  placeholder="Latitude"
                  placeholderTextColor={THEME.muted}
                  style={styles.input}
                />
              </View>
              <View style={[styles.inputWrap, { flex: 1, marginBottom: 0 }]}>
                <TextInput
                  value={longitude}
                  editable={false}
                  placeholder="Longitude"
                  placeholderTextColor={THEME.muted}
                  style={styles.input}
                />
              </View>
            </View>

            {!isManager && (
              <TouchableOpacity
                onPress={() =>
                  runGuardedPress('edit-visit:get-location', ambilLokasi, 800)
                }
                style={styles.btnAccent}
                activeOpacity={0.9}
              >
                <Text style={styles.btnAccentText}>AMBIL LOKASI</Text>
              </TouchableOpacity>
            )}

            {/* Preview Peta Interaktif & Tombol Google Maps */}
            {hasValidCoord ? (
              <View style={styles.mapWrapper}>
                <WebView
                  originWhitelist={['*']}
                  source={{ html: mapHtml }}
                  style={styles.mapWebView}
                  nestedScrollEnabled
                  javaScriptEnabled
                  domStorageEnabled
                  scalesPageToFit={Platform.OS === 'android'}
                  androidLayerType="hardware"
                />
                <View style={styles.mapActionsRow}>
                  <Text style={styles.mapCoordText} numberOfLines={1}>
                    📍 {latNum.toFixed(5)}, {lngNum.toFixed(5)}
                  </Text>
                  <TouchableOpacity
                    style={styles.btnGmaps}
                    activeOpacity={0.85}
                    onPress={() =>
                      runGuardedPress(
                        'edit-visit:open-gmaps',
                        bukaGoogleMaps,
                        800,
                      )
                    }
                  >
                    <MaterialIcons name="navigation" size={14} color="#FFF" />
                    <Text style={styles.btnGmapsText}>Buka Google Maps</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.mapEmptyBox}>
                <MaterialIcons
                  name="location-off"
                  size={18}
                  color={THEME.muted}
                />
                <Text style={styles.mapEmptyText}>
                  Koordinat belum tersedia. Tekan 'AMBIL LOKASI' untuk memuat
                  peta.
                </Text>
              </View>
            )}

            {/* Foto */}
            <Text style={styles.label}>Foto</Text>
            {photoPreviewUri ? (
              <>
                <TouchableOpacity
                  style={styles.imageCardBtn}
                  activeOpacity={0.85}
                  onPress={() => setPreviewModalUrl(photoPreviewUri)}
                >
                  <Image
                    source={{ uri: photoPreviewUri }}
                    style={styles.photo}
                    resizeMode="cover"
                  />
                  <View style={styles.imageZoomBadge}>
                    <MaterialIcons name="zoom-in" size={14} color="#FFF" />
                    <Text style={styles.imageZoomText}>Lihat Foto</Text>
                  </View>
                </TouchableOpacity>
                {photo?.sizeBytes ? (
                  <Text style={styles.photoMeta}>
                    Size: {(photo.sizeBytes / 1024).toFixed(0)} KB
                  </Text>
                ) : (
                  <Text style={styles.photoMeta}>Size: -</Text>
                )}
              </>
            ) : (
              <View style={styles.photoEmpty}>
                <Text style={{ color: THEME.muted, fontWeight: '800' }}>
                  Belum ada foto
                </Text>
              </View>
            )}

            {uploadPending && !isManager && (
              <TouchableOpacity
                onPress={() =>
                  runGuardedPress('edit-visit:retry-upload', uploadUlang, 800)
                }
                disabled={loading}
                style={[styles.btnPrimary, { marginTop: 10 }]}
                activeOpacity={0.9}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnPrimaryText}>UPLOAD ULANG FOTO</Text>
                )}
              </TouchableOpacity>
            )}

            {!isManager && (
              <View style={styles.row}>
                <TouchableOpacity
                  onPress={() =>
                    runGuardedPress(
                      'edit-visit:pick-camera',
                      pickFromCamera,
                      800,
                    )
                  }
                  style={[styles.btnSoft, { flex: 1 }]}
                  activeOpacity={0.9}
                >
                  <Text style={styles.btnSoftText}>KAMERA</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    runGuardedPress(
                      'edit-visit:pick-gallery',
                      pickFromGallery,
                      800,
                    )
                  }
                  style={[styles.btnSoft, { flex: 1 }]}
                  activeOpacity={0.9}
                >
                  <Text style={styles.btnSoftText}>GALERI</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Keperluan */}
            <Text style={styles.label}>Keperluan</Text>
            <View style={[styles.textAreaWrap]}>
              <TextInput
                value={note}
                onChangeText={setNote}
                editable={!isManager}
                placeholder="Tulis keperluan..."
                placeholderTextColor={THEME.muted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                style={[styles.input, { height: 90, paddingTop: 10 }]}
              />
            </View>

            {/* Hasil */}
            <Text style={styles.label}>Hasil</Text>
            <View style={[styles.textAreaWrap]}>
              <TextInput
                value={catatan}
                onChangeText={setCatatan}
                editable={!isManager}
                placeholder="Tulis hasil kunjungan..."
                placeholderTextColor={THEME.muted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={[styles.input, { height: 110, paddingTop: 10 }]}
              />
            </View>

            {isManager ? (
              <TouchableOpacity
                onPress={() =>
                  runGuardedPress('edit-visit:back', () => navigation.goBack())
                }
                style={styles.btnPrimary}
                activeOpacity={0.9}
              >
                <Text style={styles.btnPrimaryText}>KEMBALI</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  onPress={simpan}
                  disabled={!canSubmit}
                  style={[styles.btnPrimary, !canSubmit && { opacity: 0.55 }]}
                  activeOpacity={0.9}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnPrimaryText}>UPDATE VISIT</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() =>
                    runGuardedPress('edit-visit:cancel', () =>
                      navigation.goBack(),
                    )
                  }
                  disabled={loading}
                  style={styles.btnGhost}
                  activeOpacity={0.9}
                >
                  <Text style={styles.btnGhostText}>Batal</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal View Image Fullscreen */}
      <Modal
        visible={Boolean(previewModalUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewModalUrl(null)}
      >
        <View style={styles.fullImageModalOverlay}>
          <TouchableOpacity
            style={styles.closeFullImageBtn}
            onPress={() => setPreviewModalUrl(null)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          {previewModalUrl && (
            <Image
              source={{ uri: previewModalUrl }}
              style={styles.fullModalImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
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

  headerTop: { marginBottom: 12 },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
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
  headerRightSpacer: {
    width: 38,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: THEME.ink,
    letterSpacing: 0.2,
  },
  subtitle: {
    color: THEME.muted,
    fontSize: 12,
    marginTop: 6,
    fontWeight: '700',
    textAlign: 'center',
  },

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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 12,
    height: 45,
    marginBottom: 12,
  },

  selectWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.soft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 12,
    height: 45,
    marginBottom: 12,
  },

  input: { flex: 1, color: THEME.ink, fontSize: 15, fontWeight: '600' },
  selectText: { flex: 1, color: THEME.ink, fontSize: 14, fontWeight: '600' },

  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 10,
  },

  helper: {
    color: THEME.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: -4,
    marginLeft: 4,
  },

  btnPrimary: {
    marginTop: 14,
    height: 45,
    borderRadius: 10,
    backgroundColor: THEME.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', letterSpacing: 0.4 },

  btnSoft: {
    height: 45,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(79,70,229,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSoftText: {
    color: THEME.primary,
    fontWeight: '700',
    letterSpacing: 0.4,
    fontSize: 12,
  },

  btnAccent: {
    marginTop: 4,
    height: 45,
    borderRadius: 10,
    backgroundColor: 'rgba(6,182,212,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  btnAccentText: {
    color: THEME.ink,
    fontWeight: '700',
    letterSpacing: 0.3,
    fontSize: 12,
  },

  btnGhost: { marginTop: 10, alignItems: 'center', paddingVertical: 10 },
  btnGhostText: { color: THEME.muted, fontWeight: '700' },

  imageCardBtn: {
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 6,
  },
  photo: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  imageZoomBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  imageZoomText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  photoMeta: {
    color: THEME.muted,
    fontSize: 12,
    marginTop: 8,
    fontWeight: '600',
  },

  // Full Image Modal
  fullImageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeFullImageBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  fullModalImage: {
    width: '95%',
    height: '80%',
  },

  // Map Preview
  mapWrapper: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.line,
    backgroundColor: THEME.soft,
    marginBottom: 6,
  },
  mapWebView: {
    width: '100%',
    height: 190,
    backgroundColor: '#E2E8F0',
  },
  mapActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: THEME.line,
    gap: 8,
  },
  mapCoordText: {
    fontSize: 11.5,
    color: THEME.muted,
    fontWeight: '700',
    flex: 1,
  },
  btnGmaps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnGmapsText: {
    color: '#FFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  mapEmptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: THEME.soft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.line,
    marginTop: 6,
    marginBottom: 6,
  },
  mapEmptyText: {
    flex: 1,
    fontSize: 11.5,
    color: THEME.muted,
    fontWeight: '600',
  },

  photoEmpty: {
    width: '100%',
    height: 120,
    borderRadius: 10,
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 12,
    paddingTop: 10,
    marginBottom: 10,
  },
});
