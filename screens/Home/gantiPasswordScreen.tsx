/* eslint-disable react-native/no-inline-styles */
import React, { useMemo, useState } from 'react';
import {
        View,
        Text,
        TextInput,
        TouchableOpacity,
        ActivityIndicator,
        KeyboardAvoidingView,
        Platform,
        ScrollView,
        StyleSheet,
        StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import api from '../../services/api';
import { useAuth } from '../../context/authContext';
import Toast from 'react-native-toast-message';
import Modal from 'react-native-modal';

export default function GantiPasswordScreen({ navigation }: any) {
    const { user, logout } = useAuth();

    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);

    const [loading, setLoading] = useState(false);

    // modal konfirmasi logout setelah berhasil ganti password
    const [isModalVisible, setModalVisible] = useState(false);
    const toggleModal = () => setModalVisible((v) => !v);

    const canSubmit = useMemo(() => {
        return oldPassword.length >= 3 && newPassword.length >= 3 && !loading;
    }, [oldPassword, newPassword, loading]);

    const simpan = async () => {
        // VALIDASI pakai Toast
        if (oldPassword.length < 3 || newPassword.length < 3) {
        Toast.show({
            type: 'glassError',
            text1: 'Validasi',
            text2: 'Password minimal 3 karakter.',
        });
        return;
        }

        if (!user?.nama) {
        Toast.show({
            type: 'glassError',
            text1: 'Validasi',
            text2: 'User belum ada (login dulu)',
        });
        return;
        }

        setLoading(true);
        try {
        const payload = {
            user: user.nama,
            oldPassword,
            newPassword,
        };

        const res = await api.post('/ganti-password', payload);

        if (!res.data?.success) {
            Toast.show({
            type: 'glassError',
            text1: 'Gagal',
            text2: res.data?.message || 'Gagal mengganti password',
            });
            return;
        }

        Toast.show({
            type: 'glassSuccess',
            text1: 'Berhasil',
            text2: res.data?.message || 'Password berhasil diubah',
        });

        // reset form
        setOldPassword('');
        setNewPassword('');

        // tampilkan modal konfirmasi logout
        setModalVisible(true);
        } catch (err: any) {
        Toast.show({
            type: 'glassError',
            text1: 'Sistem Error',
            text2: err?.response?.data?.message || err?.message || 'Gagal koneksi ke server',
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
                <Text style={styles.title}>Ganti Password</Text>
                <Text style={styles.subtitle}>Setelah berhasil, kamu akan logout untuk login ulang</Text>
            </View>

            {/* Form Card */}
            <View style={styles.formCard}>
                <Text style={styles.label}>Password Lama</Text>
                <View style={styles.glassInputContainer}>
                <Text style={styles.icon}>🔒</Text>
                <TextInput
                    value={oldPassword}
                    onChangeText={setOldPassword}
                    secureTextEntry={!showOld}
                    placeholder="..."
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    style={styles.input}
                    editable={!loading}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <TouchableOpacity
                    onPress={() => setShowOld((v) => !v)}
                    style={styles.showBtn}
                    disabled={loading}
                    activeOpacity={0.85}
                >
                    <Text style={styles.showText}>{showOld ? 'HIDE' : 'SHOW'}</Text>
                </TouchableOpacity>
                </View>

                <Text style={styles.label}>Password Baru</Text>
                <View style={styles.glassInputContainer}>
                <Text style={styles.icon}>🔐</Text>
                <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNew}
                    placeholder="..."
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    style={styles.input}
                    editable={!loading}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <TouchableOpacity
                    onPress={() => setShowNew((v) => !v)}
                    style={styles.showBtn}
                    disabled={loading}
                    activeOpacity={0.85}
                >
                    <Text style={styles.showText}>{showNew ? 'HIDE' : 'SHOW'}</Text>
                </TouchableOpacity>
                </View>

                {/* Button Simpan */}
                <TouchableOpacity
                onPress={simpan}
                disabled={!canSubmit}
                style={[styles.primaryButton, !canSubmit && { opacity: 0.6 }]}
                activeOpacity={0.85}
                >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>SIMPAN</Text>}
                </TouchableOpacity>

                {/* Back */}
                <TouchableOpacity
                onPress={() => navigation.goBack()}
                disabled={loading}
                style={styles.secondaryButton}
                activeOpacity={0.85}
                >
                <Text style={styles.secondaryButtonText}>Kembali</Text>
                </TouchableOpacity>
            </View>
            </ScrollView>
        </KeyboardAvoidingView>

        <Modal
            isVisible={isModalVisible}
            onBackdropPress={toggleModal}
            backdropOpacity={0.45}
            animationIn="zoomIn"
            animationOut="zoomOut"
        >
            <View style={styles.glassModal}>
            <View style={styles.modalIndicator} />

            <Text style={styles.modalTitle}>Berhasil</Text>
            <Text style={styles.modalSubtitle}>Password sudah diubah.</Text>
            <Text style={styles.modalSubtitle}>Silakan login ulang.</Text>

            <Text style={styles.modalUserName}>{user?.nama}</Text>

            <View style={styles.modalActionRow}>
                <TouchableOpacity style={styles.btnCancel} onPress={toggleModal} activeOpacity={0.85}>
                <Text style={styles.textCancel}>Nanti</Text>
                </TouchableOpacity>

                <TouchableOpacity
                style={styles.btnLogoutConfirm}
                onPress={() => {
                    toggleModal();
                    logout?.();
                }}
                activeOpacity={0.85}
                >
                <Text style={styles.textLogout}>Logout</Text>
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
        paddingHorizontal: 25,
        paddingVertical: 40,
    },

    header: { alignItems: 'center', marginBottom: 22 },
    title: { fontSize: 30, fontWeight: '300', color: '#fff', letterSpacing: 1 },
    subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 6, textAlign: 'center' },

    formCard: {
        backgroundColor: 'rgba(255,255,255,0.10)',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.20)',
    },

    label: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 13,
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
        borderColor: 'rgba(255, 255, 255, 0.30)',
        paddingHorizontal: 15,
        marginBottom: 12,
        height: 55,
    },

    icon: { fontSize: 18, marginRight: 10 },
    input: { flex: 1, color: '#fff', fontSize: 16 },

    showBtn: { paddingHorizontal: 6, paddingVertical: 8 },
    showText: { color: '#fff', fontWeight: '800' },

    primaryButton: {
        backgroundColor: '#233975',
        borderRadius: 30,
        paddingVertical: 15,
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
        marginTop: 12,
        alignItems: 'center',
        paddingVertical: 10,
    },
    secondaryButtonText: { color: 'rgba(255,255,255,0.65)', fontSize: 14, fontWeight: '700' },

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
        marginTop: 10,
        fontSize: 15,
        fontWeight: '800',
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
        backgroundColor: '#E74C3C',
        alignItems: 'center',
    },
    textCancel: { color: '#6B7280', fontWeight: '800' },
    textLogout: { color: '#FFF', fontWeight: '900' },
});
