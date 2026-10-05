import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  Modal,
  Platform,
  FlatList,
  RefreshControl,
  ScrollView,
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
import DateRangePickerModal from '../../components/DateRangePickerModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/authContext';
import { ListSkeleton } from '../../components/loadingSkeleton';
import {
  getMasterSales,
  getPenawaranList,
  PenawaranListItem,
  PenawaranMasterOption,
} from '../../services/penawaranApi';
import { PENAWARAN_SHADOW, PENAWARAN_THEME } from './penawaranTheme';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

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
  const { user, token } = useAuth();
  const isManager = useMemo(
    () =>
      String(user?.jabatan || '')
        .trim()
        .toUpperCase()
        .split(/[\s/_-]+/)
        .includes('MANAGER'),
    [user?.jabatan],
  );

  const initialRange = useMemo(() => getCurrentMonth(), []);
  const [items, setItems] = useState<PenawaranListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [status] = useState<FilterStatus>('ALL');
  const [approvalFilter, setApprovalFilter] = useState<
    'ALL' | 'APPROVED' | 'UNAPPROVED'
  >('ALL');
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [showSearchFab, setShowSearchFab] = useState(false);
  const [openSearchMini, setOpenSearchMini] = useState(false);

  const approvalCounts = useMemo(() => {
    let approved = 0;
    let unapproved = 0;
    items.forEach(item => {
      const isApp =
        String(item.digital_sign || '')
          .trim()
          .toUpperCase() === 'Y' || Boolean(item.is_approved);
      if (isApp) approved++;
      else unapproved++;
    });
    return {
      all: items.length,
      approved,
      unapproved,
    };
  }, [items]);

  const displayedItems = useMemo(() => {
    if (approvalFilter === 'ALL') return items;
    return items.filter(item => {
      const isApp =
        String(item.digital_sign || '')
          .trim()
          .toUpperCase() === 'Y' || Boolean(item.is_approved);
      if (approvalFilter === 'APPROVED') return isApp;
      if (approvalFilter === 'UNAPPROVED') return !isApp;
      return true;
    });
  }, [items, approvalFilter]);

  const [selectedSalesKode, setSelectedSalesKode] = useState<string>('');
  const [selectedSalesName, setSelectedSalesName] =
    useState<string>('Semua Sales');
  const [salesList, setSalesList] = useState<PenawaranMasterOption[]>([]);
  const [salesPickerVisible, setSalesPickerVisible] = useState(false);
  const [salesPickerSearch, setSalesPickerSearch] = useState('');

  const loadSalesList = useCallback(async () => {
    if (!isManager) return;
    try {
      const rows = await getMasterSales();
      setSalesList(rows);
    } catch (err) {
      console.error('[PenawaranList] getMasterSales error:', err);
    }
  }, [isManager]);

  useEffect(() => {
    if (isManager) {
      loadSalesList();
    }
  }, [isManager, loadSalesList]);

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
        if (!token) {
          setItems([]);
          return;
        }

        console.log('[PenawaranList] loadData request', {
          hasToken: Boolean(token),
          startDate,
          endDate,
          status,
          hasSearch: Boolean(search.trim()),
        });

        const data = await getPenawaranList(
          {
            startDate,
            endDate,
            status,
            search: search.trim() || undefined,
            sales_kode:
              isManager && selectedSalesKode ? selectedSalesKode : undefined,
          },
          token,
        );
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
    [endDate, isManager, search, selectedSalesKode, startDate, status, token],
  );

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  useFocusEffect(
    useCallback(() => {
      const goHome = () => {
        navigation.navigate('Home');
        return true;
      };

      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        goHome,
      );

      const unsubscribeBeforeRemove = navigation.addListener(
        'beforeRemove',
        (e: any) => {
          if (e?.data?.action?.type === 'NAVIGATE') {
            return;
          }
          e.preventDefault();
          navigation.navigate('Home');
        },
      );

      return () => {
        backHandler.remove();
        unsubscribeBeforeRemove();
      };
    }, [navigation]),
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 350);
    return () => clearTimeout(timer);
  }, [search, status, startDate, endDate, selectedSalesKode, loadData]);

  const onPressItem = (item: PenawaranListItem) => {
    navigation.navigate('PenawaranDetail', { nomor: item.nomor });
  };

  const onScroll = useCallback((e: any) => {
    const y = e?.nativeEvent?.contentOffset?.y || 0;
    setShowSearchFab(y > 180);
  }, []);

  const renderItem = ({ item }: { item: PenawaranListItem }) => {
    const isApproved =
      String(item.digital_sign || '')
        .trim()
        .toUpperCase() === 'Y' || Boolean(item.is_approved);

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.card}
        onPress={() => onPressItem(item)}
      >
        <View style={styles.cardTopRow}>
          <Text style={styles.nomor}>{item.nomor}</Text>
          <View style={styles.topBadgesRow}>
            <View
              style={[
                styles.approvalBadge,
                isApproved
                  ? styles.approvalBadgeApproved
                  : styles.approvalBadgeUnapproved,
              ]}
            >
              <MaterialIcons
                name={isApproved ? 'verified' : 'schedule'}
                size={12}
                color={isApproved ? '#059669' : '#D97706'}
              />
              <Text
                style={[
                  styles.approvalBadgeText,
                  isApproved
                    ? styles.approvalBadgeTextApproved
                    : styles.approvalBadgeTextUnapproved,
                ]}
              >
                {isApproved ? 'Sudah Diapprove' : 'Belum Diapprove'}
              </Text>
            </View>
            <Text style={styles.detailCount}>{item.detail_count} item</Text>
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
        </View>
        <Text style={styles.detail}>Tap untuk lihat detail</Text>
      </TouchableOpacity>
    );
  };

  const ListHeader = (
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
            <Text style={styles.title}>Penawaran</Text>
            <Text style={styles.subtitle}>
              Periode {startDateLabel} - {endDateLabel}
            </Text>
          </View>
          <View style={styles.headerRightSpacer} />
        </View>
      </View>

      <View style={styles.headerCard}>
        <View style={styles.searchRow}>
          <View
            style={[styles.searchBox, isManager && styles.searchBoxWithFilter]}
          >
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={'Cari...'}
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
            ) : (
              <TouchableOpacity
                style={styles.clearSearchButton}
                onPress={() => setSearch('')}
                activeOpacity={0.8}
              >
                <MaterialIcons name="search" size={18} color={THEME.muted} />
              </TouchableOpacity>
            )}
          </View>

          {isManager && (
            <TouchableOpacity
              style={[
                styles.salesFilterBtn,
                Boolean(selectedSalesKode) && styles.salesFilterBtnActive,
              ]}
              onPress={() => {
                setSalesPickerSearch('');
                setSalesPickerVisible(true);
              }}
              activeOpacity={0.85}
            >
              <MaterialIcons
                name="person-outline"
                size={16}
                color={selectedSalesKode ? THEME.primary : THEME.muted}
              />
              <Text
                style={[
                  styles.salesFilterBtnText,
                  Boolean(selectedSalesKode) && styles.salesFilterBtnTextActive,
                ]}
                numberOfLines={1}
              >
                {selectedSalesName}
              </Text>
              <MaterialIcons
                name="arrow-drop-down"
                size={18}
                color={selectedSalesKode ? THEME.primary : THEME.muted}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Date Range Setting Field */}
        <View style={styles.datePickerWrap}>
          <Text style={styles.label}>Rentang Tanggal</Text>
          <TouchableOpacity
            style={styles.datePickerCard}
            onPress={() => setShowRangePicker(true)}
            activeOpacity={0.8}
          >
            <View style={styles.datePickerCol}>
              <Text style={styles.datePickerDateText} numberOfLines={1}>
                {startDateLabel}
              </Text>
            </View>
            <View style={styles.datePickerArrowWrap}>
              <MaterialIcons
                name="arrow-forward"
                size={14}
                color={THEME.muted}
              />
            </View>
            <View style={styles.datePickerCol}>
              <Text style={styles.datePickerDateText} numberOfLines={1}>
                {endDateLabel}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* FILTER STATUS APPROVAL (DI BAWAH FORM SEARCH) */}
        <View style={styles.chipRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipScroll}
          >
            {(
              [
                {
                  key: 'ALL' as const,
                  label: `Semua (${approvalCounts.all})`,
                  dotColor: undefined,
                },
                {
                  key: 'APPROVED' as const,
                  label: `Sudah Diapprove (${approvalCounts.approved})`,
                  dotColor: '#10B981',
                },
                {
                  key: 'UNAPPROVED' as const,
                  label: `Belum Diapprove (${approvalCounts.unapproved})`,
                  dotColor: '#F59E0B',
                },
              ] as const
            ).map(tab => {
              const active = approvalFilter === tab.key;
              return (
                <TouchableOpacity
                  key={`approval-${tab.key}`}
                  style={[styles.chipItem, active && styles.chipItemActive]}
                  activeOpacity={0.8}
                  onPress={() => setApprovalFilter(tab.key)}
                >
                  <View style={styles.chipContent}>
                    {tab.key === 'ALL' ? (
                      <MaterialIcons
                        name="format-list-bulleted"
                        size={14}
                        color={active ? THEME.primary : THEME.muted}
                      />
                    ) : (
                      <View
                        style={[
                          styles.chipDot,
                          { backgroundColor: tab.dotColor },
                        ]}
                      />
                    )}
                    <Text
                      style={[
                        styles.chipLabel,
                        active && styles.chipLabelActive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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
      <Text style={styles.tampil}>
        Menampilkan {displayedItems.length} data
      </Text>
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
        data={displayedItems}
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
              <Text style={styles.loadingText}>Memuat data penawaran...</Text>
              <View style={styles.skeletonWrap}>
                <ListSkeleton rows={4} />
              </View>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>Belum ada data</Text>
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

      {/* Modal Kalender Pemilihan Rentang Tanggal */}
      <DateRangePickerModal
        visible={showRangePicker}
        onClose={() => setShowRangePicker(false)}
        initialStartDate={startDate}
        initialEndDate={endDate}
        primaryColor={THEME.primary}
        rangeBgColor="rgba(79, 70, 229, 0.12)"
        onConfirm={(start, end) => {
          setStartDate(start);
          setEndDate(end);
        }}
      />

      {showSearchFab && (
        <TouchableOpacity
          style={[styles.fabSearch, { bottom: 82 + insets.bottom }]}
          onPress={() => setOpenSearchMini(true)}
          activeOpacity={0.9}
          accessibilityLabel="Cari Penawaran"
        >
          <View style={styles.fabSearchInner}>
            <MaterialIcons name="search" size={16} color={THEME.ink} />
            <Text style={styles.fabSearchText}>Cari</Text>
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

      {isManager && (
        <Modal
          visible={salesPickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setSalesPickerVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.salesPickerModalCard}>
              <View style={styles.salesPickerHeader}>
                <Text style={styles.salesPickerTitle}>
                  Filter Berdasarkan Sales
                </Text>
                <TouchableOpacity
                  onPress={() => setSalesPickerVisible(false)}
                  activeOpacity={0.8}
                  style={styles.salesPickerCloseBtn}
                >
                  <MaterialIcons name="close" size={20} color={THEME.ink} />
                </TouchableOpacity>
              </View>

              <View style={styles.salesSearchBox}>
                <MaterialIcons name="search" size={18} color={THEME.muted} />
                <TextInput
                  value={salesPickerSearch}
                  onChangeText={setSalesPickerSearch}
                  placeholder="Cari nama sales..."
                  placeholderTextColor={THEME.muted}
                  style={styles.salesSearchInput}
                />
                {salesPickerSearch.trim() ? (
                  <TouchableOpacity
                    onPress={() => setSalesPickerSearch('')}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="clear" size={16} color={THEME.muted} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <FlatList
                data={[
                  { kode: '', nama: 'Semua Sales' },
                  ...salesList.filter(
                    s =>
                      (s.nama || '')
                        .toLowerCase()
                        .includes(salesPickerSearch.trim().toLowerCase()) ||
                      (s.kode || '')
                        .toLowerCase()
                        .includes(salesPickerSearch.trim().toLowerCase()),
                  ),
                ]}
                keyExtractor={(item, index) => item.kode || `all-${index}`}
                renderItem={({ item }) => {
                  const isSelected = selectedSalesKode === item.kode;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.salesOptionItem,
                        isSelected && styles.salesOptionItemActive,
                      ]}
                      onPress={() => {
                        setSelectedSalesKode(item.kode);
                        setSelectedSalesName(item.nama);
                        setSalesPickerVisible(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.salesOptionTextWrap}>
                        <Text
                          style={[
                            styles.salesOptionText,
                            isSelected && styles.salesOptionTextActive,
                          ]}
                        >
                          {item.nama}
                        </Text>
                        {!!item.kode && (
                          <Text style={styles.salesOptionKode}>
                            Kode: {item.kode}
                          </Text>
                        )}
                      </View>
                      {isSelected && (
                        <MaterialIcons
                          name="check"
                          size={18}
                          color={THEME.primary}
                        />
                      )}
                    </TouchableOpacity>
                  );
                }}
                style={styles.salesFlatList}
                keyboardShouldPersistTaps="handled"
              />
            </View>
          </View>
        </Modal>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrap: {
    backgroundColor: THEME.bgBottom,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
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
    flex: 1,
    alignItems: 'center',
  },
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
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    color: THEME.muted,
    fontWeight: '700',
    textAlign: 'center',
  },
  label: {
    color: THEME.muted,
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 4,
    marginBottom: 4,
    marginTop: 6,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  datePickerWrap: {
    marginTop: 2,
  },
  // Date Range Card – Interactive Field
  datePickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.soft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 10,
    height: 44,
  },
  datePickerCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: THEME.muted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 2,
    textAlign: 'center',
  },
  datePickerDateText: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.ink,
    textAlign: 'center',
  },
  datePickerArrowWrap: {
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flex: 1,
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
  searchBoxWithFilter: {
    flex: 1.15,
  },
  salesFilterBtn: {
    flex: 0.95,
    height: 46,
    backgroundColor: THEME.soft,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  salesFilterBtnActive: {
    backgroundColor: 'rgba(79,70,229,0.08)',
    borderColor: 'rgba(79,70,229,0.35)',
  },
  salesFilterBtnText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.ink,
  },
  salesFilterBtnTextActive: {
    color: THEME.primary,
    fontWeight: '800',
  },
  searchInput: {
    flex: 1,
    color: THEME.ink,
    fontSize: 14,
    fontWeight: '700',
    padding: 0,
    textAlignVertical: 'center',
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
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    ...PENAWARAN_SHADOW.softCard,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nomor: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.ink,
  },
  topBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  approvalBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  approvalBadgeApproved: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  approvalBadgeUnapproved: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  approvalBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  approvalBadgeTextApproved: {
    color: '#059669',
  },
  approvalBadgeTextUnapproved: {
    color: '#C2410C',
  },
  chipRow: {
    marginTop: 10,
    marginBottom: 2,
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
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    paddingVertical: 12,
  },
  loadingText: {
    color: THEME.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  skeletonWrap: { marginTop: 10 },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 42,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
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
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
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
  fabSearchText: {
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
  salesPickerModalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.line,
    padding: 16,
    width: '90%',
    maxHeight: '75%',
    ...PENAWARAN_SHADOW.card,
  },
  salesPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
  },
  salesPickerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: THEME.ink,
  },
  salesPickerCloseBtn: {
    padding: 4,
  },
  salesSearchBox: {
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: THEME.soft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 10,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  salesSearchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.ink,
    padding: 0,
  },
  salesFlatList: {
    marginTop: 4,
    maxHeight: 320,
  },
  salesOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  salesOptionItemActive: {
    backgroundColor: 'rgba(79,70,229,0.08)',
  },
  salesOptionTextWrap: {
    flex: 1,
  },
  salesOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.ink,
  },
  salesOptionTextActive: {
    color: THEME.primary,
    fontWeight: '800',
  },
  salesOptionKode: {
    fontSize: 11,
    color: THEME.muted,
    fontWeight: '500',
    marginTop: 2,
  },
});
