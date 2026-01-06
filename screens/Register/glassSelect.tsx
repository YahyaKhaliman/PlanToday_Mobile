/* eslint-disable react-native/no-inline-styles */
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Modal from 'react-native-modal';

type Option = { label: string; value: string };

type GlassSelectProps = {
    label: string;
    value: string;
    placeholder?: string;
    options: Option[];
    visible: boolean;
    onOpen: () => void;
    onClose: () => void;
    onSelect: (value: string) => void;
};

const THEME = {
    primary: '#4F46E5',
    accent: '#06B6D4',
    ink: '#0F172A',
    muted: '#64748B',
    card: '#FFFFFF',
    soft: '#F1F5F9',
    line: 'rgba(15,23,42,0.08)',
    danger: '#EF4444',
};

export function GlassSelect({
    label,
    value,
    placeholder = 'Pilih...',
    options,
    visible,
    onOpen,
    onClose,
    onSelect,
    }: GlassSelectProps) {
    const currentLabel = useMemo(
        () => options.find(o => o.value === value)?.label || '',
        [options, value]
    );

    return (
        <>
        <Text style={styles.label}>{label}</Text>

        <TouchableOpacity onPress={onOpen} activeOpacity={0.88} style={styles.select}>
            <Text style={[styles.selectText, !currentLabel && styles.selectPlaceholder]} numberOfLines={1}>
            {currentLabel || placeholder}
            </Text>
        </TouchableOpacity>

        <Modal
            isVisible={visible}
            onBackdropPress={onClose}
            backdropOpacity={0.45}
            animationIn="zoomIn"
            animationOut="zoomOut"
            style={{ margin: 0, justifyContent: 'flex-end' }}
        >
            <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{label}</Text>

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                {options.map(opt => {
                const active = opt.value === value;
                return (
                    <TouchableOpacity
                    key={opt.value}
                    onPress={() => {
                        onSelect(opt.value);
                        onClose();
                    }}
                    activeOpacity={0.9}
                    style={[styles.sheetItem, active && styles.sheetItemActive]}
                    >
                    <Text style={[styles.sheetItemText, active && styles.sheetItemTextActive]}>
                        {opt.label}
                    </Text>
                    </TouchableOpacity>
                );
                })}
            </ScrollView>

            <TouchableOpacity onPress={onClose} style={styles.sheetClose} activeOpacity={0.9}>
                <Text style={styles.sheetCloseText}>Tutup</Text>
            </TouchableOpacity>
            </View>
        </Modal>
        </>
    );
    }

    const styles = StyleSheet.create({
    label: {
        color: THEME.muted,
        fontSize: 12,
        marginBottom: 6,
        marginLeft: 4,
        marginTop: 6,
        fontWeight: '800',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },

    select: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: THEME.soft,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: THEME.line,
        paddingHorizontal: 12,
        marginBottom: 12,
        height: 55,
        overflow: 'hidden',
    },

    selectText: {
        flex: 1,
        color: THEME.ink,
        fontSize: 16,
        fontWeight: '700',
    },
    selectPlaceholder: {
        color: THEME.muted,
        fontWeight: '700',
    },

    /* Bottom Sheet - ikut modal Home (card putih) */
    sheet: {
        backgroundColor: THEME.card,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        padding: 16,
        borderWidth: 1,
        borderColor: THEME.line,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: -6 },
        elevation: 8,
    },

    sheetHandle: {
        alignSelf: 'center',
        width: 44,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#E5E7EB',
        marginBottom: 12,
    },

    sheetTitle: {
        color: THEME.ink,
        fontSize: 14,
        fontWeight: '900',
        marginBottom: 12,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },

    sheetItem: {
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: THEME.line,
        backgroundColor: THEME.card,
        marginBottom: 10,
    },

    sheetItemActive: {
        backgroundColor: 'rgba(79,70,229,0.08)',
        borderColor: 'rgba(79,70,229,0.18)',
    },

    sheetItemText: {
        color: THEME.ink,
        fontSize: 15,
        fontWeight: '800',
    },

    sheetItemTextActive: {
        color: THEME.primary,
    },

    /* Close button - tidak tabrakan dengan theme (ghost danger) */
    sheetClose: {
        marginTop: 6,
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: 'rgba(239,68,68,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.18)',
    },
    sheetCloseText: {
        color: THEME.danger,
        fontWeight: '900',
    },
});
