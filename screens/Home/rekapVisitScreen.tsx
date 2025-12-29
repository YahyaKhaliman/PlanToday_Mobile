/* eslint-disable react-native/no-inline-styles */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Linking,
    StatusBar,
    Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../../services/api';
import { useAuth } from '../../context/authContext';
import { GlassSelect } from '../Register/glassSelect';
import Toast from 'react-native-toast-message';

type Karyawan = {
    kar_nama: string;
    kar_cabang: string;
    kar_jabatan: string;
};

export default function RekapVisitScreen({ _navigation }: any) {
    const { user } = useAuth();
    const isManager = user?.jabatan === 'MANAGER';

    const [loading, setLoading] = useState(false);

    const [tanggal, setTanggal] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    const CABANG_VALUES = useMemo(() => ['PUSAT', 'JATIM', 'JATENG', 'JAKARTA'], []);
    const [selectedCabang, setSelectedCabang] = useState<string>(() => {
        const cab = String(user?.cabang || 'PUSAT').toUpperCase();
        return CABANG_VALUES.includes(cab) ? cab : 'PUSAT';
    });
    const [openCabang, setOpenCabang] = useState(false);

    const [loadingSales, setLoadingSales] = useState(false);
    const [listSales, setListSales] = useState<string[]>([]);
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [openUser, setOpenUser] = useState(false);

    const [rekapData, setRekapData] = useState<any[]>([]);

    const tglFormatted = useMemo(() => tanggal.toISOString().split('T')[0], [tanggal]);

    const formatDisplayDate = useCallback((dt: Date) => {
        const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        return `${dt.getDate()} ${bulan[dt.getMonth()]} ${dt.getFullYear()}`;
    }, []);

    const cabangOptions = useMemo(
        () => CABANG_VALUES.map((c) => ({ label: c, value: c })),
        [CABANG_VALUES]
    );

    const userOptions = useMemo(
        () => listSales.map((n) => ({ label: n, value: n })),
        [listSales]
    );

    // SALES: kunci cabang+user
    useEffect(() => {
        if (!isManager) {
        const cab = String(user?.cabang || '').toUpperCase();
        if (cab && CABANG_VALUES.includes(cab)) setSelectedCabang(cab);
        setSelectedUser(user?.nama || '');
        }
    }, [isManager, user?.cabang, user?.nama, CABANG_VALUES]);

    const fetchSalesByCabang = useCallback(
        async (cabang: string) => {
        if (!isManager) return;

        setLoadingSales(true);
        try {
            const res = await api.get(`/karyawan`, { params: { cabang } });
            const raw = res.data?.data ?? res.data;
            const arr: Karyawan[] = Array.isArray(raw) ? raw : [];

            const names = arr
            .filter((x) => String(x?.kar_jabatan || '').toUpperCase() === 'SALES')
            .map((x) => String(x?.kar_nama || '').trim())
            .filter(Boolean);

            const uniqueSorted = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
            setListSales(uniqueSorted);

            // ✅ auto pilih pertama biar tidak kosong
            if (uniqueSorted.length > 0) setSelectedUser(uniqueSorted[0]);
            else setSelectedUser('');
        } catch (err) {
            console.log('Fetch Sales By Cabang Error:', err);
            setListSales([]);
            setSelectedUser('');
        } finally {
            setLoadingSales(false);
        }
        },
        [isManager]
    );

    useEffect(() => {
        if (!isManager) return;
        setListSales([]);
        setSelectedUser('');
        fetchSalesByCabang(selectedCabang);
    }, [isManager, selectedCabang, fetchSalesByCabang]);

    const handleRefresh = useCallback(async () => {
        if (isManager && !selectedUser) return;

        setLoading(true);
        try {
        const userParam = isManager ? selectedUser : user?.nama;

        const res = await api.get(`/rekap-visit`, {
            params: {
            user: userParam,
            tanggal: tglFormatted,
            cabang: selectedCabang,
            },
        });

        if (res.data?.success) setRekapData(res.data?.data || []);
        else setRekapData([]);
        } catch {
        Toast.show({
            type: 'glassError',
            text1: 'Error',
            text2: 'Gagal mengambil data rekap',
        });
        } finally {
        setLoading(false);
        }
    }, [isManager, selectedUser, user?.nama, tglFormatted, selectedCabang]);

    useEffect(() => {
        handleRefresh();
    }, [handleRefresh]);

    // ✅ Kirim WA ambil dari backend (lebih rapi & konsisten)
    const handleKirimWA = useCallback(async () => {
        if (isManager && !selectedUser) {
        Toast.show({ type: 'glassError', text1: 'Validasi', text2: 'Pilih sales terlebih dahulu' });
        return;
        }

        try {
        const userParam = isManager ? selectedUser : user?.nama;

        const res = await api.get('/rekap-visit/wa', {
            params: {
            user: userParam,
            tanggal: tglFormatted,
            cabang: selectedCabang,
            },
        });

        const waText = res.data?.wa_text;
        if (!waText) {
            Toast.show({ type: 'glassError', text1: 'Info', text2: 'Tidak ada data untuk dikirim' });
            return;
        }

        const url = `whatsapp://send?text=${encodeURIComponent(waText)}`;
        const supported = await Linking.canOpenURL(url);

        if (supported) {
            await Linking.openURL(url);
        } else {
            Toast.show({ type: 'glassError', text1: 'Error', text2: 'Aplikasi WhatsApp tidak terinstall' });
        }
        } catch (err: any) {
        Toast.show({
            type: 'glassError',
            text1: 'Error',
            text2: err?.response?.data?.message || 'Gagal membuat rekap WA',
        });
        }
    }, [isManager, selectedUser, user?.nama, tglFormatted, selectedCabang]);

    const renderItem = ({ item }: any) => {
        const nama = item.cus_nama || item.cc_nama || item.customer_text || '-';
        const alamat = item.cus_alamat || item.cc_alamat || item.cus_alamat_text || 'Alamat tidak ada';
        const note = item.note || 'Tidak ada catatan';
        const status = item.status || '-';
        const isDone = String(status).toUpperCase() === 'DONE';

        return (
        <View style={styles.cardItem}>
            <View style={styles.row}>
            <Text style={styles.cusName}>{nama}</Text>
            <View style={[styles.badge, isDone ? styles.badgeDone : styles.badgeNotDone]}>
                <Text style={styles.badgeText}>{status}</Text>
            </View>
            </View>
            <Text style={styles.subText}>📍 {alamat}</Text>
            <Text style={styles.subText}>📝 {note}</Text>
        </View>
        );
    };

    const ListHeader = (
        <View>
        <View style={styles.header}>
            <Text style={styles.title}>Rekap Visit</Text>
            {isManager ? <Text style={styles.smallHint}>PILIH CABANG → PILIH SALES → PILIH TANGGAL</Text> : null}
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
                value={selectedUser || (loadingSales ? 'Loading...' : '')}
                options={userOptions}
                visible={openUser}
                onOpen={() => {
                    if (loadingSales) return;
                    setOpenUser(true);
                }}
                onClose={() => setOpenUser(false)}
                onSelect={(v) => setSelectedUser(v)}
                />
                {!loadingSales && listSales.length === 0 ? (
                <Text style={styles.smallHint}>Tidak ada SALES di cabang ini</Text>
                ) : null}
            </>
            ) : null}

            <Text style={styles.label}>Tanggal</Text>
            <TouchableOpacity style={styles.glassSelect} onPress={() => setShowDatePicker(true)} activeOpacity={0.85}>
            <Text style={styles.selectText}>{formatDisplayDate(tanggal)}</Text>
            <Text style={styles.iconRight}>📅</Text>
            </TouchableOpacity>

            {showDatePicker && (
            <DateTimePicker
                value={tanggal}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(e, d) => {
                setShowDatePicker(false);
                if (d) setTanggal(d);
                }}
            />
            )}

            <View style={styles.rowBtn}>
            <TouchableOpacity
                style={[styles.primaryButton, { flex: 1 }]}
                onPress={handleRefresh}
                disabled={loading || (isManager && (!selectedUser || loadingSales))}
                activeOpacity={0.85}
            >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>REFRESH</Text>}
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.waButton, { flex: 1 }]}
                onPress={handleKirimWA}
                disabled={loading || (isManager && (!selectedUser || loadingSales))}
                activeOpacity={0.85}
            >
                <Text style={styles.primaryButtonText}>KIRIM WA</Text>
            </TouchableOpacity>
            </View>

            <Text style={styles.helperText}>
            Menampilkan: <Text style={{ fontWeight: '900' }}>{rekapData.length}</Text> data
            </Text>
        </View>
        </View>
    );

    return (
        <LinearGradient colors={['#5D59A2', '#3B3A82', '#1E224F']} style={styles.container}>
        <StatusBar barStyle="light-content" />

        <FlatList
            data={rekapData}
            keyExtractor={(item: any, idx) => String(item.id ?? idx)}
            renderItem={renderItem}
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={loading ? null : <Text style={styles.empty}>Data kunjungan tidak ditemukan</Text>}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 26, paddingBottom: 26 }}
            showsVerticalScrollIndicator={false}
        />
        </LinearGradient>
    );
    }

    const styles = StyleSheet.create({
    container: { flex: 1 },

    header: { alignItems: 'center', marginBottom: 12 },
    title: { fontSize: 28, fontWeight: '300', color: '#fff', letterSpacing: 1 },

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
        marginLeft: 5,
        marginTop: 10,
    },

    smallHint: {
        marginTop: 6,
        color: 'rgba(255,255,255,0.65)',
        fontSize: 12,
        textAlign: 'center',
    },

    glassSelect: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.30)',
        paddingHorizontal: 15,
        height: 55,
        marginTop: 6,
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

    cardItem: {
        backgroundColor: 'rgba(255,255,255,0.10)',
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.20)',
        marginBottom: 10,
    },

    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    cusName: { fontSize: 15, fontWeight: '900', color: '#fff', flex: 1, paddingRight: 10 },
    subText: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },

    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
    badgeDone: { backgroundColor: 'rgba(76, 175, 80, 0.22)', borderColor: 'rgba(255,255,255,0.22)' },
    badgeNotDone: { backgroundColor: 'rgba(244, 67, 54, 0.22)', borderColor: 'rgba(255,255,255,0.22)' },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },

    empty: { textAlign: 'center', marginTop: 14, color: 'rgba(255,255,255,0.65)', fontSize: 13 },
});
