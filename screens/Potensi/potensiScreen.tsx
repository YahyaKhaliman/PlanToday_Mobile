/* eslint-disable react-native/no-inline-styles */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  BackHandler,
  Modal,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getPotensiKandidatList,
  createPotensiBatch,
  PotensiKandidatItem,
  CreatePotensiPayload,
} from '../../services/potensiApi';
import { useAuth } from '../../context/authContext';
import { THEME, SHADOWS } from '../theme';

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

export default function PotensiScreen({ navigation }: any) {
  const { token, user } = useAuth();
  const isManager = String(user?.jabatan || '').toUpperCase() === 'MANAGER';
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rawKandidat, setRawKandidat] = useState<PotensiKandidatItem[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENAWARAN' | 'MAP'>(
    'ALL',
  );
  const [search, setSearch] = useState('');
  const [selectedSales, setSelectedSales] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<
    Map<string, PotensiKandidatItem>
  >(new Map());

  // Sales Picker Modal State
  const [salesPickerVisible, setSalesPickerVisible] = useState(false);
  const [salesPickerSearch, setSalesPickerSearch] = useState('');

  // Hardware Back Handler to Home
  useFocusEffect(
    useCallback(() => {
      const goBack = () => {
        navigation.navigate('Home');
        return true;
      };
      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        goBack,
      );
      return () => backHandler.remove();
    }, [navigation]),
  );

  const getItemKey = (item: PotensiKandidatItem): string => {
    return `${item.tipe_sumber}_${item.pen_nomor || ''}_${
      item.mspk_nomor || ''
    }_${item.item_id || ''}_${item.nama_item}`;
  };

  const effectiveSales = useMemo(() => {
    return isManager ? selectedSales : user?.nama || '';
  }, [isManager, selectedSales, user?.nama]);

  const fetchKandidat = useCallback(
    async (isRefresh = false) => {
      if (!token) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const data = await getPotensiKandidatList(
          {
            sumber: 'ALL',
            sales: effectiveSales || undefined,
          },
          token,
        );
        setRawKandidat(data || []);
        setHasLoadedOnce(true);
      } catch (err: any) {
        console.error('[PotensiScreen][fetchKandidat][Error]', err);
        setHasLoadedOnce(true);
        const msg =
          err?.response?.data?.message || 'Gagal memuat daftar potensi';
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
    [token, effectiveSales],
  );

  useFocusEffect(
    useCallback(() => {
      fetchKandidat();
    }, [fetchKandidat]),
  );

  // Daftar unik Sales dari master data kandidat
  const masterSalesList = useMemo(() => {
    const map = new Map<string, string>();
    rawKandidat.forEach(it => {
      const nama = it.sales_nama?.trim();
      const kode = it.sales_kode?.trim();
      if (nama) {
        map.set(nama, nama);
      } else if (kode) {
        map.set(kode, kode);
      }
    });
    return Array.from(map.values()).sort();
  }, [rawKandidat]);

  // Hitung jumlah item per kategori
  const counts = useMemo(() => {
    let penawaranCount = 0;
    let mapCount = 0;
    let totalCount = 0;
    rawKandidat.forEach(it => {
      if (selectedSales) {
        const qSales = selectedSales.trim().toLowerCase();
        const sNama = (it.sales_nama || '').toLowerCase();
        const sKode = (it.sales_kode || '').toLowerCase();
        if (sNama !== qSales && sKode !== qSales && !sNama.includes(qSales)) {
          return;
        }
      }
      totalCount++;
      if (it.tipe_sumber === 'PENAWARAN') penawaranCount++;
      else if (it.tipe_sumber === 'MAP') mapCount++;
    });
    return {
      all: totalCount,
      penawaran: penawaranCount,
      map: mapCount,
    };
  }, [rawKandidat, selectedSales]);

  // Filter list berdasarkan activeTab, selectedSales, & search
  const filteredList = useMemo(() => {
    return rawKandidat.filter(item => {
      if (activeTab === 'PENAWARAN' && item.tipe_sumber !== 'PENAWARAN') {
        return false;
      }
      if (activeTab === 'MAP' && item.tipe_sumber !== 'MAP') {
        return false;
      }

      if (selectedSales) {
        const qSales = selectedSales.trim().toLowerCase();
        const sNama = (item.sales_nama || '').toLowerCase();
        const sKode = (item.sales_kode || '').toLowerCase();
        if (sNama !== qSales && sKode !== qSales && !sNama.includes(qSales)) {
          return false;
        }
      }

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
  }, [rawKandidat, activeTab, selectedSales, search]);

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
      setSelectedItems(prev => {
        const next = new Map(prev);
        filteredList.forEach(it => next.delete(getItemKey(it)));
        return next;
      });
    } else {
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
        text2: 'Pilih minimal 1 kandidat untuk dijadikan Potensi',
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
        text2: `${
          res.data?.length || itemsPayload.length
        } item berhasil masuk ke Potensi`,
      });

      setSelectedItems(new Map());
      fetchKandidat(true);
    } catch (err: any) {
      console.error('[PotensiScreen][SubmitError]', err);
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
        {/* Baris 1: Checklist + Keterangan Penawaran/MAP + Nomor Penawaran/MAP + Tanggal */}
        <View style={styles.cardHeaderRow}>
          <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
            {isSelected && (
              <MaterialIcons name="check" size={13} color="#FFFFFF" />
            )}
          </View>

          <View
            style={[
              styles.typeBadge,
              isMap ? styles.typeBadgeMap : styles.typeBadgePenawaran,
            ]}
          >
            <Text
              style={[
                styles.typeBadgeText,
                isMap ? styles.typeBadgeTextMap : styles.typeBadgeTextPenawaran,
              ]}
            >
              {isMap ? 'MAP' : 'PENAWARAN'}
            </Text>
          </View>

          <Text style={styles.refNumberText} numberOfLines={1}>
            {item.mspk_nomor || item.pen_nomor || '-'}
          </Text>

          <Text style={styles.dateText}>{formatDate(item.tanggal)}</Text>
        </View>

        {/* Baris 2: Nomor & Nama Item */}
        <View style={styles.itemTitleRow}>
          {Boolean(item.item_id) && (
            <View style={styles.itemIdBadge}>
              <Text style={styles.itemIdBadgeText}>#{item.item_id}</Text>
            </View>
          )}
          <Text style={styles.itemTitle} numberOfLines={2}>
            {item.nama_item}
          </Text>
        </View>

        {/* Baris 3: Quantity Order & Sales */}
        <View style={styles.metaRow}>
          {Boolean(item.qty) && (
            <View style={styles.specChipQty}>
              <Text style={styles.specChipQtyText}>
                Qty: {item.qty} {item.satuan || 'PCS'}
              </Text>
            </View>
          )}

          <View style={styles.metaItem}>
            <Text style={styles.metaText} numberOfLines={1}>
              Sales:{' '}
              <Text style={styles.specChipQtyText}>
                {item.sales_nama || item.sales_kode || '-'}
              </Text>
            </Text>
          </View>
        </View>

        {/* Baris 4: Nominal Potensi (Satuan) & Total Nominal */}
        <View style={styles.cardBottomRow}>
          <View style={styles.priceLeftCol}>
            <Text style={styles.priceLabel}>Nominal Potensi</Text>
            <Text style={styles.unitPriceText}>
              @{formatRupiah(item.harga_satuan || item.harga || 0)} /{' '}
              {item.satuan || 'PCS'}
            </Text>
          </View>
          <View style={styles.priceRightCol}>
            <Text style={styles.totalPriceLabel}>Total Nominal</Text>
            <Text style={styles.priceValue}>{formatRupiah(item.harga)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = (
    <View style={styles.headerWrap}>
      {/* Top Title & Navigation */}
      <View style={styles.headerTop}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.title}>Potensi</Text>
        </View>
      </View>

      {/* Filter Card: Form Pencarian, Button Laporan, Sales Picker, & Button Refresh */}
      <View style={styles.filterCard}>
        {/* Search Row: Input Pencarian + Button Laporan */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder="Cari..."
              placeholderTextColor={THEME.muted}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {search.trim().length > 0 ? (
              <TouchableOpacity
                onPress={() => setSearch('')}
                style={styles.clearSearchButton}
                activeOpacity={0.8}
              >
                <MaterialIcons name="close" size={16} color={THEME.muted} />
              </TouchableOpacity>
            ) : (
              <View style={styles.searchIconWrap}>
                <MaterialIcons name="search" size={20} color={THEME.muted} />
              </View>
            )}
          </View>

          {/* Button Laporan Potensi */}
          <TouchableOpacity
            style={styles.btnLaporan}
            onPress={() => navigation.navigate('LaporanPotensi')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[THEME.primary, THEME.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.btnLaporanGradient}
            >
              <MaterialIcons name="assessment" size={16} color="#FFFFFF" />
              <Text style={styles.btnLaporanText}>Laporan</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Sales Picker Chip & Refresh Button Row */}
        <View style={styles.pickerRow}>
          {isManager ? (
            <TouchableOpacity
              style={[
                styles.pickerChip,
                selectedSales ? styles.pickerChipActive : null,
              ]}
              onPress={() => {
                setSalesPickerSearch('');
                setSalesPickerVisible(true);
              }}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="person"
                size={14}
                color={selectedSales ? THEME.primary : THEME.muted}
              />
              <Text
                style={[
                  styles.pickerChipText,
                  selectedSales ? styles.pickerChipTextActive : null,
                ]}
                numberOfLines={1}
              >
                {selectedSales || 'Semua Sales'}
              </Text>
              {selectedSales.trim() ? (
                <TouchableOpacity
                  style={styles.clearPickerButton}
                  onPress={() => setSelectedSales('')}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="close" size={12} color={THEME.ink} />
                </TouchableOpacity>
              ) : (
                <MaterialIcons
                  name="arrow-drop-down"
                  size={18}
                  color={THEME.muted}
                />
              )}
            </TouchableOpacity>
          ) : (
            <View style={[styles.pickerChip, styles.pickerChipDisabled]}>
              <Text
                style={[styles.pickerChipText, styles.pickerChipTextActive]}
                numberOfLines={1}
              >
                {user?.nama || 'Sales'}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.searchButton}
            activeOpacity={0.85}
            onPress={() => fetchKandidat(true)}
            disabled={loading || refreshing}
          >
            <LinearGradient
              colors={['#059669', '#10B981']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.searchButtonGradient}
            >
              {refreshing || loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="refresh" size={16} color="#FFFFFF" />
                  <Text style={styles.searchButtonText}>Refresh</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Selector (Semua, Penawaran, Memo SPK) */}
      <View style={styles.tabRow}>
        {[
          {
            id: 'ALL',
            label: 'Semua',
            count: counts.all,
          },
          {
            id: 'PENAWARAN',
            label: 'Penawaran',
            count: counts.penawaran,
          },
          {
            id: 'MAP',
            label: 'MAP',
            count: counts.map,
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
              <Text
                style={[styles.tabBtnText, active && styles.tabBtnTextActive]}
              >
                {tab.label} ({tab.count})
              </Text>
            </TouchableOpacity>
          );
        })}
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
          Tampil:{' '}
          <Text style={{ fontWeight: '700', color: THEME.ink }}>
            {filteredList.length}
          </Text>{' '}
          item
        </Text>
      </View>
    </View>
  );

  const renderEmptyState = useMemo(
    () => (
      <View style={styles.emptyBox}>
        <MaterialIcons name="check-circle" size={48} color={THEME.muted} />
        <Text style={styles.emptyTitle}>Tidak Ada Kandidat</Text>
        <Text style={styles.emptySubtitle}>
          {search.trim() || activeTab !== 'ALL' || selectedSales
            ? 'Tidak ada item kandidat yang sesuai dengan filter/pencarian ini.'
            : 'Semua Penawaran / MAP yang memenuhi syarat sudah masuk ke Potensi atau sudah terbit SO/SPK.'}
        </Text>
      </View>
    ),
    [search, activeTab, selectedSales],
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
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={THEME.primary} />
          <Text style={styles.loadingText}>Memuat potensi...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredList}
          keyExtractor={item => getItemKey(item)}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: 90 + insets.bottom },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchKandidat(true)}
              tintColor={THEME.primary}
              colors={[THEME.primary]}
            />
          }
        />
      )}

      {/* Sticky Bottom Action Bar */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
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
                <MaterialIcons
                  name="playlist-add-check"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.btnSubmitText}>Simpan ke Potensi</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Sales Picker Modal (Manager Only) */}
      {isManager && (
        <Modal
          visible={salesPickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setSalesPickerVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setSalesPickerVisible(false)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
              <Text style={styles.modalTitle}>Pilih Sales</Text>
              <View style={styles.modalSearchWrap}>
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Cari sales..."
                  placeholderTextColor={THEME.muted}
                  value={salesPickerSearch}
                  onChangeText={setSalesPickerSearch}
                />
              </View>

              <FlatList
                data={['', ...masterSalesList].filter(opt =>
                  (opt || 'Semua Sales')
                    .toLowerCase()
                    .includes(salesPickerSearch.toLowerCase()),
                )}
                keyExtractor={(_, idx) => String(idx)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalOption}
                    onPress={() => {
                      setSelectedSales(item);
                      setSalesPickerVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        selectedSales === item && {
                          color: THEME.primary,
                          fontWeight: '700',
                        },
                      ]}
                    >
                      {item || 'Semua Sales'}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.modalEmptyText}>
                    Sales tidak ditemukan
                  </Text>
                }
                style={{ maxHeight: 300 }}
              />

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSalesPickerVisible(false)}
              >
                <Text style={styles.modalCloseBtnText}>Tutup</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  headerWrap: {
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerTop: {
    marginBottom: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: THEME.line,
    ...SHADOWS.softCard,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    fontSize: 25,
    fontWeight: '900',
    color: THEME.ink,
    letterSpacing: 0.2,
  },
  btnLaporan: {
    borderRadius: 14,
    overflow: 'hidden',
    ...SHADOWS.softCard,
  },
  btnLaporanGradient: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  btnLaporanText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    ...SHADOWS.card,
    marginBottom: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 14,
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
    fontSize: 13,
    fontWeight: '600',
  },
  clearSearchButton: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: 'rgba(100,116,139,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  searchIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
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
    ...SHADOWS.softCard,
  },
  searchButtonGradient: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  pickerRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickerChip: {
    flex: 1,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 14,
    backgroundColor: THEME.soft,
    paddingHorizontal: 12,
    paddingVertical: 0,
    gap: 6,
  },
  pickerChipActive: {
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    borderColor: THEME.primary,
  },
  pickerChipDisabled: {
    backgroundColor: THEME.soft,
    borderColor: THEME.line,
  },
  pickerChipText: {
    flex: 1,
    color: THEME.muted,
    fontSize: 15,
    fontWeight: '700',
  },
  pickerChipTextActive: {
    color: THEME.primary,
    fontWeight: '800',
  },
  clearPickerButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(100,116,139,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
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
    paddingHorizontal: 4,
    paddingVertical: 6,
    marginBottom: 6,
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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 11,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.line,
    ...SHADOWS.softCard,
  },
  cardSelected: {
    borderColor: THEME.primary,
    backgroundColor: '#F8FAFF',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
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
    fontSize: 9.5,
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
    fontSize: 12.5,
    fontWeight: '700',
    color: THEME.ink,
  },
  dateText: {
    fontSize: 11,
    color: THEME.muted,
    fontWeight: '500',
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 5,
  },
  itemIdBadge: {
    backgroundColor: `${THEME.primary}15`,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignSelf: 'flex-start',
    marginTop: 1,
  },
  itemIdBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.primary,
  },
  itemTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.ink,
    lineHeight: 17,
  },
  specContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 6,
  },
  specChipQty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: `${THEME.primary}10`,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: `${THEME.primary}30`,
  },
  specChipQtyText: {
    fontSize: 10.5,
    color: THEME.primary,
    fontWeight: '700',
  },
  specChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: THEME.soft,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  specChipText: {
    fontSize: 10.5,
    color: THEME.muted,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
    gap: 6,
  },
  companyBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  companyBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#475569',
  },
  metaItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
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
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: THEME.line,
  },
  priceLeftCol: {
    flex: 1,
  },
  priceRightCol: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 10,
    color: THEME.muted,
    fontWeight: '500',
  },
  unitPriceText: {
    fontSize: 11,
    color: THEME.ink,
    fontWeight: '700',
    marginTop: 1,
  },
  totalPriceLabel: {
    fontSize: 10,
    color: THEME.muted,
    fontWeight: '500',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.primary,
    marginTop: 1,
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
    paddingTop: 12,
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

  // Modal Picker Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.line,
    ...SHADOWS.card,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.ink,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalSearchWrap: {
    backgroundColor: THEME.soft,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    marginBottom: 10,
    height: 40,
    justifyContent: 'center',
  },
  modalSearchInput: {
    fontSize: 13,
    color: THEME.ink,
    paddingVertical: 0,
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
  },
  modalOptionText: {
    fontSize: 14,
    color: THEME.ink,
    fontWeight: '600',
  },
  modalEmptyText: {
    textAlign: 'center',
    marginTop: 16,
    color: THEME.muted,
    fontSize: 13,
  },
  modalCloseBtn: {
    marginTop: 12,
    backgroundColor: THEME.soft,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.line,
  },
  modalCloseBtnText: {
    color: THEME.ink,
    fontSize: 13,
    fontWeight: '700',
  },
});
