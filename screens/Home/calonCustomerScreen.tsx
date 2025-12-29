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

export default function CalonCustomerScreen({ navigation }: any) {
    const { user } = useAuth();

    const [cariKeyword, setCariKeyword] = useState('');

    const [nama, setNama] = useState('');
    const [alamat, setAlamat] = useState('');
    const [telp, setTelp] = useState('');
    const [pic, setPic] = useState('');
    const [loading, setLoading] = useState(false);

    const cabang = user?.cabang || '';

    const [isSuccessModalVisible, setSuccessModalVisible] = useState(false);
    const [savedKode, setSavedKode] = useState<string>('');

    const closeSuccessModal = () => setSuccessModalVisible(false);

    const resetForm = () => {
        setNama('');
        setAlamat('');
        setTelp('');
        setPic('');
    };

    const canSubmit = useMemo(() => {
        return nama.trim().length > 0 && !loading;
    }, [nama, loading]);

    const gotoCariCustomer = () => {
        navigation.navigate('CariCustomer', {
        keyword: cariKeyword,
        from: 'CALON_CUSTOMER',
        });
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

        const kode = res.data?.data?.cc_kode;
        setSavedKode(String(kode || '-'));

        setSuccessModalVisible(true);
        } catch (err: any) {
        Toast.show({
            type: 'glassError',
            text1: 'Error',
            text2: err?.response?.data?.message || 'Gagal Koneksi ke server',
        });
        } finally {
        setLoading(false);
        }
    };

    return (
        <LinearGradient colors={['#5D59A2', '#3B3A82', '#1E224F']} style={styles.container}>
        <StatusBar barStyle="light-content" />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Calon Customer</Text>
                <Text style={styles.subtitle}>Isi data calon customer baru</Text>

                <View style={styles.badgeRow}>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{(cabang || '-').toUpperCase()}</Text>
                </View>
                </View>
            </View>

            {/* ✅ MENU CARI CUSTOMER (BARU) */}
            <View style={styles.searchCard}>
                <Text style={styles.searchLabel}>Cari Customer</Text>

                <View style={styles.searchRow}>
                <View style={[styles.glassInputContainer, { flex: 1, marginBottom: 0 }]}>
                    <Text style={styles.icon}>🔎</Text>
                    <TextInput
                    value={cariKeyword}
                    onChangeText={setCariKeyword}
                    placeholder="Cari customer"
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    style={styles.input}
                    editable={!loading}
                    returnKeyType="search"
                    onSubmitEditing={gotoCariCustomer}
                    />
                </View>

                <TouchableOpacity
                    onPress={gotoCariCustomer}
                    disabled={loading}
                    activeOpacity={0.85}
                    style={[styles.searchBtn, loading && { opacity: 0.7 }]}
                >
                    <Text style={styles.searchBtnText}>CARI</Text>
                </TouchableOpacity>
                </View>
            </View>

            {/* Form Card (Glass) */}
            <View style={styles.formCard}>
                <Text style={styles.label}>Nama Customer</Text>
                <View style={styles.glassInputContainer}>
                <Text style={styles.icon}>🏢</Text>
                <TextInput
                    value={nama}
                    onChangeText={setNama}
                    placeholder="Nama customer..."
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    style={styles.input}
                    editable={!loading}
                />
                </View>

                <Text style={styles.label}>Alamat</Text>
                <View style={[styles.glassInputContainer, { height: 110, alignItems: 'flex-start', paddingTop: 12 }]}>
                <Text style={[styles.icon, { marginTop: 2 }]}>📍</Text>
                <TextInput
                    value={alamat}
                    onChangeText={setAlamat}
                    placeholder="Alamat lengkap..."
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    multiline
                    textAlignVertical="top"
                    style={[styles.input, { height: 92 }]}
                    editable={!loading}
                />
                </View>

                <Text style={styles.label}>Cabang</Text>
                <View style={[styles.glassInputContainer, { opacity: 0.8 }]}>
                <Text style={styles.icon}>🏷️</Text>
                <TextInput value={cabang} editable={false} style={[styles.input, { color: 'rgba(255,255,255,0.85)' }]} />
                </View>

                <Text style={styles.label}>No Telp</Text>
                <View style={styles.glassInputContainer}>
                <Text style={styles.icon}>📞</Text>
                <TextInput
                    value={telp}
                    onChangeText={(t) => setTelp(t.replace(/[^0-9+]/g, ''))}
                    placeholder="08xxxxxxxxxx"
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    keyboardType="phone-pad"
                    style={styles.input}
                    editable={!loading}
                />
                </View>

                <Text style={styles.label}>Narahubung (CP)</Text>
                <View style={styles.glassInputContainer}>
                <Text style={styles.icon}>👤</Text>
                <TextInput
                    value={pic}
                    onChangeText={setPic}
                    placeholder="Nama contact person..."
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    style={styles.input}
                    editable={!loading}
                />
                </View>

                {/* Action Buttons */}
                <TouchableOpacity
                onPress={simpan}
                disabled={!canSubmit}
                activeOpacity={0.85}
                style={[styles.primaryButton, !canSubmit && { opacity: 0.7 }]}
                >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Simpan</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.goBack()} disabled={loading} activeOpacity={0.85} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Kembali</Text>
                </TouchableOpacity>
            </View>
            </ScrollView>
        </KeyboardAvoidingView>

        <Modal
            isVisible={isSuccessModalVisible}
            onBackdropPress={closeSuccessModal}
            backdropOpacity={0.45}
            animationIn="zoomIn"
            animationOut="zoomOut"
        >
            <View style={styles.glassModal}>
            <View style={styles.modalIndicator} />

            <Text style={styles.modalTitle}>Sukses</Text>
            <Text style={styles.modalSubtitle}>Calon customer berhasil disimpan.</Text>

            <Text style={styles.modalSubtitle}>Kode:</Text>
            <Text style={styles.modalUserName}>{savedKode || '-'}</Text>

            <View style={styles.modalActionRow}>
                <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => {
                    closeSuccessModal();
                    resetForm();
                }}
                activeOpacity={0.85}
                >
                <Text style={styles.textCancel}>Tambah Lagi</Text>
                </TouchableOpacity>

                <TouchableOpacity
                style={styles.btnLogoutConfirm}
                onPress={() => {
                    closeSuccessModal();
                    navigation.reset({
                    index: 0,
                    routes: [{ name: 'Home' }],
                    });
                }}
                activeOpacity={0.85}
                >
                <Text style={styles.textLogout}>Ke Home</Text>
                </TouchableOpacity>
            </View>
            </View>
        </Modal>
        </LinearGradient>
    );
    }

    const styles = StyleSheet.create({
    container: { flex: 1 },
    scroll: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 24,
    },

    header: { alignItems: 'center', marginBottom: 18 },
    title: { fontSize: 30, fontWeight: '300', color: '#fff' },
    subtitle: { marginTop: 6, color: 'rgba(255,255,255,0.8)', fontSize: 13 },

    badgeRow: { marginTop: 12, flexDirection: 'row' },
    badge: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
    },
    badgeText: { color: '#fff', fontWeight: '800', letterSpacing: 0.6, fontSize: 12 },

    // ✅ Search card
    searchCard: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        padding: 16,
        marginBottom: 12,
    },
    searchLabel: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 12,
        marginBottom: 8,
        marginLeft: 4,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
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

    formCard: {
        backgroundColor: 'rgba(255,255,255,0.10)',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        padding: 16,
    },

    label: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 12,
        marginBottom: 6,
        marginLeft: 4,
        marginTop: 6,
    },

    glassInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        paddingHorizontal: 14,
        marginBottom: 10,
        height: 55,
    },
    icon: { fontSize: 18, marginRight: 10 },
    input: { flex: 1, color: '#fff', fontSize: 15,},

    primaryButton: {
        backgroundColor: '#233975',
        borderRadius: 30,
        paddingVertical: 14,
        marginTop: 14,
        alignItems: 'center',
        elevation: 8,
    },
    primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

    secondaryButton: {
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: 30,
        paddingVertical: 12,
        marginTop: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
    },
    secondaryButtonText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '800' },

    // Modal styles
    glassModal: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 22,
        padding: 22,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    modalIndicator: {
        width: 44,
        height: 4,
        backgroundColor: '#DDD',
        borderRadius: 2,
        marginBottom: 18,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#1E224F',
    },
    modalSubtitle: {
        marginTop: 8,
        fontSize: 13,
        color: '#555',
        textAlign: 'center',
    },
    modalUserName: {
        marginTop: 8,
        fontSize: 16,
        fontWeight: '900',
        color: '#111827',
        textTransform: 'uppercase',
    },
    modalActionRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 18,
    },
    btnCancel: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#EEF0F6',
        alignItems: 'center',
    },
    btnLogoutConfirm: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#233975',
        alignItems: 'center',
    },
    textCancel: { color: '#6B7280', fontWeight: '800' },
    textLogout: { color: '#FFF', fontWeight: '900' },
});
