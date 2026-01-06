import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BaseToastProps } from 'react-native-toast-message';

const THEME = {
    primary: '#4F46E5',
    accent: '#06B6D4',
    ink: '#0F172A',
    muted: '#64748B',
    card: '#FFFFFF',
    line: 'rgba(15,23,42,0.08)',
    danger: '#EF4444',
    success: '#16A34A',
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

    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
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
});
