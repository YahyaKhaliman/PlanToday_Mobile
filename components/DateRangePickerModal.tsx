/* eslint-disable react-native/no-inline-styles */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

export interface DateRangePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (startDate: string, endDate: string) => void;
  initialStartDate?: string; // Format 'YYYY-MM-DD'
  initialEndDate?: string; // Format 'YYYY-MM-DD'
  minDate?: string; // Format 'YYYY-MM-DD'
  maxDate?: string; // Format 'YYYY-MM-DD'
  title?: string;
  primaryColor?: string;
  rangeBgColor?: string;
  confirmButtonText?: string;
}

const MONTH_NAMES = [
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

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const toYmd = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseYmd = (str: string): Date => {
  if (!str) return new Date();
  const parts = str.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  return new Date(y, m, d);
};

const formatDmy = (ymd: string): string => {
  if (!ymd) return '';
  const parts = ymd.split('-');
  if (parts.length < 3) return ymd;
  const [y, m, d] = parts;
  return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
};


interface DayCell {
  dateStr: string;
  dayNum: number;
  isCurrentMonth: boolean;
}

interface MonthData {
  key: string;
  year: number;
  month: number;
  title: string;
  weeks: DayCell[][];
}

const buildMonthData = (year: number, month: number): MonthData => {
  const firstDay = new Date(year, month, 1);
  const startDayOfWeek = firstDay.getDay(); // 0 = Minggu, 1 = Senin, ...
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: DayCell[] = [];

  // Slot kosong sebelum tanggal 1
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push({
      dateStr: '',
      dayNum: 0,
      isCurrentMonth: false,
    });
  }

  // Tanggal 1 sampai akhir bulan
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(
      d,
    ).padStart(2, '0')}`;
    days.push({
      dateStr: dStr,
      dayNum: d,
      isCurrentMonth: true,
    });
  }

  // Pecah ke dalam baris mingguan (7 sel per minggu)
  const weeks: DayCell[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    while (chunk.length < 7) {
      chunk.push({
        dateStr: '',
        dayNum: 0,
        isCurrentMonth: false,
      });
    }
    weeks.push(chunk);
  }

  return {
    key: `${year}-${month}`,
    year,
    month,
    title: `${MONTH_NAMES[month]} ${year}`,
    weeks,
  };
};

export default function DateRangePickerModal({
  visible,
  onClose,
  onConfirm,
  initialStartDate,
  initialEndDate,
  minDate,
  maxDate,
  title = 'Pilih Range Tanggal',
  primaryColor = '#00AA5B', // Hijau ala Tokopedia
  rangeBgColor = '#E8F7EE', // Hijau lembut latar belakang range
  confirmButtonText = 'Konfirmasi',
}: DateRangePickerModalProps) {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<MonthData>>(null);

  const [startDate, setStartDate] = useState<string>(() => {
    return initialStartDate || toYmd(new Date());
  });

  const [endDate, setEndDate] = useState<string>(() => {
    return initialEndDate || initialStartDate || toYmd(new Date());
  });

  // Target yang sedang aktif dipilih: 'start' (Mulai) atau 'end' (Selesai)
  const [activeField, setActiveField] = useState<'start' | 'end'>('start');


  // Generate daftar bulan: 14 bulan ke belakang s/d 12 bulan ke depan
  const months = useMemo(() => {
    const list: MonthData[] = [];
    const base = initialStartDate ? parseYmd(initialStartDate) : new Date();
    const baseYear = base.getFullYear();
    const baseMonth = base.getMonth();

    for (let offset = -14; offset <= 12; offset++) {
      const d = new Date(baseYear, baseMonth + offset, 1);
      list.push(buildMonthData(d.getFullYear(), d.getMonth()));
    }
    return list;
  }, [initialStartDate]);

  const scrollToMonth = useCallback(
    (dStr: string) => {
      if (!dStr) return;
      const targetDate = parseYmd(dStr);
      const targetKey = `${targetDate.getFullYear()}-${targetDate.getMonth()}`;
      const targetIdx = months.findIndex(m => m.key === targetKey);
      if (targetIdx >= 0) {
        flatListRef.current?.scrollToIndex({
          index: targetIdx,
          animated: true,
          viewPosition: 0,
        });
      }
    },
    [months],
  );

  // Sinkronkan state lokal saat modal dibuka
  useEffect(() => {
    if (visible) {
      const s = initialStartDate || toYmd(new Date());
      const e = initialEndDate || initialStartDate || toYmd(new Date());
      setStartDate(s);
      setEndDate(e);
      setActiveField('start');

      // Auto scroll ke bulan startDate
      const targetDate = parseYmd(s);
      const targetKey = `${targetDate.getFullYear()}-${targetDate.getMonth()}`;
      const targetIdx = months.findIndex(m => m.key === targetKey);
      if (targetIdx >= 0) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: targetIdx,
            animated: false,
            viewPosition: 0,
          });
        }, 120);
      }
    }
  }, [visible, initialStartDate, initialEndDate, months]);

  const handleSelectDate = useCallback(
    (dStr: string) => {
      if (!dStr) return;

      // Cek limit min/max date
      if (minDate && dStr < minDate) return;
      if (maxDate && dStr > maxDate) return;

      if (activeField === 'start') {
        // Mengubah Tanggal Mulai secara independen
        setStartDate(dStr);
        // Jika tanggal mulai baru melebihi tanggal selesai saat ini, sesuaikan tanggal selesai
        if (endDate && dStr > endDate) {
          setEndDate(dStr);
        }
        // Alihkan fokus ke tanggal selesai agar alur berlanjut natural
        setActiveField('end');
      } else {
        // Mengubah Tanggal Selesai secara independen tanpa mengulang dari tanggal mulai
        if (startDate && dStr < startDate) {
          // Jika memilih tanggal sebelum tanggal mulai, jadikan sebagai tanggal mulai baru
          setStartDate(dStr);
        } else {
          setEndDate(dStr);
        }
      }
    },
    [activeField, startDate, endDate, minDate, maxDate],
  );

  const handleConfirm = () => {
    if (!startDate || !endDate) return;
    onConfirm(startDate, endDate);
    onClose();
  };

  const renderMonthItem = ({ item }: { item: MonthData }) => {
    return (
      <View style={styles.monthContainer}>
        {/* Header Nama Bulan & Tahun */}
        <Text style={styles.monthTitle}>{item.title}</Text>

        {/* Baris per minggu */}
        {item.weeks.map((week, wIdx) => (
          <View key={`week-${wIdx}`} style={styles.weekRow}>
            {week.map((cell, cIdx) => {
              if (!cell.isCurrentMonth || !cell.dateStr) {
                return (
                  <View key={`empty-${cIdx}`} style={styles.cellWrapper} />
                );
              }

              const dStr = cell.dateStr;
              const isStart = startDate === dStr;
              const isEnd = endDate === dStr;
              const hasFullRange = Boolean(
                startDate && endDate && startDate !== endDate,
              );
              const isInRange = Boolean(
                hasFullRange && dStr > startDate && dStr < endDate,
              );

              const isDisabled = Boolean(
                (minDate && dStr < minDate) || (maxDate && dStr > maxDate),
              );

              return (
                <TouchableOpacity
                  key={dStr}
                  style={styles.cellWrapper}
                  activeOpacity={0.8}
                  disabled={isDisabled}
                  onPress={() => handleSelectDate(dStr)}
                >
                  {/* Background strip penghubung range ala Tokopedia */}
                  {hasFullRange && (
                    <View
                      style={[
                        styles.rangeTrack,
                        { backgroundColor: rangeBgColor },
                        isStart && styles.rangeTrackStart,
                        isEnd && styles.rangeTrackEnd,
                        isInRange && styles.rangeTrackMiddle,
                      ]}
                    />
                  )}

                  {/* Tombol tanggal (kotak rounded solid jika start/end) */}
                  <View
                    style={[
                      styles.dayButton,
                      (isStart || isEnd) && {
                        backgroundColor: primaryColor,
                        borderRadius: 8,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isDisabled && styles.dayTextDisabled,
                        isInRange && styles.dayTextInRange,
                        (isStart || isEnd) && styles.dayTextSelected,
                      ]}
                    >
                      {cell.dayNum}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdropOverlay}>
        <View style={styles.sheetCard}>
          {/* Header Modal */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <MaterialIcons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{title}</Text>
          </View>

          {/* Bar Selector: Dua Tab Pilihan (Mulai vs Selesai) */}
          <View style={styles.selectorContainer}>
            <TouchableOpacity
              style={[
                styles.selectorTab,
                activeField === 'start' && [
                  styles.selectorTabActive,
                  { borderColor: primaryColor, backgroundColor: rangeBgColor },
                ],
              ]}
              onPress={() => {
                setActiveField('start');
                scrollToMonth(startDate);
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.selectorDateText,
                  activeField === 'start' && { color: primaryColor },
                ]}
              >
                {startDate ? formatDmy(startDate) : 'Pilih tanggal'}
              </Text>
            </TouchableOpacity>

            <View style={styles.selectorDividerWrap}>
              <MaterialIcons name="arrow-forward" size={16} color="#94A3B8" />
            </View>

            <TouchableOpacity
              style={[
                styles.selectorTab,
                activeField === 'end' && [
                  styles.selectorTabActive,
                  { borderColor: primaryColor, backgroundColor: rangeBgColor },
                ],
              ]}
              onPress={() => {
                setActiveField('end');
                scrollToMonth(endDate || startDate);
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.selectorDateText,
                  activeField === 'end' && { color: primaryColor },
                ]}
              >
                {endDate ? formatDmy(endDate) : 'Pilih tanggal'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Fixed Days of Week Bar (Min Sen Sel Rab Kam Jum Sab) */}
          <View style={styles.weekdayHeaderBar}>
            {DAY_NAMES.map(day => (
              <View key={day} style={styles.weekdayCol}>
                <Text style={styles.weekdayText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* List Kalender Bulanan Scrollable Vertikal */}
          <FlatList
            ref={flatListRef}
            data={months}
            keyExtractor={m => m.key}
            renderItem={renderMonthItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.calendarScrollContent}
            initialNumToRender={4}
            maxToRenderPerBatch={4}
            windowSize={5}
            getItemLayout={(_, index) => ({
              length: 320,
              offset: 320 * index,
              index,
            })}
            onScrollToIndexFailed={info => {
              setTimeout(() => {
                flatListRef.current?.scrollToIndex({
                  index: info.index,
                  animated: false,
                });
              }, 100);
            }}
          />

          {/* Footer Tombol Konfirmasi */}
          <View
            style={[
              styles.footerContainer,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.confirmButton,
                { backgroundColor: primaryColor },
                (!startDate || !endDate) && styles.confirmButtonDisabled,
              ]}
              disabled={!startDate || !endDate}
              onPress={handleConfirm}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmButtonText}>{confirmButtonText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '86%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  closeBtn: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  selectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  selectorTab: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorTabActive: {
    borderWidth: 1.5,
  },
  selectorDateText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  selectorDividerWrap: {
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  weekdayCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#94A3B8',
  },
  calendarScrollContent: {
    paddingBottom: 20,
  },
  monthContainer: {
    paddingVertical: 16,
  },
  monthTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 14,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
  },
  cellWrapper: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  rangeTrack: {
    position: 'absolute',
    top: 2,
    bottom: 2,
  },
  rangeTrackStart: {
    left: '50%',
    right: 0,
  },
  rangeTrackEnd: {
    left: 0,
    right: '50%',
  },
  rangeTrackMiddle: {
    left: 0,
    right: 0,
  },
  dayButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  dayTextInRange: {
    color: '#0F172A',
    fontWeight: '700',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayTextDisabled: {
    color: '#CBD5E1',
    fontWeight: '400',
  },
  footerContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  footerInfoRow: {
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerHintText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  footerDateHighlight: {
    fontWeight: '800',
  },
  footerRangeText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  confirmButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.45,
    backgroundColor: '#94A3B8',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
