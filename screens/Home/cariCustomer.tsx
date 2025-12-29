/* eslint-disable react-native/no-inline-styles */
import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    StatusBar,
    FlatList,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import api from '../../services/api';
import Toast from 'react-native-toast-message';

type Customer = {
    cc_kode: string;
    cc_nama: string;
    cc_alamat: string;
    cc_telp?: string;
    cc_CP?: string;
};

const cleanText = (s: any) => String(s ?? '').replace(/\r?\n/g, ' ').trim();

export default function CariCustomerScreen({ navigation, route }: any) {
    const from = route?.params?.from || 'VISITPLAN'; // VISITPLAN / VISIT / dll
    const keywordFromPrev = route?.params?.keyword || '';

    const [keyword, setKeyword] = useState(String(keywordFromPrev));
    const [data, setData] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false);

    const canSearch = useMemo(() => {
        return keyword.trim().length >= 2 && !loading;
    }, [keyword, loading]);

    const cari = async () => {
        const q = keyword.trim();
        if (q.length < 2) {
        Toast.show({
            type: 'glassError',
            text1: 'Validasi',
            text2: 'Ketik minimal 2 huruf untuk mencari'
        })
        return;
        }

        setLoading(true);
        try {
        const res = await api.get('/cariCustomer', { params: { search: q } });
        const rows: Customer[] = res.data?.data || [];
        setData(rows);
        } catch (err: any) {
        Toast.show({
            type: 'glassError',
            text1: 'Error',
            text2: err?.response?.data?.message || 'Gagal mengambil data customer'
        })
        } finally {
        setLoading(false);
        }
    };

    useEffect(() => {
        if (String(keywordFromPrev || '').trim().length >= 2) {
        cari();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const pilihCustomer = (item: Customer) => {
        const payload = {
        kode: item.cc_kode,
        nama: item.cc_nama,
        alamat: cleanText(item.cc_alamat),
        telepon: cleanText(item.cc_telp),
        contactPerson: cleanText(item.cc_CP),
        };

        // Cara lama (aman): kirim balik dengan navigate sesuai sumber
        if (from === 'VISITPLAN') {
        navigation.navigate('VisitPlan', { selectedCustomer: payload });
        return;
        }
        if (from === 'VISIT') {
        navigation.navigate('Visit', { selectedCustomer: payload });
        return;
        }

        // default: balik
        navigation.goBack();
    };

    const renderItem = ({ item }: { item: Customer }) => (
        <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => pilihCustomer(item)}
        style={styles.card}
        >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={styles.avatar}>
            <Text style={{ fontSize: 16 }}>🏢</Text>
            </View>
            <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{cleanText(item.cc_nama)}</Text>
            <Text style={styles.cardMeta}>Kode: {cleanText(item.cc_kode)}</Text>
            </View>

            <View style={styles.pill}>
            <Text style={styles.pillText}>PILIH</Text>
            </View>
        </View>

        <Text style={styles.cardText}>{cleanText(item.cc_alamat)}</Text>

        {!!item.cc_telp && (
            <Text style={styles.cardText}>📞 {cleanText(item.cc_telp)}</Text>
        )}

        {!!item.cc_CP && (
            <Text style={styles.cardText}>👤 {cleanText(item.cc_CP)}</Text>
        )}
        </TouchableOpacity>
    );

    return (
        <LinearGradient colors={['#5D59A2', '#3B3A82', '#1E224F']} style={styles.container}>
        <StatusBar barStyle="light-content" />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.inner}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Cari Customer</Text>
            </View>

            {/* Search Bar */}
            <View style={styles.searchRow}>
                <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>🔎</Text>
                <TextInput
                    value={keyword}
                    onChangeText={setKeyword}
                    placeholder="Nama customer..."
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    style={styles.searchInput}
                    returnKeyType="search"
                    onSubmitEditing={cari}
                />
                </View>

                <TouchableOpacity
                onPress={cari}
                disabled={!canSearch}
                activeOpacity={0.85}
                style={[styles.searchBtn, !canSearch && { opacity: 0.65 }]}
                >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnText}>Cari</Text>}
                </TouchableOpacity>
            </View>

            {/* Result */}
            <FlatList
                data={data}
                keyExtractor={(item) => item.cc_kode}
                renderItem={renderItem}
                contentContainerStyle={{ paddingBottom: 18 }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                <View style={{ marginTop: 18, alignItems: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
                    {loading ? 'Mencari...' : 'Belum ada data'}
                    </Text>
                </View>
                }
            />

            {/* Footer */}
            <TouchableOpacity
                onPress={() => navigation.goBack()}
                activeOpacity={0.85}
                style={styles.secondaryButton}
            >
                <Text style={styles.secondaryButtonText}>Kembali</Text>
            </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
        </LinearGradient>
    );
    }

    const styles = StyleSheet.create({
    container: { flex: 1 },
    inner: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 18,
    },

    header: { alignItems: 'center', marginBottom: 14 },
    title: { fontSize: 30, fontWeight: '300', color: '#fff' },
    subtitle: { marginTop: 6, color: 'rgba(255,255,255,0.8)', fontSize: 13 },

    badgeRow: { marginTop: 10 },
    badgeGhost: {
        backgroundColor: 'rgba(255,255,255,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
    },
    badgeGhostText: { color: 'rgba(255,255,255,0.9)', fontWeight: '800', letterSpacing: 0.6, fontSize: 12 },

    searchRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    searchBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        paddingHorizontal: 14,
        height: 55,
    },
    searchIcon: { fontSize: 16, marginRight: 10 },
    searchInput: { flex: 1, color: '#fff', fontSize: 15 },

    searchBtn: {
        height: 55,
        paddingHorizontal: 16,
        borderRadius: 14,
        backgroundColor: '#233975',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        minWidth: 84,
    },
    searchBtnText: { color: '#fff', fontWeight: '900', letterSpacing: 0.4 },

    card: {
        backgroundColor: 'rgba(255,255,255,0.10)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        padding: 14,
        marginBottom: 12,
    },
    avatar: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pill: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    pillText: { color: '#fff', fontWeight: '900', fontSize: 11, letterSpacing: 0.6 },

    cardTitle: { color: '#fff', fontSize: 15, fontWeight: '900' },
    cardMeta: { color: 'rgba(255,255,255,0.75)', marginTop: 2, fontSize: 12 },
    cardText: { color: 'rgba(255,255,255,0.85)', marginTop: 8, fontSize: 13, lineHeight: 18 },

    secondaryButton: {
        marginTop: 8,
        marginBottom: 14,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: 30,
        paddingVertical: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
    },
    secondaryButtonText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '800' },
});
