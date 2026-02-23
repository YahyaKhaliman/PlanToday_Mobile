/* eslint-disable react-native/no-inline-styles */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';

import api from '../../services/api';
import { useAuth } from '../../context/authContext';

import MonthGridSelect from './monthGridSelect';
import YearGridSelect from './yearGridSelect';

type UserAggRow = {
  kode: string;
  nama: string;
  jabatan: string;
  target: number;
  realisasi: number;
  ach: number;
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
  ok: '#16A34A',
  warn: '#F59E0B',
};

const MONTHS = [
  { label: 'Jan', value: '1' },
  { label: 'Feb', value: '2' },
  { label: 'Mar', value: '3' },
  { label: 'Apr', value: '4' },
  { label: 'Mei', value: '5' },
  { label: 'Jun', value: '6' },
  { label: 'Jul', value: '7' },
  { label: 'Agu', value: '8' },
  { label: 'Sep', value: '9' },
  { label: 'Okt', value: '10' },
  { label: 'Nov', value: '11' },
  { label: 'Des', value: '12' },
];

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const toIndex = (y: number, m: number) => y * 12 + (m - 1);
const progressPct = (r: number, t: number) => (!t ? 0 : clamp((r / t) * 100, 0, 500));

const rupiahShort = (n: number) => {
  const v = Number(n || 0);
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}M`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}Jt`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}Rb`;
  return `${Math.round(v)}`;
};

const formatMonthYear = (month: number, year: number) => {
  const mLabel = MONTHS[clamp(month, 1, 12) - 1]?.label || `${month}`;
  return `${mLabel} ${year}`;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.key}>{label}</Text>
      <Text style={styles.val}>{value}</Text>
    </View>
  );
}

type PickerTarget = 'start' | 'end';
type PickerMode = 'inline' | 'modal';

export default function AchievementOmsetScreen({ navigation }: any) {
  const { user, token } = useAuth();
  const isManager = String(user?.jabatan || '').toUpperCase() === 'MANAGER';

  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1;

  /** years */
  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = 2023; y <= nowYear; y++) arr.push(y);
    return arr;
  }, [nowYear]);

  /** ACTIVE RANGE */
  const [fromYear, setFromYear] = useState(nowYear);
  const [fromMonth, setFromMonth] = useState(nowMonth);
  const [toYear, setToYear] = useState(nowYear);
  const [toMonth, setToMonth] = useState(nowMonth);

  /** DRAFT RANGE (MODAL FILTER) */
  const [draftFromYear, setDraftFromYear] = useState(nowYear);
  const [draftFromMonth, setDraftFromMonth] = useState(nowMonth);
  const [draftToYear, setDraftToYear] = useState(nowYear);
  const [draftToMonth, setDraftToMonth] = useState(nowMonth);

  /** PICKERS */
  const [openMonthGrid, setOpenMonthGrid] = useState(false);
  const [openYearGrid, setOpenYearGrid] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>('start');
  const [pickerMode, setPickerMode] = useState<PickerMode>('inline');

  /** UI */
  const [openFilter, setOpenFilter] = useState(false);
  const [showFab, setShowFab] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<UserAggRow[]>([]);

  const closePickers = useCallback(() => {
    setOpenMonthGrid(false);
    setOpenYearGrid(false);
  }, []);

  /** FETCH */
  const fetchRange = useCallback(
    async (fy: number, fm: number, ty: number, tm: number) => {
      if (!token) return; // ✅ tunggu token

      setLoading(true);
      try {
        const params: any = { fromYear: fy, fromMonth: fm, toYear: ty, toMonth: tm };

        const res = await api.get('/achievement/omset/range', {
          params,
          headers: { Authorization: `Bearer ${token}` },
        });

        const arr = (res.data?.data || []) as any[];
        const mapped: UserAggRow[] = arr.map((x) => ({
          kode: String(x.kode || ''),
          nama: String(x.nama || '-'),
          jabatan: String(x.jabatan || '-'),
          target: Number(x.target || 0),
          realisasi: Number(x.realisasi || 0),
          ach: Number(x.ach || 0),
        }));

        setRows(mapped);
      } catch (err: any) {
        const msg = err?.response?.data?.message || 'Gagal mengambil achievement';
        Toast.show({ type: 'glassError', text1: 'Error', text2: msg });
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const applyRange = useCallback(
    async (fy: number, fm: number, ty: number, tm: number) => {
      const nFY = fy;
      const nFM = clamp(fm, 1, 12);
      const nTY = ty;
      const nTM = clamp(tm, 1, 12);

      const a = toIndex(nFY, nFM);
      const b = toIndex(nTY, nTM);

      const fY = a <= b ? nFY : nTY;
      const fM = a <= b ? nFM : nTM;
      const tY = a <= b ? nTY : nFY;
      const tM = a <= b ? nTM : nFM;

      setFromYear(fY);
      setFromMonth(fM);
      setToYear(tY);
      setToMonth(tM);

      await fetchRange(fY, fM, tY, tM);
    },
    [fetchRange]
  );

  useEffect(() => {
    if (!token) return;
    applyRange(fromYear, fromMonth, toYear, toMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /** OPEN PICKERS */
  const openStartInline = useCallback(() => {
    closePickers();
    setPickerMode('inline');
    setPickerTarget('start');
    setOpenMonthGrid(true);
  }, [closePickers]);

  const openEndInline = useCallback(() => {
    closePickers();
    setPickerMode('inline');
    setPickerTarget('end');
    setOpenMonthGrid(true);
  }, [closePickers]);

  const openStartModal = useCallback(() => {
    closePickers();
    setPickerMode('modal');
    setPickerTarget('start');
    setOpenMonthGrid(true);
  }, [closePickers]);

  const openEndModal = useCallback(() => {
    closePickers();
    setPickerMode('modal');
    setPickerTarget('end');
    setOpenMonthGrid(true);
  }, [closePickers]);

  /** SELECT MONTH */
  const onSelectMonth = useCallback((v: string) => {
    const m = clamp(Number(v), 1, 12);

    if (pickerMode === 'modal') {
      if (pickerTarget === 'start') setDraftFromMonth(m);
      else setDraftToMonth(m);
    } else {
      if (pickerTarget === 'start') setFromMonth(m);
      else setToMonth(m);
    }

    setOpenMonthGrid(false);        // ✅ tutup month dulu

    setTimeout(() => {
      setOpenYearGrid(true);        // ✅ baru buka year
    }, 200);
  }, [pickerMode, pickerTarget]);

  /** SELECT YEAR */
  const onSelectYear = useCallback(async (v: string) => {
    const y = Number(v);

    if (pickerMode === 'modal') {
      if (pickerTarget === 'start') setDraftFromYear(y);
      else setDraftToYear(y);

      setOpenYearGrid(false);
      return;
    }

    setOpenYearGrid(false);

    if (pickerTarget === 'start') {
      setFromYear(y);
      await applyRange(y, fromMonth, toYear, toMonth);
    } else {
      setToYear(y);
      await applyRange(fromYear, fromMonth, y, toMonth);
    }
  }, [pickerMode, pickerTarget, applyRange, fromMonth, fromYear, toMonth, toYear]);

  /** FILTER MODAL OPEN */
  const openFilterModal = useCallback(() => {
    setDraftFromYear(fromYear);
    setDraftFromMonth(fromMonth);
    setDraftToYear(toYear);
    setDraftToMonth(toMonth);
    closePickers();
    setOpenFilter(true);
  }, [fromYear, fromMonth, toYear, toMonth, closePickers]);

  /** DERIVED */
  const filteredRows = useMemo(() => {
    if (!isManager) return rows;
    const q = keyword.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.nama.toLowerCase().includes(q) || r.jabatan.toLowerCase().includes(q));
  }, [rows, keyword, isManager]);

  const summary = useMemo(() => {
    const totalTarget = filteredRows.reduce((a, b) => a + Number(b.target || 0), 0);
    const totalReal = filteredRows.reduce((a, b) => a + Number(b.realisasi || 0), 0);
    const prog = progressPct(totalReal, totalTarget);
    return {
      totalTarget,
      totalReal,
      prog,
      fill: clamp(prog, 0, 100),
      isMet: totalReal >= totalTarget && totalTarget > 0,
    };
  }, [filteredRows]);

  const onScroll = useCallback((e: any) => {
    const y = e?.nativeEvent?.contentOffset?.y || 0;
    setShowFab(y > 200);
  }, []);

  const clearKeyword = useCallback(() => setKeyword(''), []);

  /** UI blocks */
  const PeriodRowInline = (
    <View style={styles.row2}>
      <View style={styles.col}>
        <Text style={styles.label}>Periode Awal</Text>
        <TouchableOpacity style={styles.dateSelect} onPress={openStartInline} activeOpacity={0.9}>
          <Text style={styles.dateText}>{formatMonthYear(fromMonth, fromYear)}</Text>
          <MaterialIcons name="edit-calendar" color={THEME.ink} size={22} />
        </TouchableOpacity>
      </View>

      <View style={styles.col}>
        <Text style={styles.label}>Periode Akhir</Text>
        <TouchableOpacity style={styles.dateSelect} onPress={openEndInline} activeOpacity={0.9}>
          <Text style={styles.dateText}>{formatMonthYear(toMonth, toYear)}</Text>
          <MaterialIcons name="edit-calendar" color={THEME.ink} size={22} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const PeriodRowModal = (
    <View style={styles.row2}>
      <View style={styles.col}>
        <Text style={styles.label}>Periode Awal</Text>
        <TouchableOpacity style={styles.dateSelect} onPress={openStartModal} activeOpacity={0.9}>
          <Text style={styles.dateText}>{formatMonthYear(draftFromMonth, draftFromYear)}</Text>
          <MaterialIcons name="edit-calendar" color={THEME.ink} size={22} />
        </TouchableOpacity>
      </View>

      <View style={styles.col}>
        <Text style={styles.label}>Periode Akhir</Text>
        <TouchableOpacity style={styles.dateSelect} onPress={openEndModal} activeOpacity={0.9}>
          <Text style={styles.dateText}>{formatMonthYear(draftToMonth, draftToYear)}</Text>
          <MaterialIcons name="edit-calendar" color={THEME.ink} size={22} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const SearchBox = useMemo(() => {
    if (!isManager) return null;
    return (
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={keyword}
          onChangeText={setKeyword}
          placeholder="Cari nama / jabatan..."
          placeholderTextColor={THEME.muted}
          style={styles.searchInput}
          autoCorrect={false}
        />
        {!!keyword.trim() && (
          <TouchableOpacity onPress={clearKeyword} activeOpacity={0.8} style={styles.clearBtn}>
            <MaterialIcons name="close" size={18} color={THEME.muted} />
          </TouchableOpacity>
        )}
      </View>
    );
  }, [keyword, clearKeyword, isManager]);

  return (
    <LinearGradient colors={[THEME.bgTop, THEME.bgBottom]} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <FlatList
        data={filteredRows}
        keyExtractor={(it, idx) => `${it.kode || 'UNK'}-${idx}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.title}>Achievement</Text>
              <Text style={styles.subTitle}>{isManager ? 'Rekap Semua User' : 'Rekap Achievement Saya'}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.heroLabel}>Progress Pencapaian</Text>
              <Text style={styles.heroValue}>{summary.prog.toFixed(2)}%</Text>

              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${summary.fill}%` }]} />
              </View>

              <View style={styles.chip}>
                <MaterialIcons
                  name={summary.isMet ? 'check-circle' : 'schedule'}
                  size={14}
                  color={summary.isMet ? THEME.ok : THEME.warn}
                />
                <Text style={[styles.chipText, { color: summary.isMet ? THEME.ok : THEME.warn }]}>
                  {summary.isMet ? 'TARGET TERCAPAI' : 'BELUM TERCAPAI'}
                </Text>
              </View>

              <View style={styles.line} />

              {PeriodRowInline}

              <View style={[styles.moneyBlock, { marginTop: 12 }]}>
                <Row label="Total Target" value={rupiahShort(summary.totalTarget)} />
                <Row label="Total Realisasi" value={rupiahShort(summary.totalReal)} />
                <Row label="Jumlah User" value={`${filteredRows.length}`} />
              </View>
              <View style={styles.line} />
              {SearchBox}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const prog = progressPct(item.realisasi, item.target);
          const barFill = clamp(prog, 0, 100);
          const achValue = Number(item.ach || prog);

          const badgeStyle =
            achValue >= 100 ? styles.badgeOk : achValue > 0 ? styles.badgeWarn : styles.badgeMissing;

          return (
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.userCard}
              onPress={() =>
                navigation.navigate('AchievementDetailUserRange', {
                  kode: item.kode,
                  nama: item.nama,
                  jabatan: item.jabatan,
                  fromYear,
                  fromMonth,
                  toYear,
                  toMonth,
                  target: item.target,
                  realisasi: item.realisasi,
                  ach: item.ach,
                })
              }
            >
              <View style={styles.userTopRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {item.nama} • {item.jabatan}
                  </Text>
                  <Text style={styles.userMeta} numberOfLines={1}>
                    Target: {rupiahShort(item.target)} • Realisasi: {rupiahShort(item.realisasi)}
                  </Text>

                  <View style={styles.userBarTrack}>
                    <View style={[styles.userBarFill, { width: `${barFill}%` }]} />
                  </View>
                </View>

                <View style={[styles.achBadge, badgeStyle]}>
                  <Text style={styles.achBadgeText}>{achValue.toFixed(2)}%</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 20 }} />
          ) : (
            <Text style={styles.empty}>{token ? 'Data tidak ditemukan' : 'Silakan login ulang'}</Text>
          )
        }
      />

      {/* FAB filter */}
      {showFab && (
        <TouchableOpacity activeOpacity={0.9} onPress={openFilterModal} style={styles.fab}>
          <View style={styles.fabInner}>
            <Text style={{ fontSize: 18 }}>🔍</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Modal Filter */}
      <Modal
        visible={openFilter}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setOpenFilter(false);
          closePickers();
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Periode</Text>
              <TouchableOpacity
                onPress={() => {
                  setOpenFilter(false);
                  closePickers();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {PeriodRowModal}

            <View style={[styles.row2, { marginTop: 14 }]}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: THEME.accent }]}
                onPress={() => {
                  setOpenFilter(false);
                  closePickers();
                  applyRange(draftFromYear, draftFromMonth, draftToYear, draftToMonth);
                }}
                disabled={loading}
                activeOpacity={0.9}
              >
                <Text style={styles.modalBtnText}>Terapkan</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  {
                    backgroundColor: 'rgba(79,70,229,0.10)',
                    borderWidth: 1,
                    borderColor: 'rgba(79,70,229,0.18)',
                  },
                ]}
                onPress={() => {
                  setDraftFromYear(nowYear);
                  setDraftFromMonth(nowMonth);
                  setDraftToYear(nowYear);
                  setDraftToMonth(nowMonth);
                  setOpenFilter(false);
                  closePickers();
                  applyRange(nowYear, nowMonth, nowYear, nowMonth);
                }}
                disabled={loading}
                activeOpacity={0.9}
              >
                <Text style={[styles.modalBtnText, { color: THEME.primary }]}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MonthGridSelect */}
      <MonthGridSelect
        visible={openMonthGrid}
        title={pickerTarget === 'start' ? 'Pilih Bulan Awal' : 'Pilih Bulan Akhir'}
        value={String(
          pickerMode === 'modal'
            ? pickerTarget === 'start'
              ? draftFromMonth
              : draftToMonth
            : pickerTarget === 'start'
            ? fromMonth
            : toMonth
        )}
        options={MONTHS}
        theme={THEME}
        onClose={() => setOpenMonthGrid(false)}
        onSelect={onSelectMonth}
      />

      {/* YearGridSelect */}
      <YearGridSelect
        visible={openYearGrid}
        title={pickerTarget === 'start' ? 'Pilih Tahun Awal' : 'Pilih Tahun Akhir'}
        value={String(
          pickerMode === 'modal'
            ? pickerTarget === 'start'
              ? draftFromYear
              : draftToYear
            : pickerTarget === 'start'
            ? fromYear
            : toYear
        )}
        years={years}
        theme={THEME}
        onClose={() => setOpenYearGrid(false)}
        onSelect={onSelectYear}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: {
    paddingTop: Platform.OS === 'android' ? 54 : 18,
    paddingHorizontal: 20,
    paddingBottom: 60,
  },

  header: { marginBottom: 12 },
  title: { fontSize: 25, fontWeight: '900', color: THEME.ink, textAlign: 'center' },
  subTitle: { color: THEME.muted, fontSize: 12, fontWeight: '800', textAlign: 'center', marginTop: 2 },

  card: { backgroundColor: THEME.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: THEME.line },

  heroLabel: { color: THEME.muted, fontSize: 12, fontWeight: '900' },
  heroValue: { color: THEME.ink, fontSize: 28, fontWeight: '900', marginVertical: 8 },

  progressTrack: { height: 10, borderRadius: 999, backgroundColor: 'rgba(15,23,42,0.08)', overflow: 'hidden' },
  progressFill: { height: 10, borderRadius: 999, backgroundColor: 'rgba(6,182,212,0.75)' },

  chip: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { fontSize: 11, fontWeight: '900' },

  line: { height: 1, backgroundColor: THEME.line, marginVertical: 14 },

  row2: { flexDirection: 'row', gap: 10, marginTop: 4 },
  col: { flex: 1 },

  label: {
    color: THEME.muted,
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 4,
    marginBottom: 6,
    marginTop: 4,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  dateSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.soft,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 12,
    height: 55,
  },
  dateText: { flex: 1, color: THEME.ink, fontSize: 14, fontWeight: '900' },

  moneyBlock: { backgroundColor: THEME.soft, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: THEME.line },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  key: { color: THEME.muted, fontSize: 12, fontWeight: '900' },
  val: { color: THEME.ink, fontSize: 12, fontWeight: '900' },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.soft,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 12,
    height: 55,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontWeight: '900', color: THEME.ink },
  clearBtn: { padding: 8, marginRight: -6 },

  detailTitle: { marginTop: 10, fontWeight: '900', color: THEME.ink },

  userCard: { marginTop: 10, backgroundColor: THEME.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: THEME.line },
  userTopRow: { flexDirection: 'row', alignItems: 'center' },
  userName: { fontWeight: '900', color: THEME.ink },
  userMeta: { color: THEME.muted, fontSize: 12, marginTop: 4, fontWeight: '800' },

  userBarTrack: { marginTop: 10, height: 8, borderRadius: 999, backgroundColor: 'rgba(15,23,42,0.08)', overflow: 'hidden' },
  userBarFill: { height: 8, borderRadius: 999, backgroundColor: 'rgba(6,182,212,0.75)' },

  achBadge: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', minWidth: 74 },
  achBadgeText: { fontWeight: '900', color: THEME.ink, fontSize: 12 },

  badgeOk: { backgroundColor: 'rgba(22,163,74,0.10)', borderColor: 'rgba(22,163,74,0.22)' },
  badgeWarn: { backgroundColor: 'rgba(245,158,11,0.10)', borderColor: 'rgba(245,158,11,0.22)' },
  badgeMissing: { backgroundColor: 'rgba(148,163,184,0.12)', borderColor: 'rgba(148,163,184,0.22)' },

  empty: { textAlign: 'center', marginTop: 20, color: THEME.muted, fontWeight: '700' },

  fab: { position: 'absolute', right: 16, bottom: 24 },
  fabInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 16, justifyContent: 'flex-end', paddingBottom: 18 },
  modalCard: { backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(15,23,42,0.10)', padding: 14 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { color: THEME.ink, fontWeight: '900', fontSize: 16 },
  modalClose: { color: THEME.muted, fontWeight: '900', fontSize: 18, paddingHorizontal: 6 },

  modalBtn: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { color: '#fff', fontWeight: '900', letterSpacing: 0.3 },
});
