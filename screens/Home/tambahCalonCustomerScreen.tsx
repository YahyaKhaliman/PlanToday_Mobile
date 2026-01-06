/* eslint-disable react-native/no-inline-styles */
import React, { useMemo, useState } from 'react';
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
import api from '../../services/api';
import { useAuth } from '../../context/authContext';
import Toast from 'react-native-toast-message';
import Modal from 'react-native-modal';

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

export default function CalonCustomerScreen({ navigation }: any) {
    const { user } = useAuth();
    const cabang = user?.cabang || '';

    const [nama, setNama] = useState('');
    const [alamat, setAlamat] = useState('');
    const [telp, setTelp] = useState('');
    const [pic, setPic] = useState('');
    const [loading, setLoading] = useState(false);

    const [isSuccessModalVisible, setSuccessModalVisible] = useState(false);
    const [savedKode, setSavedKode] = useState('');

    const canSubmit = useMemo(() => {
        return nama.trim().length > 0 && !loading;
    }, [nama, loading]);

    const resetForm = () => {
        setNama('');
        setAlamat('');
        setTelp('');
        setPic('');
    };

    const simpan = async () => {
        if (!nama.trim()) {
        Toast.show({
            type: 'glassError',
            text1: 'Validasi',
            text2: 'Nama customer wajib diisi',
        });
        return;
        }

        setLoading(true);
        try {
        const payload = {
            nama: nama.trim(),
            alamat: alamat.trim(),
            cabang,
            telp: telp.trim(),
            pic: pic.trim(),
        };

        const res = await api.post('/calon-customer', payload);

        if (!res.data?.success) {
            Toast.show({
            type: 'glassError',
            text1: 'Gagal Menyimpan',
            text2: res.data?.message || 'Gagal menyimpan data',
            });
            return;
        }

        setSavedKode(String(res.data?.data?.cc_kode || '-'));
        setSuccessModalVisible(true);
        } catch (err: any) {
        Toast.show({
            type: 'glassError',
            text1: 'Error',
            text2: err?.response?.data?.message || 'Gagal koneksi ke server',
        });
        } finally {
        setLoading(false);
        }
    };

    return (
        <LinearGradient
        colors={[THEME.bgTop, THEME.bgBottom]}
        style={styles.container}
        >
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
        >
            <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            >
            {/* HERO */}
            <View style={styles.header}>
                <Text style={styles.title}>Calon Customer</Text>
                <Text style={styles.subtitle}>Isi data calon customer baru</Text>

                <View style={styles.badge}>
                <Text style={styles.badgeText}>{cabang || '-'}</Text>
                </View>
            </View>

            {/* FORM */}
            <View style={styles.formCard}>
                <Text style={styles.label}>Nama Customer</Text>
                <View style={styles.inputContainer}>
                <TextInput
                    value={nama}
                    onChangeText={setNama}
                    placeholder="Nama customer"
                    placeholderTextColor={THEME.muted}
                    style={styles.input}
                />
                </View>

                <Text style={styles.label}>Alamat</Text>
                <View style={[styles.inputContainer, styles.textArea]}>
                <TextInput
                    value={alamat}
                    onChangeText={setAlamat}
                    placeholder="Alamat lengkap"
                    placeholderTextColor={THEME.muted}
                    multiline
                    style={[styles.input, { height: 90 }]}
                />
                </View>

                <Text style={styles.label}>Cabang</Text>
                <View style={[styles.inputContainer, { opacity: 0.7 }]}>
                <TextInput value={cabang} editable={false} style={styles.input} />
                </View>

                <Text style={styles.label}>No Telp</Text>
                <View style={styles.inputContainer}>
                <TextInput
                    value={telp}
                    onChangeText={(t) => setTelp(t.replace(/[^0-9+]/g, ''))}
                    placeholder="08xxxxxxxxxx"
                    placeholderTextColor={THEME.muted}
                    keyboardType="phone-pad"
                    style={styles.input}
                />
                </View>

                <Text style={styles.label}>Contact Person</Text>
                <View style={styles.inputContainer}>
                <TextInput
                    value={pic}
                    onChangeText={setPic}
                    placeholder="..."
                    placeholderTextColor={THEME.muted}
                    style={styles.input}
                />
                </View>

                <TouchableOpacity
                onPress={simpan}
                disabled={!canSubmit}
                activeOpacity={0.9}
                style={[styles.primaryBtn, !canSubmit && { opacity: 0.6 }]}
                >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.primaryBtnText}>Simpan</Text>
                )}
                </TouchableOpacity>

                <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.secondaryBtn}
                >
                <Text style={styles.secondaryBtnText}>Kembali</Text>
                </TouchableOpacity>
            </View>
            </ScrollView>
        </KeyboardAvoidingView>

        {/* MODAL SUKSES */}
        <Modal
            isVisible={isSuccessModalVisible}
            onBackdropPress={() => setSuccessModalVisible(false)}
            backdropOpacity={0.45}
            animationIn="zoomIn"
            animationOut="zoomOut"
        >
            <View style={styles.modalCard}>
            <View style={styles.modalIndicator} />
            <Text style={styles.modalTitle}>Berhasil</Text>
            <Text style={styles.modalSubtitle}>Calon customer berhasil disimpan</Text>

            <Text style={styles.modalSubtitle}>Kode</Text>
            <Text style={styles.modalCode}>{savedKode}</Text>

            <View style={styles.modalRow}>
                <TouchableOpacity
                style={styles.modalBtnSoft}
                onPress={() => {
                    setSuccessModalVisible(false);
                    resetForm();
                }}
                >
                <Text style={styles.modalSoftText}>Tambah Lagi</Text>
                </TouchableOpacity>

                <TouchableOpacity
                style={styles.modalBtnPrimary}
                onPress={() => {
                    setSuccessModalVisible(false);
                    navigation.reset({
                    index: 0,
                    routes: [{ name: 'Home' }],
                    });
                }}
                >
                <Text style={styles.modalPrimaryText}>Ke Home</Text>
                </TouchableOpacity>
            </View>
            </View>
        </Modal>
        </LinearGradient>
    );
    }

    /* ================= STYLES ================= */

    const styles = StyleSheet.create({
    container: { flex: 1 },
    scroll: { padding: 22, paddingBottom: 30 },

    header: { alignItems: 'center', marginBottom: 16 },
    title: { fontSize: 24, fontWeight: '900', color: THEME.ink },
    subtitle: { marginTop: 6, color: THEME.muted, fontSize: 13, fontWeight: '700' },

    badge: {
        marginTop: 10,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(79,70,229,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(79,70,229,0.2)',
    },
    badgeText: { color: THEME.primary, fontWeight: '900', fontSize: 12 },

    searchCard: {
        backgroundColor: THEME.card,
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: THEME.line,
        marginBottom: 14,
    },

    searchRow: { flexDirection: 'row', gap: 10 },

    formCard: {
        backgroundColor: THEME.card,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: THEME.line,
    },

    label: {
        color: THEME.muted,
        fontSize: 12,
        fontWeight: '800',
        marginBottom: 6,
        marginTop: 8,
        marginLeft: 4,
        textTransform: 'uppercase',
    },

    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: THEME.soft,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: THEME.line,
        paddingHorizontal: 12,
        height: 54,
        marginBottom: 10,
    },
    textArea: { height: 110, alignItems: 'flex-start', paddingTop: 10 },

    input: { flex: 1, color: THEME.ink, fontSize: 15, fontWeight: '700' },

    searchBtn: {
        backgroundColor: THEME.primary,
        borderRadius: 14,
        paddingHorizontal: 16,
        justifyContent: 'center',
    },
    searchBtnText: { color: '#fff', fontWeight: '900', fontSize: 13 },

    primaryBtn: {
        backgroundColor: THEME.primary,
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 10,
    },
    primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },

    secondaryBtn: {
        marginTop: 10,
        paddingVertical: 12,
        alignItems: 'center',
    },
    secondaryBtnText: { color: THEME.muted, fontWeight: '800' },

    modalCard: {
        backgroundColor: '#fff',
        borderRadius: 22,
        padding: 22,
        alignItems: 'center',
    },
    modalIndicator: {
        width: 44,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#E5E7EB',
        marginBottom: 16,
    },
    modalTitle: { fontSize: 18, fontWeight: '900', color: THEME.ink },
    modalSubtitle: { marginTop: 6, color: THEME.muted, fontSize: 13 },
    modalCode: { marginTop: 6, fontSize: 16, fontWeight: '900', color: THEME.ink },

    modalRow: { flexDirection: 'row', gap: 12, marginTop: 18 },

    modalBtnSoft: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: THEME.soft,
        alignItems: 'center',
    },
    modalSoftText: { color: THEME.muted, fontWeight: '900' },

    modalBtnPrimary: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: THEME.primary,
        alignItems: 'center',
    },
    modalPrimaryText: { color: '#fff', fontWeight: '900' },
});
