import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { POOL } from './photoPool';

// Same deterministic pick as the web prototype's photoUrl (frontend/src/ui/Ph.jsx).
const hash = (s: string) => {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
};
export const photoSource = (hue: number | string, seed: number | string) => POOL[hash(`${hue}:${seed}`) % POOL.length];

export default function Photo({ hue = 28, seed = 1, ar = 1.333, style }: {
  hue?: number | string; seed?: number | string; ar?: number; style?: StyleProp<ImageStyle>;
}) {
  return <Image source={photoSource(hue, seed)} style={[{ width: '100%', aspectRatio: ar }, style]} resizeMode="cover" />;
}
