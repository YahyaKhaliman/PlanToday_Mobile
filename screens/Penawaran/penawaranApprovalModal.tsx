import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import ModalConfirm from 'react-native-modal';
import Toast from 'react-native-toast-message';
import { requestApprovalPerubahan } from '../../services/penawaranApi';
import { useAuth } from '../../context/authContext';
import { PENAWARAN_THEME } from './penawaranTheme';

const THEME = PENAWARAN_THEME;

interface PenawaranApprovalModalProps {
  visible: boolean;
  nomor: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PenawaranApprovalModal({
  visible,
  nomor,
  onClose,
  onSuccess,
}: PenawaranApprovalModalProps) {
  const { token } = useAuth();
  const [alasan, setAlasan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const handleSubmit = async () => {
    if (!alasan.trim()) {
      Alert.alert('Validasi', 'Alasan pengajuan wajib diisi');
      return;
    }

    setConfirmVisible(true);
  };

  const handleConfirmSubmit = async () => {
    setConfirmVisible(false);
    try {
      setSubmitting(true);
      await requestApprovalPerubahan(nomor, { alasan: alasan.trim() }, token);
      Toast.show({
        type: 'glassSuccess',
        text1: 'Sukses',
        text2: 'Pengajuan perubahan berhasil dibuat',
      });
      setAlasan('');
      onSuccess?.();
      onClose();
    } catch (error) {
      const message =
        (error as any)?.response?.data?.message ||
        `Gagal buat pengajuan: ${error}`;
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setAlasan('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Pengajuan Perubahan</Text>
            <Text style={styles.subtitle}>Penawaran: {nomor}</Text>
          </View>

          <View style={styles.content}>
            <Text style={styles.label}>Alasan Pengajuan *</Text>
            <TextInput
              style={styles.input}
              placeholder="Jelaskan alasan perubahan data..."
              placeholderTextColor="#999"
              value={alasan}
              onChangeText={setAlasan}
              multiline
              numberOfLines={4}
              editable={!submitting}
            />
            <Text style={styles.hint}>
              Pengajuan akan dikirim untuk persetujuan manager
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={submitting}
            >
              <Text style={styles.buttonText}>Batal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.submitButton]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Ajukan</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ModalConfirm
        isVisible={confirmVisible}
        onBackdropPress={() => setConfirmVisible(false)}
        backdropOpacity={0.45}
        animationIn="zoomIn"
        animationOut="zoomOut"
      >
        <View style={styles.confirmModalCard}>
          <View style={styles.confirmModalIndicator} />
          <Text style={styles.confirmModalTitle}>Konfirmasi</Text>
          <Text style={styles.confirmModalSubtitle}>
            Ajukan perubahan untuk penawaran ini?
          </Text>

          <View style={styles.confirmModalActionRow}>
            <TouchableOpacity
              style={styles.confirmBtnCancel}
              onPress={() => setConfirmVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmTextCancel}>Batal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.confirmBtnSubmit}
              onPress={handleConfirmSubmit}
              activeOpacity={0.9}
            >
              <Text style={styles.confirmTextSubmit}>Ya, Ajukan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ModalConfirm>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.line,
    width: '85%',
    maxHeight: '80%',
    paddingTop: 18,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.ink,
  },
  subtitle: {
    fontSize: 12,
    color: THEME.muted,
    fontWeight: '700',
    marginTop: 4,
  },
  content: {
    padding: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.muted,
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: THEME.ink,
    fontWeight: '700',
    backgroundColor: THEME.soft,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  hint: {
    fontSize: 11,
    color: THEME.muted,
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: THEME.danger,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  submitButton: {
    backgroundColor: THEME.primary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#fff',
  },
  confirmModalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.16)',
  },
  confirmModalIndicator: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(79,70,229,0.24)',
    alignSelf: 'center',
    marginBottom: 10,
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.ink,
    textAlign: 'center',
  },
  confirmModalSubtitle: {
    marginTop: 8,
    textAlign: 'center',
    color: THEME.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  confirmModalActionRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  confirmBtnCancel: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.line,
    backgroundColor: '#fff',
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmBtnSubmit: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: THEME.primary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmTextCancel: {
    color: THEME.muted,
    fontWeight: '800',
  },
  confirmTextSubmit: {
    color: '#fff',
    fontWeight: '900',
  },
});
