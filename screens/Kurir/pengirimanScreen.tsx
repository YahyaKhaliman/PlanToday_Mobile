import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Toast from 'react-native-toast-message';

import api from '../../services/api';
import { useAuth } from '../../context/authContext';

type Pengiriman = {
  id: number;
  kode_pengiriman: string;
  tujuan: string;
  sender?: string | null;
  receiver?: string | null;
  note?: string | null;
  alamat_tujuan?: string | null;
  catatan?: string | null;
  status: string;
  tanggal_kirim: string;
  tanggal_plan?: string | null;
  realisasi?: string | null;
};

type Mode = 'all' | 'plan' | 'done';

const THEME = {
  primary: '#4F46E5',
  accent: '#06B6D4',
  ink: '#0F172A',
  muted: '#64748B',
  card: '#FFFFFF',
  line: 'rgba(15,23,42,0.08)',
  bgTop: '#F7F9FF',
  bgBottom: '#FFFFFF',
};

const mapStatusColor = (status: string) => {
  switch (status) {
    case 'delivered':
      return '#16A34A';
    case 'in_transit':
      return '#2563EB';
    case 'ready':
      return '#EA580C';
    case 'cancelled':
      return '#DC2626';
    default:
      return '#64748B';
  }
};

const mapStatusLabel = (status: string) => {
  switch (status) {
    case 'delivered':
      return 'Delivered';
    case 'in_transit':
      return 'In Transit';
    case 'ready':
      return 'Ready';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Draft';
  }
};

const dateToYmd = (date: Date) => date.toISOString().slice(0, 10);

const formatDateLabel = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
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
  const date = new Date(year, (month || 1) - 1, day || 1);
  return `${date.getDate()} ${bulan[date.getMonth()]} ${date.getFullYear()}`;
};

