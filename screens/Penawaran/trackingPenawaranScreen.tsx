/* eslint-disable react-native/no-inline-styles */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import LinearGradient from 'react-native-linear-gradient';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/authContext';
import { ListSkeleton } from '../../components/loadingSkeleton';
import {
  getTrackingPenawaranDetail,
  TrackingMapDetailItem,
  getTrackingPenawaranList,
  TrackingPenawaranListItem,
} from '../../services/trackingPenawaranApi';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { PENAWARAN_SHADOW, PENAWARAN_THEME } from './penawaranTheme';
import { RootStackParamList } from '../../navigation/appNavigator';

const THEME = PENAWARAN_THEME;

const DIVISI_OPTIONS = [
  { kode: '1', label: '1 - SPANDUK' },
  { kode: '4', label: '4 - GARMEN' },
  { kode: '5', label: '5 - MMT' },
];

type Props = NativeStackScreenProps<RootStackParamList, 'TrackingPenawaran'>;

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

const parseYmd = (ymd: string) => {
  const [y, m, d] = String(ymd || '')
    .split('-')
    .map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const toReadableCloseStatus = (value?: string) => {
  const v = String(value || '')
    .trim()
    .toUpperCase();
  if (v === 'Y') return 'Sudah';
  if (v === 'N') return 'Belum';
  return '-';
};

const getDocTypeLabel = (docNo?: string) => {
  const cleanList = String(docNo || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);

  if (cleanList.length === 0) return 'No. MAP';

  const first = cleanList[0].toUpperCase();
  if (first.startsWith('MAP')) {
    return 'No. MAP';
  }
  if (first.startsWith('SO')) {
    return 'No. SO';
  }
  return 'No. SPK';
};

const splitNotes = (value?: string) => {
  const raw = String(value || '').trim();
  if (!raw) return [] as string[];

  return raw
    .split(/\r?\n|\s*\|\s*|\s*;\s*|\s*•\s*/)
    .map(v => v.trim())
    .filter(Boolean);
};

const toReadableDivisi = (value?: number | string) => {
  const kode = String(value ?? '').trim();
  if (!kode) return '-';
  const found = DIVISI_OPTIONS.find(option => option.kode === kode);
  return found?.label || kode;
};

export default function TrackingPenawaranScreen({ route }: Props) {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const initialRange = useMemo(() => {
    const pMonth = route?.params?.month;
    const pYear = route?.params?.year;
    if (pMonth && pYear) {
      const start = new Date(pYear, pMonth - 1, 1);
      const end = new Date(pYear, pMonth, 0);
      const toYmdLocal = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          '0',
        )}-${String(d.getDate()).padStart(2, '0')}`;
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
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          '0',
        )}-${String(d.getDate()).padStart(2, '0')}`;
      setStartDate(toYmdLocal(start));
      setEndDate(toYmdLocal(end));
    }
  }, [route?.params?.month, route?.params?.year]);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [salesSearch, setSalesSearch] = useState('');
  const [appliedSalesSearch, setAppliedSalesSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [appliedCustomerSearch, setAppliedCustomerSearch] = useState('');
  // Status Filter & Legend States
  const [selectedStatus, setSelectedStatus] = useState<
    'all' | 'OPEN' | 'PARSIAL' | 'CLOSE'
  >('all');
  const [showTooltip, setShowTooltip] = useState(true);
  const [legendVisible, setLegendVisible] = useState(false);

  const [rawItems, setRawItems] = useState<TrackingPenawaranListItem[]>([]);

  const filteredItems = useMemo(() => {
    return rawItems.filter(item => {
      if (selectedStatus === 'all') return true;
      return item.status_tracking === selectedStatus;
    });
  }, [rawItems, selectedStatus]);

  const statusCounts = useMemo(() => {
    const counts = { OPEN: 0, PARSIAL: 0, CLOSE: 0 };
    rawItems.forEach(item => {
      const status = item.status_tracking || 'OPEN';
      if (status === 'OPEN' || status === 'PARSIAL' || status === 'CLOSE') {
        counts[status]++;
      }
    });
    return counts;
  }, [rawItems]);
  const [openedNoPenawaran, setOpenedNoPenawaran] = useState<string | null>(
    null,
  );
  const [detailMapByPenawaran, setDetailMapByPenawaran] = useState<
    Record<string, TrackingMapDetailItem[]>
  >({});
  const [loadingDetailByPenawaran, setLoadingDetailByPenawaran] = useState<
    Record<string, boolean>
  >({});
  const [loading, setLoading] = useState(false);
  const [isSearchSubmitting, setIsSearchSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Animated values for tooltip (selaras dengan referensi)
  const tooltipOpacity = useRef(new Animated.Value(0)).current;
  const tooltipScale = useRef(new Animated.Value(0.8)).current;
  const infoPulse = useRef(new Animated.Value(1)).current;

  // Tooltip entrance animation + auto-dismiss
  useEffect(() => {
    if (showTooltip) {
      Animated.parallel([
        Animated.timing(tooltipOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(tooltipScale, {
          toValue: 1,
          friction: 5,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();

      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(infoPulse, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(infoPulse, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();

      const timer = setTimeout(() => {
        dismissTooltip();
      }, 5000);

      return () => {
        pulse.stop();
        clearTimeout(timer);
      };
    } else {
      infoPulse.setValue(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTooltip]);

  const dismissTooltip = useCallback(() => {
    Animated.parallel([
      Animated.timing(tooltipOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(tooltipScale, {
        toValue: 0.8,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowTooltip(false);
    });
  }, [tooltipOpacity, tooltipScale]);

  // Picker States
  const [masterSales, setMasterSales] = useState<string[]>([]);
  const [masterCustomer, setMasterCustomer] = useState<string[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerType, setPickerType] = useState<'sales' | 'customer' | null>(
    null,
  );
  const [pickerSearch, setPickerSearch] = useState('');

  const openPicker = (type: 'sales' | 'customer') => {
    setPickerType(type);
    setPickerSearch('');
    setPickerVisible(true);
  };

  const loadList = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        if (!token) {
          setRawItems([]);
          return;
        }

        const { items: newItems, filter_options } =
          await getTrackingPenawaranList(
            {
              startDate,
              endDate,
              search: appliedSearch.trim() || undefined,
              sales: appliedSalesSearch.trim() || undefined,
              customer: appliedCustomerSearch.trim() || undefined,
              limit: 100,
            },
            token,
          );
        setRawItems(newItems);
        setMasterSales(filter_options.sales);
        setMasterCustomer(filter_options.customers);
      } catch (err: any) {
        setRawItems([]);
        Toast.show({
          type: 'glassError',
          text1: 'Error',
          text2:
            err?.response?.data?.message ||
            'Gagal mengambil data tracking penawaran',
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
        setIsSearchSubmitting(false);
      }
    },
    [
      appliedSearch,
      appliedSalesSearch,
      appliedCustomerSearch,
      endDate,
      startDate,
      token,
    ],
  );

  useEffect(() => {
    loadList();
  }, [loadList]);

  const applyFilter = useCallback(() => {
    if (loading || isSearchSubmitting) return;

    const nextSearch = search.trim();
    const currentAppliedSearch = appliedSearch.trim();
    const nextSales = salesSearch.trim();
    const currentAppliedSales = appliedSalesSearch.trim();
    const nextCustomer = customerSearch.trim();
    const currentAppliedCustomer = appliedCustomerSearch.trim();

    // Hindari loading menggantung jika tombol ditekan saat filter tidak berubah.
    if (
      nextSearch === currentAppliedSearch &&
      nextSales === currentAppliedSales &&
      nextCustomer === currentAppliedCustomer
    ) {
      setIsSearchSubmitting(false);
      return;
    }

    setIsSearchSubmitting(true);
    setAppliedSearch(nextSearch);
    setAppliedSalesSearch(nextSales);
    setAppliedCustomerSearch(nextCustomer);
  }, [
    appliedSearch,
    appliedSalesSearch,
    appliedCustomerSearch,
    isSearchSubmitting,
    loading,
    search,
    salesSearch,
    customerSearch,
  ]);

  const onChangeSearch = useCallback((value: string) => {
    setSearch(value);
  }, []);

  useEffect(() => {
    loadList();
  }, [
    appliedSearch,
    appliedSalesSearch,
    appliedCustomerSearch,
    startDate,
    endDate,
    selectedStatus,
    loadList,
  ]);

  const loadMapDetails = useCallback(
    async (noPenawaran: string) => {
      if (!noPenawaran) return;
      if (detailMapByPenawaran[noPenawaran]) return;

      setLoadingDetailByPenawaran(prev => ({ ...prev, [noPenawaran]: true }));
      try {
        const data = await getTrackingPenawaranDetail(noPenawaran, token);
        setDetailMapByPenawaran(prev => ({
          ...prev,
          [noPenawaran]: data?.map_details || [],
        }));
      } catch {
        setDetailMapByPenawaran(prev => ({
          ...prev,
          [noPenawaran]: [],
        }));
        Toast.show({
          type: 'glassError',
          text1: 'Error',
          text2: 'Gagal mengambil detail MAP',
        });
      } finally {
        setLoadingDetailByPenawaran(prev => ({
          ...prev,
          [noPenawaran]: false,
        }));
      }
    },
    [detailMapByPenawaran, token],
  );

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

  const getTrackingStatusStyle = (item: TrackingPenawaranListItem) => {
    const status = item.status_tracking || 'OPEN';
    if (status === 'CLOSE') {
      return {
        backgroundColor: '#10B9811A',
        borderColor: '#10B981',
        textColor: '#047857',
        label: 'CLOSE',
      };
    } else if (status === 'PARSIAL') {
      const percent =
        item.total_item > 0
          ? Math.round((item.total_item_map / item.total_item) * 100)
          : 0;
      return {
        backgroundColor: '#3B82F61A',
        borderColor: '#3B82F6',
        textColor: '#1D4ED8',
        label: `PARSIAL (${percent}%)`,
      };
    }
    return {
      backgroundColor: '#EF44441A',
      borderColor: '#EF4444',
      textColor: '#B91C1C',
      label: 'OPEN',
    };
  };

  const renderItem = ({ item }: { item: TrackingPenawaranListItem }) => {
    const isOpened = openedNoPenawaran === item.no_penawaran;
    const nomorPenawaran = String(item.no_penawaran || '-').trim() || '-';
    const customerName = String(item.customer || '').trim() || '-';
    const salesName = String(item.sales || '').trim() || '-';
    const noSpk = String(item.no_map || '')
      .split(',')
      .map(v => v.trim())
      .filter(Boolean)
      .join(', ');
    const statusStyle = getTrackingStatusStyle(item);

    const totalItem = item.total_item || 0;
    const totalItemMap = item.total_item_map || 0;
    const progressPercent = totalItem > 0 ? totalItemMap / totalItem : 0;

    let statusDescription = '';
    if (item.status_tracking === 'CLOSE') {
      statusDescription = `Seluruh item (${totalItemMap}/${totalItem}) sudah diproses menjadi MAP/SO/SPK`;
    } else if (item.status_tracking === 'PARSIAL') {
      statusDescription = `${totalItemMap} dari ${totalItem} item telah diproses menjadi MAP/SO/SPK`;
    } else {
      statusDescription = `Belum ada item (${totalItemMap}/${totalItem}) yang diproses menjadi MAP/SO/SPK`;
    }

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.rowCard}
        onPress={async () => {
          const nextOpened =
            openedNoPenawaran === item.no_penawaran ? null : item.no_penawaran;
          setOpenedNoPenawaran(nextOpened);
          if (nextOpened) {
            await loadMapDetails(nextOpened);
          }
        }}
      >
        {/* Header Card: No Penawaran & Status Badge */}
        <View style={styles.rowBetween}>
          <Text style={styles.rowNo} numberOfLines={1}>
            {nomorPenawaran}
          </Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: statusStyle.backgroundColor,
                borderColor: statusStyle.borderColor,
              },
            ]}
          >
            <Text
              style={[styles.statusBadgeText, { color: statusStyle.textColor }]}
            >
              {statusStyle.label}
            </Text>
          </View>
        </View>

        {/* Nama Perusahaan / Customer */}
        <Text style={styles.rowCompany} numberOfLines={1}>
          <MaterialIcons name="business" size={12} color={THEME.ink} />{' '}
          {customerName}
        </Text>

        {/* Meta Info: Sales & Tanggal */}
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Sales: {salesName}</Text>
          <Text style={styles.metaDivider}>•</Text>
          <Text style={styles.metaText}>
            {formatDate(item.tanggal_penawaran)}
          </Text>
        </View>

        {/* Progress Bar & Deskripsi Status Informatif */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${progressPercent * 100}%`,
                  backgroundColor: statusStyle.borderColor,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>{statusDescription}</Text>
        </View>

        {/* List No MAP (jika ada) */}
        {noSpk ? (
          <View style={styles.mapNoContainer}>
            <Text style={styles.mapNoLabel}>{getDocTypeLabel(noSpk)}:</Text>
            <Text style={styles.mapNoValue} numberOfLines={1}>
              {noSpk}
            </Text>
          </View>
        ) : null}

        {/* Footer Card: Indicator Buka/Tutup */}
        <View style={styles.cardFooter}>
          <Text style={styles.cardFooterText}>
            {isOpened
              ? `Tutup detail item ${getDocTypeLabel(noSpk).replace(
                  'No. ',
                  '',
                )}`
              : `Lihat detail item ${getDocTypeLabel(noSpk).replace(
                  'No. ',
                  '',
                )}`}
          </Text>
          <MaterialIcons
            name={isOpened ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
            size={18}
            color={THEME.primary}
          />
        </View>

        {/* Dropdown Detail MAP */}
        {isOpened && (
          <View style={styles.dropdownBody}>
            {loadingDetailByPenawaran[item.no_penawaran] ? (
              <View style={styles.dropdownLoadingWrap}>
                <ActivityIndicator size="small" color={THEME.primary} />
                <Text style={styles.dropdownTextHint}>
                  {`Memuat detail ${getDocTypeLabel(noSpk).replace(
                    'No. ',
                    '',
                  )}...`}
                </Text>
              </View>
            ) : (detailMapByPenawaran[item.no_penawaran] || []).length === 0 ? (
              <Text style={styles.dropdownTextHint}>
                {`Belum ada detail ${getDocTypeLabel(noSpk).replace(
                  'No. ',
                  '',
                )}`}
              </Text>
            ) : (
              (detailMapByPenawaran[item.no_penawaran] || []).map(
                (mapItem, mapIndex) => (
                  <View
                    style={styles.mapItemCard}
                    key={`${mapItem.pen_id}-${mapIndex}`}
                  >
                    <Text style={styles.mapItemTitle}>
                      {mapIndex + 1}.{' '}
                      {mapItem.no_map ||
                        `${getDocTypeLabel(noSpk).replace(
                          'No. ',
                          '',
                        )} belum tersedia`}
                    </Text>
                    <Text style={styles.dropdownText}>
                      Nama: {mapItem.map_nama || '-'}
                    </Text>
                    <Text style={styles.dropdownText}>
                      Tanggal{' '}
                      {getDocTypeLabel(mapItem.no_map || noSpk).replace(
                        'No. ',
                        '',
                      )}
                      : {formatDate(mapItem.tanggal_map)}
                    </Text>
                    <Text style={styles.dropdownText}>
                      Dateline: {formatDate(mapItem.map_deadline)}
                    </Text>
                    <Text style={styles.dropdownText}>
                      Divisi: {toReadableDivisi(mapItem.map_divisi)}
                    </Text>
                    <Text style={styles.dropdownText}>
                      Status Proses: {mapItem.map_status || '-'}
                    </Text>
                    <Text style={styles.dropdownText}>
                      Status Close: {toReadableCloseStatus(mapItem.map_close)}
                    </Text>
                    <View style={styles.notesWrap}>
                      <Text style={styles.notesTitle}>Catatan</Text>
                      {splitNotes(mapItem.map_keterangan).length > 0 ? (
                        splitNotes(mapItem.map_keterangan).map(
                          (note, noteIndex) => (
                            <View
                              style={styles.noteItem}
                              key={`${mapItem.pen_id}-${mapIndex}-note-${noteIndex}`}
                            >
                              <Text style={styles.noteBullet}>•</Text>
                              <Text style={styles.noteText}>{note}</Text>
                            </View>
                          ),
                        )
                      ) : (
                        <Text style={styles.dropdownTextHint}>-</Text>
                      )}
                    </View>
                  </View>
                ),
              )
            )}
          </View>
        )}
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

      <FlatList
        data={filteredItems}
        keyExtractor={item => item.no_penawaran}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContainer,
          { paddingBottom: 120 + insets.bottom },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadList(true)}
            tintColor={THEME.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <Text style={styles.title}>Tracking Penawaran</Text>

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

              {/* Search inline with Cari button */}
              <View style={styles.searchRow}>
                <View style={styles.searchBox}>
                  <TextInput
                    value={search}
                    onChangeText={onChangeSearch}
                    placeholder="Cari penawaran..."
                    placeholderTextColor={THEME.muted}
                    style={styles.searchInput}
                    returnKeyType="search"
                    onSubmitEditing={applyFilter}
                  />
                  {search.trim() ? (
                    <TouchableOpacity
                      style={styles.clearSearchButton}
                      onPress={() => setSearch('')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.clearSearchButtonText}>×</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={styles.searchButton}
                  activeOpacity={0.85}
                  onPress={applyFilter}
                  disabled={loading || isSearchSubmitting}
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

              {/* Sales + Customer picker row */}
              <View style={styles.searchRow}>
                <TouchableOpacity
                  style={[
                    styles.pickerChip,
                    salesSearch ? styles.pickerChipActive : null,
                  ]}
                  onPress={() => openPicker('sales')}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name="person"
                    size={14}
                    color={salesSearch ? THEME.primary : THEME.muted}
                  />
                  <Text
                    style={[
                      styles.pickerChipText,
                      salesSearch && styles.pickerChipTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {salesSearch || 'Sales'}
                  </Text>
                  {salesSearch.trim() ? (
                    <TouchableOpacity
                      style={styles.clearSearchButton}
                      onPress={() => {
                        setSalesSearch('');
                        setAppliedSalesSearch('');
                      }}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="close" size={12} color={THEME.ink} />
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.pickerChip,
                    customerSearch ? styles.pickerChipActive : null,
                  ]}
                  onPress={() => openPicker('customer')}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name="business"
                    size={14}
                    color={customerSearch ? THEME.primary : THEME.muted}
                  />
                  <Text
                    style={[
                      styles.pickerChipText,
                      customerSearch && styles.pickerChipTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {customerSearch || 'Customer'}
                  </Text>
                  {customerSearch.trim() ? (
                    <TouchableOpacity
                      style={styles.clearSearchButton}
                      onPress={() => {
                        setCustomerSearch('');
                        setAppliedCustomerSearch('');
                      }}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="close" size={12} color={THEME.ink} />
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>
              </View>

              <View style={styles.chipRow}>
                <View style={{ position: 'relative', zIndex: 10 }}>
                  <Animated.View style={{ transform: [{ scale: infoPulse }] }}>
                    <TouchableOpacity
                      onPress={() => {
                        dismissTooltip();
                        setLegendVisible(true);
                      }}
                      activeOpacity={0.7}
                      style={styles.infoChip}
                    >
                      <MaterialIcons
                        name="info-outline"
                        size={16}
                        color={THEME.primary}
                      />
                    </TouchableOpacity>
                  </Animated.View>

                  {showTooltip && (
                    <Animated.View
                      style={[
                        styles.tooltipBox,
                        {
                          opacity: tooltipOpacity,
                          transform: [{ scale: tooltipScale }],
                        },
                      ]}
                    >
                      <View style={styles.tooltipArrow} />
                      <View style={styles.tooltipIconWrap}>
                        <MaterialIcons
                          name="touch-app"
                          size={14}
                          color="#FFFFFF"
                        />
                      </View>
                      <Text style={styles.tooltipText}>
                        Klik untuk melihat keterangan status
                      </Text>
                      <TouchableOpacity
                        onPress={dismissTooltip}
                        style={styles.tooltipClose}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons
                          name="close"
                          size={12}
                          color="rgba(255,255,255,0.5)"
                        />
                      </TouchableOpacity>
                    </Animated.View>
                  )}
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipScroll}
                >
                  {(['all', 'OPEN', 'PARSIAL', 'CLOSE'] as const).map(opt => {
                    const active = selectedStatus === opt;
                    const getDotColor = (): string | undefined => {
                      if (opt === 'OPEN') return '#EF4444';
                      if (opt === 'PARSIAL') return '#3B82F6';
                      if (opt === 'CLOSE') return '#10B981';
                      return undefined;
                    };
                    const dotColor = getDotColor();
                    const labelText =
                      opt === 'all'
                        ? `Semua (${rawItems.length})`
                        : opt === 'OPEN'
                        ? `OPEN (${statusCounts.OPEN})`
                        : opt === 'PARSIAL'
                        ? `PARSIAL (${statusCounts.PARSIAL})`
                        : `CLOSE (${statusCounts.CLOSE})`;
                    return (
                      <TouchableOpacity
                        key={`status-${opt}`}
                        style={[
                          styles.chipItem,
                          active && styles.chipItemActive,
                        ]}
                        activeOpacity={0.8}
                        onPress={() =>
                          setSelectedStatus(prev =>
                            opt === 'all' ? 'all' : prev === opt ? 'all' : opt,
                          )
                        }
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          {opt === 'all' ? (
                            <MaterialIcons
                              name="format-list-bulleted"
                              size={14}
                              color={active ? THEME.primary : THEME.muted}
                            />
                          ) : (
                            <View
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: dotColor,
                              }}
                            />
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
              </View>

              {/* Inline loading indicator */}
              {isSearchSubmitting && (
                <View style={styles.inlineLoadingWrap}>
                  <ActivityIndicator size="small" color={THEME.primary} />
                  <Text style={styles.inlineLoadingText}>Memuat...</Text>
                </View>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.loadingText}>Memuat data tracking...</Text>
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

      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setPickerVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Pilih {pickerType === 'sales' ? 'Sales' : 'Customer'}
            </Text>
            <View style={styles.modalSearchWrap}>
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Cari..."
                placeholderTextColor={THEME.muted}
                value={pickerSearch}
                onChangeText={setPickerSearch}
              />
            </View>
            {false ? (
              <ActivityIndicator
                size="large"
                color={THEME.primary}
                style={{ margin: 20 }}
              />
            ) : (
              <FlatList
                data={(pickerType === 'sales'
                  ? masterSales
                  : masterCustomer
                ).filter(opt =>
                  (opt || '')
                    .toLowerCase()
                    .includes(pickerSearch.toLowerCase()),
                )}
                keyExtractor={(_, idx) => String(idx)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalOption}
                    onPress={() => {
                      if (pickerType === 'sales') {
                        setSalesSearch(item);
                        setAppliedSalesSearch(item);
                      } else {
                        setCustomerSearch(item);
                        setAppliedCustomerSearch(item);
                      }
                      setPickerVisible(false);
                    }}
                  >
                    <Text style={styles.modalOptionText}>{item}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text
                    style={{
                      textAlign: 'center',
                      marginTop: 20,
                      color: THEME.muted,
                    }}
                  >
                    Data tidak ditemukan
                  </Text>
                }
                style={{ maxHeight: 300 }}
              />
            )}
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setPickerVisible(false)}
            >
              <Text style={styles.modalCloseBtnText}>Batal</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Modal Legenda Penjelasan Status (selaras dengan referensi) */}
      <Modal
        visible={legendVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLegendVisible(false)}
      >
        <View style={styles.legendModalBackdrop}>
          <View style={styles.legendModalCard}>
            <View style={styles.legendModalHeader}>
              <Text style={styles.legendModalTitle}>
                Informasi Status Penawaran
              </Text>
              <TouchableOpacity
                onPress={() => setLegendVisible(false)}
                activeOpacity={0.8}
              >
                <MaterialIcons name="close" size={22} color={THEME.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.legendModalContent}>
              <View style={styles.legendModalRow}>
                <View
                  style={[
                    styles.legendModalDot,
                    { backgroundColor: '#EF4444' },
                  ]}
                />
                <View style={styles.legendModalTextWrap}>
                  <Text style={styles.legendModalStatusName}>OPEN</Text>
                  <Text style={styles.legendModalStatusDesc}>
                    Dokumen penawaran belum diproses menjadi MAP atau SO atau
                    SPK.
                  </Text>
                </View>
              </View>

              <View style={styles.legendModalRow}>
                <View
                  style={[
                    styles.legendModalDot,
                    { backgroundColor: '#3B82F6' },
                  ]}
                />
                <View style={styles.legendModalTextWrap}>
                  <Text style={styles.legendModalStatusName}>PARSIAL</Text>
                  <Text style={styles.legendModalStatusDesc}>
                    Sebagian item penawaran sudah diproses menjadi MAP atau SO
                    atau SPK.
                  </Text>
                </View>
              </View>

              <View style={styles.legendModalRow}>
                <View
                  style={[
                    styles.legendModalDot,
                    { backgroundColor: '#10B981' },
                  ]}
                />
                <View style={styles.legendModalTextWrap}>
                  <Text style={styles.legendModalStatusName}>CLOSE</Text>
                  <Text style={styles.legendModalStatusDesc}>
                    Seluruh item penawaran sudah selesai diproses menjadi MAP
                    atau SO atau SPK.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 44 : 14,
  },
  headerWrap: { marginBottom: 10 },
  title: {
    textAlign: 'center',
    fontSize: 25,
    fontWeight: '900',
    color: THEME.ink,
    letterSpacing: 0.2,
    marginBottom: 10,
  },
  filterCard: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: THEME.line,
    padding: 14,
    ...PENAWARAN_SHADOW.card,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  dateSeparator: {
    color: THEME.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  dateChip: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: THEME.soft,
  },
  dateChipLabel: {
    color: THEME.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  dateChipValue: {
    color: THEME.ink,
    marginTop: 2,
    fontSize: 13,
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
    borderRadius: 15,
    backgroundColor: THEME.soft,
    height: 46,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
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
  searchButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  searchButtonGradient: {
    height: 46,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  pickerChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 14,
    backgroundColor: THEME.soft,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 6,
  },
  pickerChipActive: {
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    borderColor: THEME.primary,
  },
  pickerChipText: {
    flex: 1,
    color: THEME.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  pickerChipTextActive: {
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
  chipRow: {
    marginTop: 12,
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
  infoChip: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: `${THEME.primary}30`,
    backgroundColor: `${THEME.primary}0D`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipBox: {
    position: 'absolute',
    bottom: 44,
    left: -8,
    backgroundColor: THEME.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: THEME.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 999,
    minWidth: 180,
  },
  tooltipIconWrap: {
    marginRight: 6,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginRight: 8,
    flex: 1,
    letterSpacing: 0.2,
  },
  tooltipClose: {
    padding: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  tooltipArrow: {
    position: 'absolute',
    bottom: -6,
    left: 20,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: THEME.primary,
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
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.3,
  },
  rowNo: {
    color: THEME.ink,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  rowCompany: {
    marginTop: 6,
    color: THEME.ink,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
    color: THEME.muted,
    fontWeight: '700',
  },
  metaDivider: {
    color: THEME.muted,
    fontSize: 12,
  },
  progressContainer: {
    marginTop: 10,
    backgroundColor: `${THEME.primary}08`,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: `${THEME.primary}15`,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.ink,
  },
  mapNoContainer: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapNoLabel: {
    fontSize: 12,
    color: THEME.muted,
    fontWeight: '700',
  },
  mapNoValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: THEME.ink,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: THEME.line,
    paddingTop: 10,
    marginTop: 8,
    gap: 4,
  },
  cardFooterText: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.primary,
  },
  dropdownBody: {
    borderTopWidth: 1,
    borderTopColor: THEME.line,
    paddingTop: 10,
    marginTop: 2,
  },
  dropdownLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapItemCard: {
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: THEME.soft,
    marginBottom: 8,
  },
  mapItemTitle: {
    color: THEME.primary,
    fontWeight: '900',
    marginBottom: 4,
  },
  notesWrap: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 8,
    padding: 8,
    backgroundColor: THEME.card,
  },
  notesTitle: {
    color: THEME.ink,
    fontWeight: '900',
    marginBottom: 4,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 2,
  },
  noteBullet: {
    color: THEME.primary,
    fontWeight: '900',
    marginRight: 6,
    lineHeight: 18,
  },
  noteText: {
    flex: 1,
    color: THEME.ink,
    fontWeight: '700',
    lineHeight: 18,
  },
  dropdownText: {
    color: THEME.ink,
    fontWeight: '700',
    marginTop: 2,
  },
  dropdownTextHint: {
    color: THEME.muted,
    fontWeight: '700',
    marginTop: 6,
    fontSize: 12,
  },
  loadingWrap: { paddingVertical: 14 },
  loadingText: { color: THEME.muted, fontSize: 13, textAlign: 'center' },
  skeletonWrap: { marginTop: 10 },
  emptyWrap: {
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  emptyTitle: { color: THEME.muted, fontSize: 16, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.ink,
    marginBottom: 12,
  },
  modalSearchWrap: {
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 14,
    marginBottom: 10,
    backgroundColor: THEME.soft,
  },
  modalSearchInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: THEME.ink,
  },
  modalOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
  },
  modalOptionText: {
    fontSize: 14,
    color: THEME.ink,
    fontWeight: '700',
  },
  modalCloseBtn: {
    marginTop: 16,
    backgroundColor: THEME.soft,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: THEME.ink,
    fontWeight: '800',
  },
  legendModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  legendModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  legendModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
    paddingBottom: 12,
    marginBottom: 16,
  },
  legendModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.ink,
  },
  legendModalContent: {
    gap: 14,
  },
  legendModalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  legendModalDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  legendModalTextWrap: {
    flex: 1,
  },
  legendModalStatusName: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.ink,
  },
  legendModalStatusDesc: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.muted,
    marginTop: 1,
  },
});
