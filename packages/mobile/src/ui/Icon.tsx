import React from 'react';
import { SvgXml } from 'react-native-svg';
import { ICONS } from '../store';
import { useTheme } from '../platform/theme';

// Same Lucide set as the web prototype (frontend/src/shared/icons.js). Defaults to the ink colour.
export default function Icon({ name, size = 22, color, strokeWidth = 1.75 }: {
  name: string; size?: number; color?: string; strokeWidth?: number;
}) {
  const { c } = useTheme();
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
  return <SvgXml xml={xml} width={size} height={size} color={color ?? c.ink} />;
}
