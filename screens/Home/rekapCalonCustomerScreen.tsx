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
    TextInput
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import api from '../../services/api';
import { useAuth } from '../../context/authContext';
import { Linking } from 'react-native';
import { GlassSelect } from '../Register/glassSelect';
import Toast from 'react-native-toast-message';

type CalonCustomer = {
    id: number;
    cc_kode: string;
    cc_nama: string;
    cc_alamat: string;
    cc_cp: string;
    cc_telp: string;
    cc_kota: string;
};

export default function RekapCalonCustomerScreen() {
    const { user } = useAuth();

    const [cabangList, setCabangList] = useState<string[]>([]);
    const [cabang, setCabang] = useState<string>(user?.cabang || '');
    const [openCabang, setOpenCabang] = useState(false);
    
    const [data, setData] = useState<CalonCustomer[]>([]);
    const [loading, setLoading] = useState(false);
    
    const [keyword, setKeyword] = useState('');

    const filteredData = useMemo(() => {
        if (!keyword.trim()) return data;

        const q = keyword.toLowerCase();
        return data.filter((item) =>
            item.cc_nama?.toLowerCase().includes(q)
        );
    }, [data, keyword]);

    // ====== load cabang untuk dropdown ======
    const loadCabang = useCallback(async () => {
        try {
        const res = await api.get('/cabang', {
            params: {
            jabatan: user?.jabatan,
            cabang: user?.cabang,
            nama: user?.nama,
            },
        });

        const list: string[] = res.data?.data?.cabang || [];
        setCabangList(list);

        if (!cabang && list.length > 0) setCabang(list[0]);
        } catch (err: any) {
        Toast.show({
            type: 'glassError',
            text1: 'Error',
            text2: err?.response?.data?.message || "Gagal mengambil cabang"
        })
        }
    }, [user, cabang]);

    useEffect(() => {
        loadCabang();
    }, [loadCabang]);

    const cabangOptions = useMemo(() => {
        const base = cabangList.length ? cabangList : (cabang ? [cabang] : []);
        return base.map((c) => ({ label: c, value: c }));
    }, [cabangList, cabang]);

    const refresh = useCallback(async () => {
        if (!cabang) {
        Toast.show({
            type: 'glassError',
            text1: 'Validasi',
            text2: 'Cabang belum dipilih'
        })
        return;
        }

        setLoading(true);
        try {
        const res = await api.get('/rekap-calon-customer', { params: { cabang } });
        setData(res.data?.data || []);
        } catch (err: any) {
        Toast.show({
            type: 'glassError',
            text1: "Error",
            text2: err?.response?.data?.message || 'Gagal mengambil rekap'
        })
        setData([]);
        } finally {
        setLoading(false);
        }
    }, [cabang]);

    // auto refresh setelah cabang siap
    useEffect(() => {
        if (!cabang) return;
        refresh();
    }, [cabang, refresh]);

    const kirimWA = useCallback(async () => {
        if (!cabang) {
        Toast.show({
            type: 'glassError',
            text1: 'Validasi',
            text2: 'Cabang belum dipilih'
        })
        return;
        }

        try {
        const res = await api.get('/rekap-calon-customer/wa', {
            params: { cabang, cc_nama: keyword },
        });
        const waText = res.data?.wa_text;
        if (!waText) {
            Toast.show({
                type: 'glassSuccess',
                text1: "Info",
                text2: "Data WA tidak tersedia"
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
            text1: 'Érror',
            text2: err?.response?.data?.message || "Gagal membuat rekap WA"
        })
        }
    }, [cabang, keyword]);

    const renderItem = ({ item }: { item: CalonCustomer }) => (
        <View style={styles.cardItem}>
        <Text style={styles.itemTitle}>{item.cc_nama}</Text>

        <Text style={styles.itemSub}>🧾 Kode: {item.cc_kode || String(item.id)}</Text>
        <Text style={styles.itemSub}>📍 {item.cc_alamat || '-'}</Text>

        <View style={styles.metaRow}>
            <Text style={styles.metaChip}>👤 {item.cc_cp || '-'}</Text>
            <Text style={styles.metaChip}>📞 {item.cc_telp || '-'}</Text>
        </View>

        {!!item.cc_kota && <Text style={styles.itemMeta}>🏙️ {item.cc_kota}</Text>}
        </View>
    );

    const ListHeader = (
        <View>
        <View style={styles.header}>
            <Text style={styles.title}>Rekap Calon Customer</Text>
            <Text style={styles.subtitle}>Filter per cabang, lalu kirim rekap via WhatsApp</Text>
        </View>
        
        
        <View style={styles.filterCard}>
            <Text style={styles.itemTitle}>Cari Nama Customer</Text>
            <View style={styles.glassInputContainer}>
            <Text style={styles.icon}>🔍</Text>
            <TextInput
                value={keyword}
                onChangeText={setKeyword}
                placeholder="Ketik nama customer..."
                placeholderTextColor="rgba(255,255,255,0.6)"
                style={styles.input}
                autoCorrect={false}
            />
            </View>

            <GlassSelect
            label="Cabang / Kota"
            value={cabang}
            options={cabangOptions}
            visible={openCabang}
            onOpen={() => {
                setOpenCabang(true);
            }}
            onClose={() => setOpenCabang(false)}
            onSelect={(v) => setCabang(v)}
            />

            <View style={styles.rowBtn}>
            <TouchableOpacity
                style={[styles.primaryButton, { flex: 1 }]}
                onPress={refresh}
                disabled={loading}
                activeOpacity={0.85}
            >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>REFRESH</Text>}
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.waButton, { flex: 1 }]}
                onPress={kirimWA}
                disabled={loading}
                activeOpacity={0.85}
            >
                <Text style={styles.primaryButtonText}>KIRIM WA</Text>
            </TouchableOpacity>
            </View>
            {!!keyword && (
                <Text style={styles.smallHint}>
                    Hasil pencarian: <Text style={{ fontWeight: '900' }}>{filteredData.length}</Text>
                </Text>
            )}
        </View>
        </View>
    );

    return (
        <LinearGradient colors={['#5D59A2', '#3B3A82', '#1E224F']} style={styles.container}>
        <StatusBar barStyle="light-content" />

        <FlatList
            data={filteredData}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={
            loading ? null : <Text style={styles.empty}>Belum ada data. Klik Refresh.</Text>
            }
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

    smallHint: {
        marginTop: 6,
        color: 'rgba(255,255,255,0.65)',
        fontSize: 12,
        textAlign: 'center',
    },

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

    // Item card glass
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

    metaRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
    metaChip: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        overflow: 'hidden',
    },

    itemMeta: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 10 },

    empty: { textAlign: 'center', marginTop: 14, color: 'rgba(255,255,255,0.65)', fontSize: 13 },
    glassInputContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: 'rgba(255, 255, 255, 0.15)',
  borderRadius: 15,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.30)',
  paddingHorizontal: 15,
  height: 55,
  marginBottom: 10,
},
icon: {
  fontSize: 18,
  marginRight: 10,
},
input: {
  flex: 1,
  color: '#fff',
  fontSize: 16,
},
label:{

}

});
