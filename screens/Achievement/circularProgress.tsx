/* eslint-disable react-native/no-inline-styles */
import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
    size?: number;
    strokeWidth?: number;
    progress: number;
    duration?: number;
    color?: string;
    bgColor?: string;
    textColor?: string;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export default function CircularProgressAnimated({
    size = 140,
    strokeWidth = 12,
    progress,
    duration = 900,
    color = '#06B6D4',
    bgColor = 'rgba(15,23,42,0.08)',
    textColor = '#0F172A',
    }: Props) {
    const animated = useRef(new Animated.Value(0)).current;

    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    // ✅ untuk ring: clamp 0..100
    const pctRing = useMemo(() => clamp(Number(progress) || 0, 0, 100), [progress]);

    // ✅ untuk text: boleh > 100 (tapi tetap rapihin minimal 0)
    const pctText = useMemo(() => Math.max(0, Number(progress) || 0), [progress]);

    const strokeDashoffset = animated.interpolate({
        inputRange: [0, 100],
        outputRange: [circumference, 0],
        extrapolate: 'clamp', // ✅ penting: jangan lewat 0..100
    });

    useEffect(() => {
        animated.stopAnimation();
        animated.setValue(0);
        Animated.timing(animated, {
        toValue: pctRing,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
        }).start();
    }, [pctRing, duration, animated]);

    return (
        <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
            <Circle
            stroke={bgColor}
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            />

            <AnimatedCircle
            stroke={color}
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation={-90}
            originX={size / 2}
            originY={size / 2}
            />
        </Svg>

        <View
            style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
            }}
        >
            <Text style={{ fontSize: 22, fontWeight: '900', color: textColor }}>
            {pctText.toFixed(1)}%
            </Text>
        </View>
        </View>
    );
}
