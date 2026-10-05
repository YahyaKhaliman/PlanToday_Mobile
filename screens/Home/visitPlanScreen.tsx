/* eslint-disable react-native/no-inline-styles */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Platform,
  Modal,
  BackHandler,
  Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import DateRangePickerModal from '../../components/DateRangePickerModal';
import api from '../../services/api';
import { useAuth } from '../../context/authContext';
import { Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePressGuard } from '../../utils/usePressGuard';
import { GlassSelect } from '../Register/glassSelect';
import Toast from 'react-native-toast-message';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { THEME } from '../theme';

type RekapItem = {
  id: number;
  tanggal_plan: string;
  cus_kode: string;
  cc_nama: string;
  cc_alamat: string;
  note: string;
  catatan: string;
  label_status: string;
  realisasi?: 'Y' | 'N' | string | null;
  tanggal?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  foto?: string | null;
  foto_url?: string | null;
};

type Karyawan = {
  kar_nama: string;
  kar_cabang: string;
  kar_jabatan: string;
};

const dateToYmd = (dt: Date) => {
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatDisplayDate = (ymd: string) => {
  try {
    const [y, m, d] = ymd.split('-').map(n => parseInt(n, 10));
    const dt = new Date(y, m - 1, d);
    const bulan = [
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
    return `${dt.getDate()} ${bulan[dt.getMonth()]} ${dt.getFullYear()}`;
  } catch {
    return ymd;
  }
};

export default function VisitPlanGabunganScreen({ navigation }: any) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const runGuardedPress = usePressGuard();
  const isManager = String(user?.jabatan || '').toUpperCase() === 'MANAGER';
  const namaUser = user?.nama || '';

  const currentMonthRange = useMemo(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return {
      start: dateToYmd(firstDay),
      end: dateToYmd(lastDay),
    };
  }, []);
  const CABANG_VALUES = useMemo(
    () => ['PUSAT', 'JATIM', 'JATENG', 'JAKARTA'],
    [],
  );

  const [loading, setLoading] = useState(false);

  // ===== Skeleton Loading =====
  const skeletonPulse = useRef(new Animated.Value(0.3)).current;
  const skeletonData = useMemo(
    () =>
      Array.from(
        { length: 5 },
        (_, i) => ({ id: `skeleton-${i}`, isSkeleton: true } as any),
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

  const normalizeYmd = (v: string) => String(v || '').slice(0, 10);
  const isPlanSudah = (item?: RekapItem | null) => {
    const statusLabel = String(item?.label_status || '')
      .trim()
      .toLowerCase();
    const realisasiFlag = String(item?.realisasi || '')
      .trim()
      .toUpperCase();

    return statusLabel === 'sudah' || realisasiFlag === 'Y';
  };

  // ===== cabang =====
  const [selectedCabang, setSelectedCabang] = useState<string>(() => {
    const cab = String(user?.cabang || 'PUSAT').toUpperCase();
    return CABANG_VALUES.includes(cab) ? cab : 'PUSAT';
  });
  const [openCabang, setOpenCabang] = useState(false);
  const cabangOptions = useMemo(
    () => CABANG_VALUES.map(c => ({ label: c, value: c })),
    [CABANG_VALUES],
  );

  // ===== sales (manager) =====
  const [loadingSales, setLoadingSales] = useState(false);
  const [listSales, setListSales] = useState<string[]>([]);
  const [selectedSales, setSelectedSales] = useState<string>('');
  const [openSales, setOpenSales] = useState(false);
  const salesOptions = useMemo(
    () => listSales.map(n => ({ label: n, value: n })),
    [listSales],
  );

  // ===== rentang tanggal =====
  const [tanggalAwal, setTanggalAwal] = useState<string>(
    currentMonthRange.start,
  );
  const [tanggalAkhir, setTanggalAkhir] = useState<string>(
    currentMonthRange.end,
  );
  const [showRangePicker, setShowRangePicker] = useState(false);

  // ===== data =====
  const [data, setData] = useState<RekapItem[]>([]);

  // ===== FAB filter & modal =====
  const [showFab, setShowFab] = useState(false);
  const [openFilter, setOpenFilter] = useState(false);

  // ===== FAB edit mini popup =====
  const [selectedItem, setSelectedItem] = useState<RekapItem | null>(null);
  const [showEditFab, setShowEditFab] = useState(false);

  // ===== filter belum visit =====
  const [onlyBelum, setOnlyBelum] = useState(false);

  // ===== userParam =====
  const userParam = useMemo(
    () => (isManager ? selectedSales : namaUser),
    [isManager, selectedSales, namaUser],
  );

  const filteredData = useMemo(() => {
    if (!onlyBelum) return data;
    return data.filter(
      item => String(item.realisasi || '').toUpperCase() !== 'Y',
    );
  }, [data, onlyBelum]);

  // Open WA
  const [openWaOption, setOpenWaOption] = useState(false);
  const [waPendingText, setWaPendingText] = useState<string>('');

  // set default for non-manager
  useEffect(() => {
    if (!isManager) {
      const cab = String(user?.cabang || '').toUpperCase();
      if (cab && CABANG_VALUES.includes(cab)) setSelectedCabang(cab);
      setSelectedSales(namaUser);
    }
  }, [isManager, user?.cabang, namaUser, CABANG_VALUES]);

  const formatDdMmYyyy = (ymd: string) => {
    try {
      const [y, m, d] = ymd.split('-').map(Number);
      const dt = new Date(y, m - 1, d); // LOCAL, no timezone shift
      const bulan = [
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
      return `${dt.getDate()} ${bulan[dt.getMonth()]} ${dt.getFullYear()}`;
    } catch {
      return ymd;
    }
  };

  const fetchSalesByCabang = useCallback(
    async (cabang: string) => {
      if (!isManager) return;

      setLoadingSales(true);
      try {
        const res = await api.get('/karyawan', { params: { cabang } });
        const raw = res.data?.data ?? res.data;
        const arr: Karyawan[] = Array.isArray(raw) ? raw : [];

        const names = arr
          .filter(x => String(x?.kar_jabatan || '').toUpperCase() === 'SALES')
          .map(x => String(x?.kar_nama || '').trim())
          .filter(Boolean);

        const uniqueSorted = Array.from(new Set(names)).sort((a, b) =>
          a.localeCompare(b),
        );
        setListSales(uniqueSorted);
        setSelectedSales(uniqueSorted[0] || '');
      } catch {
        setListSales([]);
        setSelectedSales('');
      } finally {
        setLoadingSales(false);
      }
    },
    [isManager],
  );

  useEffect(() => {
    if (!isManager) return;
    setListSales([]);
    setSelectedSales('');
    fetchSalesByCabang(selectedCabang);
  }, [isManager, selectedCabang, fetchSalesByCabang]);

  // ===== refresh =====
  const refresh = useCallback(async () => {
    if (!userParam) {
      Toast.show({
        type: 'glassError',
        text1: 'Validasi',
        text2: isManager
          ? 'Pilih Cabang dan Sales terlebih dahulu'
          : 'Login terlebih dahulu',
      });
      return;
    }

    if (!tanggalAwal || !tanggalAkhir) {
      Toast.show({
        type: 'glassError',
        text1: 'Validasi',
        text2: 'Tanggal awal & akhir wajib diisi',
      });
      return;
    }

    if (tanggalAwal > tanggalAkhir) {
      Toast.show({
        type: 'glassError',
        text1: 'Validasi',
        text2: 'Tanggal awal tidak boleh melebihi tanggal akhir',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await api.get('/rekap-visit-plan', {
        params: {
          user: userParam,
          cabang: selectedCabang,
          tanggal_awal: tanggalAwal,
          tanggal_akhir: tanggalAkhir,
        },
      });

      setData(res.data?.data || []);
    } catch (err: any) {
      Toast.show({
        type: 'glassError',
        text1: 'Error',
        text2: err?.response?.data?.message || 'Gagal mengambil data rekap',
      });
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [userParam, selectedCabang, tanggalAwal, tanggalAkhir, isManager]);

  useEffect(() => {
    if (!isManager) refresh();
    else if (selectedSales) refresh();
  }, [refresh, isManager, selectedSales]);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tanggalAwal, tanggalAkhir, namaUser]),
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

  const openWA = async (text: string, mode: 'app' | 'business') => {
    const encoded = encodeURIComponent(text);

    const waApp = `whatsapp://send?text=${encoded}`;
    const waBiz = `whatsapp-business://send?text=${encoded}`;
    const waWeb = `https://wa.me/?text=${encoded}`;

    const waAppIntent = `intent://send?text=${encoded}#Intent;scheme=whatsapp;package=com.whatsapp;end`;
    const waBizIntent = `intent://send?text=${encoded}#Intent;scheme=whatsapp-business;package=com.whatsapp.w4b;end`;

    try {
      if (mode === 'business') {
        if (await Linking.canOpenURL(waBiz)) return Linking.openURL(waBiz);
        if (
          Platform.OS === 'android' &&
          (await Linking.canOpenURL(waBizIntent))
        )
          return Linking.openURL(waBizIntent);

        // fallback kalau business nggak ada, coba WA biasa
        if (await Linking.canOpenURL(waApp)) return Linking.openURL(waApp);
        if (
          Platform.OS === 'android' &&
          (await Linking.canOpenURL(waAppIntent))
        )
          return Linking.openURL(waAppIntent);

        return Linking.openURL(waWeb);
      }

      if (await Linking.canOpenURL(waApp)) return Linking.openURL(waApp);
      if (Platform.OS === 'android' && (await Linking.canOpenURL(waAppIntent)))
        return Linking.openURL(waAppIntent);

      // fallback kalau WA biasa nggak ada, coba business
      if (await Linking.canOpenURL(waBiz)) return Linking.openURL(waBiz);
      if (Platform.OS === 'android' && (await Linking.canOpenURL(waBizIntent)))
        return Linking.openURL(waBizIntent);

      return Linking.openURL(waWeb);
    } catch {
      return Linking.openURL(waWeb);
    }
  };

  const kirimWA = useCallback(async () => {
    if (!userParam) {
      Toast.show({
        type: 'glassError',
        text1: 'Validasi',
        text2: isManager
          ? 'Pilih Sales terlebih dahulu'
          : 'Login terlebih dahulu',
      });
      return;
    }

    try {
      const res = await api.get('/rekap-visit-plan/wa', {
        params: {
          user: userParam,
          cabang: selectedCabang,
          tanggal_awal: tanggalAwal,
          tanggal_akhir: tanggalAkhir,
        },
      });

      const waText = res.data?.wa_text;
      if (!waText) {
        Toast.show({
          type: 'glassInfo',
          text1: 'Info',
          text2: 'Data WA tidak tersedia',
        });
        return;
      }

      setWaPendingText(waText);
      setOpenWaOption(true);
    } catch (err: any) {
      Toast.show({
        type: 'glassError',
        text1: 'Error',
        text2: err?.response?.data?.message || 'Gagal membuat rekap WA',
      });
    }
  }, [userParam, selectedCabang, tanggalAwal, tanggalAkhir, isManager]);

  // ===== scroll handler =====
  const onScroll = useCallback((e: any) => {
    const y = e.nativeEvent.contentOffset.y || 0;
    setShowFab(y > 200);
    setShowEditFab(false); // kalau user scroll, edit-fab hilang
  }, []);

  const openEditFab = useCallback(
    (item: RekapItem) => {
      runGuardedPress(
        'visit-plan:open-edit-fab',
        () => {
          const normalizedStatus = String(item?.label_status || '')
            .trim()
            .toLowerCase();
          if (normalizedStatus === 'sudah') {
            setShowEditFab(false);
            setSelectedItem(null);
            return;
          }

          setSelectedItem(item);
          setShowEditFab(true);
        },
        250,
      );
    },
    [runGuardedPress],
  );

  // ===== render item =====
  const renderItem = useCallback(
    ({ item }: { item: RekapItem & { isSkeleton?: boolean } }) => {
      if (item.isSkeleton) {
        return (
          <View style={styles.cardCompact}>
            <View style={{ flex: 1, gap: 8 }}>
              {/* Nama Customer Skeleton */}
              <Animated.View
                style={[
                  styles.skeletonBar,
                  { width: '60%', height: 16, opacity: skeletonPulse },
                ]}
              />
              {/* Tanggal Skeleton */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 4,
                }}
              >
                <Animated.View
                  style={[
                    styles.skeletonBar,
                    {
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      opacity: skeletonPulse,
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.skeletonBar,
                    { width: '40%', height: 12, opacity: skeletonPulse },
                  ]}
                />
              </View>
            </View>
            {/* Status Badge Skeleton */}
            <Animated.View
              style={[
                styles.skeletonBar,
                {
                  width: 60,
                  height: 24,
                  borderRadius: 12,
                  opacity: skeletonPulse,
                },
              ]}
            />
          </View>
        );
      }

      const done = String(item.realisasi || '').toUpperCase() === 'Y';
      const isSelected = selectedItem?.id === item.id && showEditFab;

      return (
        <TouchableOpacity activeOpacity={0.9} onPress={() => openEditFab(item)}>
          <View
            style={[
              styles.cardCompact,
              isSelected && {
                backgroundColor: '#F4F4FD',
                borderColor: THEME.primary,
                borderWidth: 1.5,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.compactTitle} numberOfLines={1}>
                {item.cc_nama || '-'}
              </Text>
              <View style={styles.inlineRow}>
                <MaterialIcons
                  name="calendar-today"
                  size={14}
                  color={THEME.accent}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.compactSub}>
                  {formatDdMmYyyy(normalizeYmd(item.tanggal_plan))}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.compactBadge,
                done ? styles.badgeDone : styles.badgeNotDone,
              ]}
            >
              <Text style={styles.compactBadgeText}>
                {done ? 'DONE' : 'BELUM'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [openEditFab, selectedItem, showEditFab, skeletonPulse],
  );

  // ===== header =====
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
            <Text style={styles.title}>Visit Plan</Text>
            <Text style={styles.subtitle}>{'Rekap rencana kunjungan'}</Text>
          </View>
          <View style={styles.headerRightSpacer} />
        </View>
      </View>

      <View style={styles.headerCard}>
        <View style={styles.row2}>
          <View style={styles.col}>
            <GlassSelect
              label="Cabang"
              value={selectedCabang}
              options={cabangOptions}
              visible={openCabang}
              onOpen={() => {
                if (!isManager) return;
                setOpenCabang(true);
              }}
              onClose={() => setOpenCabang(false)}
              onSelect={setSelectedCabang}
              size="small"
            />
          </View>

          <View style={styles.col}>
            {isManager ? (
              <GlassSelect
                label={loadingSales ? 'Sales (memuat...)' : 'Sales'}
                value={selectedSales || (loadingSales ? 'Loading...' : '')}
                options={salesOptions}
                visible={openSales}
                onOpen={() => {
                  if (loadingSales) return;
                  setOpenSales(true);
                }}
                onClose={() => setOpenSales(false)}
                onSelect={setSelectedSales}
                size="small"
              />
            ) : (
              <>
                <Text style={styles.label}>Sales</Text>
                <View style={styles.readonlyRow}>
                  <Text style={styles.readonlyText}>{namaUser || '-'}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Date Range Setting Field */}
        <View style={{ marginTop: 2 }}>
          <Text style={styles.label}>Rentang Tanggal</Text>
          <TouchableOpacity
            style={styles.datePickerCard}
            onPress={() => setShowRangePicker(true)}
            activeOpacity={0.8}
          >
            <View style={styles.datePickerCol}>
              <Text style={styles.datePickerDateText} numberOfLines={1}>
                {formatDisplayDate(tanggalAwal)}
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
                {formatDisplayDate(tanggalAkhir)}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal Kalender Pemilihan Rentang Tanggal */}
      <DateRangePickerModal
        visible={showRangePicker}
        onClose={() => setShowRangePicker(false)}
        initialStartDate={tanggalAwal}
        initialEndDate={tanggalAkhir}
        primaryColor={THEME.primary}
        rangeBgColor="rgba(79, 70, 229, 0.12)"
        onConfirm={(start, end) => {
          setTanggalAwal(start);
          setTanggalAkhir(end);
        }}
      />

      <View style={styles.rowHint}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setOnlyBelum(prev => !prev)}
          style={[
            styles.belumFilterBtn,
            onlyBelum && styles.belumFilterBtnActive,
          ]}
        >
          <View
            style={[
              styles.belumCheckbox,
              onlyBelum && styles.belumCheckboxActive,
            ]}
          >
            {onlyBelum && (
              <MaterialIcons name="check" size={10} color="#FFFFFF" />
            )}
          </View>
          <Text style={[styles.belumText, onlyBelum && styles.belumTextActive]}>
            Belum
          </Text>
        </TouchableOpacity>

        <Text style={styles.smallHint}>
          {loading ? (
            'Memuat data...'
          ) : (
            <>
              Menampilkan:{' '}
              <Text style={{ fontWeight: '900' }}>{filteredData.length}</Text>{' '}
              data
            </>
          )}
        </Text>
      </View>
      <View style={styles.divider} />
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
        data={loading ? skeletonData : filteredData}
        keyExtractor={(item, index) =>
          item.isSkeleton ? `skeleton-${index}` : String(item.id)
        }
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          loading ? null : (
            <Text style={styles.empty}>Data visit plan tidak ditemukan.</Text>
          )
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 120 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onTouchStart={() => setShowEditFab(false)}
      />

      {/* FAB Filter */}
      {showFab && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() =>
            runGuardedPress(
              'visit-plan:open-filter',
              () => setOpenFilter(true),
              250,
            )
          }
          style={[styles.fab, { bottom: 90 + insets.bottom }]}
        >
          <View style={styles.fabInner}>
            <MaterialIcons name="filter-list" size={16} color={THEME.ink} />
            <Text style={styles.fabText}>Filter</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* FAB Visit muncul saat item dipilih */}
      {showEditFab && selectedItem && !isPlanSudah(selectedItem) && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            runGuardedPress('visit-plan:go-visit', () => {
              if (isPlanSudah(selectedItem)) {
                setShowEditFab(false);
                setSelectedItem(null);
                return;
              }

              setShowEditFab(false);
              const payload = {
                kode: selectedItem.cus_kode,
                nama: selectedItem.cc_nama,
                tanggal: normalizeYmd(selectedItem.tanggal_plan),
              };
              navigation.navigate('TambahVisit', { selectedCustomer: payload });
            });
          }}
          style={[styles.visitFab, { bottom: 202 + insets.bottom }]}
        >
          <View
            style={[
              styles.fabInner,
              {
                backgroundColor: THEME.ok,
                borderColor: 'rgba(22,163,74,0.15)',
              },
            ]}
          >
            <MaterialIcons name="directions-run" size={16} color="#FFFFFF" />
            <Text style={styles.fabTextWhite}>Visit</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* FAB Edit muncul saat item dipilih */}
      {showEditFab && selectedItem && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            runGuardedPress('visit-plan:go-edit', () => {
              setShowEditFab(false);
              navigation.navigate(
                isPlanSudah(selectedItem) ? 'EditVisit' : 'EditVisitPlan',
                { data: selectedItem },
              );
            });
          }}
          style={[styles.editFab, { bottom: 146 + insets.bottom }]}
        >
          <View style={styles.fabInner}>
            <MaterialIcons name="edit" size={14} color={THEME.ink} />
            <Text style={styles.fabText}>Edit</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Modal Filter */}
      <Modal
        visible={openFilter}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenFilter(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter</Text>
              <TouchableOpacity
                onPress={() => setOpenFilter(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.row2}>
              <View style={styles.col}>
                <GlassSelect
                  label="Cabang"
                  value={selectedCabang}
                  options={cabangOptions}
                  visible={openCabang}
                  onOpen={() => {
                    if (!isManager) return;
                    setOpenCabang(true);
                  }}
                  onClose={() => setOpenCabang(false)}
                  onSelect={setSelectedCabang}
                  size="small"
                />
              </View>

              <View style={styles.col}>
                {isManager ? (
                  <GlassSelect
                    label={loadingSales ? 'Sales (memuat...)' : 'Sales'}
                    value={selectedSales || (loadingSales ? 'Loading...' : '')}
                    options={salesOptions}
                    visible={openSales}
                    onOpen={() => {
                      if (loadingSales) return;
                      setOpenSales(true);
                    }}
                    onClose={() => setOpenSales(false)}
                    onSelect={setSelectedSales}
                    size="small"
                  />
                ) : (
                  <>
                    <Text style={styles.modalLabel}>Sales</Text>
                    <View style={styles.modalReadonlyRow}>
                      <Text style={styles.modalReadonlyText}>
                        {namaUser || '-'}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Date Range Setting Field – Rata Tengah (Modal Filter) */}
            <View style={{ marginTop: 6 }}>
              <Text style={styles.modalLabel}>Rentang Tanggal</Text>
              <TouchableOpacity
                style={styles.datePickerCard}
                onPress={() => setShowRangePicker(true)}
                activeOpacity={0.8}
              >
                <View style={styles.datePickerCol}>
                  <Text style={styles.datePickerLabel}>Mulai</Text>
                  <Text style={styles.datePickerDateText} numberOfLines={1}>
                    {formatDisplayDate(tanggalAwal)}
                  </Text>
                </View>

                <View style={styles.datePickerArrowWrap}>
                  <MaterialIcons
                    name="arrow-forward"
                    size={13}
                    color={THEME.muted}
                  />
                </View>

                <View style={styles.datePickerCol}>
                  <Text style={styles.datePickerLabel}>Selesai</Text>
                  <Text style={styles.datePickerDateText} numberOfLines={1}>
                    {formatDisplayDate(tanggalAkhir)}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={[styles.row2, { marginTop: 14 }]}>
              <TouchableOpacity
                style={[
                  styles.modalBtnCompact,
                  { backgroundColor: THEME.accent },
                ]}
                onPress={() => {
                  runGuardedPress('visit-plan:modal-refresh', () => {
                    setOpenFilter(false);
                    refresh();
                  });
                }}
                disabled={
                  loading || (isManager && (!selectedSales || loadingSales))
                }
                activeOpacity={0.9}
              >
                <Text style={styles.modalBtnTextCompact}>Refresh</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtnCompact, { backgroundColor: THEME.wa }]}
                onPress={() => {
                  runGuardedPress('visit-plan:modal-wa', () => {
                    setOpenFilter(false);
                    kirimWA();
                  });
                }}
                disabled={
                  loading || (isManager && (!selectedSales || loadingSales))
                }
                activeOpacity={0.9}
              >
                <Text style={styles.modalBtnTextCompact}>Kirim WA</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal WA */}
      <Modal
        visible={openWaOption}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenWaOption(false)}
      >
        <View
          style={[styles.modalBackdrop, { paddingBottom: 18 + insets.bottom }]}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kirim lewat</Text>
              <TouchableOpacity
                onPress={() => setOpenWaOption(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.waPickBtn, { backgroundColor: '#25D366' }]}
              activeOpacity={0.9}
              onPress={async () => {
                setOpenWaOption(false);
                await openWA(waPendingText, 'app');
              }}
            >
              <Text style={styles.waPickText}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.waPickBtn, { backgroundColor: '#128C7E' }]}
              activeOpacity={0.9}
              onPress={async () => {
                setOpenWaOption(false);
                await openWA(waPendingText, 'business');
              }}
            >
              <Text style={styles.waPickText}>WhatsApp Business</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.waPickBtn,
                {
                  backgroundColor: 'rgba(15,23,42,0.06)',
                  borderWidth: 1,
                  borderColor: THEME.line,
                },
              ]}
              activeOpacity={0.9}
              onPress={() => setOpenWaOption(false)}
            >
              <Text style={[styles.waPickText, { color: THEME.ink }]}>
                Batal
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bottom Action Bar */}
      <View
        style={[
          styles.bottomAction,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        {!isManager && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() =>
              runGuardedPress('visit-plan:go-add', () =>
                navigation.navigate('TambahVisitPlan'),
              )
            }
            activeOpacity={0.9}
          >
            <Text style={styles.bottomActionText}>+ Tambah</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.actionBtn,
            styles.actionBtnSoft,
            isManager && { flex: 1 },
          ]}
          onPress={() => runGuardedPress('visit-plan:refresh', refresh)}
          disabled={loading || (isManager && (!selectedSales || loadingSales))}
          activeOpacity={0.9}
        >
          {loading ? (
            <ActivityIndicator color={THEME.primary} />
          ) : (
            <Text style={[styles.bottomActionText, { color: THEME.primary }]}>
              Refresh
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionBtn,
            styles.actionBtnWa,
            // optional: kalau manager, biar tombolnya tetap proporsional (melebar)
            isManager && { flex: 1 },
          ]}
          onPress={() => runGuardedPress('visit-plan:wa', kirimWA)}
          disabled={loading || (isManager && (!selectedSales || loadingSales))}
          activeOpacity={0.9}
        >
          <Text style={styles.bottomActionText}>Kirim WA</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  listContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 120,
  },

  headerWrap: {
    backgroundColor: THEME.bgBottom,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
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
  headerCard: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: THEME.line,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },

  title: {
    fontSize: 20,
    fontWeight: '900',
    color: THEME.ink,
    letterSpacing: 0.2,
  },
  subtitle: {
    color: THEME.muted,
    fontSize: 12,
    marginTop: 6,
    fontWeight: '700',
    textAlign: 'center',
  },

  row2: { flexDirection: 'row', gap: 10, marginTop: 4 },
  col: { flex: 1 },

  divider: { marginTop: 10, height: 1, backgroundColor: THEME.line },

  smallHint: {
    color: THEME.ink,
    fontSize: 12,
    fontWeight: '700',
  },

  rowHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  belumFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: THEME.line,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 0.5,
  },
  belumFilterBtnActive: {
    backgroundColor: '#F4F4FD',
    borderColor: '#DEDDF9',
  },
  belumCheckbox: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: THEME.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    backgroundColor: '#FFFFFF',
  },
  belumCheckboxActive: {
    borderColor: THEME.primary,
    backgroundColor: THEME.primary,
  },
  belumText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.muted,
  },
  belumTextActive: {
    color: THEME.primary,
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

  readonlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.soft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 10,
    height: 44,
  },
  readonlyText: { flex: 1, color: THEME.ink, fontSize: 13, fontWeight: '800' },

  dateSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.soft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 10,
    height: 44,
  },
  dateText: { flex: 1, color: THEME.ink, fontSize: 13, fontWeight: '800' },

  modernDateCard: {
    marginTop: 10,
    backgroundColor: '#F4F3FF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(79,70,229,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: THEME.primary,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  modernDateColStart: {
    flex: 1,
    justifyContent: 'center',
    borderLeftWidth: 2,
    borderLeftColor: THEME.primary,
    paddingLeft: 8,
  },
  modernDateColEnd: {
    flex: 1,
    justifyContent: 'center',
    borderRightWidth: 2,
    borderRightColor: THEME.accent,
    paddingRight: 8,
  },
  modernDateBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: THEME.primary,
    letterSpacing: 0.8,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  modernDateValueText: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.ink,
    letterSpacing: 0.1,
  },
  modernDateVDivider: {
    width: 1,
    height: 34,
    backgroundColor: 'rgba(79,70,229,0.18)',
    marginHorizontal: 12,
  },

  // Dot Accent Date Range Card styles (kept for reference – comment out if not used)
  /*
  dotDateCard: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  dotDateCol: {
    flex: 1,
    justifyContent: 'center',
  },
  dotDateLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  dotDateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotDateLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.primary,
    letterSpacing: 0.4,
  },
  dotDateValue: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.ink,
  },
  dotDateDivider: {
    width: 1,
    height: 32,
    backgroundColor: THEME.line,
    marginHorizontal: 14,
  },
  */

  // Pill Style Date Card (minimal icons)
  pillDateCard: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FF', // soft pastel background matching theme
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  pillDateCol: {
    flex: 1,
    alignItems: 'center',
  },
  pillDateLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.muted,
    letterSpacing: 0.3,
  },
  pillDateValue: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.ink,
  },
  pillDateDivider: {
    width: 1,
    height: 24,
    backgroundColor: THEME.line,
    marginHorizontal: 8,
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
  modernDateCalendarIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    shadowColor: THEME.primary,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  cardItem: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.line,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  itemTitle: { color: THEME.ink, fontSize: 15, fontWeight: '900' },
  itemSub: {
    color: THEME.muted,
    fontSize: 13,
    marginTop: 6,
    fontWeight: '700',
  },
  itemMeta: {
    color: THEME.muted,
    fontSize: 12,
    marginTop: 10,
    fontWeight: '700',
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeDone: {
    backgroundColor: 'rgba(22,163,74,0.10)',
    borderColor: 'rgba(22,163,74,0.22)',
  },
  badgeNotDone: {
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderColor: 'rgba(239,68,68,0.22)',
  },
  badgeText: {
    color: THEME.ink,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  empty: {
    textAlign: 'center',
    marginTop: 18,
    color: THEME.muted,
    fontSize: 13,
    fontWeight: '700',
  },

  bottomAction: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME.card,
    borderTopWidth: 1,
    borderTopColor: THEME.line,
    flexDirection: 'row',
    gap: 10,
  },

  actionBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  actionBtnPrimary: {
    backgroundColor: THEME.accent,
    borderColor: 'rgba(79,70,229,0.18)',
  },
  actionBtnSoft: {
    backgroundColor: 'rgba(79,70,229,0.08)',
    borderColor: 'rgba(79,70,229,0.18)',
  },
  actionBtnWa: {
    backgroundColor: THEME.wa,
    borderColor: 'rgba(34,197,94,0.18)',
  },

  bottomActionText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.3,
  },

  fab: { position: 'absolute', right: 16, bottom: 90 },
  editFab: { position: 'absolute', right: 16, bottom: 146 },
  visitFab: { position: 'absolute', right: 16, bottom: 202 },

  fabInner: {
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

  fabText: {
    color: THEME.ink,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
    marginLeft: 6,
  },

  fabTextWhite: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
    marginLeft: 6,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalCard: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.10)',
    padding: 16,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
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

  modalLabel: {
    color: THEME.muted,
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 4,
    marginBottom: 4,
    marginTop: 6,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  modalReadonlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.soft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 10,
    height: 44,
  },
  modalReadonlyText: {
    flex: 1,
    color: THEME.ink,
    fontSize: 13,
    fontWeight: '800',
  },

  modalDateSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.soft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 10,
    height: 44,
  },
  modalDateText: {
    flex: 1,
    color: THEME.ink,
    fontSize: 13,
    fontWeight: '800',
  },

  modalBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: { color: '#fff', fontWeight: '900', letterSpacing: 0.3 },

  modalBtnCompact: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnTextCompact: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 0.3,
    fontSize: 13,
  },
  cardCompact: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  compactTitle: {
    color: THEME.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  compactSub: {
    color: THEME.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  compactBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginLeft: 10,
  },
  compactBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
    color: THEME.ink,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waPickBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  waPickText: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  skeletonBar: {
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
  },
});
