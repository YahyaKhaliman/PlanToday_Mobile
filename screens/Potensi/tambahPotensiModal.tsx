/* eslint-disable react-native/no-inline-styles */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import Toast from 'react-native-toast-message';
import {
  getPotensiKandidatList,
  createPotensiBatch,
  PotensiKandidatItem,
  CreatePotensiPayload,
} from '../../services/potensiApi';
import { useAuth } from '../../context/authContext';
import { THEME, SHADOWS } from '../theme';

interface TambahPotensiModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const formatRupiah = (val: number | string) => {
  const num = Number(val) || 0;
  return `Rp ${new Intl.NumberFormat('id-ID').format(num)}`;
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

export default function TambahPotensiModal({
  visible,
  onClose,
  onSuccess,
}: TambahPotensiModalProps) {
  const { token } = useAuth();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rawKandidat, setRawKandidat] = useState<PotensiKandidatItem[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENAWARAN' | 'MAP'>('ALL');
  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<Map<string, PotensiKandidatItem>>(
    new Map(),
  );

  const getItemKey = (item: PotensiKandidatItem): string => {
    return `${item.tipe_sumber}_${item.pen_nomor || ''}_${item.mspk_nomor || ''}_${item.item_id || ''}_${item.nama_item}`;
  };

  const fetchKandidat = useCallback(
    async (isRefresh = false) => {
      if (!token) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const data = await getPotensiKandidatList(
          {
            sumber: 'ALL',
          },
          token,
        );
        setRawKandidat(data || []);
      } catch (err: any) {
        console.error('[TambahPotensiModal][Error]', err);
        const msg =
          err?.response?.data?.message || 'Gagal memuat daftar kandidat potensi';
        Toast.show({
          type: 'glassError',
          text1: 'Error',
          text2: msg,
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  // Inisialisasi saat modal dibuka
  useEffect(() => {
    if (visible) {
      setSelectedItems(new Map());
      setSearch('');
      setActiveTab('ALL');
      fetchKandidat();
    }
  }, [visible, fetchKandidat]);

  // Hitung jumlah item masing-masing kategori
  const counts = useMemo(() => {
    let penawaranCount = 0;
    let mapCount = 0;
    rawKandidat.forEach(it => {
      if (it.tipe_sumber === 'PENAWARAN') penawaranCount++;
      else if (it.tipe_sumber === 'MAP') mapCount++;
    });
    return {
      all: rawKandidat.length,
      penawaran: penawaranCount,
      map: mapCount,
    };
  }, [rawKandidat]);

  // Filter list berdasarkan activeTab & search live
  const filteredList = useMemo(() => {
    return rawKandidat.filter(item => {
      // Filter tipe sumber
      if (activeTab === 'PENAWARAN' && item.tipe_sumber !== 'PENAWARAN') {
        return false;
      }
      if (activeTab === 'MAP' && item.tipe_sumber !== 'MAP') {
        return false;
      }

      // Filter pencarian
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      const matchNomor =
        (item.pen_nomor && item.pen_nomor.toLowerCase().includes(q)) ||
        (item.mspk_nomor && item.mspk_nomor.toLowerCase().includes(q));
      const matchCustomer =
        item.customer_nama && item.customer_nama.toLowerCase().includes(q);
      const matchItem =
        item.nama_item && item.nama_item.toLowerCase().includes(q);
      const matchSales =
        item.sales_nama && item.sales_nama.toLowerCase().includes(q);

      return Boolean(matchNomor || matchCustomer || matchItem || matchSales);
    });
  }, [rawKandidat, activeTab, search]);

  const toggleSelect = (item: PotensiKandidatItem) => {
    const key = getItemKey(item);
    setSelectedItems(prev => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, item);
      }
      return next;
    });
  };

  const isAllSelected = useMemo(() => {
    if (filteredList.length === 0) return false;
    return filteredList.every(it => selectedItems.has(getItemKey(it)));
  }, [filteredList, selectedItems]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      // Unselect semua item yang sedang tampil
      setSelectedItems(prev => {
        const next = new Map(prev);
        filteredList.forEach(it => next.delete(getItemKey(it)));
        return next;
      });
    } else {
      // Select semua item yang sedang tampil
      setSelectedItems(prev => {
        const next = new Map(prev);
        filteredList.forEach(it => next.set(getItemKey(it), it));
        return next;
      });
    }
  };

  const { totalSelectedCount, totalSelectedNominal } = useMemo(() => {
    let count = 0;
    let nominal = 0;
    selectedItems.forEach(it => {
      count++;
      nominal += Number(it.harga || 0);
    });
    return { totalSelectedCount: count, totalSelectedNominal: nominal };
  }, [selectedItems]);

  const handleSubmit = async () => {
    if (selectedItems.size === 0) {
      Toast.show({
        type: 'glassError',
        text1: 'Peringatan',
        text2: 'Pilih minimal 1 item untuk ditambahkan ke Potensi',
      });
      return;
    }

    setSubmitting(true);
    try {
      const itemsPayload: CreatePotensiPayload[] = Array.from(
        selectedItems.values(),
      ).map(it => ({
        pot_sal_kode: it.sales_kode || undefined,
        pot_cus_kode: it.customer_kode || undefined,
        pot_pen_nomor: it.pen_nomor || null,
        pot_mspk_nomor: it.mspk_nomor || null,
        pot_nama_item: it.nama_item,
        pot_harga: Number(it.harga || 0),
        pot_perush_kode: it.perush_kode || undefined,
        pot_jo_kode: it.jo_kode || undefined,
      }));

      const res = await createPotensiBatch(itemsPayload, token);

      Toast.show({
        type: 'glassSuccess',
        text1: 'Berhasil Disimpan',
        text2: `${res.data?.length || itemsPayload.length} item berhasil masuk ke Potensi`,
      });

      onSuccess();
    } catch (err: any) {
      console.error('[TambahPotensiModal][SubmitError]', err);
      const msg =
        err?.response?.data?.message || 'Gagal menyimpan data potensi';
      Toast.show({
        type: 'glassError',
        text1: 'Gagal Menyimpan',
        text2: msg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: PotensiKandidatItem }) => {
    const key = getItemKey(item);
    const isSelected = selectedItems.has(key);
    const isMap = item.tipe_sumber === 'MAP';

    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => toggleSelect(item)}
        activeOpacity={0.85}
      >
        <View style={styles.cardTopRow}>
          {/* Checkbox */}
          <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
            {isSelected && <MaterialIcons name="check" size={14} color="#FFFFFF" />}
          </View>

          {/* Type Tag */}
          <View
            style={[
              styles.typeBadge,
              isMap ? styles.typeBadgeMap : styles.typeBadgePenawaran,
            ]}
          >
            <MaterialIcons
              name={isMap ? 'assignment' : 'receipt'}
              size={12}
              color={isMap ? '#0284C7' : THEME.primary}
            />
            <Text
              style={[
                styles.typeBadgeText,
                isMap ? styles.typeBadgeTextMap : styles.typeBadgeTextPenawaran,
              ]}
            >
              {isMap ? 'MEMO SPK' : 'PENAWARAN'}
            </Text>
          </View>

          {/* Nomor Ref */}
          <Text style={styles.refNumberText} numberOfLines={1}>
            {item.mspk_nomor || item.pen_nomor || '-'}
          </Text>

          {/* Tanggal */}
          <Text style={styles.dateText}>{formatDate(item.tanggal)}</Text>
        </View>

        {/* Nama Item */}
        <Text style={styles.itemTitle} numberOfLines={2}>
          {item.nama_item}
        </Text>

        {/* Customer & Sales */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <MaterialIcons name="business" size={13} color={THEME.muted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.customer_nama || item.customer_kode || '-'}
            </Text>
          </View>
          <View style={[styles.metaItem, { marginLeft: 10 }]}>
            <MaterialIcons name="person" size={13} color={THEME.muted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.sales_nama || item.sales_kode || '-'}
            </Text>
          </View>
        </View>

        {/* Harga */}
        <View style={styles.cardBottomRow}>
          <Text style={styles.priceLabel}>Nominal</Text>
          <Text style={styles.priceValue}>{formatRupiah(item.harga)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        {/* Modal Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <MaterialIcons name="close" size={24} color={THEME.ink} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Pilih Kandidat Potensi</Text>
            <Text style={styles.headerSubtitle}>
              Penawaran (belum MAP) & MAP (belum SO)
            </Text>
          </View>
        </View>

        {/* Filter & Search Header Card */}
        <View style={styles.filterCard}>
          {/* Search Box */}
          <View style={styles.searchBox}>
            <MaterialIcons
              name="search"
              size={20}
              color={THEME.muted}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari no. doc / customer / item..."
              placeholderTextColor={THEME.muted}
              value={search}
              onChangeText={setSearch}
            />
            {search.trim() ? (
              <TouchableOpacity
                onPress={() => setSearch('')}
                style={styles.clearSearchBtn}
              >
                <MaterialIcons name="close" size={16} color={THEME.muted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Tab Selector (Semua, Penawaran, Memo SPK) */}
          <View style={styles.tabRow}>
            {[
              {
                id: 'ALL',
                label: 'Semua',
                count: counts.all,
                icon: 'format-list-bulleted',
              },
              {
                id: 'PENAWARAN',
                label: 'Penawaran',
                count: counts.penawaran,
                icon: 'receipt',
              },
              {
                id: 'MAP',
                label: 'Memo SPK',
                count: counts.map,
                icon: 'assignment',
              },
            ].map(tab => {
              const active = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.tabBtn, active && styles.tabBtnActive]}
                  onPress={() => setActiveTab(tab.id as any)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name={tab.icon}
                    size={14}
                    color={active ? THEME.primary : THEME.muted}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[styles.tabBtnText, active && styles.tabBtnTextActive]}
                  >
                    {tab.label} ({tab.count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Selection Bar (Select All & Total Found) */}
        <View style={styles.selectBar}>
          <TouchableOpacity
            style={styles.selectAllBtn}
            onPress={toggleSelectAll}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.checkbox,
                isAllSelected && styles.checkboxActive,
                { marginRight: 8 },
              ]}
            >
              {isAllSelected && (
                <MaterialIcons name="check" size={14} color="#FFFFFF" />
              )}
            </View>
            <Text style={styles.selectAllText}>
              {isAllSelected ? 'Batalkan Semua' : 'Pilih Semua'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.itemCountText}>
            Tampil: <Text style={{ fontWeight: '700', color: THEME.ink }}>{filteredList.length}</Text> item
          </Text>
        </View>

        {/* List of Candidates */}
        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={THEME.primary} />
            <Text style={styles.loadingText}>Memuat kandidat potensi...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredList}
            keyExtractor={item => getItemKey(item)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchKandidat(true)}
                tintColor={THEME.primary}
                colors={[THEME.primary]}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <MaterialIcons name="check-circle" size={48} color={THEME.muted} />
                <Text style={styles.emptyTitle}>Tidak Ada Kandidat</Text>
                <Text style={styles.emptySubtitle}>
                  {search.trim() || activeTab !== 'ALL'
                    ? 'Tidak ada item kandidat yang sesuai dengan filter/pencarian ini.'
                    : 'Semua Penawaran / MAP yang memenuhi syarat sudah masuk ke tabel Potensi atau sudah terbit SO/SPK.'}
                </Text>
              </View>
            }
          />
        )}

        {/* Sticky Bottom Action Bar */}
        <View style={styles.bottomBar}>
          <View style={styles.bottomSummary}>
            <Text style={styles.bottomSummaryCount}>
              {totalSelectedCount} item terpilih
            </Text>
            <Text style={styles.bottomSummaryNominal}>
              {formatRupiah(totalSelectedNominal)}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.btnSubmit,
              totalSelectedCount === 0 && styles.btnSubmitDisabled,
            ]}
            onPress={handleSubmit}
            disabled={totalSelectedCount === 0 || submitting}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={
                totalSelectedCount === 0
                  ? ['#94A3B8', '#64748B']
                  : [THEME.primary, THEME.accent]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.btnSubmitGradient}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="playlist-add-check" size={20} color="#FFFFFF" />
                  <Text style={styles.btnSubmitText}>Simpan ke Potensi</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.ink,
  },
  headerSubtitle: {
    fontSize: 12,
    color: THEME.muted,
    marginTop: 2,
  },
  filterCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.soft,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    height: 42,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: THEME.ink,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: THEME.soft,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: THEME.primary,
    ...SHADOWS.softCard,
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.muted,
  },
  tabBtnTextActive: {
    color: THEME.primary,
    fontWeight: '700',
  },
  selectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxActive: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.ink,
  },
  itemCountText: {
    fontSize: 12,
    color: THEME.muted,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.line,
    ...SHADOWS.softCard,
  },
  cardSelected: {
    borderColor: THEME.primary,
    backgroundColor: '#F5F7FF',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  typeBadgePenawaran: {
    backgroundColor: `${THEME.primary}12`,
    borderColor: `${THEME.primary}30`,
  },
  typeBadgeMap: {
    backgroundColor: '#E0F2FE',
    borderColor: '#BAE6FD',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  typeBadgeTextPenawaran: {
    color: THEME.primary,
  },
  typeBadgeTextMap: {
    color: '#0284C7',
  },
  refNumberText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.ink,
  },
  dateText: {
    fontSize: 11,
    color: THEME.muted,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.ink,
    lineHeight: 18,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: THEME.muted,
    fontWeight: '500',
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: THEME.line,
  },
  priceLabel: {
    fontSize: 11,
    color: THEME.muted,
    fontWeight: '500',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.primary,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: THEME.muted,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.ink,
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: THEME.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.line,
    ...SHADOWS.card,
  },
  bottomSummary: {
    flex: 1,
    marginRight: 12,
  },
  bottomSummaryCount: {
    fontSize: 11,
    color: THEME.muted,
    fontWeight: '600',
  },
  bottomSummaryNominal: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.primary,
    marginTop: 2,
  },
  btnSubmit: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  btnSubmitDisabled: {
    opacity: 0.7,
  },
  btnSubmitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  btnSubmitText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
