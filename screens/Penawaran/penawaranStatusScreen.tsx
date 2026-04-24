import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PenawaranStackParamList } from '../../navigation/appNavigator';
import {
  getPenawaranDetail,
  updatePenawaranStatusDetail,
  getMasterPenawaranBatal,
  getMasterPenawaranConfirm,
  PenawaranDetailItem,
  PenawaranMasterOption,
  PenawaranStatusUpdate,
} from '../../services/penawaranApi';

type Props = NativeStackScreenProps<PenawaranStackParamList, 'PenawaranStatus'>;

interface PickerOption {
  label: string;
  value: string;
}

interface PickerModalState {
  visible: boolean;
  itemId: string;
  fieldName: 'status' | 'ket_batal' | 'ket_confirm';
  options: PickerOption[];
}

export default function PenawaranStatusScreen({ route, navigation }: Props) {
  const { nomor } = route.params;
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<PenawaranDetailItem[]>([]);
  const [approvalState, setApprovalState] = useState('');
  const [statusUpdates, setStatusUpdates] = useState<
    Record<string, PenawaranStatusUpdate>
  >({});
  const [masterBatal, setMasterBatal] = useState<PenawaranMasterOption[]>([]);
  const [masterConfirm, setMasterConfirm] = useState<PenawaranMasterOption[]>(
    [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [pickerModal, setPickerModal] = useState<PickerModalState>({
    visible: false,
    itemId: '',
    fieldName: 'status',
    options: [],
  });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openPicker = (
    itemId: string,
    fieldName: 'status' | 'ket_batal' | 'ket_confirm',
    options: PickerOption[],
  ) => {
    if (submitting) return;

    if (approvalState === 'WAIT') {
      Alert.alert(
        'Info',
        'Penawaran sedang proses approval (WAIT), perubahan status detail dikunci.',
      );
      return;
    }

    if (!options.length) {
      const fieldLabel =
        fieldName === 'ket_batal'
          ? 'alasan batal'
          : fieldName === 'ket_confirm'
          ? 'konfirmasi'
          : 'status';
      Alert.alert('Info', `Master ${fieldLabel} belum tersedia.`);
      return;
    }

    setPickerModal({
      visible: true,
      itemId,
      fieldName,
      options,
    });
  };

  const closePicker = () => {
    setPickerModal({ ...pickerModal, visible: false });
  };

  const handlePickerSelect = (value: string) => {
    const { itemId, fieldName } = pickerModal;
    if (fieldName === 'status') {
      handleStatusChange(itemId, value);
    } else if (fieldName === 'ket_batal') {
      handleBatalChange(itemId, value);
    } else if (fieldName === 'ket_confirm') {
      handleConfirmChange(itemId, value);
    }
    closePicker();
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const detailData = await getPenawaranDetail(nomor);
      setApprovalState(
        String(detailData?.header?.approval_state || '')
          .trim()
          .toUpperCase(),
      );
      setDetails(detailData.details || []);

      const batal = await getMasterPenawaranBatal();
      setMasterBatal(batal);

      const confirm = await getMasterPenawaranConfirm();
      setMasterConfirm(confirm);

      const initialUpdates: Record<string, PenawaranStatusUpdate> = {};
      (detailData.details || []).forEach(item => {
        initialUpdates[item.id] = {
          id: item.id,
          status: (item.status as any) || '',
          ket_batal: item.ket_batal || '',
          ket_confirm: item.ket_confirm || '',
        };
      });
      setStatusUpdates(initialUpdates);
    } catch (error) {
      Alert.alert('Error', `Gagal load data: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (id: string, status: string) => {
    setStatusUpdates(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        status: status as any,
        ket_batal: status !== 'BATAL' ? '' : prev[id]?.ket_batal || '',
      },
    }));
  };

  const handleBatalChange = (id: string, batal: string) => {
    setStatusUpdates(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        ket_batal: batal,
      },
    }));
  };

  const handleConfirmChange = (id: string, confirm: string) => {
    setStatusUpdates(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        ket_confirm: confirm,
      },
    }));
  };

  const validateAndSave = async () => {
    if (approvalState === 'WAIT') {
      Alert.alert(
        'Info',
        'Penawaran sedang proses approval (WAIT), perubahan status detail dikunci.',
      );
      return;
    }

    const updates = Object.values(statusUpdates);

    for (const upd of updates) {
      if (upd.status === 'BATAL' && !upd.ket_batal) {
        Alert.alert(
          'Validasi',
          `Item ${upd.id}: Status BATAL wajib diisi alasannya`,
        );
        return;
      }
    }

    Alert.alert('Confirm', 'Simpan perubahan status detail?', [
      { text: 'Cancel' },
      {
        text: 'OK',
        onPress: async () => {
          try {
            setSubmitting(true);
            await updatePenawaranStatusDetail(nomor, { updates });
            Alert.alert('Sukses', 'Status detail berhasil diubah', [
              {
                text: 'OK',
                onPress: () => navigation.goBack(),
              },
            ]);
          } catch (error) {
            Alert.alert('Error', `Gagal simpan: ${error}`);
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Update Status Detail</Text>
          <Text style={styles.headerSubtitle}>Penawaran: {nomor}</Text>
        </View>

        {approvalState === 'WAIT' && (
          <View style={styles.lockInfoWrap}>
            <Text style={styles.lockInfoText}>
              Approval WAIT: status detail sementara tidak dapat diubah.
            </Text>
          </View>
        )}

        {details.map(item => {
          const upd = statusUpdates[item.id];
          return (
            <View key={item.id} style={styles.itemCard}>
              <Text style={styles.itemTitle}>
                {item.urutan}. {item.nama_barang}
              </Text>
              <Text style={styles.itemDetail}>
                Qty: {item.qty} x Rp {item.harga.toLocaleString('id-ID')}
              </Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Status</Text>
                <TouchableOpacity
                  style={[
                    styles.pickerButton,
                    (submitting || approvalState === 'WAIT') &&
                      styles.pickerButtonDisabled,
                  ]}
                  onPress={() =>
                    openPicker(item.id, 'status', [
                      { label: 'OPEN', value: 'OPEN' },
                      { label: 'BATAL', value: 'BATAL' },
                      { label: 'CLOSE', value: 'CLOSE' },
                      { label: '(Kosong)', value: '' },
                    ])
                  }
                  disabled={submitting || approvalState === 'WAIT'}
                >
                  <Text style={styles.pickerButtonText}>
                    {upd?.status || 'Pilih Status...'}
                  </Text>
                </TouchableOpacity>
              </View>

              {upd?.status === 'BATAL' && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Alasan Batal *</Text>
                  <TouchableOpacity
                    style={[
                      styles.pickerButton,
                      (submitting || approvalState === 'WAIT') &&
                        styles.pickerButtonDisabled,
                    ]}
                    onPress={() =>
                      openPicker(
                        item.id,
                        'ket_batal',
                        masterBatal.map(b => ({
                          label: b.nama,
                          value: b.kode,
                        })),
                      )
                    }
                    disabled={submitting || approvalState === 'WAIT'}
                  >
                    <Text style={styles.pickerButtonText}>
                      {upd?.ket_batal || '-- Pilih Alasan --'}
                    </Text>
                  </TouchableOpacity>
                  {!masterBatal.length && (
                    <Text style={styles.helperText}>
                      Master alasan batal belum tersedia.
                    </Text>
                  )}
                </View>
              )}

              {upd?.status !== 'BATAL' && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Konfirmasi</Text>
                  <TouchableOpacity
                    style={[
                      styles.pickerButton,
                      (submitting || approvalState === 'WAIT') &&
                        styles.pickerButtonDisabled,
                    ]}
                    onPress={() =>
                      openPicker(
                        item.id,
                        'ket_confirm',
                        masterConfirm.map(c => ({
                          label: c.nama,
                          value: c.kode,
                        })),
                      )
                    }
                    disabled={submitting || approvalState === 'WAIT'}
                  >
                    <Text style={styles.pickerButtonText}>
                      {upd?.ket_confirm || '-- Pilih Konfirmasi --'}
                    </Text>
                  </TouchableOpacity>
                  {!masterConfirm.length && (
                    <Text style={styles.helperText}>
                      Master konfirmasi belum tersedia.
                    </Text>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={() => navigation.goBack()}
          disabled={submitting}
        >
          <Text style={styles.buttonText}>Batal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.submitButton]}
          onPress={validateAndSave}
          disabled={submitting || approvalState === 'WAIT'}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Simpan</Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={pickerModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closePicker}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pilih Opsi</Text>
              <TouchableOpacity onPress={closePicker}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={pickerModal.options}
              keyExtractor={(item, idx) => `${item.value}-${idx}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => handlePickerSelect(item.value)}
                >
                  <Text style={styles.modalOptionText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  lockInfoWrap: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  lockInfoText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '600',
  },
  itemCard: {
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemDetail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  formGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
  },
  submitButton: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  pickerButtonText: {
    fontSize: 14,
    color: '#333',
  },
  pickerButtonDisabled: {
    backgroundColor: '#f3f4f6',
  },
  helperText: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  modalClose: {
    fontSize: 20,
    color: '#666',
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalOptionText: {
    fontSize: 14,
    color: '#333',
  },
});
