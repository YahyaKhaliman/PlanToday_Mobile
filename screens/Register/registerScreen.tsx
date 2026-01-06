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
import DeviceInfo from 'react-native-device-info';
import LinearGradient from 'react-native-linear-gradient';
import api from '../../services/api';
import { GlassSelect } from './glassSelect';
import Toast from 'react-native-toast-message';

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

export default function RegisterScreen({ navigation }: any) {
    const [nama, setNama] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);

    const [jabatan, setJabatan] = useState<'MANAGER' | 'SALES'>('MANAGER');
    const [cabang, setCabang] = useState('PUSAT');

    const [loading, setLoading] = useState(false);

    const [openJabatan, setOpenJabatan] = useState(false);
    const [openCabang, setOpenCabang] = useState(false);

    const jabatanOptions = [
        { label: 'MANAGER', value: 'MANAGER' },
        { label: 'SALES', value: 'SALES' },
    ];

    const cabangOptions = [
        { label: 'PUSAT', value: 'PUSAT' },
        { label: 'JATIM', value: 'JATIM' },
        { label: 'JATENG', value: 'JATENG' },
        { label: 'JAKARTA', value: 'JAKARTA' },
    ];

    const canSubmit = useMemo(() => {
        return nama.trim().length > 0 && password.length >= 3 && !loading;
    }, [nama, password, loading]);

    const register = async () => {
        if (!nama.trim() || !password) {
        Toast.show({
            type: 'glassError',
            text1: 'Validasi',
            text2: 'Nama dan password wajib diisi',
        });
        return;
        }

        if (password.length < 3) {
        Toast.show({
            type: 'glassError',
            text1: 'Validasi',
            text2: 'Password minimal 3 karakter',
        });
        return;
        }

        setLoading(true);
        try {
        const deviceId = await DeviceInfo.getAndroidId();

        const payload = {
            nama: nama.trim(),
            password,
            jabatan,
            cabang,
            deviceId,
        };

        const res = await api.post('/register', payload);

        if (!res.data?.success) {
            Toast.show({
            type: 'glassError',
            text1: 'Gagal',
            text2: res.data?.message || 'Registrasi Gagal',
            });
            return;
        }

        Toast.show({
            type: 'glassSuccess',
            text1: 'Berhasil',
            text2: res.data?.message || 'Registrasi Berhasil',
        });

        setTimeout(() => {
            navigation.replace('Login');
        }, 800);

        setNama('');
        setPassword('');
        setJabatan('SALES');
        setCabang('PUSAT');
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
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
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
                <Text style={styles.welcomeText}>REGISTER</Text>
                <Text style={styles.subWelcomeText}>PLAN TODAY</Text>
                </View>

                {/* Form Card */}
                <View style={styles.formWrap}>
                <View style={styles.formCard}>
                    <Text style={styles.formTitle}>Buat Akun</Text>
                    <Text style={styles.formDesc}>Lengkapi data berikut untuk mendaftar</Text>

                    {/* Nama */}
                    <Text style={styles.label}>Nama</Text>
                    <View style={styles.inputContainer}>
                    <LinearGradient
                        colors={['rgba(79,70,229,0.18)', 'rgba(6,182,212,0.14)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.inputIconWrap}
                    >
                        <Text style={styles.iconPlaceholder}>👤</Text>
                    </LinearGradient>

                    <TextInput
                        placeholder="Nama"
                        placeholderTextColor={THEME.muted}
                        value={nama}
                        onChangeText={setNama}
                        style={styles.input}
                        editable={!loading}
                        returnKeyType="next"
                    />
                    </View>

                    {/* Password */}
                    <Text style={styles.label}>Password</Text>
                    <View style={styles.inputContainer}>
                    <LinearGradient
                        colors={['rgba(79,70,229,0.18)', 'rgba(6,182,212,0.14)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.inputIconWrap}
                    >
                        <Text style={styles.iconPlaceholder}>🔒</Text>
                    </LinearGradient>

                    <TextInput
                        placeholder="Password"
                        placeholderTextColor={THEME.muted}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPass}
                        style={styles.input}
                        editable={!loading}
                        returnKeyType="done"
                    />

                    <TouchableOpacity
                        onPress={() => setShowPass(v => !v)}
                        style={styles.showBtn}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.showBtnText}>{showPass ? 'HIDE' : 'SHOW'}</Text>
                    </TouchableOpacity>
                    </View>

                    {/* Jabatan */}
                    <GlassSelect
                    label="Jabatan"
                    value={jabatan}
                    options={jabatanOptions}
                    visible={openJabatan}
                    onOpen={() => setOpenJabatan(true)}
                    onClose={() => setOpenJabatan(false)}
                    onSelect={v => setJabatan(v as any)}
                    />

                    {/* Cabang */}
                    <GlassSelect
                    label="Cabang"
                    value={cabang}
                    options={cabangOptions}
                    visible={openCabang}
                    onOpen={() => setOpenCabang(true)}
                    onClose={() => setOpenCabang(false)}
                    onSelect={v => setCabang(v)}
                    />

                    {/* Button Register */}
                    <TouchableOpacity
                    onPress={register}
                    disabled={!canSubmit}
                    activeOpacity={0.9}
                    style={{ marginTop: 14, opacity: canSubmit ? 1 : 0.65 }}
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
                        <Text style={styles.primaryButtonText}>Register</Text>
                        )}
                    </LinearGradient>
                    </TouchableOpacity>

                    {/* Back to login */}
                    <TouchableOpacity
                    onPress={() => navigation.replace('Login')}
                    style={styles.footerLink}
                    disabled={loading}
                    activeOpacity={0.85}
                    >
                    <Text style={styles.footerText}>
                        Sudah punya akun? <Text style={styles.footerLinkBold}>Login</Text>
                    </Text>
                    </TouchableOpacity>
                </View>
                </View>
            </LinearGradient>
            </ScrollView>
        </KeyboardAvoidingView>
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
    welcomeText: {
        fontSize: 26,
        fontWeight: '900',
        color: THEME.ink,
        letterSpacing: 0.5,
    },
    subWelcomeText: {
        marginTop: 6,
        fontSize: 12,
        fontWeight: '800',
        color: THEME.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.9,
    },

    /* Form card dibuat proporsional (tidak terlalu lebar) */
    formWrap: { alignItems: 'center' },
    formCard: {
        width: '100%',
        maxWidth: 380,
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
        letterSpacing: 0.4,
    },
    formDesc: {
        marginTop: 6,
        marginBottom: 14,
        color: THEME.muted,
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
    },

    label: {
        color: THEME.muted,
        fontSize: 12,
        marginBottom: 6,
        marginLeft: 4,
        marginTop: 6,
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
    iconPlaceholder: { fontSize: 16 },

    input: {
        flex: 1,
        color: THEME.ink,
        fontSize: 16,
        fontWeight: '700',
    },

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
    primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },

    footerLink: { marginTop: 14, alignItems: 'center' },
    footerText: { color: THEME.muted, fontSize: 13, fontWeight: '700' },
    footerLinkBold: { fontWeight: '900', textDecorationLine: 'underline', color: THEME.ink },
});
