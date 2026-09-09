/* eslint-disable react-native/no-inline-styles */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
import { useAuth } from '../../context/authContext';
import { ListSkeleton } from '../../components/loadingSkeleton';
import {
  getPotensiList,
  batalPotensi,
  PotensiListItem,
} from '../../services/potensiApi';
import { THEME, SHADOWS } from '../theme';
import ModalBatalPotensi from './modalBatalPotensi';

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

const formatDate = (ymd?: string | null) => {
  if (!ymd) return '-';
  const clean = String(ymd).split('T')[0].split(' ')[0];
  const [y, m, d] = clean.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatRupiah = (val: number | string) => {
  const num = Number(val) || 0;
  return `Rp ${new Intl.NumberFormat('id-ID').format(num)}`;
};

export default function LaporanPotensiScreen({ navigation, route }: any) {
  const { token, user } = useAuth();
  const isManager = String(user?.jabatan || '').toUpperCase() === 'MANAGER';
  const insets = useSafeAreaInsets();

  const initialRange = useMemo(() => {
    const pMonth = route?.params?.month;
    const pYear = route?.params?.year;
    if (pMonth && pYear) {
      const start = new Date(pYear, pMonth - 1, 1);
      const end = new Date(pYear, pMonth, 0);
      return { startDate: toYmd(start), endDate: toYmd(end) };
    }
    return getCurrentMonth();
  }, [route?.params?.month, route?.params?.year]);

  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [search, setSearch] = useState('');
  const [selectedSales, setSelectedSales] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rawItems, setRawItems] = useState<PotensiListItem[]>([]);
  const [availableSales, setAvailableSales] = useState<string[]>([]);

  // Hanya item berstatus POTENSI (atau null/kosong) yang dihitung ke total potensi
  const openItems = useMemo(() => {
    return rawItems.filter(it => {
      const s = String(it.pot_status || it.status || 'POTENSI')
        .trim()
        .toUpperCase();
      return s === 'POTENSI' || !s;
    });
  }, [rawItems]);

  const totalNominalOpen = useMemo(() => {
    return openItems.reduce((acc, it) => {
      const h = Number(
        it.pot_harga !== undefined ? it.pot_harga : it.harga || 0,
      );
      return acc + (Number.isFinite(h) ? h : 0);
    }, 0);
  }, [openItems]);

  // Modal Batal
  const [batalTargetItem, setBatalTargetItem] =
    useState<PotensiListItem | null>(null);
  const [isBatalSubmitting, setIsBatalSubmitting] = useState(false);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!token) return;
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const res = await getPotensiList(
          {
            startDate,
            endDate,
            search: search.trim() || undefined,
            sales: selectedSales || undefined,
          },
          token,
        );

        const items = res.data || [];
        setRawItems(items);

        if (res.meta?.filter_options?.sales) {
          setAvailableSales(res.meta.filter_options.sales);
        }
        setHasLoadedOnce(true);
      } catch (err: any) {
        console.error('[LaporanPotensiScreen][loadData] Error:', err);
        setHasLoadedOnce(true);
        Toast.show({
          type: 'glassError',
          text1: 'Error',
          text2: err?.response?.data?.message || 'Gagal memuat laporan potensi',
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, startDate, endDate, search, selectedSales],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadData]);

  const handleBatalSubmit = async (alasan: string) => {
    if (!batalTargetItem || !token) return;
    setIsBatalSubmitting(true);
    try {
      await batalPotensi(batalTargetItem.pot_nomor, alasan, token);
      Toast.show({
        type: 'glassSuccess',
        text1: 'Berhasil Dibatalkan',
        text2: `Potensi ${batalTargetItem.pot_nomor} telah dibatalkan`,
      });
      setBatalTargetItem(null);
      loadData(true);
    } catch (err: any) {
      Toast.show({
        type: 'glassError',
        text1: 'Gagal Membatalkan',
        text2:
          err?.response?.data?.message ||
          'Terjadi kesalahan saat membatalkan potensi',
      });
    } finally {
      setIsBatalSubmitting(false);
    }
  };

  const getStatusBadgeConfig = (status: string) => {
    const s = String(status || '').toUpperCase();
    if (s === 'CLOSE') {
      return {
        bg: '#DCFCE7',
        border: '#86EFAC',
        text: '#15803D',
        label: 'CLOSE (DEAL)',
      };
    }
    if (s === 'BATAL') {
      return {
        bg: '#FEE2E2',
        border: '#FCA5A5',
        text: '#B91C1C',
        label: 'BATAL',
      };
    }
    return {
      bg: '#FEF3C7',
      border: '#FCD34D',
      text: '#B45309',
      label: 'POTENSI',
    };
  };

  const renderPotensiCard = ({ item }: { item: PotensiListItem }) => {
    const status = item.pot_status || item.status || 'POTENSI';
    const badge = getStatusBadgeConfig(status);
    const isOpen = status === 'POTENSI';
    const isBatal = status === 'BATAL';
    const namaItem = item.pot_nama_item || item.nama_item || '-';
    const penNomor = item.pot_pen_nomor || item.pen_nomor;
    const mspkNomor = item.pot_mspk_nomor || item.mspk_nomor;
    const cusNama =
      item.cus_nama ||
      item.customer_nama ||
      item.pot_cus_kode ||
      item.customer_kode ||
      '-';
    const salNama =
      item.sal_nama ||
      item.sales_nama ||
      item.pot_sal_kode ||
      item.sales_kode ||
      '-';
    const harga =
      item.pot_harga !== undefined ? item.pot_harga : item.harga || 0;
    const tgl = item.pot_tanggal || item.date_create;
    const alasanBatal = item.pot_alasan_batal || item.alasan_batal;

    return (
      <View style={styles.card}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.docRow}>
              <MaterialIcons
                name="trending-up"
                size={16}
                color={THEME.primary}
              />
              <Text style={styles.docNumber}>{item.pot_nomor}</Text>
            </View>
            <View style={styles.dateRowItem}>
              <MaterialIcons name="event" size={12} color={THEME.muted} />
              <Text style={styles.dateText}>{formatDate(tgl)}</Text>
            </View>
          </View>

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: badge.bg, borderColor: badge.border },
            ]}
          >
            <Text style={[styles.statusBadgeText, { color: badge.text }]}>
              {badge.label}
            </Text>
          </View>
        </View>

        {/* Card Body - Item Name */}
        <View style={styles.cardBody}>
          <Text style={styles.itemTitle}>{namaItem}</Text>

          {/* Reference Info */}
          {(Boolean(penNomor) || Boolean(mspkNomor)) && (
            <View style={styles.refContainer}>
              {Boolean(penNomor) && (
                <View style={styles.refTag}>
                  <Text style={styles.refTagLabel}>Penawaran:</Text>
                  <Text style={styles.refTagValue}>{penNomor}</Text>
                </View>
              )}
              {Boolean(mspkNomor) && (
                <View style={styles.refTag}>
                  <Text style={styles.refTagLabel}>MAP:</Text>
                  <Text style={styles.refTagValue}>{mspkNomor}</Text>
                </View>
              )}
            </View>
          )}

          {/* Customer & Sales Metadata */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaText} numberOfLines={1}>
                {cusNama}
              </Text>
            </View>
            <View style={[styles.metaItem, { marginLeft: 12 }]}>
              <Text style={styles.metaText} numberOfLines={1}>
                {salNama}
              </Text>
            </View>
          </View>

          {/* Alasan Batal */}
          {isBatal && Boolean(alasanBatal) && (
            <View style={styles.alasanBatalBox}>
              <View style={styles.alasanBatalHeader}>
                <MaterialIcons name="info-outline" size={14} color="#DC2626" />
                <Text style={styles.alasanBatalTitle}>Alasan Pembatalan:</Text>
              </View>
              <Text style={styles.alasanBatalText}>{alasanBatal}</Text>
            </View>
          )}
        </View>

        {/* Card Footer */}
        <View style={styles.cardFooter}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nominalLabel}>Nilai Potensi</Text>
            <Text style={styles.nominalValue}>{formatRupiah(harga)}</Text>
          </View>

          {isOpen && (
            <TouchableOpacity
              style={styles.btnBatal}
              onPress={() => setBatalTargetItem(item)}
              activeOpacity={0.8}
            >
              <Text style={styles.btnBatalText}>Batalkan</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const ListHeader = (
    <View style={styles.headerWrap}>
      {/* Top Title & Navigation */}
      <View style={styles.headerTop}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.navigate('Potensi')}
            activeOpacity={0.8}
          >
            <Text style={styles.backBtnText}>Kembali</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.title}>Laporan Potensi</Text>
            <Text style={styles.subtitle}>
              {formatDate(startDate)} - {formatDate(endDate)}
            </Text>
          </View>
          <View style={styles.headerRightSpacer} />
        </View>
      </View>

      {/* Filter Card */}
      <View style={styles.headerCard}>
        {/* Date Row */}
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={styles.dateChip}
            onPress={() => setShowStartPicker(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.dateChipLabel}>Mulai</Text>
            <Text style={styles.dateChipValue}>{formatDate(startDate)}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dateChip}
            onPress={() => setShowEndPicker(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.dateChipLabel}>Sampai</Text>
            <Text style={styles.dateChipValue}>{formatDate(endDate)}</Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={styles.searchBox}>
          <MaterialIcons
            name="search"
            size={20}
            color={THEME.muted}
            style={{ marginRight: 8 }}
          />
          <TextInput
            placeholder="Cari..."
            placeholderTextColor={THEME.muted}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
          {search.trim() ? (
            <TouchableOpacity
              style={styles.clearSearchButton}
              onPress={() => setSearch('')}
              activeOpacity={0.8}
            >
              <MaterialIcons name="close" size={16} color={THEME.muted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Manager Sales Selector */}
        {isManager && availableSales.length > 0 && (
          <View style={styles.salesFilterWrap}>
            <Text style={styles.salesFilterLabel}>Filter Sales:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.salesScroll}
            >
              <TouchableOpacity
                style={[
                  styles.salesChip,
                  !selectedSales && styles.salesChipActive,
                ]}
                onPress={() => setSelectedSales('')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.salesChipText,
                    !selectedSales && styles.salesChipTextActive,
                  ]}
                >
                  Semua Sales
                </Text>
              </TouchableOpacity>
              {availableSales.map(sal => {
                const active = selectedSales === sal;
                return (
                  <TouchableOpacity
                    key={sal}
                    style={[styles.salesChip, active && styles.salesChipActive]}
                    onPress={() => setSelectedSales(active ? '' : sal)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.salesChipText,
                        active && styles.salesChipTextActive,
                      ]}
                    >
                      {sal}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );

  const renderEmptyState = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconWrap}>
          <MaterialIcons name="trending-up" size={48} color={THEME.muted} />
        </View>
        <Text style={styles.emptyTitle}>Belum Ada Data Potensi</Text>
        <Text style={styles.emptySubtitle}>
          {search.trim()
            ? 'Tidak ada data potensi yang sesuai dengan filter pencarian.'
            : 'Belum ada potensi yang tersimpan pada rentang tanggal ini.'}
        </Text>
      </View>
    ),
    [search],
  );

  return (
    <LinearGradient
      colors={[THEME.bgTop, THEME.bgBottom]}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      {loading && !hasLoadedOnce ? (
        <View style={{ flex: 1, padding: 16 }}>
          {ListHeader}
          <ListSkeleton />
        </View>
      ) : (
        <FlatList
          data={rawItems}
          keyExtractor={item => item.pot_nomor}
          renderItem={renderPotensiCard}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 90 + insets.bottom },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              tintColor={THEME.primary}
              colors={[THEME.primary]}
            />
          }
        />
      )}

      {/* Bottom Sticky Total Bar */}
      <View
        style={[
          styles.bottomTotalBar,
          { paddingBottom: Math.max(insets.bottom, 14) },
        ]}
      >
        <View style={styles.bottomTotalLeft}>
          <Text style={styles.bottomTotalLabel}>Total Nominal Potensi</Text>
          <Text style={styles.bottomTotalCount}>
            {openItems.length} Item Potensi ({formatDate(startDate)} -{' '}
            {formatDate(endDate)})
          </Text>
        </View>
        <View style={styles.bottomTotalRight}>
          <Text style={styles.bottomTotalValue}>
            {formatRupiah(totalNominalOpen)}
          </Text>
        </View>
      </View>

      {/* Date Pickers */}
      {showStartPicker && (
        <DateTimePicker
          value={new Date(startDate)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selected) => {
            setShowStartPicker(false);
            if (selected) setStartDate(toYmd(selected));
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={new Date(endDate)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selected) => {
            setShowEndPicker(false);
            if (selected) setEndDate(toYmd(selected));
          }}
        />
      )}

      {/* Modal Batal Potensi */}
      <ModalBatalPotensi
        visible={Boolean(batalTargetItem)}
        item={batalTargetItem}
        onClose={() => setBatalTargetItem(null)}
        onSubmit={handleBatalSubmit}
        isSubmitting={isBatalSubmitting}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  headerWrap: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTop: {
    marginBottom: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    backgroundColor: THEME.soft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  headerRightSpacer: {
    minWidth: 74,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.ink,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    color: THEME.muted,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.line,
    ...SHADOWS.card,
    marginBottom: 14,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  dateChip: {
    flex: 1,
    backgroundColor: THEME.soft,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  dateChipLabel: {
    fontSize: 11,
    color: THEME.muted,
    fontWeight: '500',
  },
  dateChipValue: {
    fontSize: 13,
    color: THEME.ink,
    fontWeight: '600',
    marginTop: 2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.soft,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: THEME.ink,
    paddingVertical: 0,
  },
  clearSearchButton: {
    padding: 4,
  },
  salesFilterWrap: {
    marginTop: 12,
  },
  salesFilterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.ink,
    marginBottom: 6,
  },
  salesScroll: {
    gap: 6,
  },
  salesChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: THEME.soft,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  salesChipActive: {
    backgroundColor: `${THEME.primary}15`,
    borderColor: THEME.primary,
  },
  salesChipText: {
    fontSize: 12,
    color: THEME.muted,
    fontWeight: '500',
  },
  salesChipTextActive: {
    color: THEME.primary,
    fontWeight: '700',
  },

  // Bottom Sticky Total Bar Styles
  bottomTotalBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: THEME.line,
    paddingTop: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOWS.card,
  },
  bottomTotalLeft: {
    flex: 1,
  },
  bottomTotalLabel: {
    fontSize: 11,
    color: THEME.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bottomTotalCount: {
    fontSize: 12,
    color: THEME.ink,
    fontWeight: '700',
    marginTop: 2,
  },
  bottomTotalRight: {
    alignItems: 'flex-end',
  },
  bottomTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.primary,
    letterSpacing: -0.3,
  },

  // Card List Styles
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    ...SHADOWS.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  docNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.ink,
  },
  dateRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  dateText: {
    fontSize: 12,
    color: THEME.muted,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardBody: {
    marginBottom: 10,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.ink,
    lineHeight: 20,
    marginBottom: 6,
  },
  refContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  refTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.soft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  refTagLabel: {
    fontSize: 11,
    color: THEME.muted,
    fontWeight: '500',
  },
  refTagValue: {
    fontSize: 11,
    color: THEME.ink,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: THEME.muted,
    fontWeight: '500',
  },
  alasanBatalBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  alasanBatalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  alasanBatalTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  alasanBatalText: {
    fontSize: 12,
    color: '#7F1D1D',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.line,
  },
  nominalLabel: {
    fontSize: 11,
    color: THEME.muted,
    fontWeight: '500',
  },
  nominalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.primary,
  },
  btnBatal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  btnBatalText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.ink,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: THEME.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  backBtnText: {
    color: THEME.primary,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.2,
  },
});
