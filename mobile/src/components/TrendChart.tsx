import React from 'react';
import { View, Dimensions } from 'react-native';
import Svg, { Path, Circle, Line, G, Rect, Text as SvgText } from 'react-native-svg';
import { styles } from '../constants/theme';

const { width } = Dimensions.get('window');

export interface TrendChartProps {
  values: (number | null)[];
  labels: string[];
  maxY: number;
  gridValues?: number[];
  formatYLabel?: (val: number) => string;
  showTooltip?: boolean;
  tooltipIndex?: number;
  tooltipText?: string;
  accentColor?: string;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  values,
  labels,
  maxY,
  gridValues,
  formatYLabel,
  showTooltip = false,
  tooltipIndex = 3,
  tooltipText = 'Average 50 ms',
  accentColor = '#A88AD3',
}) => {
  const topPadding = 35;
  const bottomPadding = 32;
  const paddingLeft = 35;
  const paddingRight = 20;
  const svgWidth = width - 80;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = 110;
  const svgHeight = topPadding + chartHeight + bottomPadding;

  const numSegments = Math.max(labels.length - 1, 1);

  // Map values to 2D points (y is null if val is null)
  const validPoints: { x: number; y: number; val: number; idx: number }[] = [];
  const points = values.map((val, idx) => {
    const x = paddingLeft + (idx * (chartWidth / numSegments));
    if (val === null || val === undefined) {
      return { x, y: null, val: null, idx };
    }
    const y = topPadding + chartHeight - (val / maxY) * chartHeight;
    const pt = { x, y, val, idx };
    validPoints.push(pt as { x: number; y: number; val: number; idx: number });
    return pt;
  });

  // Group contiguous valid points into line segments
  const segments: { x: number; y: number }[][] = [];
  let currentSegment: { x: number; y: number }[] = [];

  for (const pt of points) {
    if (pt.y !== null) {
      currentSegment.push({ x: pt.x, y: pt.y });
    } else {
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = [];
      }
    }
  }
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  const getSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length <= 1) return '';
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 2;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (p1.x - p0.x) / 2;
      const cpY2 = p1.y;
      path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    return path;
  };

  const activeGridValues = gridValues ?? [0, 1, 2];

  return (
    <View style={styles.chartWrapper}>
      <Svg height={svgHeight} width={svgWidth}>
        {/* Y Axis Grid lines & Labels */}
        {activeGridValues.map((gridVal) => {
          const yPos = topPadding + chartHeight - (gridVal / maxY) * chartHeight;
          const labelText = formatYLabel ? formatYLabel(gridVal) : `${gridVal}`;
          return (
            <G key={gridVal}>
              <Line
                x1={paddingLeft}
                y1={yPos}
                x2={paddingLeft + chartWidth}
                y2={yPos}
                stroke="#ECDFF6"
                strokeWidth="1"
                strokeDasharray={gridVal === 0 ? undefined : '3,3'}
              />
              <SvgText
                x={paddingLeft - 8}
                y={yPos + 4}
                fill="#9E8CB0"
                fontSize="10"
                fontWeight="500"
                textAnchor="end"
              >
                {labelText}
              </SvgText>
            </G>
          );
        })}

        {/* Line Segments */}
        {segments.map((seg, sIdx) => {
          if (seg.length <= 1) return null;
          const pathD = getSmoothPath(seg);
          return (
            <G key={`seg-${sIdx}`}>
              <Path
                d={pathD}
                fill="none"
                stroke={`${accentColor}35`}
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d={pathD}
                fill="none"
                stroke={accentColor}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </G>
          );
        })}

        {/* Data Point Circles */}
        {validPoints.map((pt) => (
          <G key={`pt-${pt.idx}`}>
            <Circle
              cx={pt.x}
              cy={pt.y}
              r={7}
              fill={`${accentColor}40`}
            />
            <Circle
              cx={pt.x}
              cy={pt.y}
              r={4}
              fill={accentColor}
              stroke="#FFFFFF"
              strokeWidth="2"
            />
          </G>
        ))}

        {/* X Axis Day Labels */}
        {labels.map((label, idx) => {
          const xPos = paddingLeft + (idx * (chartWidth / numSegments));
          return (
            <SvgText
              key={`${label}-${idx}`}
              x={xPos}
              y={topPadding + chartHeight + 22}
              fill="#5A4570"
              fontSize="11"
              fontWeight={values[idx] !== null && values[idx] !== undefined ? 'bold' : 'normal'}
              textAnchor="middle"
            >
              {label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
};
