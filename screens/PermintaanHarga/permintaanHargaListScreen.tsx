/* eslint-disable react-native/no-inline-styles */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  Animated,
  BackHandler,
  Modal,
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
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/authContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { ListSkeleton } from '../../components/loadingSkeleton';
import {
  getPermintaanHargaList,
  PermintaanHargaItem,
} from '../../services/permintaanHargaApi';
import { PENAWARAN_SHADOW, PENAWARAN_THEME } from '../Penawaran/penawaranTheme';
import { COMPANY_STATUS_COLORS } from '../theme';

const THEME = PENAWARAN_THEME;

const getCurrentMonth = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const toYmd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
  return { startDate: toYmd(start), endDate: toYmd(end) };
};

const formatDate = (ymd: string) => {
  const [y, m, d] = String(ymd || '')
    .split('-')
    .map(Number);
  if (!y || !m || !d) return ymd || '-';
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatNumber = (n: any) => {
  const num = Number(n);
  if (Number.isNaN(num)) return String(n ?? '-');
  return new Intl.NumberFormat('id-ID').format(num);
};

const parseKetKalkulasi = (raw?: string) => {
  if (!raw) return { ppnStatus: null, items: [] };
  const rawParts = raw
    .split(/[;\n\r]+/)
    .map(p => p.trim())
    .filter(Boolean);

  let ppnStatus: 'EXCLUDE' | 'INCLUDE' | null = null;
  const items: string[] = [];

  for (const part of rawParts) {
    const upper = part.toUpperCase().replace(/\s+/g, '');
    if (
      upper === 'EXCPPN' ||
      upper === 'EXCLUDEPPN' ||
      upper === 'NONPPN' ||
      upper === 'EXCLUDE'
    ) {
      ppnStatus = 'EXCLUDE';
    } else if (
      upper === 'INCPPN' ||
      upper === 'INCLUDEPPN' ||
      upper === 'INCLUDE'
    ) {
      ppnStatus = 'INCLUDE';
    } else {
      items.push(part);
    }
  }

  return { ppnStatus, items };
};

const getStatusBadgeStyle = (status: string) => {
  const value = String(status || '').toUpperCase();
  const colors = COMPANY_STATUS_COLORS[value] || COMPANY_STATUS_COLORS.DEFAULT;
  return {
    backgroundColor: `${colors.base}1A`,
    borderColor: colors.base,
    textColor: colors.text,
  };
};

const KalkulasiRowItem = ({
  status,
  harga,
  ket,
}: {
  status: string;
  harga: number;
  ket?: string;
}) => {
  if (String(status || '').toUpperCase() !== 'DONE') return null;
  const parsed = parseKetKalkulasi(ket);
  return (
    <View style={styles.kalkulasiRow}>
      <View style={styles.kalkulasiRowLeft}>
        <Text style={styles.kalkulasiLabel}>Harga Kalkulasi:</Text>
        <Text style={styles.kalkulasiValue}>
          Rp {formatNumber(harga || 0)}
        </Text>
      </View>
      {parsed.ppnStatus && (
        <View
          style={[
            styles.ppnMiniBadge,
            parsed.ppnStatus === 'INCLUDE'
              ? styles.ppnMiniBadgeInclude
              : styles.ppnMiniBadgeExclude,
          ]}
        >
          <Text
            style={[
              styles.ppnMiniBadgeText,
              parsed.ppnStatus === 'INCLUDE'
                ? styles.ppnMiniBadgeTextInclude
                : styles.ppnMiniBadgeTextExclude,
            ]}
          >
            {parsed.ppnStatus === 'INCLUDE' ? 'Inc PPN' : 'Exc PPN'}
          </Text>
        </View>
      )}
    </View>
  );
};

export default function PermintaanHargaListScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const initialRange = useMemo(() => {
    const pMonth = route?.params?.month;
    const pYear = route?.params?.year;
    if (pMonth && pYear) {
      const start = new Date(pYear, pMonth - 1, 1);
      const end = new Date(pYear, pMonth, 0);
      const toYmd = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
          d.getDate(),
        ).padStart(2, '0')}`;
      return { startDate: toYmd(start), endDate: toYmd(end) };
    }
    return getCurrentMonth();
  }, [route?.params?.month, route?.params?.year]);

  const [rawItems, setRawItems] = useState<PermintaanHargaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);

  useEffect(() => {
    const pMonth = route?.params?.month;
    const pYear = route?.params?.year;
    if (pMonth && pYear) {
      const start = new Date(pYear, pMonth - 1, 1);
      const end = new Date(pYear, pMonth, 0);
      const toYmd = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
          d.getDate(),
        ).padStart(2, '0')}`;
      setStartDate(toYmd(start));
      setEndDate(toYmd(end));
    }
  }, [route?.params?.month, route?.params?.year]);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showSearchFab, setShowSearchFab] = useState(false);
  const [openSearchMini, setOpenSearchMini] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showLegendModal, setShowLegendModal] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);

  // Animated values for tooltip
  const tooltipOpacity = useRef(new Animated.Value(0)).current;
  const tooltipScale = useRef(new Animated.Value(0.8)).current;
  const infoPulse = useRef(new Animated.Value(1)).current;

  // Tooltip entrance animation + auto-dismiss
  useEffect(() => {
    if (showTooltip) {
      // Fade-in + bounce
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

      // Pulse effect on info button
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

      // Auto-dismiss after 5 seconds
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

  const filteredItems = useMemo(() => {
    return rawItems.filter(
      item =>
        filterStatus === 'all' ||
        String(item.status).toLowerCase() === filterStatus,
    );
  }, [rawItems, filterStatus]);

  const statusCounts = useMemo(() => {
    const map = { done: 0, minta: 0, wait: 0, belum: 0, cancel: 0 };
    rawItems.forEach(item => {
      const st = String(item.status || '').toLowerCase();
      if (st === 'selesai') {
        map.done++;
      } else if (st in map) {
        map[st as keyof typeof map]++;
      }
    });
    return map;
  }, [rawItems]);

  const loadData = useCallback(
    async (isRefresh = false) => {
      isRefresh ? setRefreshing(true) : setLoading(true);
      try {
        if (!token) {
          setRawItems([]);
          return;
        }

        const data = await getPermintaanHargaList(
          {
            startDate,
            endDate,
            search: search.trim() || undefined,
            limit: 300,
            page: 1,
          },
          token,
        );
        setRawItems(data);
      } catch (err: any) {
        Toast.show({
          type: 'glassError',
          text1: 'Error',
          text2:
            err?.response?.data?.message ||
            'Gagal mengambil daftar permintaan harga',
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [endDate, search, startDate, token],
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
    const timer = setTimeout(() => loadData(), 350);
    return () => clearTimeout(timer);
  }, [loadData]);

  const parseYmd = (ymd: string) => {
    const [y, m, d] = String(ymd || '')
      .split('-')
      .map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };

  const onPressItem = (item: PermintaanHargaItem) => {
    navigation.navigate('PermintaanHargaDetail', { nomor: item.nomor });
  };

  const ListHeader = (
    <View style={styles.headerWrap}>
      <View style={styles.headerTop}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.title}>Permintaan Harga</Text>
            <Text style={styles.subtitle}>
              Periode {formatDate(startDate)} - {formatDate(endDate)}
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

        <View style={styles.searchBox}>
          <TextInput
            placeholder="Cari nomor/nama/customer"
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
              <MaterialIcons
                name="close"
                style={styles.clearSearchButtonText}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.createButtonWide}
          onPress={() =>
            navigation.navigate('PermintaanHargaForm', { mode: 'create' })
          }
          activeOpacity={0.9}
          accessibilityLabel="Tambah Permintaan Harga"
        >
          <LinearGradient
            colors={[THEME.primary, THEME.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.createButtonWideGradient}
          >
            <Text style={styles.createButtonWideText}>
              Buat Permintaan Harga
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.chipRow}>
          <View style={{ position: 'relative', zIndex: 10 }}>
            <Animated.View style={{ transform: [{ scale: infoPulse }] }}>
              <TouchableOpacity
                onPress={() => {
                  dismissTooltip();
                  setShowLegendModal(true);
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
                  <MaterialIcons name="touch-app" size={14} color="#FFFFFF" />
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
            {(['all', 'done', 'minta', 'wait', 'belum', 'cancel'] as const).map(
              opt => {
                const active = filterStatus === opt;
                const count =
                  opt === 'all' ? rawItems.length : statusCounts[opt];
                const getDotColor = (): string | undefined => {
                  if (opt === 'done') return COMPANY_STATUS_COLORS.DONE.base;
                  if (opt === 'minta') return COMPANY_STATUS_COLORS.MINTA.base;
                  if (opt === 'wait') return COMPANY_STATUS_COLORS.WAIT.base;
                  if (opt === 'belum') return COMPANY_STATUS_COLORS.BELUM.base;
                  if (opt === 'cancel') return COMPANY_STATUS_COLORS.CANCEL.base;
                  return undefined;
                };
                const dotColor = getDotColor();
                const labelText =
                  opt === 'all'
                    ? `Semua (${count})`
                    : opt === 'done'
                    ? `Done (${count})`
                    : opt === 'minta'
                    ? `Minta (${count})`
                    : opt === 'wait'
                    ? `Wait (${count})`
                    : opt === 'belum'
                    ? `Belum (${count})`
                    : `Cancel (${count})`;
                return (
                  <TouchableOpacity
                    key={`status-${opt}`}
                    style={[styles.chipItem, active && styles.chipItemActive]}
                    activeOpacity={0.8}
                    onPress={() =>
                      setFilterStatus(prev =>
                        opt === 'all' ? 'all' : prev === opt ? 'all' : opt,
                      )
                    }
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
              }
            )}
          </ScrollView>
        </View>
      </View>
    </View>
  );

  const onScroll = useCallback((e: any) => {
    const y = e?.nativeEvent?.contentOffset?.y || 0;
    setShowSearchFab(y > 180);
  }, []);

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

      <FlatList
        data={loading ? [] : filteredItems}
        keyExtractor={(item, idx) => `${item.nomor}-${idx}`}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 140 + insets.bottom },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor={THEME.primary}
          />
        }
        renderItem={({ item }) => {
          const statusStyle = getStatusBadgeStyle(item.status);
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.9}
              onPress={() => onPressItem(item)}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.nomor}>{item.nomor}</Text>
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
                    style={[
                      styles.statusText,
                      { color: statusStyle.textColor },
                    ]}
                  >
                    {item.status || '-'}
                  </Text>
                </View>
              </View>

              <Text style={styles.nama} numberOfLines={1}>
                {item.nama || '-'}
              </Text>
              <Text style={styles.metaText} numberOfLines={1}>
                Customer: {item.customer || '-'}
              </Text>
              <Text style={styles.metaText} numberOfLines={1}>
                {formatDate(item.tanggal)} • {item.divisi || '-'}
              </Text>
              <Text style={styles.metaText} numberOfLines={1}>
                Jumlah Order: {item.jml_order || 0}
              </Text>
              <KalkulasiRowItem
                status={item.status}
                harga={item.harga_kalkulasi}
                ket={item.ket_kalkulasi}
              />
              <Text style={styles.detail}>Tap untuk lihat detail</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.loadingText}>
                Memuat data permintaan harga...
              </Text>
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
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />

      {showStartPicker && (
        <DateTimePicker
          mode="date"
          value={parseYmd(startDate)}
          onChange={(_, d) => {
            if (Platform.OS !== 'ios') setShowStartPicker(false);
            if (!d) return;
            const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
              2,
              '0',
            )}-${String(d.getDate()).padStart(2, '0')}`;
            setStartDate(ymd);
            if (ymd > endDate) setEndDate(ymd);
          }}
          maximumDate={parseYmd(endDate)}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          mode="date"
          value={parseYmd(endDate)}
          onChange={(_, d) => {
            if (Platform.OS !== 'ios') setShowEndPicker(false);
            if (!d) return;
            const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
              2,
              '0',
            )}-${String(d.getDate()).padStart(2, '0')}`;
            setEndDate(ymd);
            if (ymd < startDate) setStartDate(ymd);
          }}
          minimumDate={parseYmd(startDate)}
        />
      )}

      {showSearchFab && (
        <TouchableOpacity
          style={[styles.fabSearch, { bottom: 82 + insets.bottom }]}
          onPress={() => setOpenSearchMini(true)}
          activeOpacity={0.9}
          accessibilityLabel="Cari Permintaan Harga"
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
                placeholder="Cari nomor/nama/customer"
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

      <Modal
        visible={showLegendModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLegendModal(false)}
      >
        <View style={styles.legendModalBackdrop}>
          <View style={styles.legendModalCard}>
            <View style={styles.legendModalHeader}>
              <Text style={styles.legendModalTitle}>
                Info Status Permintaan Harga
              </Text>
              <TouchableOpacity
                onPress={() => setShowLegendModal(false)}
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
                    { backgroundColor: COMPANY_STATUS_COLORS.BELUM.base },
                  ]}
                />
                <View style={styles.legendModalTextWrap}>
                  <Text style={styles.legendModalStatusName}>BELUM</Text>
                  <Text style={styles.legendModalStatusDesc}>
                    Tidak muncul di kalkulasi harga
                  </Text>
                </View>
              </View>

              <View style={styles.legendModalRow}>
                <View
                  style={[
                    styles.legendModalDot,
                    { backgroundColor: COMPANY_STATUS_COLORS.MINTA.base },
                  ]}
                />
                <View style={styles.legendModalTextWrap}>
                  <Text style={styles.legendModalStatusName}>MINTA</Text>
                  <Text style={styles.legendModalStatusDesc}>
                    Sedang dimintakan harga ke Finance
                  </Text>
                </View>
              </View>

              <View style={styles.legendModalRow}>
                <View
                  style={[
                    styles.legendModalDot,
                    { backgroundColor: COMPANY_STATUS_COLORS.WAIT.base },
                  ]}
                />
                <View style={styles.legendModalTextWrap}>
                  <Text style={styles.legendModalStatusName}>WAIT</Text>
                  <Text style={styles.legendModalStatusDesc}>
                    Sudah diproses, menunggu acc
                  </Text>
                </View>
              </View>

              <View style={styles.legendModalRow}>
                <View
                  style={[
                    styles.legendModalDot,
                    { backgroundColor: COMPANY_STATUS_COLORS.DONE.base },
                  ]}
                />
                <View style={styles.legendModalTextWrap}>
                  <Text style={styles.legendModalStatusName}>DONE</Text>
                  <Text style={styles.legendModalStatusDesc}>
                    Permintaan harga telah selesai diproses
                  </Text>
                </View>
              </View>

              <View style={styles.legendModalRow}>
                <View
                  style={[
                    styles.legendModalDot,
                    { backgroundColor: COMPANY_STATUS_COLORS.CANCEL.base },
                  ]}
                />
                <View style={styles.legendModalTextWrap}>
                  <Text style={styles.legendModalStatusName}>CANCEL</Text>
                  <Text style={styles.legendModalStatusDesc}>
                    Permintaan harga dibatalkan
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
  headerWrap: {
    backgroundColor: THEME.bgBottom,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    paddingBottom: 10,
  },
  headerTop: { marginBottom: 10 },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { alignItems: 'center' },
  title: {
    fontSize: 25,
    fontWeight: '900',
    color: THEME.ink,
    letterSpacing: 0.2,
    marginTop: 0,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    color: THEME.muted,
    fontWeight: '700',
    textAlign: 'center',
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
  headerCard: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: THEME.line,
    padding: 14,
    ...PENAWARAN_SHADOW.card,
  },
  dateRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  dateChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 14,
    backgroundColor: THEME.soft,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  dateChipLabel: { color: THEME.muted, fontSize: 11, fontWeight: '700' },
  dateChipValue: {
    color: THEME.ink,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  searchBox: {
    marginTop: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: THEME.line,
    backgroundColor: THEME.soft,
    paddingHorizontal: 12,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    color: THEME.ink,
    fontSize: 14,
    fontWeight: '700',
    padding: 0,
  },
  clearSearchButton: {
    marginLeft: 8,
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(100,116,139,0.14)',
  },
  clearSearchButtonText: {
    color: THEME.ink,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
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
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  divider: {
    marginTop: 10,
    height: 1,
    backgroundColor: THEME.line,
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
  loadingWrap: {
    paddingVertical: 12,
  },
  loadingText: { color: THEME.muted, fontSize: 13, textAlign: 'center' },
  skeletonWrap: { marginTop: 10 },
  listContent: {
    paddingBottom: 24,
    paddingTop: 4,
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: THEME.line,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 10,
    ...PENAWARAN_SHADOW.softCard,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  nomor: { color: THEME.ink, fontWeight: '800', fontSize: 15 },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  statusText: { fontWeight: '800', fontSize: 11, letterSpacing: 0.3 },
  nama: { color: THEME.ink, fontWeight: '800', marginTop: 6, fontSize: 15 },
  metaText: { marginTop: 2, fontSize: 12, color: THEME.ink },
  kalkulasiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
  },
  kalkulasiRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  kalkulasiLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.muted,
  },
  kalkulasiValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  ppnMiniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  ppnMiniBadgeExclude: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  ppnMiniBadgeInclude: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  ppnMiniBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  ppnMiniBadgeTextExclude: {
    color: '#92400E',
  },
  ppnMiniBadgeTextInclude: {
    color: '#166534',
  },
  detail: {
    color: THEME.muted,
    fontWeight: '700',
    fontSize: 11,
    paddingTop: 5,
  },
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
});
