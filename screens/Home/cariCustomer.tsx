/* eslint-disable react-native/no-inline-styles */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
};

export default function CariCustomerScreen({ navigation, route }: any) {
    const from = route?.params?.from || 'VISITPLAN'; // VISITPLAN / VISIT / dll
    const keywordFromPrev = route?.params?.keyword || '';

    const [keyword, setKeyword] = useState(String(keywordFromPrev));
    const [data, setData] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false);

    const canSearch = useMemo(() => keyword.trim().length >= 2 && !loading, [keyword, loading]);

    const cari = useCallback(async () => {
        const q = keyword.trim();
        if (q.length < 2) {
        Toast.show({
            type: 'glassError',
            text1: 'Validasi',
            text2: 'Ketik minimal 2 huruf untuk mencari',
        });
        return;
        }

        setLoading(true);
        try {
        const res = await api.get('/cari-customer', { params: { search: q } });
        const rows: Customer[] = res.data?.data || [];
        setData(rows);
        } catch (err: any) {
        Toast.show({
            type: 'glassError',
            text1: 'Error',
            text2: err?.response?.data?.message || 'Gagal mengambil data customer',
        });
        setData([]);
        } finally {
        setLoading(false);
        }
    }, [keyword]);

    useEffect(() => {
        if (String(keywordFromPrev || '').trim().length >= 2) {
        // auto search
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

        if (from === 'TAMBAHVISITPLAN') {
            navigation.navigate({
                name: 'TambahVisitPlan',
                params: { selectedCustomer: payload },
                merge: true,
            });
            return;
        }
        if (from === 'TAMBAHVISIT') {
            navigation.navigate({
                name: 'TambahVisit',
                params: { selectedCustomer: payload },
                merge: true,
            });
            return;
        }
        navigation.goBack();
    };

    const renderItem = ({ item }: { item: Customer }) => (
        <TouchableOpacity activeOpacity={0.9} onPress={() => pilihCustomer(item)} style={styles.card}>
        <View style={styles.cardTopRow}>
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

        {!!item.cc_telp && <Text style={styles.cardText}>📞 {cleanText(item.cc_telp)}</Text>}
        {!!item.cc_CP && <Text style={styles.cardText}>👤 {cleanText(item.cc_CP)}</Text>}
        </TouchableOpacity>
    );

    const ListHeader = (
        <View style={styles.headerWrap}>
        <View style={styles.header}>
            <Text style={styles.title}>Cari Customer</Text>
            <Text style={styles.subtitle}>Ketik nama, lalu pilih customer</Text>
        </View>

        <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔎</Text>
            <TextInput
            value={keyword}
            onChangeText={setKeyword}
            placeholder="Nama customer..."
            placeholderTextColor={THEME.muted}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={cari}
            autoCorrect={false}
            autoCapitalize="none"
            />
        </View>

        {!!keyword?.trim() && (
            <Text style={styles.smallHint}>
            Hasil: <Text style={{ fontWeight: '900' }}>{data.length}</Text>
            </Text>
        )}

        <View style={styles.divider} />
        </View>
    );

    return (
        <LinearGradient colors={[THEME.bgTop, THEME.bgBottom]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <FlatList
            data={data}
            keyExtractor={(item) => String(item.cc_kode)}
            renderItem={renderItem}
            ListHeaderComponent={ListHeader}
            stickyHeaderIndices={[0]}
            ListHeaderComponentStyle={styles.stickyHeader}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
                loading ? (
                <ActivityIndicator style={{ marginTop: 20 }} />
                ) : (
                <Text style={styles.empty}>
                    {keyword.trim().length >= 2 ? 'Data tidak ditemukan' : 'Ketik minimal 2 huruf untuk mulai mencari'}
                </Text>
                )
            }
            />

            {/* Bottom Action Bar */}
            <View style={styles.bottomAction}>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSoft]} onPress={() => navigation.goBack()} activeOpacity={0.9}>
                <Text style={[styles.actionText, { color: THEME.primary }]}>Kembali</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                onPress={cari}
                disabled={!canSearch}
                activeOpacity={0.9}
            >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>Cari</Text>}
            </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
        </LinearGradient>
    );
    }

    const styles = StyleSheet.create({
    container: { flex: 1 },

    listContent: {
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 54 : 18,
        paddingBottom: 110, // ruang bottom bar
    },

    headerWrap: {
        backgroundColor: THEME.bgBottom,
        paddingBottom: 10,
    },

    header: { alignItems: 'center', marginBottom: 10 },
    title: { fontSize: 25, fontWeight: '900', color: THEME.ink, letterSpacing: 0.2 },
    subtitle: { color: THEME.muted, fontSize: 12, marginTop: 6, fontWeight: '700', textAlign: 'center' },

    divider: { marginTop: 10, height: 1, backgroundColor: THEME.line },

    smallHint: {
        marginTop: 8,
        color: THEME.muted,
        fontSize: 12,
        textAlign: 'center',
        fontWeight: '700',
    },

    /* Search box */
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: THEME.soft,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: THEME.line,
        paddingHorizontal: 12,
        height: 55,
    },
    searchIcon: { fontSize: 16, marginRight: 10 },
    searchInput: {
        flex: 1,
        color: THEME.ink,
        fontSize: 16,
        fontWeight: '700',
    },

    /* Item card */
    card: {
        backgroundColor: THEME.card,
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: THEME.line,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 2,
    },
    cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

    avatar: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: THEME.soft,
        borderWidth: 1,
        borderColor: THEME.line,
        alignItems: 'center',
        justifyContent: 'center',
    },

    pill: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(6,182,212,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(6,182,212,0.20)',
    },
    pillText: { color: THEME.ink, fontWeight: '900', fontSize: 11, letterSpacing: 0.6 },

    cardTitle: { color: THEME.ink, fontSize: 15, fontWeight: '900' },
    cardMeta: { color: THEME.muted, marginTop: 2, fontSize: 12, fontWeight: '700' },
    cardText: { color: THEME.muted, marginTop: 8, fontSize: 13, lineHeight: 18, fontWeight: '700' },

    empty: {
        textAlign: 'center',
        marginTop: 18,
        color: THEME.muted,
        fontSize: 13,
        fontWeight: '700',
    },

    /* Bottom Action Bar */
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

    actionBtnPrimary: {
        backgroundColor: THEME.accent,
        borderColor: 'rgba(79,70,229,0.18)',
    },

    actionBtnSoft: {
        backgroundColor: 'rgba(79,70,229,0.08)',
        borderColor: 'rgba(79,70,229,0.18)',
    },

    actionText: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 13,
        letterSpacing: 0.3,
    },

    stickyHeader: { backgroundColor: THEME.bgBottom },
});
