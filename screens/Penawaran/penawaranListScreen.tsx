import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  getPenawaranList,
  PenawaranListItem,
} from '../../services/penawaranApi';
import {
  PENAWARAN_SHADOW,
  PENAWARAN_STATUS_COLORS,
  PENAWARAN_THEME,
} from './penawaranTheme';

const THEME = PENAWARAN_THEME;

type FilterStatus = 'ALL' | 'OPEN' | 'BATAL' | 'CLOSE';

const formatRupiah = (value: number) => {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  } catch {
    return `Rp ${Number(value || 0)}`;
  }
};

const formatDate = (ymd: string) => {
  const [y, m, d] = String(ymd || '')
    .split('-')
    .map(Number);
  if (!y || !m || !d) return ymd || '-';
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getCurrentMonth = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const toYmd = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  return { startDate: toYmd(start), endDate: toYmd(end) };
};

const normalizeApprovalState = (value?: string) =>
  String(value || '')
    .trim()
    .toUpperCase();

export default function PenawaranListScreen({ navigation }: any) {
  const initialRange = useMemo(() => getCurrentMonth(), []);
  const [items, setItems] = useState<PenawaranListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<FilterStatus>('ALL');
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const startDateLabel = useMemo(() => formatDate(startDate), [startDate]);
  const endDateLabel = useMemo(() => formatDate(endDate), [endDate]);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const data = await getPenawaranList({
          startDate,
          endDate,
          status,
          search: search.trim() || undefined,
        });
        setItems(data);
      } catch (err: any) {
        Toast.show({
          type: 'glassError',
          text1: 'Error',
          text2:
            err?.response?.data?.message || 'Gagal mengambil daftar penawaran',
        });
        setItems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [endDate, search, startDate, status],
  );

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 350);
    return () => clearTimeout(timer);
  }, [search, status, startDate, endDate, loadData]);

  const parseYmd = (ymd: string) => {
    const [y, m, d] = String(ymd || '')
      .split('-')
      .map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };

  const onChangeStartDate = (_: any, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowStartPicker(false);
    }
    if (!selectedDate) return;
    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedDate.getDate()).padStart(2, '0');
    const ymd = `${yyyy}-${mm}-${dd}`;
    setStartDate(ymd);
    if (ymd > endDate) {
      setEndDate(ymd);
    }
  };

  const onChangeEndDate = (_: any, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowEndPicker(false);
    }
    if (!selectedDate) return;
    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedDate.getDate()).padStart(2, '0');
    const ymd = `${yyyy}-${mm}-${dd}`;
    if (ymd < startDate) {
      setStartDate(ymd);
    }
    setEndDate(ymd);
  };

  const onPressItem = (item: PenawaranListItem) => {
    navigation.navigate('PenawaranDetail', { nomor: item.nomor });
  };

  const renderItem = ({ item }: { item: PenawaranListItem }) => {
    const approvalState = normalizeApprovalState(item.approval_state);
    const approvalColor = PENAWARAN_STATUS_COLORS[approvalState] || THEME.muted;
    const approvalLabel = approvalState || '-';

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.card}
        onPress={() => onPressItem(item)}
      >
        <View style={styles.cardTopRow}>
          <Text style={styles.nomor}>{item.nomor}</Text>
          <View
            style={[
              styles.approvalBadge,
              { backgroundColor: `${approvalColor}1A` },
            ]}
          >
            <Text style={[styles.approvalBadgeText, { color: approvalColor }]}>
              {approvalLabel}
            </Text>
          </View>
        </View>

        <Text style={styles.customer} numberOfLines={1}>
          {item.customer || '-'}
        </Text>

        <Text style={styles.metaText} numberOfLines={1}>
          {formatDate(item.tanggal)} • {item.perusahaan || '-'}
        </Text>
        <Text style={styles.metaText} numberOfLines={1}>
          Sales: {item.sales || '-'}
        </Text>

        <View style={styles.cardBottomRow}>
          <Text style={styles.nominal}>{formatRupiah(item.nominal)}</Text>
          <Text style={styles.detailCount}>{item.detail_count} item</Text>
        </View>
      </TouchableOpacity>
    );
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

      <View style={styles.headerWrap}>
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <Text style={styles.title}>Penawaran</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate('PenawaranCreate')}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[THEME.primary, THEME.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.addButtonGradient}
              >
                <Text style={styles.addButtonText}>+ Buat</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>
            Periode {startDateLabel} s.d. {endDateLabel}
          </Text>

          <View style={styles.dateRow}>
            <TouchableOpacity
              style={styles.dateChip}
              onPress={() => setShowStartPicker(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.dateChipLabel}>Mulai</Text>
              <Text style={styles.dateChipValue}>{startDateLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dateChip}
              onPress={() => setShowEndPicker(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.dateChipLabel}>Sampai</Text>
              <Text style={styles.dateChipValue}>{endDateLabel}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Cari nomor/customer/perusahaan"
              placeholderTextColor={THEME.muted}
              style={styles.searchInput}
            />
            {search.trim() ? (
              <TouchableOpacity
                style={styles.clearSearchButton}
                onPress={() => setSearch('')}
                activeOpacity={0.8}
              >
                <Text style={styles.clearSearchButtonText}>x</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.filterRow}>
            {(['ALL', 'OPEN', 'BATAL', 'CLOSE'] as FilterStatus[]).map(s => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.filterChip,
                  status === s && styles.filterChipActive,
                ]}
                onPress={() => setStatus(s)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    status === s && styles.filterChipTextActive,
                  ]}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={THEME.primary} />
          <Text style={styles.loadingText}>Memuat data penawaran...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.nomor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>Belum ada data</Text>
              <Text style={styles.emptySub}>
                Coba ubah filter atau kata kunci.
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              tintColor={THEME.primary}
            />
          }
        />
      )}

      {showStartPicker && (
        <DateTimePicker
          value={parseYmd(startDate)}
          mode="date"
          display="default"
          onChange={onChangeStartDate}
          maximumDate={parseYmd(endDate)}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={parseYmd(endDate)}
          mode="date"
          display="default"
          onChange={onChangeEndDate}
          minimumDate={parseYmd(startDate)}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrap: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 44 : 8,
    paddingBottom: 8,
  },
  headerCard: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.line,
    padding: 14,
    ...PENAWARAN_SHADOW.card,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: THEME.ink,
  },
  addButton: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  addButtonGradient: {
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: THEME.muted,
    fontWeight: '700',
  },
  dateRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  dateChip: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.line,
    backgroundColor: THEME.soft,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  dateChipLabel: {
    color: THEME.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  dateChipValue: {
    color: THEME.ink,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  searchBox: {
    marginTop: 12,
    backgroundColor: THEME.soft,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 12,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    color: THEME.ink,
    fontSize: 14,
    fontWeight: '700',
    padding: 0,
  },
  clearSearchButton: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: 'rgba(100,116,139,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  clearSearchButtonText: {
    color: THEME.muted,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  filterRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: THEME.soft,
  },
  filterChipActive: {
    backgroundColor: 'rgba(79,70,229,0.14)',
    borderColor: 'rgba(79,70,229,0.35)',
  },
  filterChipText: {
    color: THEME.muted,
    fontWeight: '800',
    fontSize: 12,
  },
  filterChipTextActive: {
    color: THEME.primary,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 4,
    gap: 10,
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.line,
    ...PENAWARAN_SHADOW.softCard,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nomor: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.ink,
  },
  approvalBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  approvalBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  customer: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '800',
    color: THEME.ink,
  },
  metaText: {
    marginTop: 2,
    fontSize: 12,
    color: THEME.muted,
  },
  cardBottomRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nominal: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.primary,
  },
  detailCount: {
    fontSize: 12,
    color: THEME.muted,
    fontWeight: '700',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: THEME.muted,
    fontSize: 13,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 42,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.ink,
  },
  emptySub: {
    marginTop: 6,
    fontSize: 13,
    color: THEME.muted,
  },
});
