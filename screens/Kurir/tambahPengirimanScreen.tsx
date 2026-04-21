import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import api from '../../services/api';
import { useAuth } from '../../context/authContext';

const THEME = {
  primary: '#4F46E5',
  accent: '#06B6D4',
  ink: '#0F172A',
  muted: '#64748B',
  card: '#FFFFFF',
  line: 'rgba(15,23,42,0.08)',
  bgTop: '#F7F9FF',
  bgBottom: '#FFFFFF',
};

const dateToYmd = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const timeToHm = (date: Date) => {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const ymdToDate = (value: string) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const hmToDate = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
};

const formatDateLabel = (value: string) => {
  if (!value) return 'Pilih tanggal';
  const [y, m, d] = value.split('-').map(Number);
  const bulan = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des',
  ];
  const date = new Date(y, (m || 1) - 1, d || 1);
  return `${date.getDate()} ${bulan[date.getMonth()]} ${date.getFullYear()}`;
};

export default function KurirTambahPengirimanScreen({ navigation }: any) {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();

  const [sender, setSender] = useState('');
  const [receiver, setReceiver] = useState('');
  const [note, setNote] = useState('');
  const [tanggalPlan, setTanggalPlan] = useState(dateToYmd(new Date()));
  const [jamPlan, setJamPlan] = useState(timeToHm(new Date()));
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    return !!token && !!sender.trim() && !!receiver.trim() && !loading;
  }, [loading, receiver, sender, token]);

  const save = async () => {
    if (!canSubmit || !token) return;

    const today = dateToYmd(new Date());
    if (tanggalPlan < today) {
      Toast.show({
        type: 'glassError',
        text1: 'Validasi',
        text2: 'Tanggal rencana tidak boleh sebelum hari ini',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await api.post(
        '/kurir/pengiriman',
        {
          sender: sender.trim(),
          receiver: receiver.trim(),
          note: note.trim(),
          tanggal_plan: tanggalPlan,
          jam_plan: jamPlan,
          status: 'ready',
          user: user?.nama,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Gagal menyimpan pengiriman');
      }

      Toast.show({
        type: 'glassSuccess',
        text1: 'Rencana tersimpan',
        text2: res.data?.message || 'Pengiriman berhasil dijadwalkan',
      });
      navigation.navigate('KurirPengiriman');
    } catch (err: any) {
      Toast.show({
        type: 'glassError',
        text1: 'Gagal menyimpan',
        text2:
          err?.response?.data?.message ||
          err?.message ||
          'Tidak dapat menyimpan pengiriman',
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
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: 28 + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Rencana Kirim</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Kurir</Text>
            <View style={[styles.inputWrap, styles.disabledWrap]}>
              <TextInput
                editable={false}
                value={`${user?.nama || '-'} (${user?.cabang || '-'})`}
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>Pengirim</Text>
            <View style={styles.inputWrap}>
              <TextInput
                value={sender}
                onChangeText={setSender}
                placeholder="Nama pengirim / asal"
                placeholderTextColor={THEME.muted}
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>Penerima / Tujuan</Text>
            <View style={styles.inputWrap}>
              <TextInput
                value={receiver}
                onChangeText={setReceiver}
                placeholder="Nama penerima / tujuan"
                placeholderTextColor={THEME.muted}
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>Tanggal Rencana</Text>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setShowDate(true)}
              style={styles.selectWrap}
            >
              <Text style={styles.selectText}>
                {formatDateLabel(tanggalPlan)}
              </Text>
              <MaterialIcons name="edit-calendar" size={22} color={THEME.ink} />
            </TouchableOpacity>

            <Text style={styles.label}>Jam Rencana</Text>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setShowTime(true)}
              style={styles.selectWrap}
            >
              <Text style={styles.selectText}>{jamPlan || 'Pilih jam'}</Text>
              <MaterialIcons name="schedule" size={20} color={THEME.ink} />
            </TouchableOpacity>

            {showDate && (
              <DateTimePicker
                value={ymdToDate(tanggalPlan)}
                mode="date"
                minimumDate={new Date()}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event: any, selected?: Date) => {
                  setShowDate(false);
                  if (selected) setTanggalPlan(dateToYmd(selected));
                }}
              />
            )}

            {showTime && (
              <DateTimePicker
                value={hmToDate(jamPlan)}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event: any, selected?: Date) => {
                  setShowTime(false);
                  if (selected) setJamPlan(timeToHm(selected));
                }}
              />
            )}

            <Text style={styles.label}>Uraian / Catatan</Text>
            <View style={styles.textAreaWrap}>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Tulis catatan rencana kirim"
                placeholderTextColor={THEME.muted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={[styles.input, styles.textAreaInput]}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              disabled={!canSubmit}
              onPress={save}
              style={[styles.primaryBtn, !canSubmit && styles.disabledBtn]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>SIMPAN RENCANA</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              disabled={loading}
              onPress={() => navigation.goBack()}
              style={styles.ghostBtn}
            >
              <Text style={styles.ghostBtnText}>Batal</Text>
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
  },
  header: { alignItems: 'center', marginBottom: 12 },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: THEME.ink,
    letterSpacing: 0.2,
  },
  subtitle: {
    color: THEME.muted,
    fontSize: 12,
    marginTop: 6,
    fontWeight: '700',
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  label: {
    color: THEME.ink,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 12,
  },
  inputWrap: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 12,
    minHeight: 50,
    justifyContent: 'center',
  },
  disabledWrap: { opacity: 0.72 },
  input: {
    color: THEME.ink,
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 12,
  },
  selectWrap: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    color: THEME.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  textAreaWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.line,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
  },
  textAreaInput: {
    height: 110,
    paddingTop: 10,
  },
  primaryBtn: {
    marginTop: 18,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.4,
  },
  disabledBtn: { opacity: 0.55 },
  ghostBtn: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  ghostBtnText: {
    color: THEME.muted,
    fontWeight: '800',
    fontSize: 13,
  },
});
