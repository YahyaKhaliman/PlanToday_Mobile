/* eslint-disable react-native/no-inline-styles */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../../services/api';
import { useAuth } from '../../context/authContext';
import { Linking } from 'react-native';
import { GlassSelect } from '../Register/glassSelect';
import Toast from 'react-native-toast-message';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

type Karyawan = {
  kar_nama: string;
  kar_cabang: string;
  kar_jabatan: string;
};

type RekapVisitItem = {
  id?: number;
  cus_kode?: string;
  cus_nama?: string;
  cc_nama?: string;
  customer_text?: string;

  cus_alamat?: string;
  cc_alamat?: string;
  cus_alamat_text?: string;

  note?: string;
  realisasi?: 'Y' | 'N' | string | null;
  tanggal?: string;
};

const THEME = {
  primary: '#4F46E5',
  accent: '#06B6D4',
  ink: '#0F172A',
  muted: '#64748B',
  card: '#FFFFFF',
  soft: '#F1F5F9',
  line: 'rgba(15,23,42,0.08)',
  danger: '#EF4444',
  bgTop: '#F7F9FF',
  bgBottom: '#FFFFFF',
  wa: '#22C55E',
  ok: '#16A34A',
};

const ymdToDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
};

const dateToYmd = (dt: Date) => {
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatDisplayDate = (ymd: string) => {
  try {
    const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
    const dt = new Date(y, m - 1, d);
    const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${dt.getDate()} ${bulan[dt.getMonth()]} ${dt.getFullYear()}`;
  } catch {
    return ymd;
  }
};

export default function VisitGabunganScreen({ navigation }: any) {
  const { user } = useAuth();
  const isManager = String(user?.jabatan || '').toUpperCase() === 'MANAGER';
  const namaUser = user?.nama || '';

  const today = useMemo(() => new Date().toISOString().substring(0, 10), []);
  const CABANG_VALUES = useMemo(() => ['PUSAT', 'JATIM', 'JATENG', 'JAKARTA'], []);

  const [loading, setLoading] = useState(false);

  // ===== cabang =====
  const [selectedCabang, setSelectedCabang] = useState<string>(() => {
    const cab = String(user?.cabang || 'PUSAT').toUpperCase();
    return CABANG_VALUES.includes(cab) ? cab : 'PUSAT';
  });
  const [openCabang, setOpenCabang] = useState(false);
  const cabangOptions = useMemo(() => CABANG_VALUES.map((c) => ({ label: c, value: c })), [CABANG_VALUES]);

  // ===== sales (manager) =====
  const [loadingSales, setLoadingSales] = useState(false);
  const [listSales, setListSales] = useState<string[]>([]);
  const [selectedSales, setSelectedSales] = useState<string>('');
  const [openSales, setOpenSales] = useState(false);
  const salesOptions = useMemo(() => listSales.map((n) => ({ label: n, value: n })), [listSales]);

  // ===== rentang tanggal =====
  const [tanggalAwal, setTanggalAwal] = useState<string>(today);
  const [tanggalAkhir, setTanggalAkhir] = useState<string>(today);
  const [showAwal, setShowAwal] = useState(false);
  const [showAkhir, setShowAkhir] = useState(false);

  // ===== data =====
  const [data, setData] = useState<RekapVisitItem[]>([]);

  // ===== FAB filter & modal (fitur dari referensi) =====
  const [showFab, setShowFab] = useState(false);
  const [openFilter, setOpenFilter] = useState(false);

  // ===== FAB edit mini popup (fitur dari referensi) =====
  const [selectedItem, setSelectedItem] = useState<RekapVisitItem | null>(null);
  const [showEditFab, setShowEditFab] = useState(false);

  // ===== userParam =====
  const userParam = useMemo(() => (isManager ? selectedSales : namaUser), [isManager, selectedSales, namaUser]);

  const normalizeYmd = (v: string) => String(v || '').slice(0, 10);

  // Open WA
  const [openWaOption, setOpenWaOption] = useState(false);
  const [waPendingText, setWaPendingText] = useState<string>('');

  const formatDdMmYyyy = (ymd: string) => {
    try {
      const [y, m, d] = ymd.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      return `${dt.getDate()} ${bulan[dt.getMonth()]} ${dt.getFullYear()}`;
    } catch {
      return ymd;
    }
  };

  // SALES: lock cabang + sales user
  useEffect(() => {
    if (!isManager) {
      const cab = String(user?.cabang || '').toUpperCase();
      if (cab && CABANG_VALUES.includes(cab)) setSelectedCabang(cab);
      setSelectedSales(namaUser);
    }
  }, [isManager, user?.cabang, namaUser, CABANG_VALUES]);

  const fetchSalesByCabang = useCallback(
    async (cabang: string) => {
      if (!isManager) return;

      setLoadingSales(true);
      try {
        const res = await api.get('/karyawan', { params: { cabang } });
        const raw = res.data?.data ?? res.data;
        const arr: Karyawan[] = Array.isArray(raw) ? raw : [];

        const names = arr
          .filter((x) => String(x?.kar_jabatan || '').toUpperCase() === 'SALES')
          .map((x) => String(x?.kar_nama || '').trim())
          .filter(Boolean);

        const uniqueSorted = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
        setListSales(uniqueSorted);

        if (uniqueSorted.length > 0) setSelectedSales(uniqueSorted[0]);
        else setSelectedSales('');
      } catch {
        setListSales([]);
        setSelectedSales('');
      } finally {
        setLoadingSales(false);
      }
    },
    [isManager]
  );

  useEffect(() => {
    if (!isManager) return;
    setListSales([]);
    setSelectedSales('');
    fetchSalesByCabang(selectedCabang);
  }, [isManager, selectedCabang, fetchSalesByCabang]);

  const refresh = useCallback(async () => {
    if (!userParam) {
      Toast.show({
        type: 'glassSuccess',
        text1: 'Validasi',
        text2: isManager ? 'Pilih Cabang dan Sales terlebih dahulu' : 'Login terlebih dahulu',
      });
      return;
    }

    if (!tanggalAwal || !tanggalAkhir) {
      Toast.show({ type: 'glassError', text1: 'Validasi', text2: 'Tanggal awal & akhir wajib diisi' });
      return;
    }

    if (tanggalAwal > tanggalAkhir) {
      Toast.show({ type: 'glassError', text1: 'Validasi', text2: 'Tanggal awal tidak boleh melebihi tanggal akhir' });
      return;
    }

    setLoading(true);
    try {
      const res = await api.get('/rekap-visit', {
        params: {
          user: userParam,
          cabang: selectedCabang,
          tanggal_awal: tanggalAwal,
          tanggal_akhir: tanggalAkhir,
        },
      });

      if (res.data?.success) setData(res.data?.data || []);
      else setData([]);
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
      }, [tanggalAwal, tanggalAkhir, userParam])
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
        if (Platform.OS === 'android' && (await Linking.canOpenURL(waBizIntent))) return Linking.openURL(waBizIntent);

        // fallback kalau business nggak ada, coba WA biasa
        if (await Linking.canOpenURL(waApp)) return Linking.openURL(waApp);
        if (Platform.OS === 'android' && (await Linking.canOpenURL(waAppIntent))) return Linking.openURL(waAppIntent);

        return Linking.openURL(waWeb);
      }

      // mode === 'app'
      if (await Linking.canOpenURL(waApp)) return Linking.openURL(waApp);
      if (Platform.OS === 'android' && (await Linking.canOpenURL(waAppIntent))) return Linking.openURL(waAppIntent);

      // fallback kalau WA biasa nggak ada, coba business
      if (await Linking.canOpenURL(waBiz)) return Linking.openURL(waBiz);
      if (Platform.OS === 'android' && (await Linking.canOpenURL(waBizIntent))) return Linking.openURL(waBizIntent);

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
        text2: isManager ? 'Pilih Sales terlebih dahulu' : 'Login terlebih dahulu',
      });
      return;
    }

    try {
      const res = await api.get('/rekap-visit/wa', {
        params: {
          user: userParam,
          cabang: selectedCabang,
          tanggal_awal: tanggalAwal,
          tanggal_akhir: tanggalAkhir,
        },
      });

      const waText = res.data?.wa_text;
      if (!waText) {
        Toast.show({ type: 'glassSuccess', text1: 'Info', text2: 'Data WA tidak tersedia' });
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

  // ===== scroll handler (fitur dari referensi) =====
  const onScroll = useCallback((e: any) => {
    const y = e.nativeEvent.contentOffset.y || 0;
    setShowFab(y > 200);
    setShowEditFab(false);
  }, []);

  const openEditFab = useCallback((item: RekapVisitItem) => {
    setSelectedItem(item);
    setShowEditFab(true);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: RekapVisitItem }) => {
      const nama = item.cus_nama || item.cc_nama || item.customer_text || '-';
      const realisasi = String(item.realisasi || '').toUpperCase();
      const isDone = realisasi === 'Y';
      const statusLabel = isDone ? 'DONE' : 'BELUM';
      const tglRaw = (item as any).tanggal || '-';
      const tgl = tglRaw ? formatDdMmYyyy(normalizeYmd(String(tglRaw))) : '';

      return (
        <TouchableOpacity activeOpacity={0.9} onPress={() => openEditFab(item)}>
          <View style={styles.cardCompact}>
            <View style={{ flex: 1 }}>
              <Text style={styles.compactTitle} numberOfLines={1}>
                {nama}
              </Text>

              <View style={styles.inlineRow}>
                <MaterialIcons name="calendar-today" size={14} color={THEME.accent} style={{ marginRight: 6 }} />
                <Text style={styles.compactSub}>{tgl}</Text>
              </View>
            </View>

            <View style={[styles.compactBadge, isDone ? styles.badgeDone : styles.badgeNotDone]}>
              <Text style={styles.compactBadgeText}>{statusLabel}</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [openEditFab]
  );

  const ListHeader = (
    <View style={styles.headerWrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Visit</Text>
        <Text style={styles.subtitle}>Kunjungan</Text>
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

      <View style={styles.row2}>
        <View style={styles.col}>
          <Text style={styles.label}>Tanggal Awal</Text>
          <TouchableOpacity style={styles.dateSelect} onPress={() => setShowAwal(true)} activeOpacity={0.9}>
            <Text style={styles.dateText}>{formatDisplayDate(tanggalAwal)}</Text>
            <MaterialIcons name="edit-calendar" color={THEME.ink} size={22} />
          </TouchableOpacity>
        </View>

        <View style={styles.col}>
          <Text style={styles.label}>Tanggal Akhir</Text>
          <TouchableOpacity style={styles.dateSelect} onPress={() => setShowAkhir(true)} activeOpacity={0.9}>
            <Text style={styles.dateText}>{formatDisplayDate(tanggalAkhir)}</Text>
            <MaterialIcons name="edit-calendar" color={THEME.ink} size={22} />
          </TouchableOpacity>
        </View>
      </View>

      {showAwal && (
        <DateTimePicker
          value={ymdToDate(tanggalAwal)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event: any, selected?: Date) => {
            setShowAwal(false);
            if (selected) setTanggalAwal(dateToYmd(selected));
          }}
        />
      )}

      {showAkhir && (
        <DateTimePicker
          value={ymdToDate(tanggalAkhir)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event: any, selected?: Date) => {
            setShowAkhir(false);
            if (selected) setTanggalAkhir(dateToYmd(selected));
          }}
        />
      )}

      <Text style={styles.smallHint}>
        Menampilkan: <Text style={{ fontWeight: '900' }}>{data.length}</Text> data
      </Text>

      <View style={styles.divider} />
    </View>
  );

  return (
    <LinearGradient colors={[THEME.bgTop, THEME.bgBottom]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <FlatList
        data={data}
        keyExtractor={(item: any, idx) => String(item.id ?? idx)}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          loading ? <ActivityIndicator style={{ marginTop: 20 }} /> : <Text style={styles.empty}>Data visit tidak ditemukan.</Text>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onTouchStart={() => setShowEditFab(false)}
      />

      {showFab && (
        <TouchableOpacity activeOpacity={0.9} onPress={() => setOpenFilter(true)} style={styles.fab}>
          <View style={styles.fabInner}>
            <Text style={{ fontSize: 18 }}>🔍</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* FAB Edit (✏️) muncul saat item dipilih */}
      {showEditFab && selectedItem && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            setShowEditFab(false);
            navigation.navigate('EditVisit', { data: selectedItem });
          }}
          style={styles.editFab}
        >
          <View style={styles.fabInner}>
            <MaterialIcons name="edit" size={22} color={THEME.ink} />
          </View>
        </TouchableOpacity>
      )}

      {/* Modal Filter */}
      <Modal visible={openFilter} transparent animationType="fade" onRequestClose={() => setOpenFilter(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter</Text>
              <TouchableOpacity onPress={() => setOpenFilter(false)} activeOpacity={0.8}>
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

            <View style={styles.row2}>
              <View style={styles.col}>
                <Text style={styles.label}>Tanggal Awal</Text>
                <TouchableOpacity style={styles.dateSelect} onPress={() => setShowAwal(true)} activeOpacity={0.9}>
                  <Text style={styles.dateText}>{formatDisplayDate(tanggalAwal)}</Text>
                  <MaterialIcons name="edit-calendar" color={THEME.ink} size={22} />
                </TouchableOpacity>
              </View>

              <View style={styles.col}>
                <Text style={styles.label}>Tanggal Akhir</Text>
                <TouchableOpacity style={styles.dateSelect} onPress={() => setShowAkhir(true)} activeOpacity={0.9}>
                  <Text style={styles.dateText}>{formatDisplayDate(tanggalAkhir)}</Text>
                  <MaterialIcons name="edit-calendar" color={THEME.ink} size={22} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.row2, { marginTop: 14 }]}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: THEME.accent }]}
                onPress={() => {
                  setOpenFilter(false);
                  refresh();
                }}
                disabled={loading || (isManager && (!selectedSales || loadingSales))}
                activeOpacity={0.9}
              >
                <Text style={styles.modalBtnText}>Refresh</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: THEME.wa }]}
                onPress={() => {
                  setOpenFilter(false);
                  kirimWA();
                }}
                disabled={loading || (isManager && (!selectedSales || loadingSales))}
                activeOpacity={0.9}
              >
                <Text style={styles.modalBtnText}>Kirim WA</Text>
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
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kirim lewat</Text>
              <TouchableOpacity onPress={() => setOpenWaOption(false)} activeOpacity={0.8}>
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
              style={[styles.waPickBtn, { backgroundColor: 'rgba(15,23,42,0.06)', borderWidth: 1, borderColor: THEME.line }]}
              activeOpacity={0.9}
              onPress={() => setOpenWaOption(false)}
            >
              <Text style={[styles.waPickText, { color: THEME.ink }]}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bottom Action Bar (tetap seperti sebelumnya, style mengikuti referensi) */}
      <View style={styles.bottomAction}>
        {!isManager && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => navigation.navigate('TambahVisit')}
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
          onPress={refresh}
          disabled={loading || (isManager && (!selectedSales || loadingSales))}
          activeOpacity={0.9}
        >
          {loading ? (
            <ActivityIndicator color={THEME.primary} />
          ) : (
            <Text style={[styles.bottomActionText, { color: THEME.primary }]}>Refresh</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionBtn,
            styles.actionBtnWa,
            isManager && { flex: 1 },
          ]}
          onPress={kirimWA}
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
    paddingTop: Platform.OS === 'android' ? 54 : 18,
    paddingBottom: 120,
  },

  headerWrap: {
    backgroundColor: THEME.bgBottom,
    paddingBottom: 10,
  },

  header: { alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 25, fontWeight: '900', color: THEME.ink, letterSpacing: 0.2 },
  subtitle: { color: THEME.muted, fontSize: 12, marginTop: 6, fontWeight: '700', textAlign: 'center' },

  row2: { flexDirection: 'row', gap: 10, marginTop: 4 },
  col: { flex: 1 },

  divider: { marginTop: 10, height: 1, backgroundColor: THEME.line },

  smallHint: { marginTop: 10, color: THEME.muted, fontSize: 12, textAlign: 'center', fontWeight: '700' },

  label: {
    color: THEME.muted,
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 4,
    marginBottom: 6,
    marginTop: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  readonlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.soft,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 12,
    height: 55,
  },
  readonlyText: { flex: 1, color: THEME.ink, fontSize: 15, fontWeight: '900' },

  dateSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.soft,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 12,
    height: 55,
  },
  dateText: { flex: 1, color: THEME.ink, fontSize: 14, fontWeight: '900' },

  empty: { textAlign: 'center', marginTop: 18, color: THEME.muted, fontSize: 13, fontWeight: '700' },

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

  actionBtnPrimary: { backgroundColor: THEME.accent, borderColor: 'rgba(79,70,229,0.18)' },
  actionBtnSoft: { backgroundColor: 'rgba(79,70,229,0.08)', borderColor: 'rgba(79,70,229,0.18)' },
  actionBtnWa: { backgroundColor: THEME.wa, borderColor: 'rgba(34,197,94,0.18)' },

  bottomActionText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13, letterSpacing: 0.3 },

  fab: { position: 'absolute', right: 16, bottom: 90 },
  editFab: { position: 'absolute', right: 16, bottom: 152 },

  fabInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.78)',
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

  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { color: THEME.ink, fontWeight: '900', fontSize: 16 },
  modalClose: { color: THEME.muted, fontWeight: '900', fontSize: 18, paddingHorizontal: 6 },

  modalBtn: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { color: '#fff', fontWeight: '900', letterSpacing: 0.3 },

  // === Compact card ala VisitPlan ===
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

  badgeDone: { backgroundColor: 'rgba(22,163,74,0.10)', borderColor: 'rgba(22,163,74,0.22)' },
  badgeNotDone: { backgroundColor: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.22)' },

  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
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
});
