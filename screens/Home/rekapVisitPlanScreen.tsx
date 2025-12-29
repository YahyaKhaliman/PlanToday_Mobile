/* eslint-disable react-native/no-inline-styles */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    StatusBar,
    Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../../services/api';
import { useAuth } from '../../context/authContext';
import { Linking } from 'react-native';
import { GlassSelect } from '../Register/glassSelect';
import Toast from 'react-native-toast-message';

type RekapItem = {
    id: number;
    tanggal_plan: string;
    cus_kode: string;
    cc_nama: string;
    cc_alamat: string;
    note: string;
    catatan: string;
    label_status: string;
};

type Karyawan = {
    kar_nama: string;
    kar_cabang: string;
    kar_jabatan: string;
};

export default function RekapVisitPlanScreen() {
    const { user } = useAuth();

    const jabatan = user?.jabatan || '';
    const isManager = jabatan === 'MANAGER';

    const namaUser = user?.nama || '';

    const [tanggal, setTanggal] = useState(new Date().toISOString().substring(0, 10));
    const [showDate, setShowDate] = useState(false);

    const [data, setData] = useState<RekapItem[]>([]);
    const [loading, setLoading] = useState(false);

    const CABANG_VALUES = useMemo(() => ['PUSAT', 'JATIM', 'JATENG', 'JAKARTA'], []);
    const [selectedCabang, setSelectedCabang] = useState<string>(() => {
        const cab = String(user?.cabang || 'PUSAT').toUpperCase();
        return CABANG_VALUES.includes(cab) ? cab : 'PUSAT';
    });
    const [openCabang, setOpenCabang] = useState(false);

    const [loadingSales, setLoadingSales] = useState(false);
    const [listSales, setListSales] = useState<string[]>([]);
    const [selectedSales, setSelectedSales] = useState<string>(''); // manager pilih sales
    const [openSales, setOpenSales] = useState(false);

    const formatDisplayDate = useCallback((ymd: string) => {
        try {
        const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
        const dt = new Date(y, m - 1, d);
        const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        return `${dt.getDate()} ${bulan[dt.getMonth()]} ${dt.getFullYear()}`;
        } catch {
        return ymd;
        }
    }, []);

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

    const cabangOptions = useMemo(
        () => CABANG_VALUES.map((c) => ({ label: c, value: c })),
        [CABANG_VALUES]
    );

    const salesOptions = useMemo(
        () => listSales.map((n) => ({ label: n, value: n })),
        [listSales]
    );

    useEffect(() => {
        if (isManager) return;
        const cab = String(user?.cabang || '').toUpperCase();
        if (cab && CABANG_VALUES.includes(cab)) setSelectedCabang(cab);
        setSelectedSales(namaUser); 
    }, [isManager, user?.cabang, namaUser, CABANG_VALUES]);

    const fetchSalesByCabang = useCallback(
        async (cabang: string) => {
        if (!isManager) return;

        setLoadingSales(true);
        try {
            const res = await api.get('/karyawan', { params: { cabang } });

            const raw = res.data?.data ?? res.data;
            const arr: Karyawan[] = Array.isArray(raw) ? raw : [];

            const names = arr
            .filter((x) => String(x?.kar_jabatan || '').toUpperCase() === 'SALES')
            .map((x) => String(x?.kar_nama || '').trim())
            .filter(Boolean);

            const uniqueSorted = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));

            setListSales(uniqueSorted);
        } catch (err) {
            console.log('Fetch Sales By Cabang Error:', err);
            setListSales([]);
            setSelectedSales('');
        } finally {
            setLoadingSales(false);
        }
        },
        [isManager]
    );

    useEffect(() => {
        if (!isManager) return;
        setListSales([]);
        setSelectedSales('');
        fetchSalesByCabang(selectedCabang);
    }, [isManager, selectedCabang, fetchSalesByCabang]);

    const userParam = useMemo(() => {
        return isManager ? selectedSales : namaUser;
    }, [isManager, selectedSales, namaUser]);

    const refresh = useCallback(async () => {
        if (!userParam) {
        Toast.show({
            type: 'glassError',
            text1: 'Validasi',
            text2: isManager ? 'Pilih Sales terlebih dahulu' : 'Login terlebih dahulu'
        })
        return;
        }

        setLoading(true);
        try {
        const res = await api.get('/rekap-visit-plan', {
            params: { user: userParam, tanggal },
        });
        setData(res.data.data);
        } catch (err: any) {
        Toast.show({
            type: 'glassError',
            text1: 'Error',
            text2: err?.response?.data?.message || 'Gagal mengambil data rekap'
        })
        setData([]);
        } finally {
        setLoading(false);
        }
    }, [userParam, tanggal, isManager]);

    useEffect(() => {
        if (!isManager) {
        refresh();
        return;
        }
        if (selectedSales) refresh();
    }, [refresh, isManager, selectedSales]);

    const kirimWA = useCallback(async () => {
        if (!userParam) {
        Toast.show({
            type: 'glassError',
            text1: 'Validasi',
            text2: isManager ? 'Pilih Sales terlebih dahulu' : 'Login terlebih dahulu'
        })
        return;
        }

        try {
        const res = await api.get('/rekap-visit-plan/wa', {
            params: { user: userParam, tanggal },
        });

        const waText = res.data?.wa_text;
        if (!waText) {
            Toast.show({
                type: 'glassError',
                text1: 'Info',
                text2: 'Data WA tidak tersedia'
            })
            return;
        }

        const url = `whatsapp://send?text=${encodeURIComponent(waText)}`;
        const canOpen = await Linking.canOpenURL(url);

        if (!canOpen) {
            Toast.show({
                type: 'glassError',
                text1: 'Info',
                text2: 'WhatsApp tidak ditemukan di device'
            })
            return;
        }

        await Linking.openURL(url);
        } catch (err: any) {
        Toast.show({
            type: 'glassError',
            text1: 'Error',
            text2: err?.response?.data?.message || ' Gagal membuat rekap WA'
        })
        }
    }, [userParam, tanggal, isManager]);

    const renderItem = ({ item }: { item: RekapItem }) => {
    const done = String(item.label_status || '').toLowerCase() === 'done';

    return (
        <View style={styles.cardItem}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.itemTitle}>{item.cc_nama || '-'}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                {item.cus_kode || '-'}
            </Text>
            </View>

            <View
            style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: done ? 'rgba(255,255,255,0.22)'  : 'rgba(255,255,255,0.22)' ,
                backgroundColor: done ? 'rgba(76, 175, 80, 0.22)' : 'rgba(244, 67, 54, 0.22)',
            }}
            >
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.4 }}>
                {done ? 'DONE' : 'BELUM'}
            </Text>
            </View>
        </View>

        <Text style={styles.itemSub}>📍 {item.cc_alamat || '-'}</Text>
        <Text style={styles.itemSub}>📝 Catatan: {item.note || '-'}</Text>

        {!!item.catatan && String(item.catatan).trim().length > 0 && (
            <Text style={styles.itemSub}>🗒️ Catatan: {item.catatan}</Text>
        )}

        <Text style={styles.itemMeta}>• Tanggal Plan: {item.tanggal_plan}</Text>
        </View>
    );
    };

    const ListHeader = (
        <View>     
        <View style={styles.header}>
            <Text style={styles.title}>Rekap Visit Plan</Text>
            <Text style={styles.subtitle}>
            {isManager ? 'PILIH CABANG → PILIH SALES → PILIH TANGGAL' : 'Cek rencana kunjungan per tanggal'}
            </Text>
        </View>

        <View style={styles.filterCard}>
            <GlassSelect
            label="Cabang"
            value={selectedCabang}
            options={cabangOptions}
            visible={openCabang}
            onOpen={() => {
                if (!isManager) return;
                setOpenCabang(true);
            }}
            onClose={() => setOpenCabang(false)}
            onSelect={(v) => setSelectedCabang(v)}
            />

            {isManager ? (
            <>
                <GlassSelect
                label={loadingSales ? 'Sales (memuat...)' : 'Sales'}
                value={selectedSales || (loadingSales ? 'Loading...' : '')}
                options={salesOptions}
                visible={openSales}
                onOpen={() => {
                    if (loadingSales) return;
                    setOpenSales(true);
                }}
                onClose={() => setOpenSales(false)}
                onSelect={(v) => setSelectedSales(v)}
                />
            </>
            ) : (
            <>
                <Text style={styles.label}>Sales</Text>
                <View style={[styles.glassInputContainer, { opacity: 0.8 }]}>
                <Text style={styles.icon}>👤</Text>
                <Text style={styles.inputText}>{namaUser || '-'}</Text>
                </View>
            </>
            )}

            {/* Tanggal */}
            <Text style={styles.label}>Tanggal</Text>
            <TouchableOpacity onPress={() => setShowDate(true)} activeOpacity={0.85} style={styles.glassSelect}>
            <Text style={styles.selectText}>{formatDisplayDate(tanggal)}</Text>
            <Text style={styles.iconRight}>📅</Text>
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

            {/* Buttons */}
            <View style={styles.rowBtn}>
            <TouchableOpacity
                style={[styles.primaryButton, { flex: 1 }]}
                onPress={refresh}
                disabled={loading || (isManager && (!selectedSales || loadingSales))}
                activeOpacity={0.85}
            >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>REFRESH</Text>}
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.waButton, { flex: 1 }]}
                onPress={kirimWA}
                disabled={loading || (isManager && (!selectedSales || loadingSales))}
                activeOpacity={0.85}
            >
                <Text style={styles.primaryButtonText}>KIRIM WA</Text>
            </TouchableOpacity>
            </View>

            <Text style={styles.helperText}>
            Menampilkan: <Text style={{ fontWeight: '900' }}>{data.length}</Text> data
            </Text>
        </View>
        </View>
    );

    return (
        <LinearGradient colors={['#5D59A2', '#3B3A82', '#1E224F']} style={styles.container}>
        <StatusBar barStyle="light-content" />

        <FlatList
            data={data}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={loading ? null : <Text style={styles.empty}>Data tidak ditemukan.</Text>}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
        />
        </LinearGradient>
    );
    }

    const styles = StyleSheet.create({
    container: { flex: 1 },

    listContent: {
        paddingHorizontal: 20,
        paddingTop: 26,
        paddingBottom: 26,
    },

    header: { alignItems: 'center', marginBottom: 12 },
    title: { fontSize: 28, fontWeight: '300', color: '#fff', letterSpacing: 1 },
    subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 6 },

    filterCard: {
        backgroundColor: 'rgba(255,255,255,0.10)',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.20)',
        marginBottom: 14,
    },

    label: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 8,
        marginLeft: 5,
        marginTop: 10,
    },

    // view-only input (sales)
    glassInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.30)',
        paddingHorizontal: 15,
        height: 55,
    },
    icon: { fontSize: 18, marginRight: 10 },
    inputText: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '600' },

    glassSelect: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.30)',
        paddingHorizontal: 15,
        height: 55,
        marginBottom: 6,
    },
    selectText: { color: '#fff', fontSize: 16, flex: 1, fontWeight: '500' },
    iconRight: { fontSize: 18, marginLeft: 10 },

    rowBtn: { flexDirection: 'row', gap: 10, marginTop: 14 },

    primaryButton: {
        backgroundColor: '#233975',
        borderRadius: 30,
        paddingVertical: 14,
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    waButton: {
        backgroundColor: '#25D366',
        borderRadius: 30,
        paddingVertical: 14,
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 1 },

    helperText: {
        marginTop: 12,
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        textAlign: 'center',
    },

    // item card glass
    cardItem: {
        backgroundColor: 'rgba(255,255,255,0.10)',
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.20)',
        marginBottom: 10,
    },
    itemTitle: { color: '#fff', fontSize: 15, fontWeight: '900' },
    itemSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 6 },
    itemMeta: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 10 },
    itemHint: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 8, fontWeight: '700' },

    empty: { textAlign: 'center', marginTop: 14, color: 'rgba(255,255,255,0.65)', fontSize: 13 },
});
