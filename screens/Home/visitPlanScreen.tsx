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
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import { useAuth } from '../../context/authContext';

export default function VisitPlanScreen({ navigation, route }: any) {
    const { user } = useAuth();

    const [cabang] = useState(user?.cabang || '');
    const [namaSales] = useState(user?.nama || '');
    const [tanggal, setTanggal] = useState(new Date().toISOString().substring(0, 10));
    const [customer, setCustomer] = useState('');
    const [customerKode, setCustomerKode] = useState('');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [showDate, setShowDate] = useState(false);

    useEffect(() => {
        const selected = route?.params?.selectedCustomer;
        if (selected) {
        setCustomerKode(String(selected.kode || ''));
        setCustomer(String(selected.nama || ''));
        }
    }, [route.params?.selectedCustomer]);

    const canSubmit = useMemo(() => {
        return (
        customer.trim().length > 0 && 
        customerKode.trim().length > 0 && 
        !loading
        );
    }, [customer, customerKode, loading]);

    const formatDisplayDate = (ymd: string) => {
        try {
        const [y, m, d] = ymd.split('-').map(n => parseInt(n, 10));
        const dt = new Date(y, m - 1, d);
        const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        return `${dt.getDate()} ${bulan[dt.getMonth()]} ${dt.getFullYear()}`;
        } catch {
        return ymd;
        }
    };

    const ymdToDate = (ymd: string) => {
        const [y, m, d] = ymd.split('-').map(n => parseInt(n, 10));
        return new Date(y, m - 1, d);
    };

    const dateToYmd = (dt: Date) => {
        const yyyy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const simpan = async () => {
        if (!customer.trim() || !customerKode.trim()) {
        Toast.show({
            type: 'glassError',
            text1: 'Validasi Gagal',
            text2: 'Customer harus dipilih terlebih dahulu',
        });
        return;
        }

        setLoading(true);
        try {
        const payload = {
            cus_kode: customerKode.trim(),
            customer_text: customer.trim(),
            tanggal_plan: tanggal,
            note: note.trim() || '-', 
            user: namaSales,
            cabang: cabang,
        };

        const res = await api.post('/visit-plan', payload);

        if (res.data?.success) {
            setCustomer('');
            setCustomerKode('');
            setNote('');
            setTanggal(new Date().toISOString().substring(0, 10));

            Toast.show({
            type: 'glassSuccess',
            text1: 'Simpan Berhasil',
            text2: res.data?.message || 'Rencana kunjungan telah tersimpan',
            });

            setTimeout(() => {
            navigation.navigate('Home');
            }, 500);
        } else {
            throw new Error(res.data?.message || 'Gagal menyimpan data');
        }
        } catch (err: any) {
        Toast.show({
            type: 'glassError',
            text1: 'Gagal Simpan',
            text2: err.response?.data?.message || err.message || 'Gagal koneksi ke server',
        });
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
            <ScrollView 
            contentContainerStyle={styles.scroll} 
            keyboardShouldPersistTaps="handled"
            >
            {/* Header Section */}
            <View style={styles.header}>
                <Text style={styles.title}>Visit Plan</Text>
                <Text style={styles.subtitle}>Input Rencana Kunjungan</Text>
            </View>

            {/* Form Section */}
            <View style={styles.formCard}>
                
                <Text style={styles.label}>Sales (Cabang)</Text>
                <View style={[styles.glassInputContainer, { opacity: 0.7 }]}>
                <Text style={styles.icon}>👤</Text>
                <TextInput
                    value={`${namaSales} (${cabang})`}
                    editable={false}
                    style={styles.input}
                />
                </View>

                <Text style={styles.label}>Tanggal Rencana Visit</Text>
                
                <TouchableOpacity
                onPress={() => setShowDate(true)}
                activeOpacity={0.8}
                style={styles.glassSelect}
                >
                <Text style={styles.selectText}>{formatDisplayDate(tanggal)}</Text>
                <Text style={styles.icon}>📅</Text>
                
                </TouchableOpacity>

                {showDate && (
                <DateTimePicker
                    value={ymdToDate(tanggal)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event: any, selected?: Date) => {
                    setShowDate(false);
                    if (selected) setTanggal(dateToYmd(selected));
                    }}
                />
                )}

                <Text style={styles.label}>Customer</Text>
                <View style={styles.customerRow}>
                <View style={[styles.glassInputContainer, { flex: 1, marginBottom: 0 }]}>
                    <Text style={styles.icon}>🏢</Text>
                    <TextInput
                    value={customer}
                    onChangeText={setCustomer}
                    placeholder="Pilih Customer"
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    style={styles.input}
                    />
                </View>
                <TouchableOpacity
                    onPress={() => navigation.navigate('CariCustomer', { keyword: customer, from: 'VISITPLAN' })}
                    style={styles.searchBtn}
                >
                    <Text style={styles.searchBtnText}>CARI</Text>
                </TouchableOpacity>
                </View>
                {!!customerKode && (
                <Text style={styles.helperText}>Terpilih: {customerKode}</Text>
                )}

                <Text style={styles.label}>Catatan</Text>
                <View style={[styles.glassInputContainer, styles.textAreaContainer]}>
                <Text style={[styles.icon, { marginTop: 4 }]}>📝</Text>
                <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="Tulis rencana kegiatan..."
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    style={[styles.input, { height: 100, paddingTop: 10 }]}
                />
                </View>

                {/* Action Buttons */}
                <TouchableOpacity
                onPress={simpan}
                disabled={!canSubmit}
                style={[styles.primaryButton, !canSubmit && { opacity: 0.5 }]}
                >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.primaryButtonText}>SIMPAN RENCANA</Text>
                )}
                </TouchableOpacity>

                <TouchableOpacity
                onPress={() => navigation.goBack()}
                disabled={loading}
                style={styles.secondaryButton}
                >
                <Text style={styles.secondaryButtonText}>Batal</Text>
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
        paddingHorizontal: 25,
        paddingVertical: 40,
        justifyContent: 'center',
    },
    header: { alignItems: 'center', marginBottom: 30 },
    title: { fontSize: 32, fontWeight: '300', color: '#fff', letterSpacing: 1 },
    subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 5 },
    
    formCard: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    label: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 12,
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
        borderColor: 'rgba(255, 255, 255, 0.3)',
        paddingHorizontal: 15,
        marginBottom: 15,
        height: 55,
    },
    textAreaContainer: {
        height: 120,
        alignItems: 'flex-start',
    },
    pickerHint: { 
        color: 'rgba(255,255,255,0.7)', 
        fontSize: 11,
        marginTop: 4 
    },
    glassSelect: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        paddingHorizontal: 15,
        height: 55,
        marginBottom: 15,
    },
    selectText: { color: '#fff', fontSize: 16, flex: 1, fontWeight: '500' },
    icon: { fontSize: 18, marginRight: 10 },
    input: { flex: 1, color: '#fff', fontSize: 16 },
    
    customerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    searchBtn: {
        backgroundColor: '#233975',
        height: 55,
        paddingHorizontal: 20,
        borderRadius: 15,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    searchBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    helperText: { color: '#FFD700', fontSize: 12, marginTop: 5, marginLeft: 5 },

    primaryButton: {
        backgroundColor: '#233975',
        borderRadius: 30,
        paddingVertical: 16,
        marginTop: 30,
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
    
    secondaryButton: {
        marginTop: 15,
        alignItems: 'center',
        paddingVertical: 10,
    },
    secondaryButtonText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
});