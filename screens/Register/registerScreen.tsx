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
            text2: 'Nama dan password wajib diisi'
        })
        return;
        }

        if (password.length < 3) {
        Toast.show({
            type: 'glassError',
            text1: 'Validasi',
            text2: 'Password minimal 3 karakter'
        })
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
                text2: res.data?.message || 'Registrasi Gagal'
            })
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
            text2: err?.response?.data?.message || 'Gagal koneksi ke server'
        })
        } finally {
        setLoading(false);
        }
    };

    return (
        <LinearGradient colors={['#5D59A2', '#3B3A82', '#1E224F']} style={styles.container}>
        <StatusBar barStyle="light-content" />

        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
        >
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.welcomeText}>Register</Text>
                <Text style={styles.subWelcomeText}>PLAN TODAY</Text>
            </View>

            {/* Form */}
            <View style={styles.formContainer}>
                {/* Nama */}
                <View style={styles.glassInputContainer}>
                <Text style={styles.iconPlaceholder}>👤</Text>
                <TextInput
                    placeholder="Nama"
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    value={nama}
                    onChangeText={setNama}
                    style={styles.input}
                />
                </View>

                {/* Password */}
                <View style={styles.glassInputContainer}>
                <Text style={styles.iconPlaceholder}>🔒</Text>
                <TextInput
                    placeholder="Password"
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPass}
                    style={styles.input}
                />
                <TouchableOpacity
                    onPress={() => setShowPass(v => !v)}
                    style={{ paddingHorizontal: 6 }}
                    disabled={loading}
                >
                    <Text style={{ color: '#fff', fontWeight: '800' }}>
                    {showPass ? 'HIDE' : 'SHOW'}
                    </Text>
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
                    onSelect={(v) => setJabatan(v as any)}
                />

                {/* Cabang */}
                <GlassSelect
                    label="Cabang"
                    value={cabang}
                    options={cabangOptions}
                    visible={openCabang}
                    onOpen={() => setOpenCabang(true)}
                    onClose={() => setOpenCabang(false)}
                    onSelect={(v) => setCabang(v)}
                />

                {/* Button Register */}
                <TouchableOpacity
                onPress={register}
                disabled={!canSubmit}
                style={[styles.primaryButton, !canSubmit && { opacity: 0.7 }]}
                activeOpacity={0.85}
                >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.primaryButtonText}>Register</Text>
                )}
                </TouchableOpacity>

                {/* Back to login */}
                <TouchableOpacity
                onPress={() => navigation.replace('Login')}
                style={{ marginTop: 16, alignItems: 'center' }}
                disabled={loading}
                >
                <Text style={styles.footerText}>
                    <Text style={styles.footerLinkBold}>Login</Text>
                </Text>
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
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 30,
        paddingVertical: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
    },
    welcomeText: {
        fontSize: 30,
        fontWeight: '300',
        color: '#FFFFFF',
    },
    subWelcomeText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 6,
    },
    formContainer: {
        width: '100%',
    },

    // Glass Input
    glassInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        paddingHorizontal: 15,
        marginBottom: 15,
        height: 55,
    },
    iconPlaceholder: { fontSize: 18, marginRight: 10 },
    input: { flex: 1, color: '#FFFFFF', fontSize: 16 },

    // Picker
    label: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 12,
        marginBottom: 6,
        marginLeft: 4,
    },
    glassPickerContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        marginBottom: 10,
        overflow: 'hidden',
    },
    picker: {
        height: 52,
        color: '#FFFFFF', // untuk text selected (kadang Android beda)
    },

    // Button
    primaryButton: {
        backgroundColor: '#233975',
        borderRadius: 30,
        paddingVertical: 15,
        marginTop: 22,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },

    footerText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 13,
    },
    footerLinkBold: {
        fontWeight: 'bold',
        textDecorationLine: 'underline',
    },
});
