/* eslint-disable react-native/no-inline-styles */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  Animated,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePressGuard } from '../../utils/usePressGuard';
import ModalPicker from 'react-native-modal';
import CircularProgress from './circularProgress';

import api from '../../services/api';
import { useAuth } from '../../context/authContext';

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

const SHORT_MONTHS = [
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

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
const toIndex = (y: number, m: number) => y * 12 + (m - 1);
const progressPct = (r: number, t: number) =>
  !t ? 0 : clamp((r / t) * 100, 0, 500);

const rupiahShort = (n: number) => {
  const v = Number(n || 0);
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}M`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}Jt`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}Rb`;
  return `${Math.round(v)}`;
};

const rupiahFull = (n: number) =>
  `Rp.${Number(n || 0).toLocaleString('id-ID')}`;

const formatMonthYear = (month: number, year: number) => {
  const mLabel = MONTHS[clamp(month, 1, 12) - 1]?.label || `${month}`;
  return `${mLabel} ${year}`;
};

type PickerTarget = 'start' | 'end';
type PickerMode = 'inline' | 'modal';

export default function AchievementOmsetScreen({ navigation }: any) {
  const { user, token } = useAuth();
  const insets = useSafeAreaInsets();
  const runGuardedPress = usePressGuard();
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
  const [isMonthYearPickerVisible, setIsMonthYearPickerVisible] =
    useState(false);
  const [tempMonth, setTempMonth] = useState(nowMonth);
  const [tempYear, setTempYear] = useState(nowYear);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>('start');
  const [pickerMode, setPickerMode] = useState<PickerMode>('inline');

  /** UI */
  const [openFilter, setOpenFilter] = useState(false);
  const [showFab, setShowFab] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  // ===== Skeleton Loading =====
  const skeletonPulse = useRef(new Animated.Value(0.3)).current;
  const skeletonData = useMemo(
    () =>
      Array.from(
        { length: 5 },
        (_, i) => ({ kode: `skeleton-${i}`, isSkeleton: true } as any),
      ),
    [],
  );

  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (loading) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(skeletonPulse, {
            toValue: 0.8,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(skeletonPulse, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      anim.start();
    } else {
      skeletonPulse.setValue(0.3);
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [loading, skeletonPulse]);
  const [rows, setRows] = useState<UserAggRow[]>([]);

  const closePickers = useCallback(() => {
    setIsMonthYearPickerVisible(false);
  }, []);

  /** FETCH */
  const fetchRange = useCallback(
    async (fy: number, fm: number, ty: number, tm: number) => {
      if (!token) return; // ✅ tunggu token

      setLoading(true);
      try {
        const params: any = {
          fromYear: fy,
          fromMonth: fm,
          toYear: ty,
          toMonth: tm,
        };

        const res = await api.get('/achievement/omset/range', {
          params,
          headers: { Authorization: `Bearer ${token}` },
        });

        const arr = (res.data?.data || []) as any[];
        const mapped: UserAggRow[] = arr.map(x => ({
          kode: String(x.kode || ''),
          nama: String(x.nama || '-'),
          jabatan: String(x.jabatan || '-'),
          target: Number(x.target || 0),
          realisasi: Number(x.realisasi || 0),
          ach: Number(x.ach || 0),
        }));

        setRows(mapped);
      } catch (err: any) {
        const msg =
          err?.response?.data?.message || 'Gagal mengambil achievement';
        Toast.show({ type: 'glassError', text1: 'Error', text2: msg });
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [token],
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
    [fetchRange],
  );

  useEffect(() => {
    if (!token) return;
    applyRange(fromYear, fromMonth, toYear, toMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /** OPEN PICKERS */
  const openStartInline = useCallback(() => {
    setPickerMode('inline');
    setPickerTarget('start');
    setTempMonth(fromMonth);
    setTempYear(fromYear);
    setIsMonthYearPickerVisible(true);
  }, [fromMonth, fromYear]);

  const openEndInline = useCallback(() => {
    setPickerMode('inline');
    setPickerTarget('end');
    setTempMonth(toMonth);
    setTempYear(toYear);
    setIsMonthYearPickerVisible(true);
  }, [toMonth, toYear]);

  const openStartModal = useCallback(() => {
    setPickerMode('modal');
    setPickerTarget('start');
    setTempMonth(draftFromMonth);
    setTempYear(draftFromYear);
    setIsMonthYearPickerVisible(true);
  }, [draftFromMonth, draftFromYear]);

  const openEndModal = useCallback(() => {
    setPickerMode('modal');
    setPickerTarget('end');
    setTempMonth(draftToMonth);
    setTempYear(draftToYear);
    setIsMonthYearPickerVisible(true);
  }, [draftToMonth, draftToYear]);

  const applyMonthYearPicker = useCallback(async () => {
    if (pickerMode === 'modal') {
      if (pickerTarget === 'start') {
        setDraftFromMonth(tempMonth);
        setDraftFromYear(tempYear);
      } else {
        setDraftToMonth(tempMonth);
        setDraftToYear(tempYear);
      }
    } else {
      if (pickerTarget === 'start') {
        setFromMonth(tempMonth);
        setFromYear(tempYear);
        await applyRange(tempYear, tempMonth, toYear, toMonth);
      } else {
        setToMonth(tempMonth);
        setToYear(tempYear);
        await applyRange(fromYear, fromMonth, tempYear, tempMonth);
      }
    }
    setIsMonthYearPickerVisible(false);
  }, [
    pickerMode,
    pickerTarget,
    tempMonth,
    tempYear,
    fromMonth,
    fromYear,
    toMonth,
    toYear,
    applyRange,
  ]);

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
    return rows.filter(
      r =>
        r.nama.toLowerCase().includes(q) || r.jabatan.toLowerCase().includes(q),
    );
  }, [rows, keyword, isManager]);

  const summary = useMemo(() => {
    const totalTarget = filteredRows.reduce(
      (a, b) => a + Number(b.target || 0),
      0,
    );
    const totalReal = filteredRows.reduce(
      (a, b) => a + Number(b.realisasi || 0),
      0,
    );
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
        <TouchableOpacity
          style={styles.dateSelect}
          onPress={openStartInline}
          activeOpacity={0.9}
        >
          <Text style={styles.dateText}>
            {formatMonthYear(fromMonth, fromYear)}
          </Text>
          <MaterialIcons name="edit-calendar" color={THEME.ink} size={18} />
        </TouchableOpacity>
      </View>

      <View style={styles.col}>
        <Text style={styles.label}>Periode Akhir</Text>
        <TouchableOpacity
          style={styles.dateSelect}
          onPress={openEndInline}
          activeOpacity={0.9}
        >
          <Text style={styles.dateText}>
            {formatMonthYear(toMonth, toYear)}
          </Text>
          <MaterialIcons name="edit-calendar" color={THEME.ink} size={18} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const PeriodRowModal = (
    <View style={styles.row2}>
      <View style={styles.col}>
        <Text style={styles.label}>Periode Awal</Text>
        <TouchableOpacity
          style={styles.dateSelect}
          onPress={openStartModal}
          activeOpacity={0.9}
        >
          <Text style={styles.dateText}>
            {formatMonthYear(draftFromMonth, draftFromYear)}
          </Text>
          <MaterialIcons name="edit-calendar" color={THEME.ink} size={18} />
        </TouchableOpacity>
      </View>

      <View style={styles.col}>
        <Text style={styles.label}>Periode Akhir</Text>
        <TouchableOpacity
          style={styles.dateSelect}
          onPress={openEndModal}
          activeOpacity={0.9}
        >
          <Text style={styles.dateText}>
            {formatMonthYear(draftToMonth, draftToYear)}
          </Text>
          <MaterialIcons name="edit-calendar" color={THEME.ink} size={18} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const SearchBox = useMemo(() => {
    if (!isManager) return null;
    return (
      <View style={styles.searchBox}>
        <MaterialIcons name="search" size={20} color={THEME.muted} />

        <TextInput
          value={keyword}
          onChangeText={setKeyword}
          placeholder="Cari nama / jabatan..."
          placeholderTextColor={THEME.muted}
          style={styles.searchInput}
          autoCorrect={false}
        />
        {!!keyword.trim() && (
          <TouchableOpacity
            onPress={clearKeyword}
            activeOpacity={0.8}
            style={styles.clearBtn}
          >
            <MaterialIcons name="close" size={18} color={THEME.muted} />
          </TouchableOpacity>
        )}
      </View>
    );
  }, [keyword, clearKeyword, isManager]);

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

      <FlatList
        data={loading ? skeletonData : filteredRows}
        keyExtractor={(it, idx) =>
          it.isSkeleton ? `skeleton-${idx}` : `${it.kode || 'UNK'}-${idx}`
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 60 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View>
            <View style={styles.headerWrap}>
              <View style={styles.headerTop}>
                <View style={styles.headerTopRow}>
                  <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => navigation.navigate('Home')}
                    activeOpacity={0.85}
                  >
                    <MaterialIcons
                      name="arrow-back-ios-new"
                      size={18}
                      color={THEME.primary}
                    />
                  </TouchableOpacity>
                  <View style={styles.headerTitleWrap}>
                    <Text style={styles.title}>Achievement</Text>
                    <Text style={styles.subTitle}>
                      {isManager ? 'Rekap Achievement' : 'Rekap Achievement'}
                    </Text>
                  </View>
                  <View style={styles.headerRightSpacer} />
                </View>
              </View>
            </View>

            <View style={styles.card}>
              {/* Bagian Atas: Circular Progress + Ringkasan Metrik Berdampingan */}
              <View style={styles.cardTopRow}>
                {/* Sisi Kiri: Circular Progress */}
                <View style={styles.circleWrap}>
                  <CircularProgress
                    size={78}
                    strokeWidth={8}
                    progress={summary.prog}
                    color={summary.isMet ? THEME.ok : THEME.accent}
                    bgColor="rgba(15,23,42,0.08)"
                    textColor={THEME.ink}
                  />
                </View>

                {/* Sisi Kanan: Informasi & Statistik Ringkas */}
                <View style={styles.cardTopInfo}>
                  <View style={styles.infoTopHeader}>
                    <Text style={styles.infoTitle}>Progress Pencapaian</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: summary.isMet
                            ? 'rgba(22,163,74,0.10)'
                            : 'rgba(245,158,11,0.10)',
                          borderColor: summary.isMet
                            ? 'rgba(22,163,74,0.22)'
                            : 'rgba(245,158,11,0.22)',
                        },
                      ]}
                    >
                      <MaterialIcons
                        name={summary.isMet ? 'check-circle' : 'schedule'}
                        size={12}
                        color={summary.isMet ? THEME.ok : THEME.warn}
                      />
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: summary.isMet ? THEME.ok : THEME.warn },
                        ]}
                      >
                        {summary.isMet ? 'TERCAPAI' : 'BELUM'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.statListWrap}>
                    <View style={styles.statRowItem}>
                      <Text style={styles.statRowLabel}>Target</Text>
                      <Text style={styles.statRowColon}>:</Text>
                      <Text style={styles.statRowValue} numberOfLines={1}>
                        {rupiahFull(summary.totalTarget)}
                      </Text>
                    </View>

                    <View style={styles.statRowItem}>
                      <Text style={styles.statRowLabel}>Realisasi</Text>
                      <Text style={styles.statRowColon}>:</Text>
                      <Text
                        style={[
                          styles.statRowValue,
                          { color: summary.isMet ? THEME.ok : THEME.primary },
                        ]}
                        numberOfLines={1}
                      >
                        {rupiahFull(summary.totalReal)}
                      </Text>
                    </View>

                    {isManager && (
                      <View style={styles.statRowItem}>
                        <Text style={styles.statRowLabel}>User</Text>
                        <Text style={styles.statRowColon}>:</Text>
                        <Text style={styles.statRowValue} numberOfLines={1}>
                          {loading ? '...' : `${filteredRows.length}`}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Rentang Periode Ramping */}
              {PeriodRowInline}

              {/* Pencarian (Khusus Manager) */}
              {SearchBox}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          if (item.isSkeleton) {
            return (
              <View style={styles.userCard}>
                <View style={styles.userTopRow}>
                  <View style={{ flex: 1, paddingRight: 10, gap: 8 }}>
                    {/* Nama User & Jabatan Skeleton */}
                    <Animated.View
                      style={[
                        styles.skeletonBar,
                        { width: '55%', height: 15, opacity: skeletonPulse },
                      ]}
                    />
                    {/* Target & Realisasi Skeleton */}
                    <Animated.View
                      style={[
                        styles.skeletonBar,
                        {
                          width: '80%',
                          height: 11,
                          opacity: skeletonPulse,
                          marginTop: 2,
                        },
                      ]}
                    />
                    {/* Progress Bar Track Skeleton */}
                    <View style={[styles.userBarTrack, { marginTop: 4 }]}>
                      <View style={[styles.userBarFill, { width: '0%' }]} />
                    </View>
                  </View>

                  {/* Badge Pencapaian Skeleton */}
                  <Animated.View
                    style={[
                      styles.skeletonBar,
                      {
                        width: 56,
                        height: 28,
                        borderRadius: 8,
                        opacity: skeletonPulse,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          }

          const prog = progressPct(item.realisasi, item.target);
          const barFill = clamp(prog, 0, 100);
          const achValue = Number(item.ach || prog);

          const badgeStyle =
            achValue >= 100
              ? styles.badgeOk
              : achValue > 0
              ? styles.badgeWarn
              : styles.badgeMissing;

          return (
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.userCard}
              onPress={() =>
                runGuardedPress(
                  `achievement:detail:${item.kode || item.nama}`,
                  () =>
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
                    }),
                )
              }
            >
              <View style={styles.userTopRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {item.nama} • {item.jabatan}
                  </Text>
                  <Text style={styles.userMeta} numberOfLines={1}>
                    Target: {rupiahShort(item.target)} • Realisasi:{' '}
                    {rupiahShort(item.realisasi)}
                  </Text>

                  <View style={styles.userBarTrack}>
                    <View
                      style={[styles.userBarFill, { width: `${barFill}%` }]}
                    />
                  </View>
                </View>

                <View style={[styles.achBadge, badgeStyle]}>
                  <Text style={styles.achBadgeText}>
                    {achValue.toFixed(2)}%
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          loading ? null : (
            <Text style={styles.empty}>
              {token ? 'Data tidak ditemukan' : 'Silakan login ulang'}
            </Text>
          )
        }
      />

      {/* FAB filter */}
      {showFab && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() =>
            runGuardedPress('achievement:open-filter', openFilterModal, 250)
          }
          style={[styles.fab, { bottom: 24 + insets.bottom }]}
        >
          <View style={styles.fabInner}>
            <MaterialIcons name="filter-list" size={16} color={THEME.ink} />
            <Text style={styles.fabText}>Filter</Text>
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
        <View
          style={[styles.modalBackdrop, { paddingBottom: 18 + insets.bottom }]}
        >
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
                  runGuardedPress('achievement:apply-filter', () => {
                    setOpenFilter(false);
                    closePickers();
                    applyRange(
                      draftFromYear,
                      draftFromMonth,
                      draftToYear,
                      draftToMonth,
                    );
                  });
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
                  runGuardedPress('achievement:reset-filter', () => {
                    setDraftFromYear(nowYear);
                    setDraftFromMonth(nowMonth);
                    setDraftToYear(nowYear);
                    setDraftToMonth(nowMonth);
                    setOpenFilter(false);
                    closePickers();
                    applyRange(nowYear, nowMonth, nowYear, nowMonth);
                  });
                }}
                disabled={loading}
                activeOpacity={0.9}
              >
                <Text style={[styles.modalBtnText, { color: THEME.primary }]}>
                  Reset
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Month Year Picker Terpadu */}
      <ModalPicker
        isVisible={isMonthYearPickerVisible}
        onBackdropPress={() => setIsMonthYearPickerVisible(false)}
        onBackButtonPress={() => setIsMonthYearPickerVisible(false)}
        backdropOpacity={0.45}
        animationIn="zoomIn"
        animationOut="zoomOut"
        useNativeDriver
        hideModalContentWhileAnimating
      >
        <View style={styles.periodModalCard}>
          <Text style={styles.periodModalTitle}>
            Pilih Periode {pickerTarget === 'start' ? 'Awal' : 'Akhir'}
          </Text>

          <Text style={styles.periodSectionTitle}>Bulan</Text>
          <View style={styles.monthGrid}>
            {SHORT_MONTHS.map((mName, idx) => {
              const mVal = idx + 1;
              const active = tempMonth === mVal;
              return (
                <TouchableOpacity
                  key={`m-${mVal}`}
                  style={[styles.monthChip, active && styles.monthChipActive]}
                  onPress={() => setTempMonth(mVal)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.monthChipText,
                      active && styles.monthChipTextActive,
                    ]}
                  >
                    {mName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.periodSectionTitle}>Tahun</Text>
          <View style={styles.yearRow}>
            {years.map(yVal => {
              const active = tempYear === yVal;
              return (
                <TouchableOpacity
                  key={`y-${yVal}`}
                  style={[styles.yearChip, active && styles.yearChipActive]}
                  onPress={() => setTempYear(yVal)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.yearChipText,
                      active && styles.yearChipTextActive,
                    ]}
                  >
                    {yVal}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.modalBtnRow}>
            <TouchableOpacity
              style={styles.modalBtnCancel}
              onPress={() => setIsMonthYearPickerVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalBtnCancelText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalBtnApply}
              onPress={applyMonthYearPicker}
              activeOpacity={0.7}
            >
              <Text style={styles.modalBtnApplyText}>Terapkan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ModalPicker>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: {
    paddingTop: 4,
    paddingHorizontal: 20,
    paddingBottom: 60,
  },

  headerWrap: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    paddingBottom: 10,
  },
  header: { alignItems: 'center', marginBottom: 10 },
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
  },
  subTitle: {
    color: THEME.muted,
    fontSize: 12,
    marginTop: 6,
    fontWeight: '700',
    textAlign: 'center',
  },

  card: {
    backgroundColor: THEME.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1.5,
  },

  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    gap: 12,
  },
  circleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTopInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  infoTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.muted,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 7,
    borderWidth: 1,
    gap: 3,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  statListWrap: {
    gap: 3,
  },
  statRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statRowLabel: {
    width: 60,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.muted,
  },
  statRowColon: {
    width: 10,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.muted,
  },
  statRowValue: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '800',
    color: THEME.ink,
    textAlign: 'right',
  },

  chip: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { fontSize: 11, fontWeight: '900' },

  line: { height: 1, backgroundColor: THEME.line, marginVertical: 12 },

  row2: { flexDirection: 'row', gap: 10, marginTop: 4 },
  col: { flex: 1 },

  label: {
    color: THEME.muted,
    fontSize: 10,
    fontWeight: '900',
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 12,
    height: 45,
  },
  dateText: { flex: 1, color: THEME.ink, fontSize: 13, fontWeight: '900' },

  moneyBlock: {
    backgroundColor: THEME.soft,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  key: { color: THEME.muted, fontSize: 12, fontWeight: '800' },
  val: { color: THEME.ink, fontSize: 12, fontWeight: '900' },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.soft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontWeight: '900', color: THEME.ink },
  clearBtn: { padding: 8, marginRight: -6 },

  detailTitle: { marginTop: 10, fontWeight: '900', color: THEME.ink },

  userCard: {
    marginTop: 8,
    backgroundColor: THEME.card,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  userTopRow: { flexDirection: 'row', alignItems: 'center' },
  userName: { fontWeight: '900', color: THEME.ink, fontSize: 13 },
  userMeta: {
    color: THEME.muted,
    fontSize: 11,
    marginTop: 4,
    fontWeight: '800',
  },

  userBarTrack: {
    marginTop: 10,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.08)',
    overflow: 'hidden',
  },
  userBarFill: {
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(6,182,212,0.75)',
  },

  achBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  achBadgeText: { fontWeight: '900', color: THEME.ink, fontSize: 11 },

  badgeOk: {
    backgroundColor: 'rgba(22,163,74,0.10)',
    borderColor: 'rgba(22,163,74,0.22)',
  },
  badgeWarn: {
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderColor: 'rgba(245,158,11,0.22)',
  },
  badgeMissing: {
    backgroundColor: 'rgba(148,163,184,0.12)',
    borderColor: 'rgba(148,163,184,0.22)',
  },

  empty: {
    textAlign: 'center',
    marginTop: 20,
    color: THEME.muted,
    fontWeight: '700',
  },

  fab: { position: 'absolute', right: 16, bottom: 24 },
  fabInner: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  fabText: {
    color: THEME.ink,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
    marginLeft: 6,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 16,
    justifyContent: 'flex-end',
    paddingBottom: 18,
  },
  modalCard: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.10)',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: { color: THEME.ink, fontWeight: '900', fontSize: 16 },
  modalClose: {
    color: THEME.muted,
    fontWeight: '900',
    fontSize: 18,
    paddingHorizontal: 6,
  },

  modalBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: { color: '#fff', fontWeight: '900', letterSpacing: 0.3 },
  skeletonBar: {
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
  },

  periodModalCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  periodModalTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: THEME.ink,
    textAlign: 'center',
    marginBottom: 16,
  },
  periodSectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: THEME.muted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  monthChip: {
    width: '23%',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: THEME.line,
    alignItems: 'center',
  },
  monthChipActive: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  monthChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.ink,
  },
  monthChipTextActive: {
    color: '#FFF',
  },
  yearRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 20,
  },
  yearChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: THEME.line,
    alignItems: 'center',
  },
  yearChipActive: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  yearChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.ink,
  },
  yearChipTextActive: {
    color: '#FFF',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.line,
  },
  modalBtnCancelText: {
    color: THEME.muted,
    fontWeight: '900',
    fontSize: 12,
  },
  modalBtnApply: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: THEME.primary,
    alignItems: 'center',
  },
  modalBtnApplyText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 12,
  },
});
