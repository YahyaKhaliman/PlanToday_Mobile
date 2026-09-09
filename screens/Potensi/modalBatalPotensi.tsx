/* eslint-disable react-native/no-inline-styles */
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { PotensiListItem } from '../../services/potensiApi';
import { THEME, SHADOWS } from '../theme';

interface ModalBatalPotensiProps {
  visible: boolean;
  item: PotensiListItem | null;
  onClose: () => void;
  onSubmit: (alasan: string) => Promise<void>;
  isSubmitting: boolean;
}

const formatRupiah = (val: number | string) => {
  const num = Number(val) || 0;
  return `Rp ${new Intl.NumberFormat('id-ID').format(num)}`;
};

export default function ModalBatalPotensi({
  visible,
  item,
  onClose,
  onSubmit,
  isSubmitting,
}: ModalBatalPotensiProps) {
  const [alasan, setAlasan] = useState('');
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (visible) {
      setAlasan('');
      setErrorText('');
    }
  }, [visible]);

  const handleConfirm = async () => {
    const trimmed = alasan.trim();
    if (!trimmed) {
      setErrorText('Alasan pembatalan wajib diisi');
      return;
    }
    if (trimmed.length < 3) {
      setErrorText('Alasan minimal 3 karakter');
      return;
    }
    setErrorText('');
    await onSubmit(trimmed);
  };

  if (!item) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.centeredView}
          >
            <View style={styles.modalCard}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.iconCircle}>
                  <MaterialIcons
                    name="error-outline"
                    size={24}
                    color="#DC2626"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.title}>Yakin Batalkan Potensi? </Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  disabled={isSubmitting}
                  style={styles.closeBtn}
                >
                  <MaterialIcons name="close" size={20} color={THEME.muted} />
                </TouchableOpacity>
              </View>

              {/* Info Item Ringkas */}
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>{item.pot_nomor}</Text>
                <Text style={styles.infoValue} numberOfLines={2}>
                  {item.pot_nama_item || item.nama_item || '-'}
                </Text>
                <View style={styles.rowBetween}>
                  <Text style={styles.infoSubText}>
                    {item.cus_nama ||
                      item.customer_nama ||
                      item.pot_cus_kode ||
                      item.customer_kode ||
                      '-'}
                  </Text>
                  <Text style={styles.infoPriceText}>
                    {formatRupiah(item.pot_harga ?? item.harga ?? 0)}
                  </Text>
                </View>
              </View>

              {/* Input Alasan */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  Alasan Pembatalan <Text style={{ color: '#DC2626' }}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.textArea,
                    Boolean(errorText) && styles.textAreaError,
                  ]}
                  placeholder="Masukkan Alasan"
                  placeholderTextColor={THEME.muted}
                  multiline
                  numberOfLines={3}
                  value={alasan}
                  onChangeText={txt => {
                    setAlasan(txt);
                    if (errorText) setErrorText('');
                  }}
                  editable={!isSubmitting}
                />
                {Boolean(errorText) && (
                  <Text style={styles.errorText}>{errorText}</Text>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.btnCancel}
                  onPress={onClose}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnCancelText}>Kembali</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.btnConfirm,
                    isSubmitting && styles.btnConfirmDisabled,
                  ]}
                  onPress={handleConfirm}
                  disabled={isSubmitting}
                  activeOpacity={0.85}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.btnConfirmText}>Yakin</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  centeredView: {
    width: '100%',
    maxWidth: 420,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.line,
    ...SHADOWS.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.ink,
  },
  subtitle: {
    fontSize: 12,
    color: THEME.muted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: THEME.soft,
  },
  infoBox: {
    backgroundColor: THEME.soft,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  infoLabel: {
    fontSize: 11,
    color: THEME.muted,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.ink,
    marginTop: 2,
    marginBottom: 6,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: THEME.line,
  },
  infoSubText: {
    fontSize: 12,
    color: THEME.muted,
    flex: 1,
  },
  infoPriceText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.primary,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.ink,
    marginBottom: 6,
  },
  textArea: {
    backgroundColor: THEME.soft,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: THEME.ink,
    borderWidth: 1,
    borderColor: THEME.line,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  textAreaError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: THEME.soft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.line,
  },
  btnCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.muted,
  },
  btnConfirm: {
    flex: 1.2,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.softCard,
  },
  btnConfirmDisabled: {
    opacity: 0.6,
  },
  btnConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
