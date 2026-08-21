/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-native/no-inline-styles */
import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  View,
  StatusBar,
  Platform,
  BackHandler,
  ToastAndroid,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Modal from 'react-native-modal';
import Svg, {
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Text as SvgText,
  Path,
} from 'react-native-svg';
import DateTimePicker from '@react-native-community/datetimepicker';

import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { THEME, COMPANY_STATUS_COLORS } from '../theme';
import { useAuth } from '../../context/authContext';
import { usePressGuard } from '../../utils/usePressGuard';
import api from '../../services/api';
import {
  getPermintaanHargaStatusCounts,
  getPermintaanHargaList,
  PermintaanHargaStatusCounts,
  PermintaanHargaItem,
} from '../../services/permintaanHargaApi';
import {
  getTrackingPenawaranStatusCounts,
  getTrackingPenawaranList,
  TrackingPenawaranStatusCounts,
  TrackingPenawaranListItem,
} from '../../services/trackingPenawaranApi';
import {
  getTrackingSpkStatusCounts,
  getTrackingSpkList,
  TrackingSpkStatusCounts,
  TrackingSpkListItem,
} from '../../services/trackingSpkApi';

type Role = 'SALES' | 'MANAGER' | 'KURIR';
type MenuItem = {
  title: string;
  route: string;
  roles?: Role[];
  icon?: string;
};

type RekapItem = {
  id: number;
  tanggal_plan: string;
  cus_kode: string;
  cc_nama: string;
  cc_alamat: string;
  note: string;
  label_status: string;
  realisasi?: 'Y' | 'N' | string | null;
  tanggal?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  foto?: string | null;
  foto_url?: string | null;
  sales_name?: string;
};

type UserAggRow = {
  kode: string;
  nama: string;
  jabatan: string;
  target: number;
  realisasi: number;
  ach: number;
};

const menus: MenuItem[] = [
  {
    title: 'Customer',
    route: 'RekapCalonCustomer',
    roles: ['SALES', 'MANAGER'],
    icon: 'people',
  },
  {
    title: 'Visit Plan',
    route: 'VisitPlan',
    roles: ['SALES', 'MANAGER'],
    icon: 'calendar-today',
  },
  {
    title: 'Visit',
    route: 'Visit',
    roles: ['SALES', 'MANAGER'],
    icon: 'place',
  },
  {
    title: 'Achievement',
    route: 'Achievement',
    roles: ['SALES', 'MANAGER'],
    icon: 'stars',
  },
  {
    title: 'Permintaan Harga',
    route: 'PermintaanHargaList',
    roles: ['SALES', 'MANAGER'],
    icon: 'monetization-on',
  },
  {
    title: 'Penawaran',
    route: 'PenawaranList',
    roles: ['SALES', 'MANAGER'],
    icon: 'receipt',
  },
  {
    title: 'Tracking Penawaran',
    route: 'TrackingPenawaran',
    roles: ['SALES', 'MANAGER'],
    icon: 'push-pin',
  },
  {
    title: 'Tracking MAP',
    route: 'TrackingMap',
    roles: ['SALES', 'MANAGER'],
    icon: 'map',
  },
  {
    title: 'Tracking SPK',
    route: 'TrackingSPK',
    roles: ['SALES', 'MANAGER'],
    icon: 'assignment',
  },
  {
    title: 'Pengiriman Kurir',
    route: 'KurirMenu',
    roles: ['KURIR'],
    icon: 'local-shipping',
  },
  {
    title: 'Ganti Password',
    route: 'GantiPassword',
    roles: ['SALES', 'MANAGER', 'KURIR'],
    icon: 'vpn-key',
  },
];

const MONTHS_NAME = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Ags',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

