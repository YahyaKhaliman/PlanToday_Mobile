import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BaseToastProps } from 'react-native-toast-message';

export const toastConfig = {
    glassError: ({ text1, text2 }: BaseToastProps) => (
        <View style={[styles.container, styles.errorBorder]}>
        <View style={styles.content}>
            <Text style={styles.icon}>⚠️</Text>
            <View>
            <Text style={styles.title}>{text1}</Text>
            {text2 && <Text style={styles.message}>{text2}</Text>}
            </View>
        </View>
        </View>
    ),

    glassSuccess: ({ text1, text2 }: BaseToastProps) => (
        <View style={[styles.container, styles.successBorder]}>
        <View style={styles.content}>
            <Text style={styles.icon}>✅</Text>
            <View>
            <Text style={styles.title}>{text1}</Text>
            {text2 && <Text style={styles.message}>{text2}</Text>}
            </View>
        </View>
        </View>
    ),
};

const styles = StyleSheet.create({
    container: {
        height: 'auto',
        width: '90%',
        backgroundColor: 'rgba(255, 255, 255, 0.2)', // Efek Transparan
        borderRadius: 15,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        // Shadow untuk efek kedalaman
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    errorBorder: {
        borderLeftWidth: 6,
        borderLeftColor: '#FF453A', // Merah Terang
    },
    successBorder: {
        borderLeftWidth: 6,
        borderLeftColor: '#32D74B', // Hijau Terang
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    icon: {
        fontSize: 24,
        marginRight: 12,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    message: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 13,
        marginTop: 2,
    },
});