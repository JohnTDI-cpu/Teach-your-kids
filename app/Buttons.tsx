/**
 * Reusable button components backed by Qwen-generated 3D pill/round
 * graphics from assets/menu/btn_*.webp. Text always lives in React Native
 * (Qwen is poor at letters), the image is just a glossy background.
 *
 * Single source of truth for UI button styling — one PillButton import
 * everywhere instead of nine bespoke TouchableOpacity styles.
 */
import React from 'react';
import {
  ImageBackground,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { MenuAssets } from './AssetMap';

const FONT_BOLD = 'Fredoka_700Bold';

export type PillColor = 'green' | 'blue' | 'orange' | 'purple' | 'red' | 'gray';
export type RoundColor = 'green' | 'blue' | 'red' | 'gray';

const PILL_FALLBACK: Record<PillColor, string> = {
  green: '#4CAF50',
  blue: '#2196F3',
  orange: '#FF9800',
  purple: '#9C27B0',
  red: '#D32F2F',
  gray: '#9E9E9E',
};
const ROUND_FALLBACK: Record<RoundColor, string> = {
  green: '#4CAF50',
  blue: '#2196F3',
  red: '#D32F2F',
  gray: '#9E9E9E',
};

type PillProps = {
  label: string;
  color?: PillColor;
  onPress?: () => void;
  disabled?: boolean;
  /** Optional extra style appended to the pill container. */
  style?: ViewStyle;
  /** Override label text style (fontSize, color etc.). */
  textStyle?: TextStyle;
  /** Visual size; controls intrinsic width/height. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
};

/**
 * Per-size geometry. minWidth grows generously so localised long labels
 * (German "Aufnahme stoppen (12s)", Ukrainian "Зберегти картку") have room.
 * Horizontal padding scales with size so smaller buttons don't lose half
 * their interior to whitespace.
 */
const PILL_SIZES = {
  sm: { minWidth: 110, height: 40, fontSize: 14, paddingHorizontal: 14 },
  md: { minWidth: 170, height: 52, fontSize: 17, paddingHorizontal: 20 },
  lg: { minWidth: 230, height: 64, fontSize: 21, paddingHorizontal: 28 },
  xl: { minWidth: 280, height: 72, fontSize: 24, paddingHorizontal: 32 },
};

/**
 * Glossy pill button. Falls back to a solid colour rounded rect when the
 * generated PNG isn't bundled (e.g. during dev before regenerating
 * AssetMap), so the UI never breaks on missing assets.
 *
 * Long labels are handled by auto-shrinking the font down to 65 % rather
 * than ellipsising — important for German/Ukrainian translations that run
 * 1.5-2× longer than the English source.
 */
export function PillButton({
  label,
  color = 'blue',
  onPress,
  disabled,
  style,
  textStyle,
  size = 'md',
}: PillProps) {
  const dims = PILL_SIZES[size];
  const bg = MenuAssets[`btn_pill_${color}.webp`];
  const { paddingHorizontal, ...containerDims } = dims;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[
        styles.pillWrap,
        containerDims,
        { paddingHorizontal },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      {bg ? (
        <ImageBackground source={bg} style={StyleSheet.absoluteFill} imageStyle={styles.pillImage} resizeMode="stretch" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: PILL_FALLBACK[color], borderRadius: dims.height / 2 }]} />
      )}
      <Text
        style={[styles.pillLabel, { fontSize: dims.fontSize }, textStyle]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

type RoundProps = {
  label: string; // emoji / single char — actual icon
  color?: RoundColor;
  onPress?: () => void;
  disabled?: boolean;
  size?: number; // diameter in dp
  style?: ViewStyle;
  textStyle?: TextStyle;
};

/** Round 3D icon button (play/select/delete in recording rows, back arrow). */
export function RoundButton({
  label,
  color = 'gray',
  onPress,
  disabled,
  size = 44,
  style,
  textStyle,
}: RoundProps) {
  const bg = MenuAssets[`btn_round_${color}.webp`];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      {bg ? (
        <ImageBackground source={bg} style={StyleSheet.absoluteFill} imageStyle={styles.roundImage} resizeMode="cover" />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: ROUND_FALLBACK[color], borderRadius: size / 2 },
          ]}
        />
      )}
      <Text style={[styles.roundLabel, { fontSize: Math.round(size * 0.45) }, textStyle]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pillWrap: {
    // paddingHorizontal applied inline per-size — see PILL_SIZES.
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 999,
  },
  pillImage: { borderRadius: 999 },
  pillLabel: {
    color: '#fff',
    fontFamily: FONT_BOLD,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    paddingHorizontal: 4,
  },
  roundImage: { borderRadius: 999 },
  roundLabel: {
    color: '#fff',
    fontFamily: FONT_BOLD,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
