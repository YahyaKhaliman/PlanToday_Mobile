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
import { requestApprovalPerubahan } from '../../services/penawaranApi';
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
  const [alasan, setAlasan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!alasan.trim()) {
      Alert.alert('Validasi', 'Alasan pengajuan wajib diisi');
      return;
    }

    Alert.alert('Confirm', 'Ajukan perubahan untuk penawaran ini?', [
      { text: 'Cancel' },
      {
        text: 'OK',
        onPress: async () => {
          try {
            setSubmitting(true);
            await requestApprovalPerubahan(nomor, { alasan: alasan.trim() });
            Alert.alert('Sukses', 'Pengajuan perubahan berhasil dibuat', [
              {
                text: 'OK',
                onPress: () => {
                  setAlasan('');
                  onSuccess?.();
                  onClose();
                },
              },
            ]);
          } catch (error) {
            const message =
              (error as any)?.response?.data?.message ||
              `Gagal buat pengajuan: ${error}`;
            Alert.alert('Error', message);
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
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
    backgroundColor: THEME.soft,
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
});