export default function KurirPengirimanScreen({ navigation }: any) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<Pengiriman[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [mode, setMode] = useState<Mode>('all');
  const [selectedDate, setSelectedDate] = useState(dateToYmd(new Date()));
  const [showDate, setShowDate] = useState(false);

  const endpoint = useMemo(() => {
    if (mode === 'plan') return '/kurir/rencana-kirim';
    if (mode === 'done') return '/kurir/kirim';
    return '/kurir/pengiriman';
  }, [mode]);

  const fetchData = useCallback(
    async (nextPage = 1, silent = false) => {
      if (!token) {
        setLoading(false);
        return;
      }

      if (!silent) setLoading(true);
      try {
        const params: Record<string, string | number> = {
          page: nextPage,
          limit: 10,
        };
        if (mode !== 'all') {
          params.tanggal = selectedDate;
        }

        const res = await api.get(endpoint, {
          params,
          headers: { Authorization: `Bearer ${token}` },
        });

        const payload = res.data || {};
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        const pagination = payload?.meta?.pagination || {};

        setItems(rows as Pengiriman[]);
        setPage(Number(pagination?.page || nextPage));
        setTotalPages(Number(pagination?.total_pages || 1));
      } catch (err: any) {
        Toast.show({
          type: 'glassError',
          text1: 'Gagal memuat data',
          text2:
            err?.response?.data?.message ||
            'Tidak dapat mengambil data kiriman',
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [endpoint, mode, selectedDate, token],
  );

  useFocusEffect(
    React.useCallback(() => {
      fetchData(1);
    }, [fetchData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(1, true);
  }, [fetchData]);

  const emptyText = useMemo(() => {
    if (!token) return 'Silakan login ulang';
    if (mode === 'plan') return 'Belum ada rencana kirim untuk tanggal ini';
    if (mode === 'done') return 'Belum ada kiriman selesai untuk tanggal ini';
    return 'Belum ada data pengiriman';
  }, [mode, token]);

  const headerSubtitle = useMemo(() => {
    if (mode === 'plan') return 'Rencana kirim harian dari modul Delphi';
    if (mode === 'done') return 'Rekap kirim selesai per tanggal';
    return 'Daftar pengiriman dan progres terakhir';
  }, [mode]);

  const renderModeChip = (value: Mode, label: string) => {
    const active = mode === value;
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        key={value}
        onPress={() => {
          setMode(value);
          setPage(1);
        }}
        style={[styles.chip, active && styles.chipActive]}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>
          {label}
        </Text>
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

      <SafeAreaView style={styles.safe}>
        <View style={styles.headerWrap}>
          <View style={styles.titleRow}>
            <View style={styles.titleTextWrap}>
              <Text style={styles.headerTitle}>Kiriman Kurir</Text>
              <Text style={styles.headerSub}>{headerSubtitle}</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => navigation.navigate('KurirTambahPengiriman')}
              style={styles.headerBtn}
            >
              <Text style={styles.headerBtnText}>Rencana Baru</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.chipRow}>
            {renderModeChip('all', 'Semua')}
            {renderModeChip('plan', 'Rencana')}
            {renderModeChip('done', 'Terkirim')}
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setShowDate(true)}
            style={styles.dateFilter}
          >
            <Text style={styles.dateFilterLabel}>Tanggal Filter</Text>
            <Text style={styles.dateFilterValue}>
              {formatDateLabel(selectedDate)}
            </Text>
          </TouchableOpacity>

          {showDate && (
            <DateTimePicker
              value={new Date(selectedDate)}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event: any, selected?: Date) => {
                setShowDate(false);
                if (selected) {
                  setSelectedDate(dateToYmd(selected));
                }
              }}
            />
          )}
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={THEME.primary} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>{emptyText}</Text>
              </View>
            }
            renderItem={({ item }) => {
              const status = String(item.status || 'draft');
              const color = mapStatusColor(status);
              const label = mapStatusLabel(status);

              return (
                <View style={styles.card}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.kode} numberOfLines={1}>
                      {item.kode_pengiriman}
                    </Text>
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor: `${color}22`,
                          borderColor: `${color}44`,
                        },
                      ]}
                    >
                      <Text style={[styles.badgeText, { color }]}>{label}</Text>
                    </View>
                  </View>

                  <Text style={styles.tujuan} numberOfLines={1}>
                    {item.receiver || item.tujuan || '-'}
                  </Text>
                  <Text style={styles.asal} numberOfLines={1}>
                    Dari: {item.sender || '-'}
                  </Text>
                  {!!item.note && (
                    <Text style={styles.note} numberOfLines={2}>
                      {item.note}
                    </Text>
                  )}
                  {!!item.catatan && (
                    <Text style={styles.catatan} numberOfLines={2}>
                      Catatan: {item.catatan}
                    </Text>
                  )}

                  <View style={styles.footerRow}>
                    <Text style={styles.footerLabel}>
                      {mode === 'plan' ? 'Tanggal Plan' : 'Tanggal Kirim'}
                    </Text>
                    <Text style={styles.footerValue}>
                      {(mode === 'plan'
                        ? item.tanggal_plan || item.tanggal_kirim
                        : item.tanggal_kirim) || '-'}
                    </Text>
                  </View>

                  <View style={styles.actionRow}>
                    {status === 'delivered' ? (
                      <View style={[styles.actionPill, styles.actionDone]}>
                        <Text style={styles.actionDoneText}>Selesai</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() =>
                          navigation.navigate('KurirProsesPengiriman', {
                            id: item.id,
                          })
                        }
                        style={styles.actionBtn}
                      >
                        <Text style={styles.actionBtnText}>Proses Kirim</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            }}
            ListFooterComponent={
              items.length > 0 ? (
                <View style={styles.paginationWrap}>
                  <TouchableOpacity
                    style={[
                      styles.pageBtn,
                      page <= 1 && styles.pageBtnDisabled,
                    ]}
                    disabled={page <= 1}
                    onPress={() => fetchData(page - 1, true)}
                  >
                    <Text style={styles.pageBtnText}>Prev</Text>
                  </TouchableOpacity>

                  <Text style={styles.pageInfo}>
                    {page} / {totalPages}
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.pageBtn,
                      page >= totalPages && styles.pageBtnDisabled,
                    ]}
                    disabled={page >= totalPages}
                    onPress={() => fetchData(page + 1, true)}
                  >
                    <Text style={styles.pageBtnText}>Next</Text>
                  </TouchableOpacity>
                </View>
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  headerWrap: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleTextWrap: { flex: 1, paddingRight: 10 },
  headerTitle: {
    color: THEME.ink,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  headerSub: {
    color: THEME.muted,
    marginTop: 4,
    fontWeight: '700',
    fontSize: 12,
  },
  headerBtn: {
    minHeight: 38,
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.primary,
  },
  headerBtnText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  chipRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  chip: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: THEME.line,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: 'rgba(79,70,229,0.12)',
    borderColor: 'rgba(79,70,229,0.24)',
  },
  chipText: { color: THEME.muted, fontWeight: '800', fontSize: 12 },
  chipTextActive: { color: THEME.primary },
  dateFilter: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.line,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateFilterLabel: { color: THEME.muted, fontSize: 11, fontWeight: '800' },
  dateFilterValue: {
    color: THEME.ink,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 20, paddingBottom: 28 },
  emptyCard: {
    marginTop: 20,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 16,
    padding: 16,
  },
  emptyText: { color: THEME.muted, textAlign: 'center', fontWeight: '700' },
  card: {
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center' },
  kode: {
    flex: 1,
    color: THEME.ink,
    fontWeight: '900',
    fontSize: 14,
    marginRight: 8,
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 11, fontWeight: '900' },
  tujuan: { color: THEME.ink, marginTop: 8, fontWeight: '700', fontSize: 13 },
  asal: { color: THEME.muted, marginTop: 4, fontWeight: '700', fontSize: 12 },
  note: { color: THEME.muted, marginTop: 3, fontWeight: '600', fontSize: 12 },
  catatan: {
    color: THEME.primary,
    marginTop: 3,
    fontWeight: '700',
    fontSize: 12,
  },
  footerRow: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.line,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerLabel: { color: THEME.muted, fontSize: 11, fontWeight: '800' },
  footerValue: { color: THEME.ink, fontSize: 11, fontWeight: '800' },
  actionRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionBtn: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  actionPill: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDone: { backgroundColor: 'rgba(22,163,74,0.12)' },
  actionDoneText: { color: '#15803D', fontWeight: '900', fontSize: 12 },
  paginationWrap: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageBtn: {
    height: 36,
    minWidth: 84,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.line,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnDisabled: { opacity: 0.45 },
  pageBtnText: { color: THEME.ink, fontWeight: '800', fontSize: 12 },
  pageInfo: { color: THEME.muted, fontWeight: '800' },
});
