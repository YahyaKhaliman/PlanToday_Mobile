import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getPenawaranList,
  PenawaranListItem,
} from '../../services/penawaranApi';
import { PENAWARAN_SHADOW, PENAWARAN_THEME } from './penawaranTheme';

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

export default function PenawaranListScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const initialRange = useMemo(() => getCurrentMonth(), []);
  const [items, setItems] = useState<PenawaranListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [status] = useState<FilterStatus>('ALL');
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showSearchFab, setShowSearchFab] = useState(false);
  const [openSearchMini, setOpenSearchMini] = useState(false);

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

  const onScroll = useCallback((e: any) => {
    const y = e?.nativeEvent?.contentOffset?.y || 0;
    setShowSearchFab(y > 180);
  }, []);

  const renderItem = ({ item }: { item: PenawaranListItem }) => {
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.card}
        onPress={() => onPressItem(item)}
      >
        <View style={styles.cardTopRow}>
          <Text style={styles.nomor}>{item.nomor}</Text>
          <Text style={styles.detailCount}>{item.detail_count} item</Text>
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
        </View>
        <Text style={styles.detail}>Tap untuk lihat detail</Text>
      </TouchableOpacity>
    );
  };

  const ListHeader = (
    <View style={styles.headerWrap}>
      <View style={styles.headerTop}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.title}>Penawaran</Text>
            <Text style={styles.subtitle}>
              Periode {startDateLabel} - {endDateLabel}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.headerCard}>
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

        <TouchableOpacity
          style={styles.createButtonWide}
          onPress={() => navigation.navigate('PenawaranCreate')}
          activeOpacity={0.9}
          accessibilityLabel="Tambah Penawaran"
        >
          <LinearGradient
            colors={[THEME.primary, THEME.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.createButtonWideGradient}
          >
            <Text style={styles.createButtonWideText}>Buat Penawaran</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />
      <Text style={styles.tampil}>Menampilkan {items.length} data</Text>
    </View>
  );

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

      <FlatList
        data={items}
        keyExtractor={item => item.nomor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={[
          styles.listContainer,
          { paddingBottom: 140 + insets.bottom },
        ]}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={THEME.primary} />
              <Text style={styles.loadingText}>Memuat data penawaran...</Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>Belum ada data</Text>
              <Text style={styles.emptySub}>
                Coba ubah filter atau kata kunci.
              </Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor={THEME.primary}
          />
        }
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />

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

      {showSearchFab && (
        <TouchableOpacity
          style={[styles.fabSearch, { bottom: 82 + insets.bottom }]}
          onPress={() => setOpenSearchMini(true)}
          activeOpacity={0.9}
          accessibilityLabel="Cari Penawaran"
        >
          <View style={styles.fabSearchInner}>
            <Text style={styles.fabSearchIcon}>🔍</Text>
          </View>
        </TouchableOpacity>
      )}

      <Modal
        visible={openSearchMini}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenSearchMini(false)}
      >
        <View
          style={[styles.modalBackdrop, { paddingBottom: 18 + insets.bottom }]}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pencarian</Text>
              <TouchableOpacity
                onPress={() => setOpenSearchMini(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalClose}>✕</Text>
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
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrap: {
    backgroundColor: THEME.bgBottom,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 54 : 18,
    paddingBottom: 10,
  },
  headerTop: {
    marginBottom: 10,
  },
  headerCard: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: THEME.line,
    padding: 14,
    ...PENAWARAN_SHADOW.card,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  title: {
    fontSize: 25,
    fontWeight: '900',
    color: THEME.ink,
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    color: THEME.muted,
    fontWeight: '700',
    textAlign: 'center',
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
    color: THEME.ink,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  filterRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  divider: {
    marginTop: 10,
    height: 1,
    backgroundColor: THEME.line,
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
    paddingBottom: 24,
    paddingTop: 4,
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    padding: 14,
    marginHorizontal: 20,
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
    color: THEME.ink,
  },
  tampil: {
    marginTop: 2,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: 800,
    color: THEME.ink,
  },
  cardBottomRow: {
    marginTop: 5,
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
    color: THEME.ink,
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
    paddingHorizontal: 20,
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
  createButtonWide: {
    marginTop: 10,
    borderRadius: 14,
    overflow: 'hidden',
    ...PENAWARAN_SHADOW.softCard,
  },
  createButtonWideGradient: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  createButtonWideText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  fabSearch: {
    position: 'absolute',
    right: 16,
  },
  fabSearchInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.8)',
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
  fabSearchIcon: {
    fontSize: 18,
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.10)',
    padding: 14,
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
  detail: {
    color: THEME.muted,
    fontWeight: '700',
    fontSize: 11,
    paddingTop: 5,
  },
});
