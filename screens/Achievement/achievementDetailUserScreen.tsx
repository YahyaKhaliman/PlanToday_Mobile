/* eslint-disable react-native/no-inline-styles */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/appNavigator';
import CircularProgress from '../Achievement/circularProgress';

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
  ok: '#16A34A',
  warn: '#F59E0B',
};

const MONTH_LABELS = [
  'Jan','Feb','Mar','Apr','Mei','Juni',
  'Juli','Agust','Sept','Okt','Nov','Des',
];

const rupiahFull = (n: number) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
const percent2 = (n?: number) => `${Number(n || 0).toFixed(2)}%`;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const progressPct = (realisasi: number, target: number) => (!target ? 0 : clamp((realisasi / target) * 100, 0, 500));

const fmtMonthYear = (m: number, y: number) => {
  const label = MONTH_LABELS[clamp(m, 1, 12) - 1] || `${m}`;
  return `${label} ${y}`;
};

type Nav = NativeStackNavigationProp<RootStackParamList, 'AchievementDetailUserRange'>;
type R = RouteProp<RootStackParamList, 'AchievementDetailUserRange'>;

function Row({ label, value, valueStyle }: any) {
  return (
    <View style={styles.row}>
      <Text style={styles.key}>{label}</Text>
      <Text style={[styles.val, valueStyle]}>{value}</Text>
    </View>
  );
}

export default function AchievementDetailUserRangeScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();

  const {
    nama,
    jabatan,
    fromYear,
    fromMonth,
    toYear,
    toMonth,
    target: targetParam,
    realisasi: realisasiParam,
  } = route.params as any;

  const periodLabel = useMemo(() => {
    if (!fromYear || !fromMonth || !toYear || !toMonth) return '-';
    return `${fmtMonthYear(fromMonth, fromYear)} — ${fmtMonthYear(toMonth, toYear)}`;
  }, [fromMonth, fromYear, toMonth, toYear]);

  // kalau dari list sudah bawa agregat, pakai itu
  const target = Number(targetParam || 0);
  const realisasi = Number(realisasiParam || 0);

  const missing = target <= 0 && realisasi <= 0;

  const selisih = realisasi - target;
  const prog = progressPct(realisasi, target);
  const isMet = realisasi >= target && target > 0;

  return (
    <LinearGradient colors={[THEME.bgTop, THEME.bgBottom]} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>Detail Achievement</Text>
        <Text style={styles.subTitle} numberOfLines={1}>
          {nama} • {jabatan}
        </Text>
        <Text style={styles.periodText} numberOfLines={1}>
          {periodLabel}
        </Text>
      </View>

      {/* CARD */}
      <View style={styles.card}>
        {/* HERO PROGRESS */}
        <Text style={styles.heroLabel}>Progress Pencapaian</Text>
        {!missing ? (
          <View style={{ alignItems: 'center', marginVertical: 16 }}>
            <CircularProgress
              progress={prog}
              color={isMet ? THEME.ok : THEME.accent}
              textColor={THEME.ink}
            />

            <View style={styles.chip}>
              <MaterialIcons
                name={isMet ? 'check-circle' : 'schedule'}
                size={14}
                color={isMet ? THEME.ok : THEME.warn}
              />
              <Text style={[styles.chipText, { color: isMet ? THEME.ok : THEME.warn }]}>
                {isMet ? 'TARGET TERCAPAI' : 'BELUM TERCAPAI'}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.heroValue}>No Data</Text>
        )}

        <View style={styles.line} />

        {/* NILAI UTAMA */}
        <View style={styles.moneyBlock}>
          <Row label="Periode" value={periodLabel} />
          <Row label="Total Target" value={rupiahFull(target)} />
          <Row label="Total Realisasi" value={rupiahFull(realisasi)} />
          <Row
            label="Selisih"
            value={rupiahFull(selisih)}
            valueStyle={selisih < 0 ? styles.negative : styles.positive}
          />
        </View>

        <View style={styles.line} />
      </View>

      {/* BUTTON KEMBALI */}
      <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.goBack()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={20} color={THEME.ink} />
        <Text style={styles.backButtonText}>Kembali</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 54 : 18,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  header: { marginBottom: 12, alignItems: 'center' },
  title: { fontSize: 25, fontWeight: '900', color: THEME.ink, letterSpacing: 0.2, textAlign: 'center' },
  subTitle: { color: THEME.muted, fontSize: 12, fontWeight: '800', marginTop: 2, textAlign: 'center' },
  periodText: { color: THEME.muted, fontSize: 12, fontWeight: '900', marginTop: 6, textAlign: 'center' },

  card: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.line,
    flexGrow: 1,
  },

  heroLabel: { color: THEME.muted, fontSize: 12, fontWeight: '900' },
  heroValue: { color: THEME.ink, fontSize: 28, fontWeight: '900', marginVertical: 8, },

  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(6,182,212,0.75)',
  },

  chip: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: THEME.line,
    backgroundColor: THEME.soft,
  },
  chipText: { fontSize: 11, fontWeight: '900' },

  line: { height: 1, backgroundColor: THEME.line, marginVertical: 14 },

  moneyBlock: {
    borderRadius: 14,
    padding: 12,
    backgroundColor: 'rgba(241,245,249,0.55)',
    borderWidth: 1,
    borderColor: THEME.line,
  },

  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, gap: 12 },
  key: { color: THEME.muted, fontSize: 12, fontWeight: '900', flex: 1 },
  val: { color: THEME.ink, fontSize: 12, fontWeight: '900', flex: 1, textAlign: 'right' },

  positive: { color: THEME.ok },
  negative: { color: '#DC2626' },

  backButton: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: THEME.line,
  },
  backButtonText: { color: THEME.ink, fontSize: 14, fontWeight: '900' },
});
