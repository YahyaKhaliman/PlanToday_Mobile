/* eslint-disable react-native/no-inline-styles */
import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/appNavigator';
import CircularProgress from '../Achievement/circularProgress';
import { LoadingSkeleton } from '../../components/loadingSkeleton';
import api from '../../services/api';
import { useAuth } from '../../context/authContext';

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

const rupiahFull = (n: number) =>
  `Rp.${Number(n || 0).toLocaleString('id-ID')}`;
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const progressPct = (realisasi: number, target: number) =>
  !target ? 0 : clamp((realisasi / target) * 100, 0, 500);

const fmtMonthYear = (m: number, y: number) => {
  const label = MONTH_LABELS[clamp(m, 1, 12) - 1] || `${m}`;
  return `${label} ${y}`;
};

const formatDate = (ymd?: string) => {
  if (!ymd) return '-';
  const clean = String(ymd).trim().slice(0, 10);
  const parts = clean.split('-');
  if (parts.length !== 3) return ymd;
  const [y, m, d] = parts;
  return `${d}-${m}-${y}`;
};

type Nav = NativeStackNavigationProp<
  RootStackParamList,
  'AchievementDetailUserRange'
>;
type R = RouteProp<RootStackParamList, 'AchievementDetailUserRange'>;

export default function AchievementDetailUserRangeScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const {
    nama,
    jabatan,
    fromYear,
    fromMonth,
    toYear,
    toMonth,
    target: targetParam,
    realisasi: realisasiParam,
    ach: achParam,
  } = route.params;

  const [loading, setLoading] = useState(false);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);

  const periodLabel = useMemo(() => {
    if (!fromYear || !fromMonth || !toYear || !toMonth) return '-';
    return `${fmtMonthYear(fromMonth, fromYear)} — ${fmtMonthYear(
      toMonth,
      toYear,
    )}`;
  }, [fromMonth, fromYear, toMonth, toYear]);

  useEffect(() => {
    async function fetchData() {
      if (!token || !route.params.kode) return;
      setLoading(true);
      try {
        const fromVal = `${fromYear}-${String(fromMonth).padStart(2, '0')}`;
        const toVal = `${toYear}-${String(toMonth).padStart(2, '0')}`;
        const res = await api.get(
          `/achievement/omset/month/${route.params.kode}`,
          {
            params: {
              from: fromVal,
              to: toVal,
            },
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (res.data?.success) {
          setMonthlyData(res.data?.data || []);
        }
      } catch (err) {
        console.error('FETCH MONTHLY ACHIEVEMENT DETAILS ERROR:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [token, route.params.kode, fromYear, fromMonth, toYear, toMonth]);

  const allSpkList = useMemo(() => {
    const list = monthlyData.flatMap(m => m.detail_spk || []);
    // Diurutkan terbaru paling atas
    return list.sort((a, b) => {
      const dateA = a.spk_tanggal ? new Date(a.spk_tanggal).getTime() : 0;
      const dateB = b.spk_tanggal ? new Date(b.spk_tanggal).getTime() : 0;
      return dateB - dateA;
    });
  }, [monthlyData]);

  // kalau dari list sudah bawa agregat, pakai itu
  const target = Number(targetParam || 0);
  const realisasi = Number(realisasiParam || 0);

  const missing = target <= 0 && realisasi <= 0;

  const selisih = realisasi - target;
  const prog = progressPct(realisasi, target);
  const ach = typeof achParam === 'number' ? achParam : prog;
  const isMet = realisasi >= target && target > 0;

  return (
    <LinearGradient
      colors={[THEME.bgTop, THEME.bgBottom]}
      style={styles.container}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      {/* HEADER */}
      <View style={styles.headerWrap}>
        <View style={styles.headerTop}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
            >
              <MaterialIcons
                name="arrow-back-ios-new"
                size={18}
                color={THEME.primary}
              />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.title}>Detail Achievement</Text>
              <Text style={styles.subTitle} numberOfLines={1}>
                {nama} • {jabatan}
              </Text>
            </View>
            <View style={styles.headerRightSpacer} />
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 16 },
        ]}
      >
        {/* CARD */}
        <View style={styles.card}>
          {/* PROGRESS + RINGKASAN 2-KOLOM */}
          <View style={styles.progressRow}>
            {/* KIRI: Chart */}
            <View style={styles.progressLeft}>
              {!missing ? (
                <CircularProgress
                  size={90}
                  strokeWidth={9}
                  progress={ach}
                  color={isMet ? THEME.ok : THEME.accent}
                  textColor={THEME.ink}
                />
              ) : (
                <Text style={styles.noDataText}>No Data</Text>
              )}
              <View style={[styles.chip, { marginTop: 8 }]}>
                <MaterialIcons
                  name={isMet ? 'check-circle' : 'schedule'}
                  size={12}
                  color={isMet ? THEME.ok : THEME.warn}
                />
                <Text
                  style={[
                    styles.chipText,
                    { color: isMet ? THEME.ok : THEME.warn },
                  ]}
                >
                  {isMet ? 'TERCAPAI' : 'BELUM'}
                </Text>
              </View>
            </View>

            {/* KANAN: Ringkasan */}
            <View style={styles.progressRight}>
              <Text style={styles.summaryTitle} numberOfLines={2}>
                {periodLabel}
              </Text>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Target</Text>
                <Text style={styles.summaryValue}>{rupiahFull(target)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Realisasi</Text>
                <Text style={styles.summaryValue}>{rupiahFull(realisasi)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Selisih</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    selisih < 0 ? styles.negative : styles.positive,
                  ]}
                >
                  {rupiahFull(selisih)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total SPK</Text>
                <Text style={styles.summaryValue}>
                  {loading ? '...' : `${allSpkList.length} SPK`}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.line} />

          {/* DAFTAR SPK REALISASI */}
          <View style={styles.spkSection}>
            <Text style={styles.sectionTitle}>Daftar SPK</Text>
            {loading ? (
              <View style={{ gap: 10 }}>
                {[1, 2, 3].map(item => (
                  <View style={styles.spkCard} key={`spk-skel-${item}`}>
                    <View style={styles.spkHeader}>
                      <LoadingSkeleton
                        height={14}
                        width={100}
                        color="rgba(148,163,184,0.18)"
                      />
                      <LoadingSkeleton
                        height={12}
                        width={80}
                        color="rgba(148,163,184,0.18)"
                      />
                    </View>
                    <LoadingSkeleton
                      height={14}
                      width="70%"
                      color="rgba(148,163,184,0.18)"
                      style={{ marginVertical: 6 }}
                    />
                    <View style={styles.spkFooter}>
                      <LoadingSkeleton
                        height={12}
                        width={120}
                        color="rgba(148,163,184,0.18)"
                      />
                      <LoadingSkeleton
                        height={12}
                        width={60}
                        color="rgba(148,163,184,0.18)"
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : allSpkList.length === 0 ? (
              <Text style={styles.emptyText}>
                Tidak ada SPK terbit di periode ini
              </Text>
            ) : (
              allSpkList.map((spk, idx) => (
                <View style={styles.spkCard} key={`${spk.spk_nomor}-${idx}`}>
                  <View style={styles.spkHeader}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Text style={styles.spkNo}>{spk.spk_nomor}</Text>
                      {spk.spk_close === true ||
                      spk.spk_close === 1 ||
                      spk.spk_close === '1' ? (
                        <View
                          style={[styles.statusBadgeCompact, styles.badgeClose]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeTextCompact,
                              styles.badgeCloseText,
                            ]}
                          >
                            CLOSE
                          </Text>
                        </View>
                      ) : (
                        <View
                          style={[styles.statusBadgeCompact, styles.badgeOpen]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeTextCompact,
                              styles.badgeOpenText,
                            ]}
                          >
                            OPEN
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.spkMeta}>
                      {formatDate(spk.spk_tanggal?.slice(0, 10))}
                    </Text>
                  </View>
                  <Text style={styles.spkName}>{spk.spk_nama || '-'}</Text>
                  <Text style={styles.spkCustomer}>
                    {spk.customer || spk.customer_nama || spk.cus_nama || '-'}
                  </Text>
                  <View style={styles.spkFooter}>
                    <Text style={styles.spkMeta}>
                      {rupiahFull(spk.spk_harga)} • Order: {spk.spk_jumlah} Pcs
                    </Text>
                    <Text style={styles.spkValue}>{rupiahFull(spk.nilai)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerWrap: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerTop: { marginBottom: 10 },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: THEME.soft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.line,
  },
  headerRightSpacer: {
    width: 38,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: THEME.ink,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  subTitle: {
    color: THEME.muted,
    fontSize: 12,
    marginTop: 6,
    fontWeight: '700',
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.line,
    marginBottom: 8,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  progressLeft: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRight: {
    flex: 1,
    justifyContent: 'center',
  },
  summaryTitle: {
    color: THEME.ink,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.1,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: THEME.line,
    marginVertical: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  summaryLabel: {
    color: THEME.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  summaryValue: {
    color: THEME.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  noDataText: {
    color: THEME.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: THEME.line,
    backgroundColor: THEME.soft,
  },
  chipText: { fontSize: 10, fontWeight: '900' },

  line: { height: 1, backgroundColor: THEME.line, marginVertical: 14 },

  positive: { color: THEME.ok },
  negative: { color: '#DC2626' },

  spkSection: {
    marginTop: 3,
  },
  sectionTitle: {
    color: THEME.ink,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
    letterSpacing: 0.1,
  },
  emptyText: {
    color: THEME.muted,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    paddingVertical: 20,
    backgroundColor: 'rgba(241,245,249,0.55)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  spkCard: {
    backgroundColor: THEME.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    marginBottom: 10,
  },
  spkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  spkNo: {
    color: THEME.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  spkValue: {
    color: THEME.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  statusBadgeCompact: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  badgeClose: {
    backgroundColor: '#10B9811A',
    borderColor: '#10B981',
  },
  badgeOpen: {
    backgroundColor: '#EF44441A',
    borderColor: '#EF4444',
  },
  statusBadgeTextCompact: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  badgeCloseText: {
    color: '#047857',
  },
  badgeOpenText: {
    color: '#B91C1C',
  },
  spkName: {
    color: THEME.ink,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  spkCustomer: {
    color: THEME.muted,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
  },
  spkFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  spkMeta: {
    color: THEME.muted,
    fontSize: 11,
    fontWeight: '800',
  },
});
