/* eslint-disable react-native/no-inline-styles */
import React, { useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    StatusBar,
    StyleSheet,
    Platform,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../../services/api';
import Toast from 'react-native-toast-message';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

type RekapItem = {
    id: number;
    tanggal_plan: string; 
    cus_kode: string;
    cc_nama: string;
    cc_alamat: string;
    note: string;
    catatan?: string;
    label_status?: string;
};

const THEME = {
    primary: '#4F46E5',
    accent: '#06B6D4',
    ink: '#0F172A',
    muted: '#64748B',
    card: '#FFFFFF',
    soft: '#F1F5F9',
    line: 'rgba(15,23,42,0.08)',
    bgTop: '#F7F9FF',
    bgBottom: '#FFFFFF',
};

const normalizeYmd = (v: any) => String(v || '').slice(0, 10); // ambil "YYYY-MM-DD" dari datetime

const ymdToDate = (ymd: string) => {
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return new Date();
    const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
    return new Date(y, m - 1, d);
};

const dateToYmd = (dt: Date) => {
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const formatDisplayDate = (ymd: string) => {
    try {
        if (!ymd) return 'Pilih Tanggal';
        const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
        const dt = new Date(y, m - 1, d);
        const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        return `${dt.getDate()} ${bulan[dt.getMonth()]} ${dt.getFullYear()}`;
    } catch {
        return 'Pilih Tanggal';
    }
};

export default function EditVisitPlanScreen({ route, navigation }: any) {
    const data: RekapItem | undefined = route?.params?.data;

    const today = useMemo(() => dateToYmd(new Date()), []);

    // ambil tanggal dari DB tanpa timezone shift
    const initialTanggal = useMemo(() => {
        const t = normalizeYmd(data?.tanggal_plan);
        return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : today;
    }, [data?.tanggal_plan, today]);

    // simpan "original" tanggal sekali saja (tidak ikut berubah)
    const originalTanggal = useRef<string>(initialTanggal);

    const [tanggal, setTanggal] = useState<string>(initialTanggal);
    const [note, setNote] = useState<string>(String(data?.note || ''));
    const [catatan] = useState(String(data?.catatan || ''));
    const [loading, setLoading] = useState(false);
    const [showDate, setShowDate] = useState(false);

    const simpan = async () => {
        if (!data?.id) {
            Toast.show({ type: 'glassError', text1: 'Error', text2: 'Data tidak valid' });
            return;
        }

        const fixedTanggal = (tanggal || originalTanggal || '');
        if (!fixedTanggal) {
            Toast.show({ type: 'glassError', text1: 'Validasi', text2: 'Tanggal plan wajib diisi' });
            return;
        }

        try {
            setLoading(true);

            const body = {
            tanggal_plan: fixedTanggal,        
            note: note.trim() || '',
            catatan: catatan.trim() || '',
            };

            const res = await api.put(`/visit-plan/${data.id}`, body);

            Toast.show({
            type: 'glassSuccess',
            text1: 'Berhasil',
            text2: res?.data?.message || 'Visit plan diperbarui',
            });

            navigation.goBack();
        } catch (err: any) {
            Toast.show({
            type: 'glassError',
            text1: 'Gagal',
            text2: err?.response?.data?.message || err?.message || 'Gagal update',
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
                <Text style={styles.title}>Edit Visit Plan</Text>
                <Text style={styles.subtitle}>Perbarui rencana kunjungan</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.label}>Customer</Text>
                <View style={[styles.inputWrap, { opacity: 0.9 }]}>
                <TextInput value={String(data?.cc_nama || '-')} editable={false} style={styles.input} />
                </View>

                <Text style={styles.label}>Kode Customer</Text>
                <View style={[styles.inputWrap, { opacity: 0.9 }]}>
                <TextInput value={String(data?.cus_kode || '-')} editable={false} style={styles.input} />
                </View>

                <Text style={styles.label}>Tanggal Rencana Visit</Text>
                <TouchableOpacity onPress={() => setShowDate(true)} activeOpacity={0.9} style={styles.selectWrap}>
                <Text style={[styles.selectText, !tanggal && { color: THEME.muted }]}>
                    {tanggal ? formatDisplayDate(tanggal) : 'Pilih Tanggal'}
                </Text>
                <MaterialIcons name="edit-calendar" size={22} color={THEME.ink} />
                </TouchableOpacity>

                {showDate && (
                <DateTimePicker
                    value={tanggal ? ymdToDate(tanggal) : new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event: any, selected?: Date) => {
                    setShowDate(false);
                    if (selected) setTanggal(dateToYmd(selected));
                    }}
                />
                )}

                <Text style={styles.label}>Catatan</Text>
                <View style={styles.textAreaWrap}>
                <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="Tulis rencana kegiatan..."
                    placeholderTextColor={THEME.muted}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    style={[styles.input, { height: 110, paddingTop: 10 }]}
                />
                </View>

                <TouchableOpacity onPress={simpan} disabled={loading} style={[styles.btnPrimary, loading && { opacity: 0.7 }]} activeOpacity={0.9}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>SIMPAN PERUBAHAN</Text>}
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
    subtitle: { color: THEME.muted, fontSize: 12, marginTop: 6, fontWeight: '700', textAlign: 'center' },

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
        marginBottom: 12,
    },

    selectWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: THEME.soft,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: THEME.line,
        paddingHorizontal: 12,
        height: 55,
        marginBottom: 12,
    },

    input: { flex: 1, color: THEME.ink, fontSize: 15, fontWeight: '800' },
    selectText: { flex: 1, color: THEME.ink, fontSize: 14, fontWeight: '900' },

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

    textAreaWrap: {
        backgroundColor: THEME.soft,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: THEME.line,
        paddingHorizontal: 12,
        paddingTop: 10,
        marginBottom: 10,
    },
});
