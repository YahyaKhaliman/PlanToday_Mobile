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

export default function GantiPasswordScreen({ navigation }: any) {
    const { user, logout } = useAuth();

    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);

    const [loading, setLoading] = useState(false);

    const [isModalVisible, setModalVisible] = useState(false);
    const toggleModal = () => setModalVisible(v => !v);

    const canSubmit = useMemo(() => {
        return oldPassword.length >= 3 && newPassword.length >= 3 && !loading;
    }, [oldPassword, newPassword, loading]);

    const simpan = async () => {
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

        setOldPassword('');
        setNewPassword('');

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
        <LinearGradient
        colors={[THEME.bgTop, THEME.bgBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
        >
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* HERO ala Home */}
            <LinearGradient
                colors={[
                'rgba(79,70,229,0.16)',
                'rgba(6,182,212,0.10)',
                'rgba(255,255,255,0.00)',
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.hero}
            >
                {/* Header */}
                <View style={styles.header}>
                <Text style={styles.title}>Ganti Password</Text>
                </View>

                {/* Form Card */}
                <View style={styles.formCard}>
                {/* Password Lama */}
                <Text style={styles.label}>Password Lama</Text>
                <View style={styles.inputContainer}>
                    <LinearGradient
                    colors={['rgba(79,70,229,0.18)', 'rgba(6,182,212,0.14)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.inputIconWrap}
                    >
                    <Text style={styles.icon}>🔒</Text>
                    </LinearGradient>

                    <TextInput
                    value={oldPassword}
                    onChangeText={setOldPassword}
                    secureTextEntry={!showOld}
                    placeholder="..."
                    placeholderTextColor={THEME.muted}
                    style={styles.input}
                    editable={!loading}
                    autoCapitalize="none"
                    autoCorrect={false}
                    />

                    <TouchableOpacity
                    onPress={() => setShowOld(v => !v)}
                    style={styles.showBtn}
                    disabled={loading}
                    activeOpacity={0.85}
                    >
                    <Text style={styles.showBtnText}>{showOld ? 'HIDE' : 'SHOW'}</Text>
                    </TouchableOpacity>
                </View>

                {/* Password Baru */}
                <Text style={styles.label}>Password Baru</Text>
                <View style={styles.inputContainer}>
                    <LinearGradient
                    colors={['rgba(79,70,229,0.18)', 'rgba(6,182,212,0.14)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.inputIconWrap}
                    >
                    <Text style={styles.icon}>🔐</Text>
                    </LinearGradient>

                    <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNew}
                    placeholder="..."
                    placeholderTextColor={THEME.muted}
                    style={styles.input}
                    editable={!loading}
                    autoCapitalize="none"
                    autoCorrect={false}
                    />

                    <TouchableOpacity
                    onPress={() => setShowNew(v => !v)}
                    style={styles.showBtn}
                    disabled={loading}
                    activeOpacity={0.85}
                    >
                    <Text style={styles.showBtnText}>{showNew ? 'HIDE' : 'SHOW'}</Text>
                    </TouchableOpacity>
                </View>

                {/* Button Simpan */}
                <TouchableOpacity
                    onPress={simpan}
                    disabled={!canSubmit}
                    activeOpacity={0.9}
                    style={{ marginTop: 10, opacity: canSubmit ? 1 : 0.6 }}
                >
                    <LinearGradient
                    colors={[THEME.primary, THEME.accent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.primaryButton}
                    >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.primaryButtonText}>SIMPAN</Text>
                    )}
                    </LinearGradient>
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
            </LinearGradient>
            </ScrollView>
        </KeyboardAvoidingView>

        {/* Modal logout */}
        <Modal
            isVisible={isModalVisible}
            onBackdropPress={toggleModal}
            backdropOpacity={0.45}
            animationIn="zoomIn"
            animationOut="zoomOut"
        >
            <View style={styles.modalCard}>
            <View style={styles.modalIndicator} />

            <Text style={styles.modalTitle}>Berhasil</Text>
            <Text style={styles.modalSubtitle}>Password sudah diubah.</Text>
            <Text style={styles.modalSubtitle}>Silakan login ulang.</Text>

            <Text style={styles.modalUserName}>{user?.nama || '-'}</Text>

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
        paddingHorizontal: 22,
        paddingTop: Platform.OS === 'android' ? 54 : 10,
        paddingBottom: 24,
    },

    hero: {
        borderRadius: 26,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(79,70,229,0.12)',
        backgroundColor: 'rgba(255,255,255,0.50)',
    },

    header: { alignItems: 'center', marginBottom: 14 },
    title: { fontSize: 26, fontWeight: '900', color: THEME.ink, letterSpacing: 0.4 },
    subtitle: {
        marginTop: 8,
        color: THEME.muted,
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
        lineHeight: 16,
    },

    formCard: {
        backgroundColor: THEME.card,
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: THEME.line,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 3,
    },

    formTitle: {
        color: THEME.ink,
        fontSize: 18,
        fontWeight: '900',
        textAlign: 'center',
        letterSpacing: 0.2,
        marginBottom: 8,
    },

    label: {
        color: THEME.muted,
        fontSize: 12,
        marginBottom: 6,
        marginLeft: 4,
        marginTop: 10,
        fontWeight: '800',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },

    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: THEME.soft,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: THEME.line,
        paddingHorizontal: 12,
        marginBottom: 12,
        height: 55,
    },

    inputIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(79,70,229,0.14)',
        marginRight: 10,
    },

    icon: { fontSize: 16 },
    input: { flex: 1, color: THEME.ink, fontSize: 16, fontWeight: '700' },

    showBtn: {
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(15,23,42,0.04)',
        borderWidth: 1,
        borderColor: THEME.line,
    },
    showBtnText: { color: THEME.muted, fontWeight: '900', fontSize: 12, letterSpacing: 0.4 },

    primaryButton: {
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
    },
    primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },

    secondaryButton: {
        marginTop: 10,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 14,
    },
    secondaryButtonText: { color: THEME.muted, fontSize: 14, fontWeight: '800' },

    /* Modal ala Home */
    modalCard: {
        backgroundColor: THEME.card,
        borderRadius: 22,
        padding: 22,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: THEME.line,
    },
    modalIndicator: {
        width: 44,
        height: 4,
        backgroundColor: '#E5E7EB',
        borderRadius: 2,
        marginBottom: 18,
    },
    modalTitle: { fontSize: 18, fontWeight: '900', color: THEME.ink },
    modalSubtitle: { marginTop: 8, fontSize: 13, color: THEME.muted, textAlign: 'center', fontWeight: '700' },
    modalUserName: {
        marginTop: 10,
        fontSize: 14,
        fontWeight: '900',
        color: THEME.ink,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    modalActionRow: { flexDirection: 'row', gap: 12, marginTop: 18 },

    btnCancel: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#EEF2F7',
        alignItems: 'center',
    },
    btnLogoutConfirm: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: THEME.danger,
        alignItems: 'center',
    },
    textCancel: { color: THEME.muted, fontWeight: '900' },
    textLogout: { color: '#FFF', fontWeight: '900' },
});
