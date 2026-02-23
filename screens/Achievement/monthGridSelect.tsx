/* eslint-disable react-native/no-inline-styles */
import React, { useMemo } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    FlatList,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

type Option = { label: string; value: string };

type Props = {
    visible: boolean;
    title?: string;
    value?: string;
    options?: Option[];
    onClose: () => void;
    onSelect: (value: string) => void;
    theme?: {
        ink: string;
        muted: string;
        card: string;
        soft: string;
        line: string;
        accent: string;
        primary: string;
    };
};

const DEFAULT_MONTHS: Option[] = [
    { label: 'Jan', value: '1' },
    { label: 'Feb', value: '2' },
    { label: 'Mar', value: '3' },
    { label: 'Apr', value: '4' },
    { label: 'Mei', value: '5' },
    { label: 'Jun', value: '6' },
    { label: 'Jul', value: '7' },
    { label: 'Agu', value: '8' },
    { label: 'Sep', value: '9' },
    { label: 'Okt', value: '10' },
    { label: 'Nov', value: '11' },
    { label: 'Des', value: '12' },
];

export default function MonthGridSelect({
    visible,
    title = 'Pilih Bulan',
    value,
    options,
    onClose,
    onSelect,
    theme,
    }: Props) {
    const MONTHS = useMemo(() => options || DEFAULT_MONTHS, [options]);

    const T = useMemo(
        () => ({
        ink: theme?.ink ?? '#0F172A',
        muted: theme?.muted ?? '#64748B',
        card: theme?.card ?? '#FFFFFF',
        soft: theme?.soft ?? '#F1F5F9',
        line: theme?.line ?? 'rgba(15,23,42,0.08)',
        accent: theme?.accent ?? '#06B6D4',
        primary: theme?.primary ?? '#4F46E5',
        }),
        [theme]
    );

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.backdrop}>
            <View style={[styles.card, { borderColor: T.line, backgroundColor: 'rgba(255,255,255,0.96)' }]}>
            {/* Header */}
            <View style={styles.headerRow}>
                <Text style={[styles.title, { color: T.ink }]}>{title}</Text>
                <TouchableOpacity onPress={onClose} activeOpacity={0.8} style={styles.closeBtn}>
                <MaterialIcons name="close" size={20} color={T.muted} />
                </TouchableOpacity>
            </View>

            {/* Grid 4 kolom */}
            <FlatList
                data={MONTHS}
                keyExtractor={(it) => it.value}
                numColumns={4}
                scrollEnabled={false}
                columnWrapperStyle={{ gap: 10 }}
                contentContainerStyle={{ gap: 10, paddingTop: 12 }}
                renderItem={({ item }) => {
                    const active = String(item.value) === String(value);
                    return (
                        <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => onSelect(item.value)}
                        style={[
                            styles.monthBtn,
                            {
                            backgroundColor: active ? 'rgba(6,182,212,0.14)' : T.soft,
                            borderColor: active ? 'rgba(6,182,212,0.35)' : T.line,
                            },
                        ]}
                        >
                        <Text style={[styles.monthText, { color: T.ink }]}>{item.label}</Text>
                        </TouchableOpacity>
                    );
                    }}
            />
            </View>
        </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        paddingHorizontal: 16,
        justifyContent: 'flex-end',
        paddingBottom: 18,
    },
    card: {
        borderRadius: 18,
        borderWidth: 1,
        padding: 14,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: { fontSize: 16, fontWeight: '900' },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hint: { marginTop: 6, fontSize: 12, fontWeight: '800' },

    monthBtn: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        // supaya rata 4 kolom, FlatList numColumns + flex:1 sudah cukup
    },
    monthText: {
        fontSize: 13,
        fontWeight: '900',
    },
    footer: {
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
    },
});
