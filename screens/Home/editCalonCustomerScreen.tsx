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
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Toast from 'react-native-toast-message';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import api from '../../services/api';

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

type CalonCustomer = {
    id: number;
    cc_kode?: string;
    cc_nama?: string;
    cc_alamat?: string;
    cc_cp?: string;
    cc_telp?: string;
    cc_kota?: string;
};

export default function EditCalonCustomerScreen({ navigation, route }: any) {
    const initial: CalonCustomer | undefined = route?.params?.data;

    const cc_kode = useMemo(() => String(initial?.cc_kode || '').trim() || null, [initial?.cc_kode]);

    const [kode, setKode] = useState('');
    const [nama, setNama] = useState('');
    const [kota, setKota] = useState('');
    const [alamat, setAlamat] = useState('');
    const [cp, setCp] = useState('');
    const [telp, setTelp] = useState('');

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setKode(String(initial?.cc_kode || ''));
        setNama(String(initial?.cc_nama || ''));
        setKota(String(initial?.cc_kota || ''));
        setAlamat(String(initial?.cc_alamat || ''));
        setCp(String(initial?.cc_cp || ''));
        setTelp(String(initial?.cc_telp || ''));
    }, [initial]);

    const canSubmit = useMemo(() => {
        return !!cc_kode && !!nama.trim() && !loading;
    }, [cc_kode, nama, loading]);

    const simpan = async () => {
        if (!cc_kode) {
        Toast.show({ type: 'glassError', text1: 'Validasi', text2: 'ID customer tidak ditemukan' });
        return;
        }
        if (!nama.trim()) {
        Toast.show({ type: 'glassError', text1: 'Validasi', text2: 'Nama customer wajib diisi' });
        return;
        }

        setLoading(true);
        try {
        const payload = {
            cc_nama: nama.trim(),
            cc_kota: kota.trim(),
            cc_alamat: alamat.trim(),
            cc_cp: cp.trim(),
            cc_telp: telp.trim(),
        };

        const res = await api.put(`/update-customer/${cc_kode}`, payload);

        if (!res.data?.success) throw new Error(res.data?.message || 'Gagal update calon customer');

        Toast.show({ type: 'glassSuccess', text1: 'Berhasil', text2: 'Data calon customer diperbarui' });

        setTimeout(() => navigation.goBack(), 250);
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

    return (
        <LinearGradient colors={[THEME.bgTop, THEME.bgBottom]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
                <Text style={styles.title}>Calon Customer</Text>
                <Text style={styles.subtitle}>Edit Data CS</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.label}>Kode</Text>
                <View style={[styles.inputWrap, { opacity: 0.75 }]}>
                <MaterialIcons name="tag" size={18} color={THEME.muted} style={{ marginRight: 10 }} />
                <TextInput value={kode} editable={false} style={styles.input} />
                </View>

                {/* Kota */}
                <Text style={styles.label}>Kota</Text>
                <View style={[styles.inputWrap, { opacity: 0.75 }]}>
                <TextInput value={kota} editable={false} style={styles.input} />
                </View>

                {/* Nama */}
                <Text style={styles.label}>Nama</Text>
                <View style={styles.inputWrap}>
                <TextInput value={nama} onChangeText={setNama} placeholder="Nama customer" placeholderTextColor={THEME.muted} style={styles.input} />
                </View>

                {/* Alamat */}
                <Text style={styles.label}>Alamat</Text>
                <View style={styles.textAreaWrap}>
                <TextInput
                    value={alamat}
                    onChangeText={setAlamat}
                    placeholder="Alamat"
                    placeholderTextColor={THEME.muted}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    style={[styles.input, { height: 110, paddingTop: 10 }]}
                />
                </View>

                {/* CP */}
                <Text style={styles.label}>Contact Person</Text>
                <View style={styles.inputWrap}>
                <MaterialIcons name="person" size={18} color={THEME.muted} style={{ marginRight: 10 }} />
                <TextInput value={cp} onChangeText={setCp} placeholder="Nama CP" placeholderTextColor={THEME.muted} style={styles.input} />
                </View>

                {/* Telepon */}
                <Text style={styles.label}>Telepon</Text>
                <View style={styles.inputWrap}>
                <MaterialIcons name="phone" size={18} color={THEME.muted} style={{ marginRight: 10 }} />
                <TextInput
                    value={telp}
                    onChangeText={setTelp}
                    placeholder="No. telepon"
                    placeholderTextColor={THEME.muted}
                    keyboardType="phone-pad"
                    style={styles.input}
                />
                </View>

                <TouchableOpacity onPress={simpan} disabled={!canSubmit} style={[styles.btnPrimary, !canSubmit && { opacity: 0.55 }]} activeOpacity={0.9}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>UPDATE</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.goBack()} disabled={loading} style={styles.btnGhost} activeOpacity={0.9}>
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
        marginBottom: 10,
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

    input: { flex: 1, color: THEME.ink, fontSize: 15, fontWeight: '800' },

    btnPrimary: {
        marginTop: 14,
        height: 52,
        borderRadius: 14,
        backgroundColor: THEME.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnPrimaryText: { color: '#fff', fontWeight: '900', letterSpacing: 0.4 },

    btnGhost: { marginTop: 10, alignItems: 'center', paddingVertical: 10 },
    btnGhostText: { color: THEME.muted, fontWeight: '900' },
});
