/* eslint-disable react-native/no-inline-styles */
import React from 'react';
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
    const currentLabel = options.find(o => o.value === value)?.label || '';

    return (
        <>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginBottom: 6, marginLeft: 4 }}>
            {label}
        </Text>

        <TouchableOpacity
            onPress={onOpen}
            activeOpacity={0.85}
            style={styles.glassSelect}
        >
            <Text style={{ color: currentLabel ? '#fff' : 'rgba(255,255,255,0.6)', fontSize: 16, flex: 1 }}>
            {currentLabel || placeholder}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 22, marginTop: -2 }}>⌄</Text>
        </TouchableOpacity>

        <Modal
            isVisible={visible}
            onBackdropPress={onClose}
            backdropOpacity={0.45}
            animationIn="slideInUp"
            animationOut="slideOutDown"
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
                    activeOpacity={0.85}
                    style={[styles.sheetItem, active && styles.sheetItemActive]}
                    >
                    <Text style={[styles.sheetItemText, active && styles.sheetItemTextActive]}>
                        {opt.label}
                    </Text>
                    </TouchableOpacity>
                );
                })}
            </ScrollView>

            <TouchableOpacity onPress={onClose} style={styles.sheetClose} activeOpacity={0.85}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>Tutup</Text>
            </TouchableOpacity>
            </View>
        </Modal>
        </>
    );
    }

    const styles = StyleSheet.create({
    glassSelect: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        paddingHorizontal: 15,
        marginBottom: 15,
        height: 55,
    },

    sheet: {
        backgroundColor: 'rgba(30, 34, 79, 0.98)', 
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    sheetHandle: {
        alignSelf: 'center',
        width: 44,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.25)',
        marginBottom: 12,
    },
    sheetTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '900',
        marginBottom: 10,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    sheetItem: {
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(255,255,255,0.06)',
        marginBottom: 10,
    },
    sheetItemActive: {
        backgroundColor: 'rgba(255,255,255,0.14)',
        borderColor: 'rgba(255,255,255,0.28)',
    },
    sheetItemText: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 15,
        fontWeight: '700',
    },
    sheetItemTextActive: {
        color: '#fff',
    },
    sheetClose: {
        marginTop: 6,
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: '#233975',
    },
});
