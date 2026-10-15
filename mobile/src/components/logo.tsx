import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Monogramme BYYND : une trajectoire en paliers qui monte au-delà du cadre. */
export function Logo({ size = 28, mono = false }: { size?: number; mono?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="BYYND">
      <Rect width={64} height={64} rx={16} fill="#15161A" />
      <Path d="M13 46h14V31h14V16h12" fill="none" stroke="#F4F2EE" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={53} cy={16} r={5} fill={mono ? '#F4F2EE' : '#2946F0'} />
    </Svg>
  );
}
