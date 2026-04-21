/* eslint-disable react-native/no-inline-styles */
import React, { useCallback, useMemo, useState } from 'react';
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
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import api from '../../services/api';
import { useAuth } from '../../context/authContext';

type RencanaItem = {
  id: number;
  kode_pengiriman: string;
  sender?: string | null;
  receiver?: string | null;
  note?: string | null;
  catatan?: string | null;
  tanggal_plan?: string | null;
  jam_plan?: string | null;
  status: string;
  realisasi?: string | null;
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
  ok: '#16A34A',
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

const normalizeYmd = (v: string) => String(v || '').slice(0, 10);

const formatDdMmYyyy = (ymd: string) => {
  try {
    const [y, m, d] = ymd.split('-').map(Number);
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

export default function KurirRencanaKirimScreen({ navigation }: any) {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();

  const currentMonthRange = useMemo(() => {
    const now = new Date();
    return {
      start: dateToYmd(new Date(now.getFullYear(), now.getMonth(), 1)),
      end: dateToYmd(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }, []);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RencanaItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [tanggalAwal, setTanggalAwal] = useState(currentMonthRange.start);
  const [tanggalAkhir, setTanggalAkhir] = useState(currentMonthRange.end);
  const [showAwal, setShowAwal] = useState(false);
  const [showAkhir, setShowAkhir] = useState(false);
  const [showFab, setShowFab] = useState(false);

  const fetchData = useCallback(
    async (nextPage = 1, silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await api.get('/kurir/rencana-kirim', {
          params: {
            page: nextPage,
            limit: 15,
            tanggal_awal: tanggalAwal,
            tanggal_akhir: tanggalAkhir,
          },
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = res.data || {};
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        const pagination = payload?.meta?.pagination || {};
        setData(rows as RencanaItem[]);
        setPage(Number(pagination?.page || nextPage));
        setTotalPages(Number(pagination?.total_pages || 1));
      } catch (err: any) {
        Toast.show({
          type: 'glassError',
          text1: 'Gagal memuat data',
          text2:
            err?.response?.data?.message ||
            'Tidak dapat mengambil rencana kirim',
        });
        setData([]);
      } finally {
        setLoading(false);
      }
    },
    [token, tanggalAwal, tanggalAkhir],
  );

  useFocusEffect(
    useCallback(() => {
      fetchData(1);
    }, [fetchData]),
  );

  const onScroll = useCallback((e: any) => {
    const y = e.nativeEvent.contentOffset.y || 0;
    setShowFab(y > 200);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: RencanaItem }) => {
      const isDone = String(item.realisasi || 'N').toUpperCase() === 'Y';
      const tanggalItem = normalizeYmd(String(item.tanggal_plan || ''));
      return (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            if (!isDone) {
              navigation.navigate('KurirProsesPengiriman', { id: item.id });
            }
          }}
          style={styles.cardCompact}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.compactTitle} numberOfLines={1}>
              {item.kode_pengiriman}
            </Text>
            {!!tanggalItem && (
              <View style={styles.inlineRow}>
                <MaterialIcons
                  name="calendar-today"
                  size={14}
                  color={THEME.accent}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.compactSub}>
                  {formatDdMmYyyy(tanggalItem)}
                </Text>
              </View>
            )}
            <Text style={styles.compactSub} numberOfLines={1}>
              Ke: {item.receiver || '-'}
            </Text>
            {!!item.note && (
              <Text style={styles.compactSub} numberOfLines={1}>
                {item.note}
              </Text>
            )}
          </View>
          <View
            style={[
              styles.compactBadge,
              isDone ? styles.badgeDone : styles.badgeNotDone,
            ]}
          >
            <Text style={styles.compactBadgeText}>
              {isDone ? 'DONE' : 'BELUM'}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [navigation],
  );

  const ListHeader = (
    <View style={styles.headerWrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Rencana Kirim</Text>
        <Text style={styles.subtitle}>
          Daftar rencana pengiriman per periode
        </Text>
      </View>

      <View style={styles.row2}>
        <View style={styles.col}>
          <Text style={styles.label}>Tanggal Awal</Text>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setShowAwal(true)}
            style={styles.dateSelect}
          >
            <Text style={styles.dateText}>
              {formatDisplayDate(tanggalAwal)}
            </Text>
            <MaterialIcons name="edit-calendar" color={THEME.ink} size={22} />
          </TouchableOpacity>
        </View>

        <View style={styles.col}>
          <Text style={styles.label}>Tanggal Akhir</Text>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setShowAkhir(true)}
            style={styles.dateSelect}
          >
            <Text style={styles.dateText}>
              {formatDisplayDate(tanggalAkhir)}
            </Text>
            <MaterialIcons name="edit-calendar" color={THEME.ink} size={22} />
          </TouchableOpacity>
        </View>
      </View>

      {showAwal && (
        <DateTimePicker
          value={new Date(tanggalAwal)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_: any, d?: Date) => {
            setShowAwal(false);
            if (d) setTanggalAwal(dateToYmd(d));
          }}
        />
      )}

      {showAkhir && (
        <DateTimePicker
          value={new Date(tanggalAkhir)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_: any, d?: Date) => {
            setShowAkhir(false);
            if (d) setTanggalAkhir(dateToYmd(d));
          }}
        />
      )}

      <Text style={styles.smallHint}>
        Menampilkan: <Text style={{ fontWeight: '900' }}>{data.length}</Text>{' '}
        data
      </Text>

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
        data={data}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 20 }} />
          ) : (
            <Text style={styles.empty}>
              Belum ada rencana kirim untuk periode ini
            </Text>
          )
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 120 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        ListFooterComponent={
          data.length > 0 ? (
            <View style={styles.paginationWrap}>
              <TouchableOpacity
                style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
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

      {showFab && (
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.85}
          onPress={() => {
            // Scroll to top action
          }}
        >
          <View style={styles.fabInner}>
            <Text style={{ fontSize: 20 }}>↑</Text>
          </View>
        </TouchableOpacity>
      )}

      <View
        style={[
          styles.bottomAction,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnPrimary]}
          onPress={() => navigation.navigate('KurirTambahPengiriman')}
          activeOpacity={0.9}
        >
          <Text style={styles.bottomActionText}>+ Tambah</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnSoft]}
          onPress={() => fetchData(1)}
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
  title: {
    fontSize: 25,
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
  dateText: { flex: 1, color: THEME.ink, fontSize: 14, fontWeight: '900' },
  smallHint: {
    marginTop: 10,
    color: THEME.muted,
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '700',
  },
  divider: { marginTop: 10, height: 1, backgroundColor: THEME.line },
  empty: {
    textAlign: 'center',
    marginTop: 18,
    color: THEME.muted,
    fontSize: 13,
    fontWeight: '700',
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
    backgroundColor: 'rgba(79,70,229,0.10)',
    borderColor: 'rgba(79,70,229,0.22)',
  },
  badgeDone: {
    backgroundColor: 'rgba(22,163,74,0.10)',
    borderColor: 'rgba(22,163,74,0.22)',
  },
  badgeNotDone: {
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderColor: 'rgba(239,68,68,0.22)',
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
    marginTop: 6,
  },
  paginationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  pageBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pageBtnDisabled: { backgroundColor: '#CBD5E1' },
  pageBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  pageInfo: { fontSize: 13, color: '#0F172A', fontWeight: '600' },
  fab: { position: 'absolute', right: 16, bottom: 90 },
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
  bottomActionText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.3,
  },
});
