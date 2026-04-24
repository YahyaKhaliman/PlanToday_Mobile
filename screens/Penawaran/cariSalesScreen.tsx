/* eslint-disable react-native/no-inline-styles */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  StatusBar,
  FlatList,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePressGuard } from '../../utils/usePressGuard';
import {
  getMasterSales,
  PenawaranMasterOption,
} from '../../services/penawaranApi';

const THEME = {
  primary: '#4F46E5',
  accent: '#06B6D4',
  ink: '#0F172A',
  muted: '#64748B',
  card: '#FFFFFF',
  soft: '#F1F5F9',
  line: 'rgba(15,23,42,0.08)',
  bgTop: '#F7F9FF',
  bgBottom: '#FFFFFF',
};

const cleanText = (s: any) =>
  String(s ?? '')
    .replace(/\r?\n/g, ' ')
    .trim();

export default function CariSalesScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const runGuardedPress = usePressGuard();
  const keywordFromPrev = route?.params?.keyword || '';

  const [keyword, setKeyword] = useState(String(keywordFromPrev));
  const [data, setData] = useState<PenawaranMasterOption[]>([]);
  const [loading, setLoading] = useState(false);

  const canSearch = useMemo(
    () => keyword.trim().length >= 1 && !loading,
    [keyword, loading],
  );

  const cari = useCallback(async () => {
    const q = keyword.trim();
    if (q.length < 1) {
      Toast.show({
        type: 'glassError',
        text1: 'Validasi',
        text2: 'Ketik minimal 1 huruf untuk mencari',
      });
      return;
    }

    setLoading(true);
    try {
      const rows = await getMasterSales(q);
      setData(rows);
    } catch (err: any) {
      Toast.show({
        type: 'glassError',
        text1: 'Error',
        text2: err?.response?.data?.message || 'Gagal mengambil data sales',
      });
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  useEffect(() => {
    if (String(keywordFromPrev || '').trim().length >= 1) {
      cari();
    }
  }, [cari, keywordFromPrev]);

  const pilih = (item: PenawaranMasterOption) => {
    runGuardedPress(`search-sales:pick:${item.kode}`, () => {
      navigation.navigate({
        name: 'PenawaranCreate',
        params: {
          selectedSales: {
            kode: item.kode,
            nama: item.nama,
            alamat: item.alamat || '',
          },
        },
        merge: true,
      });
    });
  };

  const renderItem = ({ item }: { item: PenawaranMasterOption }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => pilih(item)}
      style={styles.card}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.avatar}>
          <Text style={{ fontSize: 16 }}>👤</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{cleanText(item.nama)}</Text>
          <Text style={styles.cardMeta}>Kode: {cleanText(item.kode)}</Text>
        </View>

        <View style={styles.pill}>
          <Text style={styles.pillText}>PILIH</Text>
        </View>
      </View>

      {!!item.alamat && (
        <Text style={styles.cardText}>{cleanText(item.alamat)}</Text>
      )}
    </TouchableOpacity>
  );

  const header = (
    <View style={styles.headerWrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Cari Sales</Text>
        <Text style={styles.subtitle}>Ketik nama/kode, lalu pilih sales</Text>
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔎</Text>
        <TextInput
          value={keyword}
          onChangeText={setKeyword}
          placeholder="Nama/kode sales..."
          placeholderTextColor={THEME.muted}
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={cari}
          autoCorrect={false}
          autoCapitalize="characters"
        />
      </View>

      {!!keyword?.trim() && (
        <Text style={styles.smallHint}>
          Hasil: <Text style={{ fontWeight: '900' }}>{data.length}</Text>
        </Text>
      )}

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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <FlatList
          data={data}
          keyExtractor={item => String(item.kode)}
          renderItem={renderItem}
          ListHeaderComponent={header}
          stickyHeaderIndices={[0]}
          ListHeaderComponentStyle={styles.stickyHeader}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 110 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={{ marginTop: 20 }} />
            ) : (
              <Text style={styles.empty}>
                {keyword.trim().length >= 1
                  ? 'Data tidak ditemukan'
                  : 'Ketik minimal 1 huruf untuk mulai mencari'}
              </Text>
            )
          }
        />

        <View
          style={[
            styles.bottomAction,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSoft]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.9}
          >
            <Text style={[styles.actionText, { color: THEME.primary }]}>
              Kembali
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={cari}
            disabled={!canSearch}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionText}>Cari</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 54 : 18,
    paddingBottom: 110,
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
  divider: { marginTop: 10, height: 1, backgroundColor: THEME.line },
  smallHint: {
    marginTop: 8,
    color: THEME.muted,
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.soft,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: THEME.line,
    paddingHorizontal: 12,
    height: 55,
  },
  searchIcon: { fontSize: 16, marginRight: 10 },
  searchInput: {
    flex: 1,
    color: THEME.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  card: {
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
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: THEME.soft,
    borderWidth: 1,
    borderColor: THEME.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(6,182,212,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.20)',
  },
  pillText: {
    color: THEME.ink,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.6,
  },
  cardTitle: { color: THEME.ink, fontSize: 15, fontWeight: '900' },
  cardMeta: {
    color: THEME.muted,
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
  },
  cardText: {
    color: THEME.muted,
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  stickyHeader: {
    zIndex: 10,
    elevation: 2,
  },
  empty: {
    textAlign: 'center',
    color: THEME.muted,
    marginTop: 18,
    fontWeight: '700',
  },
  bottomAction: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: 1,
    borderTopColor: THEME.line,
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnSoft: {
    borderWidth: 1,
    borderColor: THEME.line,
    backgroundColor: '#fff',
  },
  actionBtnPrimary: {
    backgroundColor: THEME.primary,
  },
  actionText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.6,
  },
});
