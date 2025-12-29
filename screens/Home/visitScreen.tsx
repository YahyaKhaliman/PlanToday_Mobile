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

import api from '../../services/api';
import { useAuth } from '../../context/authContext';

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

    async function compressToUnderLimit(inputUri: string): Promise<{ uri: string; sizeBytes: number }> {
    const inputFileUri = toFileUri(inputUri);

    // Kalau file sudah kecil, tidak perlu kompres (tapi kadang kamera besar, jadi biasanya tetap kompres)
    // Di sini kita tetap coba preset pertama agar konsisten.
    for (const preset of COMPRESS_PRESETS) {
        const resized = await ImageResizer.createResizedImage(
        inputFileUri,
        preset.max,
        preset.max,
        'JPEG',
        preset.quality,
        0
        );

        const outUri = toFileUri(resized.uri);
        const stat = await RNBlobUtil.fs.stat(stripFileScheme(outUri));
        const sizeBytes = Number(stat.size || 0);

        console.log('COMPRESS RESULT:', { outUri, sizeBytes, preset });

        if (sizeBytes > 0 && sizeBytes <= MAX_UPLOAD_BYTES) {
        return { uri: outUri, sizeBytes };
        }
    }

    // kalau masih > limit, tetap kembalikan hasil terakhir (paling kecil)
    const lastPreset = COMPRESS_PRESETS[COMPRESS_PRESETS.length - 1];
    const last = await ImageResizer.createResizedImage(inputFileUri, lastPreset.max, lastPreset.max, 'JPEG', lastPreset.quality, 0);
    const lastUri = toFileUri(last.uri);
    const statLast = await RNBlobUtil.fs.stat(stripFileScheme(lastUri));
    const lastSize = Number(statLast.size || 0);

    return { uri: lastUri, sizeBytes: lastSize };
    }

    export default function VisitScreen({ navigation, route }: any) {
    const { user } = useAuth();

    const [cabang] = useState(user?.cabang || '');
    const [namaSales] = useState(user?.nama || '');
    const [tanggal, setTanggal] = useState(new Date().toISOString().substring(0, 10));

    const [customer, setCustomer] = useState('');
    const [customerKode, setCustomerKode] = useState('');

    const [note, setNote] = useState('');
    const [catatan, setCatatan] = useState('');

    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');

    const [photo, setPhoto] = useState<PhotoState | null>(null);

    const [loading, setLoading] = useState(false);
    const [showDate, setShowDate] = useState(false);
    const [planLoaded, setPlanLoaded] = useState(false);

    const [lastVisitId, setLastVisitId] = useState<number | null>(null);
    const [uploadPending, setUploadPending] = useState(false);

    // =========================
    // Load Visit Plan jika ada
    // =========================
    const loadPlanIfAny = async (cusKode: string, ymdTanggal: string) => {
        if (!cusKode?.trim()) return;
        try {
        const resp = await api.get('/rekap-visit-detail', {
            params: { user: namaSales, tanggal: ymdTanggal, cus_kode: cusKode.trim() },
        });

        const plan = resp.data?.data;
        if (plan) {
            setNote((prev) => (prev?.trim() ? prev : plan.note || ''));
            setCatatan((prev) => (prev?.trim() ? prev : plan.catatan || ''));
            setPlanLoaded(true);

            Toast.show({
            type: 'glassSuccess',
            text1: 'Visit Plan ditemukan',
            text2: 'Keperluan & Catatan terisi otomatis',
            });
        } else {
            setPlanLoaded(false);
        }
        } catch {
        setPlanLoaded(false);
        }
    };

    useEffect(() => {
        const selected = route?.params?.selectedCustomer;
        if (selected) {
        setCustomerKode(String(selected.kode || ''));
        setCustomer(String(selected.nama || ''));
        setNote('');
        setCatatan('');
        setPlanLoaded(false);
        }
    }, [route?.params?.selectedCustomer]);

    useEffect(() => {
        if (customerKode && tanggal) loadPlanIfAny(customerKode, tanggal);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customerKode, tanggal]);

    const canSubmit = useMemo(() => customer.trim().length > 0 && customerKode.trim().length > 0 && !loading, [
        customer,
        customerKode,
        loading,
    ]);

    // =========================
    // Location
    // =========================
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

    // =========================
    // Foto
    // =========================
    const setPhotoFromAsset = async (asset: Asset) => {
        if (!asset?.uri) return;

        const originalUri = toFileUri(asset.uri);
        const originalSize = asset.fileSize;

        console.log('PHOTO ORIGINAL:', { originalUri, originalSize, type: asset.type, name: asset.fileName });

        Toast.show({ type: 'glassSuccess', text1: 'Foto dipilih', text2: 'Mengompres foto...' });

        const { uri: compressedUri, sizeBytes } = await compressToUnderLimit(originalUri);

        const finalName = safeFileName(asset.fileName, `visit_${Date.now()}.jpg`);

        setPhoto({
        uri: compressedUri,
        name: finalName,
        type: 'image/jpeg',
        sizeBytes,
        });

        if (sizeBytes > MAX_UPLOAD_BYTES) {
        Toast.show({
            type: 'glassError',
            text1: 'Foto masih terlalu besar',
            text2: `Hasil kompres ${(sizeBytes / 1024 / 1024).toFixed(2)} MB > 1 MB. Turunkan kualitas/resolusi lagi.`,
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

        // Optional guard: jangan upload kalau hasil kompres > limit
        if (photo.sizeBytes && photo.sizeBytes > MAX_UPLOAD_BYTES) {
        throw new Error('Ukuran foto masih > 1MB. Turunkan kualitas/resolusi kompres.');
        }

        const baseURL = (api as any)?.defaults?.baseURL; // contoh: http://127.0.0.1:3000/api
        if (!baseURL) throw new Error('baseURL api belum ter-set');

        const url = `${baseURL}/visits/${visitId}/photo`;
        const filePath = stripFileScheme(photo.uri);

        console.log('UPLOAD (blob):', { url, filePath, name: photo.name, type: photo.type, size: photo.sizeBytes });

        const resp = await RNBlobUtil.fetch(
        'POST',
        url,
        { Accept: 'application/json' },
        [
            {
            name: 'file', // harus sama dengan multer.single('file')
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

    // =========================
    // Simpan visit
    // =========================
    const resetForm = () => {
        setCustomer('');
        setCustomerKode('');
        setNote('');
        setCatatan('');
        setPlanLoaded(false);
        setTanggal(new Date().toISOString().substring(0, 10));
        setLatitude('');
        setLongitude('');
    };

    const simpan = async () => {
        if (!customer.trim() || !customerKode.trim()) {
        Toast.show({ type: 'glassError', text1: 'Validasi Gagal', text2: 'Customer harus dipilih terlebih dahulu' });
        return;
        }

        setLoading(true);
        try {
        const payload = {
            cus_kode: customerKode.trim(),
            customer_text: customer.trim(),
            tanggal,
            user: namaSales,
            cabang,
            latitude: latitude?.trim() || null,
            longitude: longitude?.trim() || null,
            note: note.trim() || '',
            catatan: catatan.trim() || '',
        };

        const res = await api.post('/visits', payload);
        if (!res.data?.success) throw new Error(res.data?.message || 'Gagal menyimpan data');

        const createdId = res.data?.data?.id as number | undefined;
        setLastVisitId(createdId || null);

        if (createdId && photo?.uri) {
            try {
            await uploadPhoto(createdId);
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
        Toast.show({ type: 'glassSuccess', text1: 'Simpan Berhasil', text2: res.data?.message || 'Kunjungan tersimpan' });
        setTimeout(() => navigation.navigate('Home'), 500);
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

    // =========================
    // UI
    // =========================
    return (
        <LinearGradient colors={['#5D59A2', '#3B3A82', '#1E224F']} style={styles.container}>
        <StatusBar barStyle="light-content" />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
                <Text style={styles.title}>Visit</Text>
                <Text style={styles.subtitle}>Input Kunjungan</Text>
            </View>

            <View style={styles.formCard}>
                <Text style={styles.label}>Sales (Cabang)</Text>
                <View style={[styles.glassInputContainer, { opacity: 0.7 }]}>
                <Text style={styles.icon}>👤</Text>
                <TextInput value={`${namaSales} (${cabang})`} editable={false} style={styles.input} />
                </View>

                <Text style={styles.label}>Tanggal Visit</Text>
                <TouchableOpacity onPress={() => setShowDate(true)} activeOpacity={0.8} style={styles.glassSelect}>
                <Text style={styles.selectText}>{formatDisplayDate(tanggal)}</Text>
                <Text style={styles.icon}>📅</Text>
                </TouchableOpacity>

                {showDate && (
                <DateTimePicker
                    value={ymdToDate(tanggal)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event: any, selected?: Date) => {
                    setShowDate(false);
                    if (selected) setTanggal(dateToYmd(selected));
                    }}
                />
                )}

                <Text style={styles.label}>Customer</Text>
                <View style={styles.customerRow}>
                <View style={[styles.glassInputContainer, { flex: 1, marginBottom: 0 }]}>
                    <Text style={styles.icon}>🏢</Text>
                    <TextInput
                    value={customer}
                    onChangeText={(t) => {
                        setCustomer(t);
                        if (customerKode) setCustomerKode('');
                        setPlanLoaded(false);
                    }}
                    placeholder="Pilih Customer"
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    style={styles.input}
                    />
                </View>

                <TouchableOpacity
                    onPress={() => navigation.navigate('CariCustomer', { keyword: customer, from: 'VISIT' })}
                    style={styles.searchBtn}
                >
                    <Text style={styles.searchBtnText}>CARI</Text>
                </TouchableOpacity>
                </View>

                {!!customerKode && <Text style={styles.helperText}>Terpilih: {customerKode}</Text>}
                {planLoaded && (
                <Text style={{ color: '#7CFFB2', fontSize: 12, marginLeft: 5, marginTop: 2 }}>
                    Keperluan & catatan terisi dari Visit Plan
                </Text>
                )}

                <Text style={[styles.label, { marginTop: 16 }]}>Lokasi</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[styles.glassInput, { flex: 1, opacity: 0.9 }]}>
                    <TextInput value={latitude} editable={false} placeholder="Latitude" placeholderTextColor="rgba(255,255,255,0.55)" style={styles.input} />
                </View>
                <View style={[styles.glassInput, { flex: 1, opacity: 0.9 }]}>
                    <TextInput value={longitude} editable={false} placeholder="Longitude" placeholderTextColor="rgba(255,255,255,0.55)" style={styles.input} />
                </View>
                </View>

                <TouchableOpacity onPress={ambilLokasi} style={styles.searchBtn}>
                <Text style={styles.searchBtnText}>AMBIL LOKASI</Text>
                </TouchableOpacity>

                <Text style={styles.label}>Foto</Text>
                {photo?.uri ? (
                <>
                    <Image
                    source={{ uri: photo.uri }}
                    style={{
                        width: '100%',
                        height: 180,
                        borderRadius: 15,
                        marginTop: 12,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.2)',
                    }}
                    resizeMode="cover"
                    />
                    <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 8 }}>
                    Size: {photo.sizeBytes ? `${(photo.sizeBytes / 1024).toFixed(0)} KB` : '-'}
                    </Text>
                </>
                ) : (
                <View style={styles.photoEmpty}>
                    <Text style={{ color: 'rgba(255,255,255,0.6)' }}>Belum ada foto</Text>
                </View>
                )}

                {uploadPending && (
                <TouchableOpacity onPress={uploadUlang} disabled={loading} style={[styles.primaryButton, { marginTop: 12 }]}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>UPLOAD ULANG FOTO</Text>}
                </TouchableOpacity>
                )}

                <View style={styles.customerRow}>
                <TouchableOpacity onPress={pickFromCamera} style={[styles.searchBtn, { flex: 1 }]}>
                    <Text style={styles.searchBtnText}>KAMERA</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={pickFromGallery} style={[styles.searchBtn, { flex: 1 }]}>
                    <Text style={styles.searchBtnText}>GALERI</Text>
                </TouchableOpacity>
                </View>

                <Text style={styles.label}>Catatan</Text>
                <View style={[styles.glassInputContainer, styles.textAreaContainer]}>
                <Text style={[styles.icon, { marginTop: 4 }]}>📝</Text>
                <TextInput
                    value={note}
                    onChangeText={(t) => {
                    setNote(t);
                    if (t?.trim()) setPlanLoaded(false);
                    }}
                    placeholder="Tulis catatan..."
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    style={[styles.input, { height: 90, paddingTop: 10 }]}
                />
                </View>

                <Text style={styles.label}>Keperluan</Text>
                <View style={[styles.glassInputContainer, styles.textAreaContainer]}>
                <Text style={[styles.icon, { marginTop: 4 }]}>🗒️</Text>
                <TextInput
                    value={catatan}
                    onChangeText={(t) => {
                    setCatatan(t);
                    if (t?.trim()) setPlanLoaded(false);
                    }}
                    placeholder="Tulis keperluan..."
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    style={[styles.input, { height: 110, paddingTop: 10 }]}
                />
                </View>

                <TouchableOpacity onPress={simpan} disabled={!canSubmit} style={[styles.primaryButton, !canSubmit && { opacity: 0.5 }]}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>SIMPAN VISIT</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.goBack()} disabled={loading} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Batal</Text>
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
        flexGrow: 1,
        paddingHorizontal: 25,
        paddingVertical: 40,
        justifyContent: 'center',
    },
    header: { alignItems: 'center', marginBottom: 30 },
    title: { fontSize: 32, fontWeight: '300', color: '#fff', letterSpacing: 1 },
    subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 5 },

    formCard: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    label: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 8,
        marginLeft: 5,
        marginTop: 10,
    },
    glassInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        paddingHorizontal: 15,
        marginBottom: 15,
        height: 55,
    },
    textAreaContainer: {
        height: 130,
        alignItems: 'flex-start',
    },
    glassSelect: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        paddingHorizontal: 15,
        height: 55,
        marginBottom: 15,
    },
    selectText: { color: '#fff', fontSize: 16, flex: 1, fontWeight: '500' },
    icon: { fontSize: 18, marginRight: 10 },
    input: { flex: 1, color: '#fff', fontSize: 16 },

    customerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 15,
    },
    searchBtn: {
        backgroundColor: '#233975',
        height: 55,
        paddingHorizontal: 16,
        borderRadius: 15,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
    },
    searchBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12, letterSpacing: 1 },

    helperText: { color: '#FFD700', fontSize: 12, marginTop: -8, marginBottom: 4, marginLeft: 5 },

    photoEmpty: {
        width: '100%',
        height: 120,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(255,255,255,0.07)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },

    primaryButton: {
        backgroundColor: '#233975',
        borderRadius: 30,
        paddingVertical: 16,
        marginTop: 18,
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1 },

    secondaryButton: {
        marginTop: 15,
        alignItems: 'center',
        paddingVertical: 10,
    },
    glassInput: {
        backgroundColor: 'rgba(255,255,255,0.10)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 10,
    },
    secondaryButtonText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
});
