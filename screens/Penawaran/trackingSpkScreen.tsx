/* eslint-disable react-native/no-inline-styles */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import LinearGradient from 'react-native-linear-gradient';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { PENAWARAN_SHADOW, PENAWARAN_THEME } from './penawaranTheme';
import { useAuth } from '../../context/authContext';
import { ListSkeleton } from '../../components/loadingSkeleton';
import {
  getTrackingSpkList,
  TrackingSpkListItem,
} from '../../services/trackingSpkApi';

const THEME = PENAWARAN_THEME;

const toYmd = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getCurrentMonth = () => {
  const now = new Date();
  return {
    startDate: toYmd(new Date(now.getFullYear(), now.getMonth(), 1)),
    endDate: toYmd(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
};

const parseYmd = (ymd: string) => {
  const [y, m, d] = String(ymd || '')
    .split('-')
    .map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const formatDate = (ymd?: string) => {
  if (!ymd) return '-';
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function TrackingSpkScreen({ route }: any) {
  const { token } = useAuth();
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'belum' | 'proses' | 'sudah'
  >('all');
  const insets = useSafeAreaInsets();
  const initialRange = useMemo(() => {
    const pMonth = route?.params?.month;
    const pYear = route?.params?.year;
    if (pMonth && pYear) {
      const start = new Date(pYear, pMonth - 1, 1);
      const end = new Date(pYear, pMonth, 0);
      const toYmdLocal = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
          d.getDate(),
        ).padStart(2, '0')}`;
      return { startDate: toYmdLocal(start), endDate: toYmdLocal(end) };
    }
    return getCurrentMonth();
  }, [route?.params?.month, route?.params?.year]);

  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);

  useEffect(() => {
    const pMonth = route?.params?.month;
    const pYear = route?.params?.year;
    if (pMonth && pYear) {
      const start = new Date(pYear, pMonth - 1, 1);
      const end = new Date(pYear, pMonth, 0);
      const toYmdLocal = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
          d.getDate(),
        ).padStart(2, '0')}`;
      setStartDate(toYmdLocal(start));
      setEndDate(toYmdLocal(end));
    }
  }, [route?.params?.month, route?.params?.year]);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [rawItems, setRawItems] = useState<TrackingSpkListItem[]>([]);

  const filteredItems = useMemo(() => {
    return rawItems.filter(item => {
      if (filterStatus === 'all') return true;
      const order = Number(item.spk_jumlah) || 0;
      const realisasi = Number(item.realisasi_total) || 0;
      if (filterStatus === 'belum') return realisasi < 0.01;
      if (filterStatus === 'sudah') return realisasi >= (order - 0.01);
      if (filterStatus === 'proses') return realisasi >= 0.01 && realisasi < (order - 0.01);
      return true;
    });
  }, [rawItems, filterStatus]);

  const counts = useMemo(() => {
    let belumCount = 0;
    let prosesCount = 0;
    let sudahCount = 0;
    rawItems.forEach(item => {
      const order = Number(item.spk_jumlah) || 0;
      const realisasi = Number(item.realisasi_total) || 0;
      if (realisasi < 0.01) {
        belumCount++;
      } else if (realisasi >= (order - 0.01)) {
        sudahCount++;
      } else {
        prosesCount++;
      }
    });
    return { belum: belumCount, proses: prosesCount, sudah: sudahCount };
  }, [rawItems]);

  const [loading, setLoading] = useState(false);
  const [isSearchSubmitting, setIsSearchSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [openedItemKey, setOpenedItemKey] = useState<string | null>(null);
  const isBusy = loading || isSearchSubmitting || refreshing;

  const loadList = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        setErrorMessage(null);
        if (!token) {
          setRawItems([]);
          setHasLoadedOnce(true);
          return;
        }

        const data = await getTrackingSpkList(
          {
            startDate,
            endDate,
            search: appliedSearch.trim() || undefined,
            limit: 1000,
          },
          token,
        );
        setRawItems(data);
        setHasLoadedOnce(true);
      } catch (err: any) {
        setRawItems([]);
        const message =
          err?.response?.data?.message || 'Gagal mengambil data tracking SPK';
        setErrorMessage(message);
        setHasLoadedOnce(true);
        Toast.show({
          type: 'glassError',
          text1: 'Error',
          text2: message,
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
        setIsSearchSubmitting(false);
      }
    },
    [appliedSearch, endDate, startDate, token],
  );

  useEffect(() => {
    loadList();
  }, [loadList]);

  const applyFilter = useCallback(() => {
    if (isBusy) return;
    const nextSearch = search.trim();
    const currentAppliedSearch = appliedSearch.trim();
    if (nextSearch === currentAppliedSearch) {
      setIsSearchSubmitting(false);
      return;
    }
    setIsSearchSubmitting(true);
    setAppliedSearch(nextSearch);
  }, [appliedSearch, isBusy, search]);

  const onChangeSearch = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const showSkeleton = loading && !refreshing;

  const onRetry = useCallback(() => {
    if (loading || refreshing) return;
    loadList();
  }, [loadList, loading, refreshing]);

  const onRefresh = useCallback(() => {
    if (loading || isSearchSubmitting) return;
    loadList(true);
  }, [isSearchSubmitting, loadList, loading]);

  const onChangeStartDate = (_: any, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') setShowStartPicker(false);
    if (!selectedDate) return;
    const ymd = toYmd(selectedDate);
    setStartDate(ymd);
    if (ymd > endDate) setEndDate(ymd);
  };

  const onChangeEndDate = (_: any, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') setShowEndPicker(false);
    if (!selectedDate) return;
    const ymd = toYmd(selectedDate);
    if (ymd < startDate) setStartDate(ymd);
    setEndDate(ymd);
  };

  const renderItem = useCallback(
    ({ item, index }: { item: TrackingSpkListItem; index: number }) => {
      const itemKey = `${item.spk_nomor || 'spk'}-${
        item.spk_tanggal || 'tgl'
      }-${index}`;
      return (
        <TrackingSpkRow
          item={item}
          isOpened={openedItemKey === itemKey}
          onToggle={() => {
            setOpenedItemKey(prev => (prev === itemKey ? null : itemKey));
          }}
        />
      );
    },
    [openedItemKey],
  );

  const keyExtractor = useCallback(
    (item: TrackingSpkListItem, idx: number) =>
      `${item.spk_nomor || 'spk'}-${item.spk_tanggal || 'tgl'}-${idx}`,
    [],
  );

  const listEmptyComponent = useMemo(() => {
    if (showSkeleton) {
      return (
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingSubText}>Memuat data tracking SPK...</Text>
          <View style={styles.skeletonWrap}>
            <ListSkeleton rows={4} />
          </View>
        </View>
      );
    }

    if (errorMessage) {
      return (
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Gagal memuat data</Text>
          <Text style={styles.errorSubtitle}>{errorMessage}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            activeOpacity={0.88}
            onPress={onRetry}
          >
            <Text style={styles.retryButtonText}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>Data tracking SPK tidak ditemukan</Text>
        <Text style={styles.emptySubtitle}>
          Ubah rentang tanggal atau kata kunci pencarian, lalu coba lagi.
        </Text>
      </View>
    );
  }, [errorMessage, showSkeleton, onRetry]);

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
        data={showSkeleton ? [] : filteredItems}
        extraData={openedItemKey}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={60}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        contentContainerStyle={[
          styles.listContainer,
          { paddingBottom: 120 + insets.bottom },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={THEME.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <Text style={styles.title}>Tracking SPK</Text>

            <View style={styles.filterCard}>
              {/* Compact date row */}
              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={styles.dateChip}
                  onPress={() => setShowStartPicker(true)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.dateChipLabel}>Dari</Text>
                  <Text style={styles.dateChipValue}>
                    {formatDate(startDate)}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.dateSeparator}>—</Text>
                <TouchableOpacity
                  style={styles.dateChip}
                  onPress={() => setShowEndPicker(true)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.dateChipLabel}>Sampai</Text>
                  <Text style={styles.dateChipValue}>
                    {formatDate(endDate)}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Search inline with button */}
              <View style={styles.searchRow}>
                <View style={styles.searchBox}>
                  <TextInput
                    value={search}
                    onChangeText={onChangeSearch}
                    placeholder="Cari SPK..."
                    placeholderTextColor={THEME.muted}
                    style={styles.searchInput}
                    returnKeyType="search"
                    onSubmitEditing={applyFilter}
                    editable={!isBusy}
                  />
                  {search.trim() ? (
                    <TouchableOpacity
                      style={styles.clearSearchButton}
                      onPress={() => setSearch('')}
                      activeOpacity={0.8}
                      disabled={isBusy}
                    >
                      <Text style={styles.clearSearchButtonText}>×</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={styles.searchButton}
                  activeOpacity={0.85}
                  onPress={applyFilter}
                  disabled={isBusy}
                >
                  <LinearGradient
                    colors={[THEME.primary, THEME.accent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.searchButtonGradient}
                  >
                    {isSearchSubmitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.searchButtonText}>Cari</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* Chip filter + count inline */}
              <View style={styles.chipRow}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipScroll}
                >
                  {(['all', 'belum', 'proses', 'sudah'] as const).map(opt => {
                    const active = filterStatus === opt;
                    const getDotColor = (): string | undefined => {
                      if (opt === 'belum') return '#EF4444';
                      if (opt === 'proses') return '#F59E0B';
                      if (opt === 'sudah') return '#10B981';
                      return undefined;
                    };
                    const dotColor = getDotColor();
                    const labelText =
                      opt === 'all'
                        ? `Semua (${rawItems.length})`
                        : opt === 'belum'
                        ? `Open (${counts.belum})`
                        : opt === 'proses'
                        ? `Proses (${counts.proses})`
                        : `Close (${counts.sudah})`;
                    return (
                      <TouchableOpacity
                        key={`status-${opt}`}
                        style={[
                          styles.chipItem,
                          active && styles.chipItemActive,
                        ]}
                        activeOpacity={0.8}
                        onPress={() => setFilterStatus(opt)}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {opt === 'all' ? (
                            <MaterialIcons
                              name="format-list-bulleted"
                              size={14}
                              color={active ? THEME.primary : THEME.muted}
                            />
                          ) : (
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor }} />
                          )}
                          <Text
                            style={[
                              styles.chipLabel,
                              active && styles.chipLabelActive,
                            ]}
                          >
                            {labelText}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                {/* <Text style={styles.countBadge}>{rawItems.length}</Text> */}
              </View>

              {/* Inline loading indicator */}
              {(isSearchSubmitting || (loading && hasLoadedOnce)) && (
                <View style={styles.inlineLoadingWrap}>
                  <ActivityIndicator size="small" color={THEME.primary} />
                  <Text style={styles.inlineLoadingText}>Memuat...</Text>
                </View>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={listEmptyComponent}
      />

      {showStartPicker && (
        <DateTimePicker
          value={parseYmd(startDate)}
          mode="date"
          display="default"
          onChange={onChangeStartDate}
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          value={parseYmd(endDate)}
          mode="date"
          display="default"
          onChange={onChangeEndDate}
        />
      )}
    </LinearGradient>
  );
}

const TrackingSpkRow = memo(
  ({
    item,
    isOpened,
    onToggle,
  }: {
    item: TrackingSpkListItem;
    isOpened: boolean;
    onToggle: () => void;
  }) => {
    const getSpkStatus = () => {
      const order = Number(item.spk_jumlah) || 0;
      const realisasi = Number(item.realisasi_total) || 0;
      if (realisasi < 0.01) {
        return {
          label: 'OPEN',
          color: '#EF4444',
          bgColor: 'rgba(239, 68, 68, 0.08)',
        };
      }
      if (realisasi >= (order - 0.01)) {
        return {
          label: 'CLOSE',
          color: '#10B981',
          bgColor: 'rgba(16, 185, 129, 0.08)',
        };
      }
      return {
        label: 'PROSES',
        color: '#F59E0B',
        bgColor: 'rgba(245, 158, 11, 0.08)',
      };
    };

    const statusInfo = getSpkStatus();

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.rowCard}
        onPress={onToggle}
      >
        <View style={[styles.rowHeader, { alignItems: 'stretch' }]}>
          <View style={styles.rowLeft}>
            <View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  flexWrap: 'wrap',
                }}
              >
                <Text style={styles.rowLabel}>SPK</Text>
                <View
                  style={{
                    backgroundColor: statusInfo.bgColor,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: statusInfo.color + '22',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '800',
                      color: statusInfo.color,
                      textTransform: 'uppercase',
                    }}
                  >
                    {statusInfo.label}
                  </Text>
                </View>
              </View>
              <Text style={styles.rowNo} numberOfLines={1} ellipsizeMode="clip">
                {item.spk_nomor || '-'}
              </Text>
              <Text style={styles.rowCompany} numberOfLines={2}>
                {item.spk_nama || '-'}
              </Text>
            </View>
          </View>
          <View style={styles.rowRight}>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.rowLabel}>Detail</Text>
              <Text style={styles.rowActionSub}>
                {isOpened ? 'Tap untuk tutup' : 'Tap untuk buka'}
              </Text>
            </View>
          </View>
          <View style={styles.chevronWrap}>
            <Text style={styles.chevron}>{isOpened ? '▲' : '▼'}</Text>
          </View>
        </View>

        <View style={styles.rowMetaRow}>
          <Text style={styles.rowActionHint}>
            <Text style={{ color: THEME.muted }}>Tanggal SPK: </Text>
            {formatDate(item.spk_tanggal)}
          </Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            Order: {item.spk_jumlah ?? '-'}
          </Text>
        </View>

        {isOpened && (
          <View style={styles.dropdownBody}>
            <View style={styles.mapItemCard}>
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.notesTitle}>Estimasi (Jadwal Kirim)</Text>
                {item.estimasi_list?.length > 0 ? (
                  item.estimasi_list.map((est, idx) => (
                    <View key={idx} style={styles.detailRow}>
                      <Text style={styles.dropdownText}>
                        • {formatDate(est.tanggal)}
                      </Text>
                      <Text style={styles.dropdownTextBold}>{est.jumlah}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.dropdownText}>-</Text>
                )}
                {item.estimasi_list?.length > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total Estimasi:</Text>
                    <Text style={styles.totalValue}>{item.estimasi_total}</Text>
                  </View>
                )}
              </View>
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.notesTitle}>Komitmen (PPIC)</Text>
                {item.komitmen_list?.length > 0 ? (
                  item.komitmen_list.map((kom, idx) => (
                    <View key={idx} style={styles.detailRow}>
                      <Text style={styles.dropdownText}>
                        • {formatDate(kom.tanggal)}
                      </Text>
                      <Text style={styles.dropdownTextBold}>{kom.jumlah}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.dropdownText}>-</Text>
                )}
                {item.komitmen_list?.length > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total Komitmen:</Text>
                    <Text style={styles.totalValue}>{item.komitmen_total}</Text>
                  </View>
                )}
              </View>
              <View>
                <Text style={styles.notesTitle}>Realisasi (Surat Jalan)</Text>
                {item.realisasi_list?.length > 0 ? (
                  item.realisasi_list.map((real, idx) => (
                    <View key={idx} style={styles.detailRow}>
                      <Text style={styles.dropdownText}>
                        • {formatDate(real.tanggal)}
                      </Text>
                      <Text style={styles.dropdownTextBold}>{real.jumlah}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.dropdownText}>-</Text>
                )}
                {item.realisasi_list?.length > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total Realisasi:</Text>
                    <Text style={styles.totalValue}>
                      {item.realisasi_total}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  },
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 44 : 14,
  },
  headerWrap: { marginBottom: 10 },
  title: {
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '900',
    color: THEME.ink,
    letterSpacing: 0.2,
    marginBottom: 10,
  },
  filterCard: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.line,
    padding: 12,
    ...PENAWARAN_SHADOW.card,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateSeparator: {
    color: THEME.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  dateChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: THEME.soft,
  },
  dateChipLabel: {
    color: THEME.muted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  dateChipValue: {
    color: THEME.ink,
    marginTop: 1,
    fontSize: 12,
    fontWeight: '800',
  },
  searchRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 12,
    backgroundColor: THEME.soft,
    height: 40,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
    color: THEME.ink,
    fontSize: 13,
    fontWeight: '700',
    padding: 0,
  },
  clearSearchButton: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(100,116,139,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  clearSearchButtonText: {
    color: THEME.ink,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  searchButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  searchButtonGradient: {
    height: 40,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  chipRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  chipItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.line,
    backgroundColor: THEME.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipItemActive: {
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    borderColor: THEME.primary,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.muted,
  },
  chipLabelActive: {
    color: THEME.primary,
    fontWeight: '800',
  },
  countBadge: {
    color: THEME.ink,
    fontSize: 13,
    fontWeight: '900',
    backgroundColor: THEME.soft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
    textAlign: 'center',
    minWidth: 36,
  },
  inlineLoadingWrap: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  inlineLoadingText: {
    color: THEME.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  rowCard: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: THEME.line,
    marginBottom: 10,
    ...PENAWARAN_SHADOW.softCard,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowLeft: {
    flex: 1,
    minWidth: 0,
  },
  rowNo: {
    color: THEME.ink,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 20,
  },
  rowCompany: {
    marginTop: 2,
    color: THEME.ink,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  rowLabel: {
    color: THEME.muted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  rowSub: {
    color: THEME.muted,
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'right',
  },
  rowRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 100,
  },
  rowMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  rowActionSub: {
    marginTop: 3,
    color: THEME.muted,
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 140,
  },
  rowActionHint: {
    marginTop: 3,
    color: THEME.primary,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'left',
  },
  rowActionDateLabel: {
    marginTop: 4,
    color: THEME.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  chevronWrap: {
    marginTop: 15,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.line,
    backgroundColor: THEME.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  chevron: {
    color: THEME.primary,
    fontWeight: '900',
    fontSize: 11,
    lineHeight: 12,
  },
  dropdownBody: {
    borderTopWidth: 1,
    borderTopColor: THEME.line,
    paddingTop: 10,
    marginTop: 2,
  },
  mapItemCard: {
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: THEME.soft,
    marginBottom: 2,
  },
  notesTitle: {
    color: THEME.ink,
    fontWeight: '900',
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  dropdownText: {
    color: THEME.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  dropdownTextBold: {
    color: THEME.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: THEME.line,
    gap: 8,
  },
  totalLabel: {
    color: THEME.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  totalValue: {
    color: THEME.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  loadingWrap: {
    padding: 20,
    alignItems: 'center',
  },
  loadingSubText: {
    marginTop: 10,
    color: THEME.muted,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 20,
  },
  skeletonWrap: { width: '100%' },
  errorWrap: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.danger,
    marginTop: 10,
  },
  errorSubtitle: {
    fontSize: 14,
    color: THEME.muted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: THEME.danger,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
  },
  emptyWrap: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: THEME.ink,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 6,
    color: THEME.muted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
});
