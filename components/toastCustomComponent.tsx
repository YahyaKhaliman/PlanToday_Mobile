/* eslint-disable react-native/no-inline-styles */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BaseToastProps } from 'react-native-toast-message';

type ConfirmToastProps = BaseToastProps & {
  props?: {
    onConfirm?: () => void;
    onCancel?: () => void;
    cancelText?: string;
    confirmText?: string;
  };
};

const THEME = {
  primary: '#4F46E5',
  accent: '#06B6D4',
  ink: '#0F172A',
  muted: '#64748B',
  card: '#FFFFFF',
  line: 'rgba(15,23,42,0.08)',
  danger: '#EF4444',
  success: '#16A34A',
  info: '#0369A1',
};

export const toastConfig = {
  glassError: ({ text1, text2 }: BaseToastProps) => (
    <View style={[styles.container, styles.errorAccent]}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, styles.errorIconWrap]}>
          <Text style={styles.icon}>⚠️</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{text1}</Text>
          {text2 && <Text style={styles.message}>{text2}</Text>}
        </View>
      </View>
    </View>
  ),

  glassSuccess: ({ text1, text2 }: BaseToastProps) => (
    <View style={[styles.container, styles.successAccent]}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, styles.successIconWrap]}>
          <Text style={styles.icon}>✅</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{text1}</Text>
          {text2 && <Text style={styles.message}>{text2}</Text>}
        </View>
      </View>
    </View>
  ),

  glassInfo: ({ text1, text2 }: BaseToastProps) => (
    <View style={[styles.container, styles.infoAccent]}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, styles.infoIconWrap]}>
          <Text style={styles.icon}>ℹ️</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{text1}</Text>
          {text2 && <Text style={styles.message}>{text2}</Text>}
        </View>
      </View>
    </View>
  ),

  glassConfirm: ({ text1, text2, props }: ConfirmToastProps) => (
    <View style={[styles.container, styles.confirmContainer]}>
      <View style={styles.modalIndicator} />
      <Text style={styles.confirmTitle}>{text1 || 'Konfirmasi'}</Text>
      {text2 ? <Text style={styles.confirmSubtitle}>{text2}</Text> : null}

      <View style={styles.confirmActions}>
        <TouchableOpacity
          style={styles.btnCancel}
          onPress={props?.onCancel}
          activeOpacity={0.85}
        >
          <Text style={styles.textCancel}>{props?.cancelText || 'Batal'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnConfirm}
          onPress={props?.onConfirm}
          activeOpacity={0.9}
        >
          <Text style={styles.textConfirm}>
            {props?.confirmText || 'Ya, Simpan'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  ),
};

const styles = StyleSheet.create({
  container: {
    width: '90%',
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.line,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },

  /* ACCENT KIRI */
  errorAccent: {
    borderLeftWidth: 6,
    borderLeftColor: THEME.danger,
  },
  successAccent: {
    borderLeftWidth: 6,
    borderLeftColor: THEME.success,
  },
  infoAccent: {
    borderLeftWidth: 6,
    borderLeftColor: THEME.info,
  },

  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  confirmContainer: {
    borderLeftWidth: 1,
    borderColor: THEME.line,
  },
  modalIndicator: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    marginBottom: 10,
  },

  /* ICON */
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  errorIconWrap: {
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderColor: 'rgba(239,68,68,0.18)',
  },
  successIconWrap: {
    backgroundColor: 'rgba(22,163,74,0.10)',
    borderColor: 'rgba(22,163,74,0.18)',
  },
  infoIconWrap: {
    backgroundColor: 'rgba(3,105,161,0.10)',
    borderColor: 'rgba(3,105,161,0.18)',
  },

  icon: { fontSize: 18 },

  /* TEXT */
  title: {
    color: THEME.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  message: {
    marginTop: 4,
    color: THEME.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  confirmTitle: {
    color: THEME.ink,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  confirmSubtitle: {
    marginTop: 6,
    color: THEME.muted,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  confirmActions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.line,
    backgroundColor: '#fff',
  },
  textCancel: {
    color: THEME.ink,
    fontWeight: '800',
    fontSize: 12,
  },
  btnConfirm: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.24)',
    backgroundColor: 'rgba(79,70,229,0.12)',
  },
  textConfirm: {
    color: THEME.primary,
    fontWeight: '900',
    fontSize: 12,
  },
});