const formatDateToDmY = (dateStr?: string | null) => {
  if (!dateStr) return '-';
  try {
    const cleanStr = String(dateStr).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
      const [y, m, d] = cleanStr.split('-');
      return `${d}-${m}-${y}`;
    }
    const datePart = cleanStr.split('T')[0] || cleanStr.split(' ')[0] || '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      const [y, m, d] = datePart.split('-');
      return `${d}-${m}-${y}`;
    }
    const dt = new Date(cleanStr);
    if (!isNaN(dt.getTime())) {
      const d = String(dt.getDate()).padStart(2, '0');
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const y = dt.getFullYear();
      return `${d}-${m}-${y}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
};

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 11) return 'Selamat Pagi';
  if (hour < 15) return 'Selamat Siang';
  if (hour < 18) return 'Selamat Sore';
  return 'Selamat Malam';
};

const isSameDay = (d1: Date, d2: Date) => {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

const formatDateLong = (date: Date): string => {
  const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const MONTHS = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];
  return `${DAYS[date.getDay()]}, ${date.getDate()} ${
    MONTHS[date.getMonth()]
  } ${date.getFullYear()}`;
};

export default function HomeScreen({ navigation }: any) {
  const { user, logout, token } = useAuth();
  const runGuardedPress = usePressGuard();
  const [showAllVisits, setShowAllVisits] = useState(false);
  const isManager = String(user?.jabatan || '').toUpperCase() === 'MANAGER';

  const today = useMemo(() => new Date(), []);
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  }, []);
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }, []);

  const handleCardPress = useCallback(
    (item: RekapItem) => {
      const isSudah =
        String(item.realisasi || '').toUpperCase() === 'Y' ||
        String(item.label_status || '').toLowerCase() === 'sudah';

      navigation.navigate(isSudah ? 'EditVisit' : 'EditVisitPlan', {
        data: item,
      });
    },
    [navigation],
  );

  const [phMonth, setPhMonth] = useState(new Date().getMonth() + 1);
  const [phYear, setPhYear] = useState(new Date().getFullYear());

  const [penawaranMonth, setPenawaranMonth] = useState(
    new Date().getMonth() + 1,
  );
  const [penawaranYear, setPenawaranYear] = useState(new Date().getFullYear());

  const [spkMonth, setSpkMonth] = useState(new Date().getMonth() + 1);
  const [spkYear, setSpkYear] = useState(new Date().getFullYear());

  const [pickerTarget, setPickerTarget] = useState<
    'PH' | 'PENAWARAN' | 'SPK' | null
  >(null);
  const [tempMonth, setTempMonth] = useState(new Date().getMonth() + 1);
  const [tempYear, setTempYear] = useState(new Date().getFullYear());
  const [isMonthYearPickerVisible, setIsMonthYearPickerVisible] =
    useState(false);

  const getRangeForMonthYear = (month: number, year: number) => {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const toYmd = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };
    return { startDate: toYmd(start), endDate: toYmd(end) };
  };

  const [loadingPh, setLoadingPh] = useState(false);
  const [loadingPenawaran, setLoadingPenawaran] = useState(false);
  const [loadingSpk, setLoadingSpk] = useState(false);

  const reloadPhData = async (month: number, year: number) => {
    if (!token) return;
    setLoadingPh(true);
    try {
      const range = getRangeForMonthYear(month, year);
      const [counts, list] = await Promise.all([
        getPermintaanHargaStatusCounts(range, token),
        getPermintaanHargaList({ ...range, limit: 10 }, token),
      ]);
      setPhStatusCounts(counts);
      setRecentPh((list || []).slice(0, 3));
    } catch (err: any) {
      console.log('[HomeScreen] Failed to reload PH data:', err);
      if (err?.response?.status === 401) {
        logout();
      }
    } finally {
      setLoadingPh(false);
    }
  };

  const reloadPenawaranData = async (month: number, year: number) => {
    if (!token) return;
    setLoadingPenawaran(true);
    try {
      const range = getRangeForMonthYear(month, year);
      const [counts, list] = await Promise.all([
        getTrackingPenawaranStatusCounts(range, token),
        getTrackingPenawaranList({ ...range, limit: 10 }, token),
      ]);
      setPenawaranStatusCounts(counts);
      setRecentPenawaran((list?.items || []).slice(0, 3));
    } catch (err: any) {
      console.log('[HomeScreen] Failed to reload Penawaran data:', err);
      if (err?.response?.status === 401) {
        logout();
      }
    } finally {
      setLoadingPenawaran(false);
    }
  };

  const reloadSpkData = async (month: number, year: number) => {
    if (!token) return;
    setLoadingSpk(true);
    try {
      const range = getRangeForMonthYear(month, year);
      const [counts, list] = await Promise.all([
        getTrackingSpkStatusCounts(range, token),
        getTrackingSpkList({ ...range, limit: 10 }, token),
      ]);
      setSpkStatusCounts(counts);
      setRecentSpk((list || []).slice(0, 3));
    } catch (err: any) {
      console.log('[HomeScreen] Failed to reload SPK data:', err);
      if (err?.response?.status === 401) {
        logout();
      }
    } finally {
      setLoadingSpk(false);
    }
  };

  const openMonthYearPicker = (target: 'PH' | 'PENAWARAN' | 'SPK') => {
    setPickerTarget(target);
    if (target === 'PH') {
      setTempMonth(phMonth);
      setTempYear(phYear);
    } else if (target === 'PENAWARAN') {
      setTempMonth(penawaranMonth);
      setTempYear(penawaranYear);
    } else {
      setTempMonth(spkMonth);
      setTempYear(spkYear);
    }
    setIsMonthYearPickerVisible(true);
  };

  const applyMonthYearPicker = async () => {
    setIsMonthYearPickerVisible(false);
    if (!pickerTarget) return;

    if (pickerTarget === 'PH') {
      setPhMonth(tempMonth);
      setPhYear(tempYear);
      await reloadPhData(tempMonth, tempYear);
    } else if (pickerTarget === 'PENAWARAN') {
      setPenawaranMonth(tempMonth);
      setPenawaranYear(tempYear);
      await reloadPenawaranData(tempMonth, tempYear);
    } else if (pickerTarget === 'SPK') {
      setSpkMonth(tempMonth);
      setSpkYear(tempYear);
      await reloadSpkData(tempMonth, tempYear);
    }
    setPickerTarget(null);
  };

  const [isModalVisible, setModalVisible] = useState(false);
  const [phStatusCounts, setPhStatusCounts] =
    useState<PermintaanHargaStatusCounts>({
      BELUM: 0,
      MINTA: 0,
      WAIT: 0,
      DONE: 0,
      CANCEL: 0,
    });
  const [penawaranStatusCounts, setPenawaranStatusCounts] =
    useState<TrackingPenawaranStatusCounts>({
      OPEN: 0,
      PARSIAL: 0,
      CLOSE: 0,
    });
  const [spkStatusCounts, setSpkStatusCounts] =
    useState<TrackingSpkStatusCounts>({
      BELUM: 0,
      PROSES: 0,
      SUDAH: 0,
    });
  const [isStatusModalVisible, setStatusModalVisible] = useState(false);
  const [visitPlans, setVisitPlans] = useState<RekapItem[]>([]);
  const [selectedVisitPlanDate, setSelectedVisitPlanDate] = useState<Date>(
    new Date(),
  );
  const [showVpDatePicker, setShowVpDatePicker] = useState(false);
  const [loadingVisitPlan, setLoadingVisitPlan] = useState(false);
  const [selectedSalesFilter, setSelectedSalesFilter] = useState('ALL');
  const [isSalesPickerVisible, setIsSalesPickerVisible] = useState(false);

  const availableSales = useMemo(() => {
    const salesSet = new Set<string>();
    visitPlans.forEach(vp => {
      if (vp.sales_name) {
        salesSet.add(vp.sales_name);
      }
    });
    return Array.from(salesSet).sort();
  }, [visitPlans]);

  const filteredVisitPlans = useMemo(() => {
    if (!isManager || selectedSalesFilter === 'ALL') return visitPlans;
    return visitPlans.filter(
      vp =>
        String(vp.sales_name || '').toLowerCase() ===
        selectedSalesFilter.toLowerCase(),
    );
  }, [visitPlans, selectedSalesFilter, isManager]);

  const fetchVisitPlans = useCallback(
    async (date: Date) => {
      if (!token) return;
      setLoadingVisitPlan(true);
      try {
        const ymd = (() => {
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const dd = String(date.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        })();
        const res = await api.get('/rekap-visit-plan', {
          params: {
            user: user?.nama || '',
            cabang: user?.cabang || 'PUSAT',
            tanggal_awal: ymd,
            tanggal_akhir: ymd,
            is_manager:
              String(user?.jabatan || '').toUpperCase() === 'MANAGER'
                ? 'true'
                : 'false',
          },
        });
        setVisitPlans(res.data?.data || []);
      } catch (err) {
        console.log('[HomeScreen] Failed to fetch visit plans:', err);
      } finally {
        setLoadingVisitPlan(false);
      }
    },
    [token, user?.nama, user?.cabang, user?.jabatan],
  );

  useEffect(() => {
    fetchVisitPlans(selectedVisitPlanDate);
  }, [selectedVisitPlanDate, fetchVisitPlans]);

  const [myAchievement, setMyAchievement] = useState<UserAggRow | null>(null);
  const [recentPh, setRecentPh] = useState<PermintaanHargaItem[]>([]);
  const [recentPenawaran, setRecentPenawaran] = useState<
    TrackingPenawaranListItem[]
  >([]);

  const [recentSpk, setRecentSpk] = useState<TrackingSpkListItem[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState(false);

  const skeletonPulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (loadingDashboard) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(skeletonPulse, {
            toValue: 1.0,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(skeletonPulse, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      anim.start();
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [loadingDashboard, skeletonPulse]);

  const lastBackPressRef = useRef<number>(0);
  const toggleModal = () => {
    setModalVisible(v => !v);
  };

  const totalActivePH =
    phStatusCounts.BELUM + phStatusCounts.MINTA + phStatusCounts.WAIT;
  const totalActivePenawaran =
    penawaranStatusCounts.OPEN + penawaranStatusCounts.PARSIAL;
  const totalActiveSpk = spkStatusCounts.BELUM + spkStatusCounts.PROSES;
  const grandTotalNotifications =
    totalActivePH + totalActivePenawaran + totalActiveSpk;

  const fetchDashboardData = useCallback(async () => {
    if (!token) return;
    setLoadingDashboard(true);
    setDashboardError(false);
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const todayYmd = `${yyyy}-${mm}-${dd}`;

      const phRange = getRangeForMonthYear(phMonth, phYear);
      const penawaranRange = getRangeForMonthYear(
        penawaranMonth,
        penawaranYear,
      );
      const spkRange = getRangeForMonthYear(spkMonth, spkYear);

      // Fetch visit plan secara independen
      fetchVisitPlans(selectedVisitPlanDate);

      const [
        phCounts,
        penawaranCounts,
        spkCounts,
        achievementRes,
        phListRes,
        penawaranListRes,
        spkListRes,
      ] = await Promise.all([
        getPermintaanHargaStatusCounts(phRange, token),
        getTrackingPenawaranStatusCounts(penawaranRange, token),
        getTrackingSpkStatusCounts(spkRange, token),
        api
          .get('/achievement/omset/range', {
            params: {
              fromYear: currentYear,
              fromMonth: currentMonth,
              toYear: currentYear,
              toMonth: currentMonth,
            },
            headers: { Authorization: `Bearer ${token}` },
          })
          .catch(err => {
            console.log(
              '[HomeScreen] Achievement API failed (non-critical):',
              err?.response?.data || err?.message,
            );
            return { data: { success: false, data: [] } } as any;
          }),
        getPermintaanHargaList({ ...phRange, limit: 10 }, token),
        getTrackingPenawaranList({ ...penawaranRange, limit: 10 }, token),
        getTrackingSpkList({ ...spkRange, limit: 10 }, token),
      ]);

      setPhStatusCounts(phCounts);
      setPenawaranStatusCounts(penawaranCounts);
      setSpkStatusCounts(spkCounts);

      const rows: UserAggRow[] = achievementRes.data?.data || [];

      if (isManager) {
        const totalTarget = rows.reduce(
          (acc, r) => acc + Number(r.target || 0),
          0,
        );
        const totalReal = rows.reduce(
          (acc, r) => acc + Number(r.realisasi || 0),
          0,
        );
        const clampLocal = (v: number, min: number, max: number) =>
          Math.max(min, Math.min(max, v));
        const ach = !totalTarget
          ? 0
          : clampLocal((totalReal / totalTarget) * 100, 0, 500);

        setMyAchievement({
          kode: 'ALL',
          nama: 'Rekap Semua User',
          jabatan: 'MANAGER',
          target: totalTarget,
          realisasi: totalReal,
          ach,
        });
      } else {
        const myRow =
          rows.find(
            r =>
              String(r.nama).toLowerCase() ===
              String(user?.nama || '').toLowerCase(),
          ) ||
          rows[0] ||
          null;

        if (myRow) {
          const clampLocal = (v: number, min: number, max: number) =>
            Math.max(min, Math.min(max, v));
          const ach = !myRow.target
            ? 0
            : clampLocal((myRow.realisasi / myRow.target) * 100, 0, 500);

          setMyAchievement({
            ...myRow,
            ach,
          });
        } else {
          setMyAchievement(null);
        }
      }

      setRecentPh((phListRes || []).slice(0, 3));
      setRecentPenawaran((penawaranListRes?.items || []).slice(0, 3));
      setRecentSpk((spkListRes || []).slice(0, 3));
    } catch (err: any) {
      console.log('[HomeScreen] Failed to fetch dashboard data:', err);
      if (err?.response?.status === 401) {
        logout();
      } else {
        setDashboardError(true);
      }
    } finally {
      setLoadingDashboard(false);
    }
  }, [
    token,
    phMonth,
    phYear,
    penawaranMonth,
    penawaranYear,
    spkMonth,
    spkYear,
    user?.nama,
    user?.cabang,
    user?.jabatan,
    isManager,
    logout,
    selectedVisitPlanDate,
    fetchVisitPlans,
  ]);

  useFocusEffect(
    useCallback(() => {
      // Auto-redirect KURIR to KurirMenu
      if (user?.jabatan === 'KURIR') {
        navigation.reset({
          index: 0,
          routes: [{ name: 'KurirMenu' }],
        });
        return;
      }

      fetchDashboardData();

      const onBackPress = () => {
        const now = Date.now();
        const isDoublePress = now - lastBackPressRef.current < 2000;

        if (isDoublePress) {
          BackHandler.exitApp();
          return true;
        }

        lastBackPressRef.current = now;
        if (Platform.OS === 'android') {
          ToastAndroid.show(
            'Tekan sekali lagi untuk keluar aplikasi',
            ToastAndroid.SHORT,
          );
        }

        return true;
      };

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );

      return () => {
        subscription.remove();
      };
    }, [user?.jabatan, navigation, fetchDashboardData]),
  );

  const handleNavigate = (route: string, params?: any) => {
    runGuardedPress(`home:navigate:${route}`, () => {
      try {
        navigation.navigate(route, params);
      } catch {
        console.log('Menu belum tersedia:', route);
      }
    });
  };

  const availableMenus = useMemo(() => {
    return menus.filter(
      m => !m.roles || m.roles.includes(user?.jabatan as Role),
    );
  }, [user?.jabatan]);

  const menuGroups = useMemo(() => {
    const groups = [
      { title: 'AKTIVITAS HARIAN', items: [] as MenuItem[] },
      { title: 'DOKUMEN & PENJUALAN', items: [] as MenuItem[] },
      { title: 'PELACAKAN & LAINNYA', items: [] as MenuItem[] },
      { title: 'PENGATURAN', items: [] as MenuItem[] },
    ];

    availableMenus.forEach(item => {
      if (
        ['Customer', 'Visit Plan', 'Visit', 'Achievement'].includes(item.title)
      ) {
        groups[0].items.push(item);
      } else if (['Permintaan Harga', 'Penawaran'].includes(item.title)) {
        groups[1].items.push(item);
      } else if (item.title === 'Ganti Password') {
        groups[3].items.push(item);
      } else {
        groups[2].items.push(item);
      }
    });

    return groups.filter(g => g.items.length > 0);
  }, [availableMenus]);

  const initials = useMemo(() => {
    const name = (user?.nama || '').trim();
    if (!name) return 'U';
    const parts = name.split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]?.toUpperCase()).join('') || 'U';
  }, [user?.nama]);

  const [isSidebarVisible, setSidebarVisible] = useState(false);

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

      <SafeAreaView style={styles.safe}>
        {/* HEADER */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => setSidebarVisible(true)}
            activeOpacity={0.7}
            style={styles.headerMenuButton}
          >
            <Svg width={24} height={24} viewBox="0 0 24 24">
              <Defs>
                <SvgGradient id="menuGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#4F46E5" />
                  <Stop offset="100%" stopColor="#06B6D4" />
                </SvgGradient>
              </Defs>
              <Path
                d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"
                fill="url(#menuGrad)"
              />
            </Svg>
          </TouchableOpacity>

          <Svg width={140} height={35} viewBox="0 0 140 35">
            <Defs>
              <SvgGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#4F46E5" stopOpacity={1} />
                <Stop offset="100%" stopColor="#06B6D4" stopOpacity={1} />
              </SvgGradient>
            </Defs>
            <SvgText
              fill="url(#brandGrad)"
              fontSize="24"
              fontWeight="900"
              letterSpacing="0.5"
              x="10"
              y="26"
            >
              PlanToday
            </SvgText>
          </Svg>

          <TouchableOpacity
            style={styles.headerBellButton}
            onPress={() => setStatusModalVisible(true)}
            activeOpacity={0.7}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Defs>
                <SvgGradient id="bellGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#4F46E5" />
                  <Stop offset="100%" stopColor="#06B6D4" />
                </SvgGradient>
              </Defs>
              <Path
                d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16l-2-2v-1z"
                fill="url(#bellGrad)"
              />
            </Svg>
            {grandTotalNotifications > 0 && (
              <View style={styles.headerBellBadge}>
                <Text style={styles.headerBellBadgeText}>
                  {grandTotalNotifications}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* DASHBOARD CONTAINER */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.dashboardContainer}
        >
          {/* Welcome Card */}
          <LinearGradient
            colors={['#FFFFFF', '#F1F5F9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.welcomeCard}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: THEME.muted,
                  }}
                >
                  {getGreeting()},
                </Text>
                <Text style={styles.welcomeGreeting}>
                  {(user?.nama || 'Sales').toUpperCase()}
                </Text>
                {user?.jabatan || user?.cabang ? (
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: THEME.muted,
                      marginTop: 2,
                    }}
                  >
                    {user?.jabatan || ''}
                    {user?.cabang ? ` · ${user.cabang}` : ''}
                  </Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 3, marginLeft: 8 }}>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '800',
                    color: THEME.primary,
                    textAlign: 'right',
                    maxWidth: 110,
                  }}
                >
                  {formatDateLong(new Date())}
                </Text>
              </View>
            </View>
          </LinearGradient>

          {/* Banner Error */}
          {dashboardError && (
            <View style={styles.errorCard}>
              <MaterialIcons name="cloud-off" size={26} color="#991B1B" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.errorCardTitle}>Gagal Memuat Data</Text>
                <Text style={styles.errorCardSubtitle}>
                  Koneksi internet bermasalah atau server tidak merespons.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.btnErrorRetry}
                onPress={fetchDashboardData}
                activeOpacity={0.8}
              >
                <Text style={styles.btnErrorRetryText}>COBA LAGI</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* QUICK STATS STRIP */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.quickStatChip}
              onPress={() => handleNavigate('PermintaanHargaList')}
              activeOpacity={0.75}
            >
              <Text style={[styles.quickStatNumber, { color: '#EF4444' }]}>
                {totalActivePH}
              </Text>
              <Text style={styles.quickStatLabel}>PH Pending</Text>
              <View
                style={[styles.quickStatAccent, { backgroundColor: '#EF4444' }]}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickStatChip}
              onPress={() => handleNavigate('TrackingPenawaran')}
              activeOpacity={0.75}
            >
              <Text style={[styles.quickStatNumber, { color: '#3B82F6' }]}>
                {totalActivePenawaran}
              </Text>
              <Text style={styles.quickStatLabel}>Penawaran Open</Text>
              <View
                style={[styles.quickStatAccent, { backgroundColor: '#3B82F6' }]}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickStatChip}
              onPress={() => handleNavigate('TrackingSPK')}
              activeOpacity={0.75}
            >
              <Text style={[styles.quickStatNumber, { color: '#10B981' }]}>
                {totalActiveSpk}
              </Text>
              <Text style={styles.quickStatLabel}>SPK Open</Text>
              <View
                style={[styles.quickStatAccent, { backgroundColor: '#10B981' }]}
              />
            </TouchableOpacity>
          </View>

          {loadingDashboard ? (
            // SKELETON LOADING
            <View style={{ gap: 16 }}>
              {/* Skeleton Visit Plan */}
              <Animated.View
                style={[styles.skeletonCard, { opacity: skeletonPulse }]}
              >
                <View
                  style={[
                    styles.skeletonBar,
                    { width: 140, height: 18, marginBottom: 12 },
                  ]}
                />
                <View
                  style={[
                    styles.skeletonBar,
                    { width: '90%', height: 14, marginBottom: 8 },
                  ]}
                />
                <View
                  style={[styles.skeletonBar, { width: '60%', height: 14 }]}
                />
              </Animated.View>

              {/* Skeleton Achievement */}
              <Animated.View
                style={[styles.skeletonCard, { opacity: skeletonPulse }]}
              >
                <View
                  style={[
                    styles.skeletonBar,
                    { width: 120, height: 18, marginBottom: 12 },
                  ]}
                />
                <View
                  style={{ flexDirection: 'row', gap: 16, marginBottom: 12 }}
                >
                  <View style={{ flex: 1 }}>
                    <View
                      style={[
                        styles.skeletonBar,
                        { width: 80, height: 12, marginBottom: 6 },
                      ]}
                    />
                    <View
                      style={[styles.skeletonBar, { width: 100, height: 16 }]}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View
                      style={[
                        styles.skeletonBar,
                        { width: 80, height: 12, marginBottom: 6 },
                      ]}
                    />
                    <View
                      style={[styles.skeletonBar, { width: 100, height: 16 }]}
                    />
                  </View>
                </View>
                <View
                  style={[
                    styles.skeletonBar,
                    { width: '100%', height: 10, borderRadius: 5 },
                  ]}
                />
              </Animated.View>

              {/* Skeleton List */}
              <Animated.View
                style={[styles.skeletonCard, { opacity: skeletonPulse }]}
              >
                <View
                  style={[
                    styles.skeletonBar,
                    { width: 150, height: 16, marginBottom: 12 },
                  ]}
                />
                <View
                  style={[
                    styles.skeletonBar,
                    { width: '100%', height: 40, marginBottom: 8 },
                  ]}
                />
                <View
                  style={[styles.skeletonBar, { width: '100%', height: 40 }]}
                />
              </Animated.View>
            </View>
          ) : (
            // REAL DASHBOARD DATA
            <>
              {/* WIDGET VISIT PLAN */}
              <View style={styles.cardContainer}>
                <View style={styles.cardHeaderRow}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      flex: 1,
                    }}
                  >
                    <MaterialIcons
                      name="calendar-today"
                      size={20}
                      color={THEME.primary}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.cardHeaderTitle} numberOfLines={1}>
                      Visit Plan
                      {filteredVisitPlans.length > 0
                        ? (() => {
                            const doneCount = filteredVisitPlans.filter(
                              vp =>
                                String(vp.realisasi || '').toUpperCase() ===
                                  'Y' ||
                                String(vp.label_status || '').toLowerCase() ===
                                  'sudah',
                            ).length;
                            return ` (${doneCount}/${filteredVisitPlans.length})`;
                          })()
                        : ''}
                    </Text>
                  </View>
                  {isManager ? (
                    availableSales.length > 0 && (
                      <TouchableOpacity
                        style={styles.vpFilterDropdownHeader}
                        onPress={() => setIsSalesPickerVisible(true)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={styles.vpFilterDropdownHeaderText}
                          numberOfLines={1}
                        >
                          {selectedSalesFilter === 'ALL'
                            ? 'Semua Sales'
                            : selectedSalesFilter}
                        </Text>
                        <MaterialIcons
                          name="arrow-drop-down"
                          size={16}
                          color={THEME.primary}
                        />
                      </TouchableOpacity>
                    )
                  ) : (
                    <TouchableOpacity
                      style={styles.cardHeaderAction}
                      onPress={() => handleNavigate('TambahVisitPlan')}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons
                        name="add-circle-outline"
                        size={18}
                        color={THEME.primary}
                      />
                      <Text style={styles.cardHeaderActionText}>Buat Plan</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* STEPPER TANGGAL */}
                <View style={styles.vpStepperContainer}>
                  <TouchableOpacity
                    style={styles.vpStepperButton}
                    onPress={() => {
                      setSelectedVisitPlanDate(prev => {
                        const next = new Date(prev);
                        next.setDate(next.getDate() - 1);
                        return next;
                      });
                    }}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons
                      name="chevron-left"
                      size={24}
                      color={THEME.primary}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.vpStepperInfo}
                    onPress={() => setShowVpDatePicker(true)}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons
                      name="calendar-today"
                      size={14}
                      color={THEME.primary}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.vpStepperText}>
                      {formatDateLong(selectedVisitPlanDate)}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.vpStepperButton}
                    onPress={() => {
                      setSelectedVisitPlanDate(prev => {
                        const next = new Date(prev);
                        next.setDate(next.getDate() + 1);
                        return next;
                      });
                    }}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons
                      name="chevron-right"
                      size={24}
                      color={THEME.primary}
                    />
                  </TouchableOpacity>
                </View>

                {showVpDatePicker && (
                  <DateTimePicker
                    value={selectedVisitPlanDate}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowVpDatePicker(false);
                      if (date) {
                        setSelectedVisitPlanDate(date);
                      }
                    }}
                  />
                )}

                {/* MODAL PICKER SALES */}
                {isManager && (
                  <Modal
                    isVisible={isSalesPickerVisible}
                    onBackdropPress={() => setIsSalesPickerVisible(false)}
                    backdropOpacity={0.4}
                    animationIn="slideInUp"
                    animationOut="slideOutDown"
                    style={{ justifyContent: 'flex-end', margin: 0 }}
                  >
                    <View style={styles.salesPickerCard}>
                      <View style={styles.salesPickerHeader}>
                        <Text style={styles.salesPickerTitle}>Pilih Sales</Text>
                        <TouchableOpacity
                          onPress={() => setIsSalesPickerVisible(false)}
                        >
                          <MaterialIcons
                            name="close"
                            size={22}
                            color={THEME.muted}
                          />
                        </TouchableOpacity>
                      </View>
                      <ScrollView
                        style={{ maxHeight: 300 }}
                        showsVerticalScrollIndicator={false}
                      >
                        <TouchableOpacity
                          style={[
                            styles.salesPickerOption,
                            selectedSalesFilter === 'ALL' &&
                              styles.salesPickerOptionActive,
                          ]}
                          onPress={() => {
                            setSelectedSalesFilter('ALL');
                            setIsSalesPickerVisible(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.salesPickerOptionText,
                              selectedSalesFilter === 'ALL' &&
                                styles.salesPickerOptionTextActive,
                            ]}
                          >
                            Semua Sales
                          </Text>
                          {selectedSalesFilter === 'ALL' && (
                            <MaterialIcons
                              name="check"
                              size={18}
                              color="#FFF"
                            />
                          )}
                        </TouchableOpacity>

                        {availableSales.map((salesName, index) => {
                          const isActive = selectedSalesFilter === salesName;
                          return (
                            <TouchableOpacity
                              key={index}
                              style={[
                                styles.salesPickerOption,
                                isActive && styles.salesPickerOptionActive,
                              ]}
                              onPress={() => {
                                setSelectedSalesFilter(salesName);
                                setIsSalesPickerVisible(false);
                              }}
                            >
                              <Text
                                style={[
                                  styles.salesPickerOptionText,
                                  isActive &&
                                    styles.salesPickerOptionTextActive,
                                ]}
                              >
                                {salesName}
                              </Text>
                              {isActive && (
                                <MaterialIcons
                                  name="check"
                                  size={18}
                                  color="#FFF"
                                />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </Modal>
                )}

                {loadingVisitPlan ? (
                  <Animated.View
                    style={{ opacity: skeletonPulse, gap: 10, marginTop: 12 }}
                  >
                    <View
                      style={[
                        styles.skeletonBar,
                        { width: '100%', height: 40, borderRadius: 8 },
                      ]}
                    />
                    <View
                      style={[
                        styles.skeletonBar,
                        { width: '100%', height: 40, borderRadius: 8 },
                      ]}
                    />
                  </Animated.View>
                ) : visitPlans.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      Tidak ada jadwal visit plan untuk tanggal ini.
                    </Text>
                    {!isManager && (
                      <TouchableOpacity
                        style={styles.btnActionSecondary}
                        onPress={() => handleNavigate('TambahVisitPlan')}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.btnActionSecondaryText}>
                          Jadwalkan Kunjungan
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : filteredVisitPlans.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      Tidak ada jadwal visit plan untuk sales ini pada tanggal
                      terpilih.
                    </Text>
                  </View>
                ) : (
                  (() => {
                    const displayedVisits =
                      isManager && !showAllVisits
                        ? filteredVisitPlans.slice(0, 2)
                        : filteredVisitPlans;
                    return (
                      <View style={{ gap: 10, marginTop: 4 }}>
                        {displayedVisits.map((item, idx) => {
                          const isSudah =
                            String(item.realisasi || '').toUpperCase() ===
                              'Y' ||
                            String(item.label_status || '').toLowerCase() ===
                              'sudah';
                          return (
                            <TouchableOpacity
                              key={`${item.id}-${idx}`}
                              style={styles.itemRowCard}
                              onPress={() => handleCardPress(item)}
                              activeOpacity={0.9}
                            >
                              <View style={{ flex: 1, gap: 4 }}>
                                <Text
                                  style={styles.itemRowTitle}
                                  numberOfLines={1}
                                >
                                  {item.cc_nama || '-'}
                                </Text>

                                {item.sales_name ? (
                                  <View
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 4,
                                      marginTop: 1,
                                    }}
                                  >
                                    <MaterialIcons
                                      name="person"
                                      size={12}
                                      color={THEME.primary}
                                    />
                                    <Text
                                      style={{
                                        fontSize: 10.5,
                                        fontWeight: '800',
                                        color: THEME.primary,
                                      }}
                                    >
                                      Sales: {item.sales_name}
                                    </Text>
                                  </View>
                                ) : null}

                                <Text
                                  style={styles.itemRowSubtitle}
                                  numberOfLines={1}
                                >
                                  {item.cc_alamat || '-'}
                                </Text>
                                {item.note ? (
                                  <Text
                                    style={styles.itemRowNote}
                                    numberOfLines={2}
                                  >
                                    {item.note}
                                  </Text>
                                ) : null}
                              </View>
                              {isSudah ? (
                                <View
                                  style={[
                                    styles.statusBadgeRow,
                                    { backgroundColor: 'rgba(16,185,129,0.1)' },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.statusBadgeRowText,
                                      { color: '#10B981' },
                                    ]}
                                  >
                                    SELESAI
                                  </Text>
                                </View>
                              ) : isManager ? (
                                <View
                                  style={[
                                    styles.statusBadgeRow,
                                    {
                                      backgroundColor: 'rgba(107,114,128,0.1)',
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.statusBadgeRowText,
                                      { color: '#6B7280' },
                                    ]}
                                  >
                                    BELUM
                                  </Text>
                                </View>
                              ) : (
                                <TouchableOpacity
                                  style={styles.btnRowVisit}
                                  onPress={() => {
                                    navigation.navigate('TambahVisit', {
                                      selectedCustomer: {
                                        kode: item.cus_kode,
                                        nama: item.cc_nama,
                                        tanggal: String(
                                          item.tanggal_plan || '',
                                        ).slice(0, 10),
                                      },
                                    });
                                  }}
                                  activeOpacity={0.8}
                                >
                                  <Text style={styles.btnRowVisitText}>
                                    Visit
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </TouchableOpacity>
                          );
                        })}

                        {isManager && filteredVisitPlans.length > 2 && (
                          <TouchableOpacity
                            onPress={() => setShowAllVisits(prev => !prev)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              paddingVertical: 10,
                              marginTop: 4,
                              gap: 4,
                              backgroundColor: '#F8FAFC',
                              borderRadius: 10,
                              borderStyle: 'dashed',
                              borderWidth: 1,
                              borderColor: 'rgba(79,70,229,0.3)',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: '800',
                                color: THEME.primary,
                              }}
                            >
                              {showAllVisits
                                ? 'Sembunyikan Rencana Kunjungan'
                                : `Tampilkan ${
                                    filteredVisitPlans.length - 2
                                  } Rencana Lainnya`}
                            </Text>
                            <MaterialIcons
                              name={
                                showAllVisits
                                  ? 'keyboard-arrow-up'
                                  : 'keyboard-arrow-down'
                              }
                              size={16}
                              color={THEME.primary}
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })()
                )}
              </View>

              {/* WIDGET ACHIEVEMENT */}
              <View style={styles.cardContainer}>
                <View style={styles.cardHeaderRow}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <MaterialIcons
                      name="stars"
                      size={20}
                      color={THEME.primary}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.cardHeaderTitle}>
                      Achievement Bulan Ini
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.cardHeaderAction}
                    onPress={() => handleNavigate('Achievement')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cardHeaderActionText}>Detail</Text>
                    <MaterialIcons
                      name="chevron-right"
                      size={16}
                      color={THEME.primary}
                    />
                  </TouchableOpacity>
                </View>

                {!myAchievement ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      Data pencapaian belum tersedia.
                    </Text>
                  </View>
                ) : (
                  <View style={{ marginTop: 6, gap: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                      <View
                        style={{
                          flex: 1,
                          backgroundColor: '#F8FAFC',
                          padding: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: THEME.line,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '800',
                            color: THEME.muted,
                          }}
                        >
                          Target Bulan Ini
                        </Text>
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: '900',
                            color: THEME.ink,
                            marginTop: 4,
                          }}
                        >
                          Rp{' '}
                          {myAchievement.target
                            ? Number(myAchievement.target).toLocaleString(
                                'id-ID',
                              )
                            : '0'}
                        </Text>
                      </View>
                      <View
                        style={{
                          flex: 1,
                          backgroundColor: '#F8FAFC',
                          padding: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: THEME.line,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '800',
                            color: THEME.muted,
                          }}
                        >
                          Realisasi Bulan Ini
                        </Text>
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: '900',
                            color: '#10B981',
                            marginTop: 4,
                          }}
                        >
                          Rp{' '}
                          {myAchievement.realisasi
                            ? Number(myAchievement.realisasi).toLocaleString(
                                'id-ID',
                              )
                            : '0'}
                        </Text>
                      </View>
                    </View>

                    <View style={{ gap: 4 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        {(() => {
                          const achReal = Number(myAchievement.ach || 0);
                          const barWidth = Math.min(achReal, 100);
                          const achColor =
                            achReal >= 80
                              ? '#10B981'
                              : achReal >= 50
                              ? '#F59E0B'
                              : '#EF4444';
                          return (
                            <>
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: '900',
                                  color: achColor,
                                }}
                              >
                                {achReal.toFixed(1)}%
                              </Text>
                              <View
                                style={{
                                  height: 10,
                                  backgroundColor: '#E2E8F0',
                                  borderRadius: 99,
                                  overflow: 'hidden',
                                  flex: 1,
                                  marginLeft: 10,
                                }}
                              >
                                <View
                                  style={{
                                    height: '100%',
                                    width: `${barWidth}%`,
                                    backgroundColor: achColor,
                                    borderRadius: 99,
                                  }}
                                />
                              </View>
                            </>
                          );
                        })()}
                      </View>
                    </View>
                  </View>
                )}
              </View>

              {/* 1. PERMINTAAN HARGA */}
              <View
                style={[
                  styles.cardContainer,
                  { borderLeftWidth: 4, borderLeftColor: '#EF4444' },
                ]}
              >
                <View style={styles.cardHeaderRow}>
                  <View style={{ gap: 2, flex: 1 }}>
                    <Text style={styles.cardHeaderTitle}>
                      Permintaan Harga Terbaru
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        marginTop: 2,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '700',
                          color: THEME.muted,
                        }}
                      >
                        Periode:
                      </Text>
                      <TouchableOpacity
                        style={styles.periodPickerBtn}
                        onPress={() => openMonthYearPicker('PH')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.periodPickerText}>
                          {MONTHS_NAME[phMonth - 1]} {phYear}
                        </Text>
                        <MaterialIcons
                          name="arrow-drop-down"
                          size={14}
                          color={THEME.primary}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.cardHeaderAction}
                    onPress={() =>
                      handleNavigate('PermintaanHargaList', {
                        month: phMonth,
                        year: phYear,
                      })
                    }
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cardHeaderActionText}>Lihat Semua</Text>
                    <MaterialIcons
                      name="chevron-right"
                      size={16}
                      color={THEME.primary}
                    />
                  </TouchableOpacity>
                </View>

                {loadingPh ? (
                  <Animated.View
                    style={{ opacity: skeletonPulse, gap: 10, marginTop: 12 }}
                  >
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <View
                        style={[
                          styles.skeletonBar,
                          { width: 68, height: 18, borderRadius: 8 },
                        ]}
                      />
                      <View
                        style={[
                          styles.skeletonBar,
                          { width: 68, height: 18, borderRadius: 8 },
                        ]}
                      />
                      <View
                        style={[
                          styles.skeletonBar,
                          { width: 68, height: 18, borderRadius: 8 },
                        ]}
                      />
                    </View>
                    <View
                      style={[
                        styles.skeletonBar,
                        { width: '100%', height: 6, borderRadius: 99 },
                      ]}
                    />
                    <View style={{ gap: 8, marginTop: 4 }}>
                      <View
                        style={[
                          styles.skeletonBar,
                          { width: '100%', height: 44, borderRadius: 12 },
                        ]}
                      />
                      <View
                        style={[
                          styles.skeletonBar,
                          { width: '100%', height: 44, borderRadius: 12 },
                        ]}
                      />
                      <View
                        style={[
                          styles.skeletonBar,
                          { width: '100%', height: 44, borderRadius: 12 },
                        ]}
                      />
                    </View>
                  </Animated.View>
                ) : (
                  <>
                    {/* Status Breakdown */}
                    <View
                      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
                    >
                      {phStatusCounts.BELUM > 0 && (
                        <View
                          style={[
                            styles.breakdownChip,
                            {
                              backgroundColor: `${COMPANY_STATUS_COLORS.BELUM.base}1A`,
                              borderColor: `${COMPANY_STATUS_COLORS.BELUM.base}40`,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.breakdownChipText,
                              { color: COMPANY_STATUS_COLORS.BELUM.text },
                            ]}
                          >
                            BELUM: {phStatusCounts.BELUM}
                          </Text>
                        </View>
                      )}
                      {phStatusCounts.MINTA > 0 && (
                        <View
                          style={[
                            styles.breakdownChip,
                            {
                              backgroundColor: `${COMPANY_STATUS_COLORS.MINTA.base}1A`,
                              borderColor: `${COMPANY_STATUS_COLORS.MINTA.base}40`,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.breakdownChipText,
                              { color: COMPANY_STATUS_COLORS.MINTA.text },
                            ]}
                          >
                            MINTA: {phStatusCounts.MINTA}
                          </Text>
                        </View>
                      )}
                      {phStatusCounts.WAIT > 0 && (
                        <View
                          style={[
                            styles.breakdownChip,
                            {
                              backgroundColor: `${COMPANY_STATUS_COLORS.WAIT.base}1A`,
                              borderColor: `${COMPANY_STATUS_COLORS.WAIT.base}40`,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.breakdownChipText,
                              { color: COMPANY_STATUS_COLORS.WAIT.text },
                            ]}
                          >
                            WAIT: {phStatusCounts.WAIT}
                          </Text>
                        </View>
                      )}
                      {phStatusCounts.DONE > 0 && (
                        <View
                          style={[
                            styles.breakdownChip,
                            {
                              backgroundColor: `${COMPANY_STATUS_COLORS.DONE.base}1A`,
                              borderColor: `${COMPANY_STATUS_COLORS.DONE.base}40`,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.breakdownChipText,
                              { color: COMPANY_STATUS_COLORS.DONE.text },
                            ]}
                          >
                            DONE: {phStatusCounts.DONE}
                          </Text>
                        </View>
                      )}
                      {phStatusCounts.CANCEL > 0 && (
                        <View
                          style={[
                            styles.breakdownChip,
                            {
                              backgroundColor: `${COMPANY_STATUS_COLORS.CANCEL.base}1A`,
                              borderColor: `${COMPANY_STATUS_COLORS.CANCEL.base}40`,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.breakdownChipText,
                              { color: COMPANY_STATUS_COLORS.CANCEL.text },
                            ]}
                          >
                            CANCEL: {phStatusCounts.CANCEL}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Horizontal Segmented Bar (Grafik Line Horizontal Status) */}
                    {(() => {
                      const total =
                        phStatusCounts.BELUM +
                        phStatusCounts.MINTA +
                        phStatusCounts.WAIT +
                        phStatusCounts.DONE +
                        phStatusCounts.CANCEL;
                      return total > 0 ? (
                        <View
                          style={{
                            height: 6,
                            flexDirection: 'row',
                            borderRadius: 99,
                            overflow: 'hidden',
                            marginVertical: 4,
                          }}
                        >
                          {phStatusCounts.BELUM > 0 && (
                            <View
                              style={{
                                flex: phStatusCounts.BELUM,
                                backgroundColor:
                                  COMPANY_STATUS_COLORS.BELUM.base,
                              }}
                            />
                          )}
                          {phStatusCounts.MINTA > 0 && (
                            <View
                              style={{
                                flex: phStatusCounts.MINTA,
                                backgroundColor:
                                  COMPANY_STATUS_COLORS.MINTA.base,
                              }}
                            />
                          )}
                          {phStatusCounts.WAIT > 0 && (
                            <View
                              style={{
                                flex: phStatusCounts.WAIT,
                                backgroundColor:
                                  COMPANY_STATUS_COLORS.WAIT.base,
                              }}
                            />
                          )}
                          {phStatusCounts.DONE > 0 && (
                            <View
                              style={{
                                flex: phStatusCounts.DONE,
                                backgroundColor:
                                  COMPANY_STATUS_COLORS.DONE.base,
                              }}
                            />
                          )}
                          {phStatusCounts.CANCEL > 0 && (
                            <View
                              style={{
                                flex: phStatusCounts.CANCEL,
                                backgroundColor:
                                  COMPANY_STATUS_COLORS.CANCEL.base,
                              }}
                            />
                          )}
                        </View>
                      ) : (
                        <View
                          style={{
                            height: 6,
                            backgroundColor: '#E2E8F0',
                            borderRadius: 99,
                            marginVertical: 4,
                          }}
                        />
                      );
                    })()}

                    {recentPh.length === 0 ? (
                      <View style={styles.emptyContainer}>
                        <MaterialIcons
                          name="inbox"
                          size={28}
                          color={THEME.muted}
                          style={{ opacity: 0.4 }}
                        />
                        <Text style={styles.emptyText}>
                          Belum ada data PH terbaru
                        </Text>
                      </View>
                    ) : (
                      <View style={{ gap: 8 }}>
                        {recentPh.map((item, idx) => {
                          const getPhStatusBadgeStyle = (status: string) => {
                            const value = String(status || '').toUpperCase();
                            const colors =
                              COMPANY_STATUS_COLORS[value] ||
                              COMPANY_STATUS_COLORS.DEFAULT;
                            return {
                              backgroundColor: `${colors.base}1A`,
                              borderColor: colors.base,
                              textColor: colors.text,
                            };
                          };

                          const statusStyle = getPhStatusBadgeStyle(
                            item.status,
                          );
                          return (
                            <View
                              key={`${item.nomor}-${idx}`}
                              style={styles.recentDocCard}
                            >
                              <View style={{ flex: 1, gap: 4 }}>
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                  }}
                                >
                                  <Text style={styles.docCodeText}>
                                    {item.nomor}
                                  </Text>
                                  <Text style={styles.docDateText}>
                                    {formatDateToDmY(
                                      item.created_at_fmt || item.tanggal,
                                    )}
                                  </Text>
                                </View>
                                <Text
                                  style={styles.docCustomerText}
                                  numberOfLines={1}
                                >
                                  {item.customer || '-'}
                                </Text>
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginTop: 2,
                                  }}
                                >
                                  <Text
                                    style={[
                                      styles.docLabelText,
                                      { flex: 1, marginRight: 8 },
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {item.nama || 'Item tidak bernama'} (
                                    {item.divisi})
                                  </Text>
                                  <View
                                    style={[
                                      styles.statusBadgeMini,
                                      {
                                        backgroundColor:
                                          statusStyle.backgroundColor,
                                        borderColor: statusStyle.borderColor,
                                        borderWidth: 1,
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.statusBadgeMiniText,
                                        { color: statusStyle.textColor },
                                      ]}
                                    >
                                      {item.status}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* 2. TRACKING PENAWARAN */}
              <View
                style={[
                  styles.cardContainer,
                  { borderLeftWidth: 4, borderLeftColor: '#3B82F6' },
                ]}
              >
                <View style={styles.cardHeaderRow}>
                  <View style={{ gap: 2, flex: 1 }}>
                    <Text style={styles.cardHeaderTitle}>
                      Penawaran Terbaru
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        marginTop: 2,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '700',
                          color: THEME.muted,
                        }}
                      >
                        Periode:
                      </Text>
                      <TouchableOpacity
                        style={styles.periodPickerBtn}
                        onPress={() => openMonthYearPicker('PENAWARAN')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.periodPickerText}>
                          {MONTHS_NAME[penawaranMonth - 1]} {penawaranYear}
                        </Text>
                        <MaterialIcons
                          name="arrow-drop-down"
                          size={14}
                          color={THEME.primary}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.cardHeaderAction}
                    onPress={() =>
                      handleNavigate('TrackingPenawaran', {
                        month: penawaranMonth,
                        year: penawaranYear,
                      })
                    }
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cardHeaderActionText}>Lihat Semua</Text>
                    <MaterialIcons
                      name="chevron-right"
                      size={16}
                      color={THEME.primary}
                    />
                  </TouchableOpacity>
                </View>

                {loadingPenawaran ? (
                  <Animated.View
                    style={{ opacity: skeletonPulse, gap: 10, marginTop: 12 }}
                  >
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <View
                        style={[
                          styles.skeletonBar,
                          { width: 68, height: 18, borderRadius: 8 },
                        ]}
                      />
                      <View
                        style={[
                          styles.skeletonBar,
                          { width: 68, height: 18, borderRadius: 8 },
                        ]}
                      />
                      <View
                        style={[
                          styles.skeletonBar,
                          { width: 68, height: 18, borderRadius: 8 },
                        ]}
                      />
                    </View>
                    <View
                      style={[
                        styles.skeletonBar,
                        { width: '100%', height: 6, borderRadius: 99 },
                      ]}
                    />
                    <View style={{ gap: 8, marginTop: 4 }}>
                      <View
                        style={[
                          styles.skeletonBar,
                          { width: '100%', height: 44, borderRadius: 12 },
                        ]}
                      />
                      <View
                        style={[
                          styles.skeletonBar,
                          { width: '100%', height: 44, borderRadius: 12 },
                        ]}
                      />
                      <View
                        style={[
                          styles.skeletonBar,
                          { width: '100%', height: 44, borderRadius: 12 },
                        ]}
                      />
                    </View>
                  </Animated.View>
                ) : (
                  <>
                    {/* Status Breakdown */}
                    <View
                      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
                    >
                      {penawaranStatusCounts.OPEN > 0 && (
                        <View
                          style={[
                            styles.breakdownChip,
                            {
                              backgroundColor: 'rgba(239,68,68,0.1)',
                              borderColor: 'rgba(239,68,68,0.35)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.breakdownChipText,
                              { color: '#B91C1C' },
                            ]}
                          >
                            OPEN: {penawaranStatusCounts.OPEN}
                          </Text>
                        </View>
                      )}
                      {penawaranStatusCounts.PARSIAL > 0 && (
                        <View
                          style={[
                            styles.breakdownChip,
                            {
                              backgroundColor: 'rgba(59,130,246,0.1)',
                              borderColor: 'rgba(59,130,246,0.35)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.breakdownChipText,
                              { color: '#1D4ED8' },
                            ]}
                          >
                            PARSIAL: {penawaranStatusCounts.PARSIAL}
                          </Text>
                        </View>
                      )}
                      {penawaranStatusCounts.CLOSE > 0 && (
                        <View
                          style={[
                            styles.breakdownChip,
                            {
                              backgroundColor: 'rgba(16,185,129,0.1)',
                              borderColor: 'rgba(16,185,129,0.35)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.breakdownChipText,
                              { color: '#047857' },
                            ]}
                          >
                            CLOSE: {penawaranStatusCounts.CLOSE}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Horizontal Segmented Bar (Grafik Line Horizontal Status) */}
                    {(() => {
                      const total =
                        penawaranStatusCounts.OPEN +
                        penawaranStatusCounts.PARSIAL +
                        penawaranStatusCounts.CLOSE;
                      return total > 0 ? (
                        <View
                          style={{
                            height: 6,
                            flexDirection: 'row',
                            borderRadius: 99,
                            overflow: 'hidden',
                            marginVertical: 4,
                          }}
                        >
                          {penawaranStatusCounts.OPEN > 0 && (
                            <View
                              style={{
                                flex: penawaranStatusCounts.OPEN,
                                backgroundColor: '#EF4444',
                              }}
                            />
                          )}
                          {penawaranStatusCounts.PARSIAL > 0 && (
                            <View
                              style={{
                                flex: penawaranStatusCounts.PARSIAL,
                                backgroundColor: '#3B82F6',
                              }}
                            />
                          )}
                          {penawaranStatusCounts.CLOSE > 0 && (
                            <View
                              style={{
                                flex: penawaranStatusCounts.CLOSE,
                                backgroundColor: '#10B981',
                              }}
                            />
                          )}
                        </View>
                      ) : (
                        <View
                          style={{
                            height: 6,
                            backgroundColor: '#E2E8F0',
                            borderRadius: 99,
                            marginVertical: 4,
                          }}
                        />
                      );
                    })()}

                    {recentPenawaran.length === 0 ? (
                      <View style={styles.emptyContainer}>
                        <MaterialIcons
                          name="description"
                          size={28}
                          color={THEME.muted}
                          style={{ opacity: 0.4 }}
                        />
                        <Text style={styles.emptyText}>
                          Belum ada data penawaran terbaru
                        </Text>
                      </View>
                    ) : (
                      <View style={{ gap: 8 }}>
                        {recentPenawaran.map((item, idx) => {
                          const colorMap = {
                            OPEN: '#EF4444',
                            PARSIAL: '#3B82F6',
                            CLOSE: '#10B981',
                          };
                          const status = item.status_tracking || 'OPEN';
                          const badgeColor = colorMap[status] || THEME.muted;
                          const hasItems = item.total_item > 0;
                          const progress = hasItems
                            ? (item.total_item_map / item.total_item) * 100
                            : 0;
                          return (
                            <View
                              key={`${item.no_penawaran}-${idx}`}
                              style={styles.recentDocCard}
                            >
                              <View style={{ flex: 1, gap: 4 }}>
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                  }}
                                >
                                  <Text style={styles.docCodeText}>
                                    {item.no_penawaran}
                                  </Text>
                                  <Text style={styles.docDateText}>
                                    {formatDateToDmY(item.tanggal_penawaran)}
                                  </Text>
                                </View>
                                <Text
                                  style={styles.docCustomerText}
                                  numberOfLines={1}
                                >
                                  {item.customer || '-'}
                                </Text>
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginTop: 2,
                                  }}
                                >
                                  <Text
                                    style={[
                                      styles.docLabelText,
                                      { flex: 1, marginRight: 8 },
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {item.total_item_map} dari {item.total_item}{' '}
                                    item MAP
                                  </Text>
                                  <View
                                    style={[
                                      styles.statusBadgeMini,
                                      { backgroundColor: badgeColor },
                                    ]}
                                  >
                                    <Text style={styles.statusBadgeMiniText}>
                                      {status}
                                    </Text>
                                  </View>
                                </View>
                                <View
                                  style={{
                                    height: 4,
                                    backgroundColor: '#E2E8F0',
                                    borderRadius: 2,
                                    marginTop: 4,
                                    overflow: 'hidden',
                                  }}
                                >
                                  <View
                                    style={{
                                      height: '100%',
                                      width: `${progress}%`,
                                      backgroundColor: badgeColor,
                                    }}
                                  />
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* 3. TRACKING SPK */}
              <View
                style={[
                  styles.cardContainer,
                  { borderLeftWidth: 4, borderLeftColor: '#10B981' },
                ]}
              >
                <View style={styles.cardHeaderRow}>
                  <View style={{ gap: 2, flex: 1 }}>
                    <Text style={styles.cardHeaderTitle}>SPK Terbaru</Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        marginTop: 2,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '700',
                          color: THEME.muted,
                        }}
                      >
                        Periode:
                      </Text>
                      <TouchableOpacity
                        style={styles.periodPickerBtn}
                        onPress={() => openMonthYearPicker('SPK')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.periodPickerText}>
                          {MONTHS_NAME[spkMonth - 1]} {spkYear}
                        </Text>
                        <MaterialIcons
                          name="arrow-drop-down"
                          size={14}
                          color={THEME.primary}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.cardHeaderAction}
                    onPress={() =>
                      handleNavigate('TrackingSPK', {
                        month: spkMonth,
                        year: spkYear,
                      })
                    }
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cardHeaderActionText}>Lihat Semua</Text>
                    <MaterialIcons
                      name="chevron-right"
                      size={16}
                      color={THEME.primary}
                    />
                  </TouchableOpacity>
                </View>

                {loadingSpk ? (
                  <Animated.View
                    style={{ opacity: skeletonPulse, gap: 10, marginTop: 12 }}
                  >
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <View
                        style={[
                          styles.skeletonBar,
                          { width: 68, height: 18, borderRadius: 8 },
                        ]}
                      />
                      <View
                        style={[
                          styles.skeletonBar,
                          { width: 68, height: 18, borderRadius: 8 },
                        ]}
                      />
                      <View
                        style={[
                          styles.skeletonBar,
                          { width: 68, height: 18, borderRadius: 8 },
                        ]}
                      />
                    </View>
                    <View
                      style={[
                        styles.skeletonBar,
                        { width: '100%', height: 6, borderRadius: 99 },
                      ]}
                    />
                    <View style={{ gap: 8, marginTop: 4 }}>
                      <View
                        style={[
                          styles.skeletonBar,
                          { width: '100%', height: 44, borderRadius: 12 },
                        ]}
                      />
                      <View
                        style={[
                          styles.skeletonBar,
                          { width: '100%', height: 44, borderRadius: 12 },
                        ]}
                      />
                      <View
                        style={[
                          styles.skeletonBar,
                          { width: '100%', height: 44, borderRadius: 12 },
                        ]}
                      />
                    </View>
                  </Animated.View>
                ) : (
                  <>
                    {/* Status Breakdown */}
                    <View
                      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
                    >
                      {spkStatusCounts.BELUM > 0 && (
                        <View
                          style={[
                            styles.breakdownChip,
                            {
                              backgroundColor: 'rgba(239,68,68,0.1)',
                              borderColor: 'rgba(239,68,68,0.35)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.breakdownChipText,
                              { color: '#B91C1C' },
                            ]}
                          >
                            OPEN: {spkStatusCounts.BELUM}
                          </Text>
                        </View>
                      )}
                      {spkStatusCounts.PROSES > 0 && (
                        <View
                          style={[
                            styles.breakdownChip,
                            {
                              backgroundColor: 'rgba(245,158,11,0.1)',
                              borderColor: 'rgba(245,158,11,0.35)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.breakdownChipText,
                              { color: '#B45309' },
                            ]}
                          >
                            PROSES: {spkStatusCounts.PROSES}
                          </Text>
                        </View>
                      )}
                      {spkStatusCounts.SUDAH > 0 && (
                        <View
                          style={[
                            styles.breakdownChip,
                            {
                              backgroundColor: 'rgba(16,185,129,0.1)',
                              borderColor: 'rgba(16,185,129,0.35)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.breakdownChipText,
                              { color: '#047857' },
                            ]}
                          >
                            CLOSE: {spkStatusCounts.SUDAH}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Horizontal Segmented Bar (Grafik Line Horizontal Status) */}
                    {(() => {
                      const total =
                        spkStatusCounts.BELUM +
                        spkStatusCounts.PROSES +
                        spkStatusCounts.SUDAH;
                      return total > 0 ? (
                        <View
                          style={{
                            height: 6,
                            flexDirection: 'row',
                            borderRadius: 99,
                            overflow: 'hidden',
                            marginVertical: 4,
                          }}
                        >
                          {spkStatusCounts.BELUM > 0 && (
                            <View
                              style={{
                                flex: spkStatusCounts.BELUM,
                                backgroundColor: '#EF4444',
                              }}
                            />
                          )}
                          {spkStatusCounts.PROSES > 0 && (
                            <View
                              style={{
                                flex: spkStatusCounts.PROSES,
                                backgroundColor: '#F59E0B',
                              }}
                            />
                          )}
                          {spkStatusCounts.SUDAH > 0 && (
                            <View
                              style={{
                                flex: spkStatusCounts.SUDAH,
                                backgroundColor: '#10B981',
                              }}
                            />
                          )}
                        </View>
                      ) : (
                        <View
                          style={{
                            height: 6,
                            backgroundColor: '#E2E8F0',
                            borderRadius: 99,
                            marginVertical: 4,
                          }}
                        />
                      );
                    })()}

                    {recentSpk.length === 0 ? (
                      <View style={styles.emptyContainer}>
                        <MaterialIcons
                          name="assignment"
                          size={28}
                          color={THEME.muted}
                          style={{ opacity: 0.4 }}
                        />
                        <Text style={styles.emptyText}>
                          Belum ada data SPK terbaru
                        </Text>
                      </View>
                    ) : (
                      <View style={{ gap: 8 }}>
                        {recentSpk.map((item, idx) => {
                          const real = item.realisasi_total || 0;
                          const ord = item.spk_jumlah || 0;
                          const progress = ord > 0 ? (real / ord) * 100 : 0;
                          let statusText = 'OPEN';
                          let statusColor = '#EF4444';
                          if (real >= ord - 0.01) {
                            statusText = 'CLOSE';
                            statusColor = '#10B981';
                          } else if (real > 0) {
                            statusText = 'PROSES';
                            statusColor = '#F59E0B';
                          }
                          return (
                            <View
                              key={`${item.spk_nomor}-${idx}`}
                              style={styles.recentDocCard}
                            >
                              <View style={{ flex: 1, gap: 4 }}>
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                  }}
                                >
                                  <Text style={styles.docCodeText}>
                                    {item.spk_nomor}
                                  </Text>
                                  <Text style={styles.docDateText}>
                                    {formatDateToDmY(item.spk_tanggal)}
                                  </Text>
                                </View>
                                <Text
                                  style={styles.docCustomerText}
                                  numberOfLines={1}
                                >
                                  {item.spk_nama || '-'}
                                </Text>
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginTop: 2,
                                  }}
                                >
                                  <Text
                                    style={[
                                      styles.docLabelText,
                                      { flex: 1, marginRight: 8 },
                                    ]}
                                    numberOfLines={1}
                                  >
                                    Realisasi: {real} / {ord}
                                  </Text>
                                  <View
                                    style={[
                                      styles.statusBadgeMini,
                                      { backgroundColor: statusColor },
                                    ]}
                                  >
                                    <Text style={styles.statusBadgeMiniText}>
                                      {statusText}
                                    </Text>
                                  </View>
                                </View>
                                <View
                                  style={{
                                    height: 4,
                                    backgroundColor: '#E2E8F0',
                                    borderRadius: 2,
                                    marginTop: 4,
                                    overflow: 'hidden',
                                  }}
                                >
                                  <View
                                    style={{
                                      height: '100%',
                                      width: `${Math.min(progress, 100)}%`,
                                      backgroundColor: statusColor,
                                    }}
                                  />
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </>
                )}
              </View>
            </>
          )}
        </ScrollView>

        {/* SIDEBAR DRAWER MENU */}
        <Modal
          isVisible={isSidebarVisible}
          onBackdropPress={() => setSidebarVisible(false)}
          backdropOpacity={0.4}
          animationIn="slideInLeft"
          animationOut="slideOutLeft"
          style={{ margin: 0, justifyContent: 'flex-start' }}
          useNativeDriver
          hideModalContentWhileAnimating
        >
          <View style={styles.sidebarContainer}>
            {/* Header Sidebar: Profil User */}
            <LinearGradient
              colors={['#FFFFFF', '#F1F5F9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sidebarHeader}
            >
              <LinearGradient
                colors={[THEME.primary, THEME.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sidebarAvatar}
              >
                <Text style={styles.sidebarAvatarText}>{initials}</Text>
              </LinearGradient>
              <View style={styles.sidebarProfileInfo}>
                <Text style={styles.sidebarUserName} numberOfLines={1}>
                  {(user?.nama || '-').toUpperCase()}
                </Text>
                <View style={styles.sidebarBadge}>
                  <Text style={styles.sidebarBadgeText}>
                    {user?.jabatan || '-'}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    marginTop: 4,
                  }}
                >
                  <MaterialIcons name="place" size={14} color={THEME.primary} />
                  <Text style={styles.sidebarUserCity} numberOfLines={1}>
                    {user?.cabang || '-'}
                  </Text>
                </View>
              </View>

              {/* Tombol Keluar di Samping Profil */}
              <TouchableOpacity
                onPress={() => {
                  setSidebarVisible(false);
                  toggleModal();
                }}
                activeOpacity={0.7}
                style={styles.sidebarLogoutButton}
              >
                <MaterialIcons name="logout" size={20} color={THEME.danger} />
              </TouchableOpacity>
            </LinearGradient>

            {/* Menu List */}
            <ScrollView
              showsVerticalScrollIndicator={true}
              persistentScrollbar={true}
              contentContainerStyle={styles.sidebarMenuScroll}
            >
              {menuGroups.map((group, groupIdx) => (
                <View
                  key={group.title || groupIdx}
                  style={{ marginBottom: 14 }}
                >
                  <Text style={styles.sidebarCategoryLabel}>{group.title}</Text>
                  {group.items.map((menuItemObj, itemIdx) => {
                    const isPH = menuItemObj.title === 'Permintaan Harga';
                    const isTrackingPenawaran =
                      menuItemObj.title === 'Tracking Penawaran';
                    const isTrackingSpk = menuItemObj.title === 'Tracking SPK';
                    const badgeCount = isPH
                      ? totalActivePH
                      : isTrackingPenawaran
                      ? totalActivePenawaran
                      : isTrackingSpk
                      ? totalActiveSpk
                      : 0;
                    const hasBadge = badgeCount > 0;

                    return (
                      <TouchableOpacity
                        key={menuItemObj.route || itemIdx}
                        style={styles.sidebarMenuItem}
                        activeOpacity={0.7}
                        onPress={() => {
                          setSidebarVisible(false);
                          handleNavigate(menuItemObj.route);
                        }}
                      >
                        <View style={styles.sidebarMenuIconContainer}>
                          <MaterialIcons
                            name={menuItemObj.icon || 'circle'}
                            size={18}
                            color={THEME.primary}
                          />
                        </View>
                        <Text style={styles.sidebarMenuTitle}>
                          {menuItemObj.title}
                        </Text>
                        {hasBadge && (
                          <View style={styles.sidebarMenuBadge}>
                            <Text style={styles.sidebarMenuBadgeText}>
                              {badgeCount}
                            </Text>
                          </View>
                        )}
                        <MaterialIcons
                          name="chevron-right"
                          size={18}
                          color="rgba(15, 23, 42, 0.22)"
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </View>
        </Modal>

        {/* Modal logout */}
        <Modal
          isVisible={isModalVisible}
          onBackdropPress={toggleModal}
          backdropOpacity={0.45}
          animationIn="zoomIn"
          animationOut="zoomOut"
        >
          <View style={styles.modalCard}>
            <View style={styles.modalIndicator} />
            <Text style={styles.modalTitle}>Konfirmasi</Text>
            <Text style={styles.modalSubtitle}>Yakin ingin keluar?</Text>
            <Text style={styles.modalUserName}>
              {(user?.nama || '').toUpperCase()}
            </Text>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={toggleModal}
                activeOpacity={0.85}
              >
                <Text style={styles.textCancel}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnLogoutConfirm}
                onPress={() => {
                  setModalVisible(false);
                  logout();
                }}
                activeOpacity={0.9}
              >
                <Text style={styles.textLogout}>Keluar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Modal Rincian Status (Rekap Notifikasi) */}
        <Modal
          isVisible={isStatusModalVisible}
          onBackdropPress={() => setStatusModalVisible(false)}
          backdropOpacity={0.45}
          animationIn="zoomIn"
          animationOut="zoomOut"
        >
          <View
            style={[
              styles.modalCard,
              { maxHeight: '80%', paddingHorizontal: 16 },
            ]}
          >
            <View style={styles.modalIndicator} />
            <Text style={styles.modalTitle}>Rincian Status Dokumen</Text>
            <Text style={[styles.modalSubtitle, { marginBottom: 12 }]}>
              Detail jumlah per status saat ini:
            </Text>

            <ScrollView
              style={{ width: '100%' }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 4 }}
            >
              {/* Permintaan Harga */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 4,
                  marginBottom: 4,
                }}
              >
                <Text style={[styles.modalSectionTitle, { marginBottom: 0 }]}>
                  Permintaan Harga
                </Text>
                {totalActivePH > 0 && (
                  <View style={styles.modalSectionBadge}>
                    <Text style={styles.modalSectionBadgeText}>
                      {totalActivePH}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.statusListContainer}>
                <View style={styles.statusItem}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <MaterialIcons
                      name="schedule"
                      size={16}
                      color={COMPANY_STATUS_COLORS.BELUM.base}
                    />
                    <Text style={styles.statusLabel}>Belum</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: COMPANY_STATUS_COLORS.BELUM.base },
                    ]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {phStatusCounts.BELUM}
                    </Text>
                  </View>
                </View>

                <View style={styles.statusItem}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <MaterialIcons
                      name="description"
                      size={16}
                      color={COMPANY_STATUS_COLORS.MINTA.base}
                    />
                    <Text style={styles.statusLabel}>Minta</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: COMPANY_STATUS_COLORS.MINTA.base },
                    ]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {phStatusCounts.MINTA}
                    </Text>
                  </View>
                </View>

                <View style={styles.statusItem}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <MaterialIcons
                      name="hourglass-empty"
                      size={16}
                      color={COMPANY_STATUS_COLORS.WAIT.base}
                    />
                    <Text style={styles.statusLabel}>Wait</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: COMPANY_STATUS_COLORS.WAIT.base },
                    ]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {phStatusCounts.WAIT}
                    </Text>
                  </View>
                </View>

                <View style={styles.statusItem}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <MaterialIcons
                      name="check-circle"
                      size={16}
                      color={COMPANY_STATUS_COLORS.DONE.base}
                    />
                    <Text style={styles.statusLabel}>Done</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: COMPANY_STATUS_COLORS.DONE.base },
                    ]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {phStatusCounts.DONE}
                    </Text>
                  </View>
                </View>

                <View style={styles.statusItem}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <MaterialIcons
                      name="cancel"
                      size={16}
                      color={COMPANY_STATUS_COLORS.CANCEL.base}
                    />
                    <Text style={styles.statusLabel}>Cancel</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: COMPANY_STATUS_COLORS.CANCEL.base },
                    ]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {phStatusCounts.CANCEL}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Tracking Penawaran */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 16,
                  marginBottom: 4,
                }}
              >
                <Text style={[styles.modalSectionTitle, { marginBottom: 0 }]}>
                  Tracking Penawaran
                </Text>
                {totalActivePenawaran > 0 && (
                  <View style={styles.modalSectionBadge}>
                    <Text style={styles.modalSectionBadgeText}>
                      {totalActivePenawaran}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.statusListContainer}>
                <View style={styles.statusItem}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: '#EF4444',
                      }}
                    />
                    <Text style={styles.statusLabel}>OPEN</Text>
                  </View>
                  <View
                    style={[styles.statusBadge, { backgroundColor: '#EF4444' }]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {penawaranStatusCounts.OPEN}
                    </Text>
                  </View>
                </View>

                <View style={styles.statusItem}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: '#3B82F6',
                      }}
                    />
                    <Text style={styles.statusLabel}>PARSIAL</Text>
                  </View>
                  <View
                    style={[styles.statusBadge, { backgroundColor: '#3B82F6' }]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {penawaranStatusCounts.PARSIAL}
                    </Text>
                  </View>
                </View>

                <View style={styles.statusItem}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: '#10B981',
                      }}
                    />
                    <Text style={styles.statusLabel}>CLOSE</Text>
                  </View>
                  <View
                    style={[styles.statusBadge, { backgroundColor: '#10B981' }]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {penawaranStatusCounts.CLOSE}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Tracking SPK */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 16,
                  marginBottom: 4,
                }}
              >
                <Text style={[styles.modalSectionTitle, { marginBottom: 0 }]}>
                  Tracking SPK
                </Text>
                {totalActiveSpk > 0 && (
                  <View style={styles.modalSectionBadge}>
                    <Text style={styles.modalSectionBadgeText}>
                      {totalActiveSpk}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.statusListContainer}>
                <View style={styles.statusItem}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: '#EF4444',
                      }}
                    />
                    <Text style={styles.statusLabel}>OPEN</Text>
                  </View>
                  <View
                    style={[styles.statusBadge, { backgroundColor: '#EF4444' }]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {spkStatusCounts.BELUM}
                    </Text>
                  </View>
                </View>

                <View style={styles.statusItem}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: '#F59E0B',
                      }}
                    />
                    <Text style={styles.statusLabel}>PROSES</Text>
                  </View>
                  <View
                    style={[styles.statusBadge, { backgroundColor: '#F59E0B' }]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {spkStatusCounts.PROSES}
                    </Text>
                  </View>
                </View>

                <View style={styles.statusItem}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: '#10B981',
                      }}
                    />
                    <Text style={styles.statusLabel}>CLOSE</Text>
                  </View>
                  <View
                    style={[styles.statusBadge, { backgroundColor: '#10B981' }]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {spkStatusCounts.SUDAH}
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.btnDismiss}
                onPress={() => setStatusModalVisible(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.textDismiss}>Tutup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Modal Month-Year Picker */}
        <Modal
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
              Pilih Periode{' '}
              {pickerTarget === 'PH'
                ? 'Permintaan Harga'
                : pickerTarget === 'PENAWARAN'
                ? 'Penawaran'
                : 'SPK'}
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
              {[2024, 2025, 2026, 2027].map(yVal => {
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
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },

  /* VISIT PLAN STEPPER FILTER */
  vpStepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  vpStepperButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.04)',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  vpStepperInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 8,
  },
  vpStepperText: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.ink,
  },

  /* VISIT PLAN SALES FILTER (MANAGER ONLY) */
  vpFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  vpFilterLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.muted,
  },
  vpFilterDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  vpFilterDropdownText: {
    fontSize: 11,
    fontWeight: '900',
    color: THEME.primary,
  },
  vpFilterDropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 2,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    maxWidth: 130,
  },
  vpFilterDropdownHeaderText: {
    fontSize: 10,
    fontWeight: '900',
    color: THEME.primary,
  },
  salesPickerCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  salesPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
    paddingBottom: 12,
    marginBottom: 12,
  },
  salesPickerTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: THEME.ink,
  },
  salesPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.02)',
  },
  salesPickerOptionActive: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  salesPickerOptionText: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.ink,
  },
  salesPickerOptionTextActive: {
    color: '#FFF',
  },

  /* HEADER */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 20 : 8,
    paddingBottom: 12,
  },
  headerMenuButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.line,
  },
  brandTextBig: {
    fontSize: 26,
    fontWeight: '900',
    color: THEME.ink,
    letterSpacing: 0.5,
  },
  headerBellButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(79,70,229,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.18)',
  },
  headerBellIcon: {
    fontSize: 18,
  },
  headerBellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 99,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerBellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },

  /* DASHBOARD */
  dashboardContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 16,
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  errorCardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#991B1B',
  },
  errorCardSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
    marginTop: 2,
    lineHeight: 15,
  },
  btnErrorRetry: {
    backgroundColor: '#EF4444',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnErrorRetryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  welcomeCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.line,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  welcomeGreeting: {
    fontSize: 20,
    fontWeight: '900',
    color: THEME.ink,
  },

  /* SKELETON */
  skeletonCard: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.line,
    gap: 8,
  },
  skeletonBar: {
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
  },

  /* WIDGET CONTAINER */
  cardContainer: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.line,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
  },
  cardHeaderEmoji: {
    fontSize: 18,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: THEME.ink,
  },
  cardHeaderAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardHeaderActionText: {
    fontSize: 12,
    fontWeight: '900',
    color: THEME.primary,
  },

  /* EMPTY STATE */
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.muted,
    textAlign: 'center',
  },
  btnActionSecondary: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(79,70,229,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.15)',
  },
  btnActionSecondaryText: {
    fontSize: 12,
    fontWeight: '900',
    color: THEME.primary,
  },

  /* ITEM CARD ROW */
  itemRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    gap: 12,
  },
  itemRowTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: THEME.ink,
  },
  itemRowSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.muted,
  },
  itemRowNote: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.muted,
    marginTop: 2,
  },
  statusBadgeRow: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  statusBadgeRowText: {
    fontSize: 10,
    fontWeight: '900',
  },
  btnRowVisit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#16A34A',
  },
  btnRowVisitText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },

  /* RECENT DOCUMENTS CARD */
  recentDocCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  docCodeText: {
    fontSize: 12,
    fontWeight: '900',
    color: THEME.primary,
  },
  docDateText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.muted,
  },
  docCustomerText: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.ink,
    marginTop: 4,
  },
  docLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.muted,
  },
  statusBadgeMini: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    minWidth: 50,
    alignItems: 'center',
  },
  statusBadgeMiniText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },

  /* SIDEBAR DRAWER */
  sidebarContainer: {
    width: '80%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 4, height: 0 },
    elevation: 16,
    overflow: 'hidden',
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
    gap: 14,
  },
  sidebarAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  sidebarAvatarText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  sidebarProfileInfo: {
    flex: 1,
    gap: 3,
  },
  sidebarUserName: {
    fontSize: 16,
    fontWeight: '900',
    color: THEME.ink,
  },
  sidebarBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(79,70,229,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(79,70,229,0.15)',
  },
  sidebarBadgeText: {
    color: THEME.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  sidebarUserCity: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.muted,
  },
  sidebarMenuScroll: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  sidebarMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: THEME.line,
    gap: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  sidebarMenuIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(79,70,229,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarMenuIcon: {
    fontSize: 18,
  },
  sidebarMenuTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: THEME.ink,
  },
  sidebarMenuBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarMenuBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  sidebarFooter: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.line,
    gap: 8,
  },
  sidebarFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.04)',
  },
  sidebarFooterBtnLogout: {
    backgroundColor: 'rgba(239,68,68,0.06)',
    borderColor: 'rgba(239,68,68,0.1)',
  },
  sidebarFooterBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.ink,
  },

  /* MODALS */
  modalCard: {
    backgroundColor: '#FFF',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.line,
  },
  modalIndicator: {
    width: 44,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 18,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: THEME.ink },
  modalSubtitle: {
    marginTop: 10,
    fontSize: 13,
    color: THEME.muted,
    textAlign: 'center',
  },
  modalUserName: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '900',
    color: THEME.ink,
    letterSpacing: 0.6,
  },
  modalActionRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  btnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#EEF2F7',
    alignItems: 'center',
  },
  btnLogoutConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: THEME.danger,
    alignItems: 'center',
  },
  textCancel: { color: THEME.muted, fontWeight: '900' },
  textLogout: { color: '#FFF', fontWeight: '900' },

  /* STATUS NOTIFICATIONS LIST */
  statusListContainer: {
    width: '100%',
    marginVertical: 16,
    gap: 8,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.04)',
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusBadge: {
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 2,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  btnDismiss: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
  },
  textDismiss: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  modalSectionTitle: {
    alignSelf: 'flex-start',
    fontSize: 14,
    fontWeight: '900',
    color: THEME.primary,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  modalSectionBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  modalSectionBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
  },

  /* QUICK STATS STRIP */
  quickStatChip: {
    flex: 1,
    backgroundColor: THEME.card,
    borderRadius: 16,
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: THEME.line,
    alignItems: 'center',
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
    overflow: 'hidden',
  },
  quickStatNumber: {
    fontSize: 22,
    fontWeight: '900',
  },
  quickStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.muted,
    textAlign: 'center',
  },
  quickStatAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },

  /* BREAKDOWN CHIPS */
  breakdownChip: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  breakdownChipText: {
    fontSize: 10,
    fontWeight: '800',
  },

  /* SIDEBAR CATEGORY LABEL */
  sidebarCategoryLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: THEME.muted,
    letterSpacing: 1.2,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },

  /* MONTH YEAR PICKER */
  periodPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  periodPickerText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4F46E5',
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
  sidebarLogoutButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
