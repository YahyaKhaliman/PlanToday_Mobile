/* eslint-disable react-native/no-inline-styles */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    StatusBar,
    TextInput,
    Platform,
    Modal,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import api from '../../services/api';
import { useAuth } from '../../context/authContext';
import { Linking } from 'react-native';
import Toast from 'react-native-toast-message';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

type CalonCustomer = {
    id?: number;
    cc_kode: string;
    cc_nama: string;
    cc_alamat: string;
    cc_cp?: string;
    cc_telp?: string;
    cc_kota?: string;
    sumber?: string;
};

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
};

export default function RekapCalonCustomerScreen({ navigation }: any) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { user } = useAuth();

    const [data, setData] = useState<CalonCustomer[]>([]);
    const [loading, setLoading] = useState(false);

    const [keyword, setKeyword] = useState('');

    // ===== FAB + Modal Filter =====
    const [showFab, setShowFab] = useState(false);
    const [openFilter, setOpenFilter] = useState(false);

    // ===== mini edit fab =====
    const [selectedItem, setSelectedItem] = useState<CalonCustomer | null>(null);
    const [showEditFab, setShowEditFab] = useState(false);

    const clearKeyword = useCallback(() => setKeyword(''), []);

    const SearchBox = useMemo(
        () => (
        <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>

            <TextInput
            value={keyword}
            onChangeText={setKeyword}
            placeholder="Cari customer..."
            placeholderTextColor={THEME.muted}
            style={styles.searchInput}
            autoCorrect={false}
            />

            {!!keyword.trim() && (
            <TouchableOpacity onPress={clearKeyword} activeOpacity={0.8} style={styles.clearBtn}>
                <MaterialIcons name="close" size={18} color={THEME.muted} />
            </TouchableOpacity>
            )}
        </View>
        ),
        [keyword, clearKeyword]
    );

    const refreshRekap = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/rekap-calon-customer', {
            });

            setData((res.data?.data || []).map((x: any) => ({
                id: x.id,
                cc_kode: x.cc_kode,
                cc_nama: x.cc_nama,
                cc_alamat: x.cc_alamat,
                cc_cp: x.cc_cp ?? '',
                cc_telp: x.cc_telp ?? '',
                cc_kota: x.cc_kota ?? '',
            })));
        } catch (err: any) {
            Toast.show({
            type: 'glassError',
            text1: 'Error',
            text2: err?.response?.data?.message || 'Gagal mengambil rekap calon customer',
            });
            setData([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const searchCustomer = useCallback(async (q: string) => {
        // eslint-disable-next-line @typescript-eslint/no-shadow
        const keyword = String(q || '').trim();
        if (!keyword) return;

        setLoading(true);
        try {
            const res = await api.get('/cari-customer', {
            params: { search: keyword },
            });

            setData(res.data?.data || []);
        } catch (err: any) {
            Toast.show({
            type: 'glassError',
            text1: 'Error',
            text2: err?.response?.data?.message || 'Gagal mencari customer',
            });
            setData([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const q = keyword.trim();

        const t = setTimeout(() => {
            if (!q) {
            refreshRekap();          
            } else {
            searchCustomer(q);    
        }
    }, 350); 
    return () => clearTimeout(t);
    }, [keyword, refreshRekap, searchCustomer]);

    useFocusEffect(
        React.useCallback(() => {
        refreshRekap();
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [])
    );

    const kirimWA = useCallback(async () => {
        try {
        const res = await api.get('/rekap-calon-customer/wa', {
            params: {
            cc_nama: keyword.trim() || undefined,
            },
        });

        const waText = res.data?.wa_text;
        if (!waText) {
            Toast.show({ type: 'glassSuccess', text1: 'Info', text2: 'Data WA tidak tersedia' });
            return;
        }

        const url = `whatsapp://send?text=${encodeURIComponent(waText)}`;
        const canOpen = await Linking.canOpenURL(url);

        if (!canOpen) {
            Toast.show({ type: 'glassError', text1: 'Info', text2: 'WhatsApp tidak ditemukan di device' });
            return;
        }

        await Linking.openURL(url);
        } catch (err: any) {
        Toast.show({
            type: 'glassError',
            text1: 'Error',
            text2: err?.response?.data?.message || 'Gagal membuat rekap WA',
        });
        }
    }, [keyword]);

    // ===== scroll handler =====
    const onScroll = useCallback((e: any) => {
        const y = e.nativeEvent.contentOffset.y || 0;
        setShowFab(y > 200);
        setShowEditFab(false);
    }, []);

    const openEdit = useCallback((item: CalonCustomer) => {
        setSelectedItem(item);
        setShowEditFab(true);
    }, []);
    
    const handleRefresh = useCallback(() => {
        setKeyword('');        // balik ke awal
        setShowEditFab(false); // optional: tutup mini edit
    }, []);

    const renderItem = useCallback(
        ({ item }: { item: CalonCustomer }) => {
        const nama = item.cc_nama || '-';
        const kota = item.cc_kota || '-';
        const alamat = item.cc_alamat || '-';
        const cp = item.cc_cp || '-';
        const telp = item.cc_telp || '-';

        return (
            <TouchableOpacity activeOpacity={0.9} onPress={() => openEdit(item)}>
            <View style={styles.cardCompact}>
                <View style={{ flex: 1 }}>
                <Text style={styles.compactTitle} numberOfLines={1}>
                    {nama}
                </Text>

                <View style={styles.inlineRow}>
                    <MaterialIcons name="place" size={14} color={THEME.accent} style={{ marginRight: 6 }} />
                    <Text style={styles.compactSub} numberOfLines={1}>
                    {kota} • {alamat}
                    </Text>
                </View>

                <View style={[styles.inlineRow, { marginTop: 6, flexWrap: 'wrap' }]}>
                    <Text style={styles.miniChip}>CP: {cp}</Text>
                    <Text style={styles.miniChip}>Telp: {telp}</Text>
                </View>
                </View>
            </View>
            </TouchableOpacity>
        );
        },
        [openEdit]
    );

    const ListHeader = (
        <View style={styles.headerWrap}>
        <View style={styles.header}>
            <Text style={styles.title}>Calon Customer</Text>
            <Text style={styles.subtitle}>Rekap daftar calon customer</Text>
        </View>

        {SearchBox}

        <Text style={styles.smallHint}>
            Menampilkan: <Text style={{ fontWeight: '900' }}>{data.length}</Text> data
        </Text>

        <View style={styles.divider} />
        </View>
    );

    return (
        <LinearGradient colors={[THEME.bgTop, THEME.bgBottom]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

        <FlatList
            data={data}
  keyExtractor={(item, index) => {
    const sumber = String(item?.sumber || 'UNK');
    const id = String(item?.id || '').trim();
    const kode = String(item?.cc_kode || '').trim();

    // prioritas: id (kalau valid)
    if (id) return `${sumber}-${id}`;

    // fallback: cc_kode (biasanya ada)
    if (kode) return `${sumber}-K-${kode}`;

    // last resort: index (pasti unik)
    return `${sumber}-IDX-${index}`;
  }}
            renderItem={renderItem}
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={loading ? <ActivityIndicator style={{ marginTop: 20 }} /> : <Text style={styles.empty}>Belum ada data customer.</Text>}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onTouchStart={() => setShowEditFab(false)}
        />

        {/* FAB Filter (🔍) */}
        {showFab && (
            <TouchableOpacity activeOpacity={0.9} onPress={() => setOpenFilter(true)} style={styles.fab}>
            <View style={styles.fabInner}>
                <Text style={{ fontSize: 18 }}>🔍</Text>
            </View>
            </TouchableOpacity>
        )}

        {/* mini FAB Edit (✏️) */}
        {showEditFab && selectedItem && (
            <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
                setShowEditFab(false);
                navigation.navigate('EditCalonCustomer', { data: selectedItem });
            }}
            style={styles.editFab}
            >
            <View style={styles.fabInner}>
                <MaterialIcons name="edit" size={22} color={THEME.ink} />
            </View>
            </TouchableOpacity>
        )}

        {/* Modal Filter */}
        <Modal visible={openFilter} transparent animationType="fade" onRequestClose={() => setOpenFilter(false)}>
            <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filter</Text>
                <TouchableOpacity onPress={() => setOpenFilter(false)} activeOpacity={0.8}>
                    <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
                </View>

                {SearchBox}

                <View style={[styles.row2, { marginTop: 14 }]}>
                <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: THEME.accent }]}
                    onPress={() => {
                    setOpenFilter(false);
                    refreshRekap();
                    }}
                    disabled={loading}
                    activeOpacity={0.9}
                >
                    <Text style={styles.modalBtnText}>Refresh</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: THEME.wa }]}
                    onPress={() => {
                    setOpenFilter(false);
                    kirimWA();
                    }}
                    disabled={loading}
                    activeOpacity={0.9}
                >
                    <Text style={styles.modalBtnText}>Kirim WA</Text>
                </TouchableOpacity>
                </View>
            </View>
            </View>
        </Modal>

        {/* Bottom Action Bar */}
        <View style={styles.bottomAction}>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={() => navigation.navigate('CalonCustomer')} activeOpacity={0.9}>
            <Text style={styles.bottomActionText}>+ Tambah</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSoft]} onPress={handleRefresh} disabled={loading} activeOpacity={0.9}>
            {loading ? (<ActivityIndicator color={THEME.primary} />) : (<Text style={[styles.bottomActionText, { color: THEME.primary }]}>Refresh</Text>)}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnWa]} onPress={kirimWA} disabled={loading} activeOpacity={0.9}>
            <Text style={styles.bottomActionText}>Kirim WA</Text>
            </TouchableOpacity>
        </View>
        </LinearGradient>
    );
    }

    const styles = StyleSheet.create({
    container: { flex: 1 },

    listContent: {
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 54 : 18,
        paddingBottom: 120,
    },

    headerWrap: {
        backgroundColor: THEME.bgBottom,
        paddingBottom: 10,
    },

    header: { alignItems: 'center', marginBottom: 10 },
    title: { fontSize: 25, fontWeight: '900', color: THEME.ink, letterSpacing: 0.2 },
    subtitle: { color: THEME.muted, fontSize: 12, marginTop: 6, fontWeight: '700', textAlign: 'center' },

    divider: { marginTop: 10, height: 1, backgroundColor: THEME.line },

    smallHint: { marginTop: 10, color: THEME.muted, fontSize: 12, textAlign: 'center', fontWeight: '700' },

    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: THEME.soft,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: THEME.line,
        paddingHorizontal: 12,
        height: 55,
        marginBottom: 10,
    },
    searchIcon: { fontSize: 16, marginRight: 10 },
    searchInput: { flex: 1, color: THEME.ink, fontSize: 14, fontWeight: '900' },

    clearBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15,23,42,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(15,23,42,0.08)',
    },

    cardCompact: {
        backgroundColor: THEME.card,
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: THEME.line,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 1,
    },
    compactTitle: { color: THEME.ink, fontSize: 15, fontWeight: '900' },
    compactSub: { color: THEME.muted, fontSize: 12, fontWeight: '800', flex: 1 },

    inlineRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },

    miniChip: {
        color: THEME.ink,
        fontSize: 11,
        fontWeight: '900',
        backgroundColor: 'rgba(15,23,42,0.04)',
        borderWidth: 1,
        borderColor: THEME.line,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        overflow: 'hidden',
        marginRight: 8,
        marginBottom: 6,
    },

    empty: { textAlign: 'center', marginTop: 18, color: THEME.muted, fontSize: 13, fontWeight: '700' },

    bottomAction: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: THEME.card,
        borderTopWidth: 1,
        borderTopColor: THEME.line,
        flexDirection: 'row',
        gap: 10,
    },

    actionBtn: {
        flex: 1,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },

    actionBtnPrimary: { backgroundColor: THEME.accent, borderColor: 'rgba(79,70,229,0.18)' },
    actionBtnSoft: { backgroundColor: 'rgba(79,70,229,0.08)', borderColor: 'rgba(79,70,229,0.18)' },
    actionBtnWa: { backgroundColor: THEME.wa, borderColor: 'rgba(34,197,94,0.18)' },

    bottomActionText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13, letterSpacing: 0.3 },

    fab: { position: 'absolute', right: 16, bottom: 90 },
    editFab: { position: 'absolute', right: 16, bottom: 152 },

    fabInner: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(255,255,255,0.78)',
        borderWidth: 1,
        borderColor: 'rgba(15,23,42,0.10)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
    },

    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        paddingHorizontal: 16,
        justifyContent: 'flex-end',
        paddingBottom: 18,
    },

    modalCard: {
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(15,23,42,0.10)',
        padding: 14,
    },

    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    modalTitle: { color: THEME.ink, fontWeight: '900', fontSize: 16 },
    modalClose: { color: THEME.muted, fontWeight: '900', fontSize: 18, paddingHorizontal: 6 },

    row2: { flexDirection: 'row', gap: 10, marginTop: 4 },

    modalBtn: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    modalBtnText: { color: '#fff', fontWeight: '900', letterSpacing: 0.3 },
});