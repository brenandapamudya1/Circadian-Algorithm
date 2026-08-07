import React from 'react';
import { View, Dimensions } from 'react-native';
import Svg, { Path, Circle, Line, G, Rect, Text as SvgText } from 'react-native-svg';
import { styles } from '../constants/theme';

const { width } = Dimensions.get('window');

interface TrendChartProps {
  values: number[];
  labels: string[];
  maxY: number;
  showTooltip?: boolean;
  tooltipIndex?: number;
  tooltipText?: string;
  accentColor?: string;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  values,
  labels,
  maxY,
  showTooltip = false,
  tooltipIndex = 3,
  tooltipText = 'Average 50 ms',
  accentColor = '#A88AD3',
}) => {
  const topPadding = 42;
  const bottomPadding = 32;
  const paddingLeft = 30;
  const paddingRight = 18;
  const svgWidth = width - 80;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = 110;
  const svgHeight = topPadding + chartHeight + bottomPadding;

  const numSegments = Math.max(labels.length - 1, 1);

  const points = values.map((val, idx) => {
    const x = paddingLeft + (idx * (chartWidth / numSegments));
    const y = topPadding + chartHeight - (val / maxY) * chartHeight;
    return { x, y };
  });

  const getSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
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

  const linePath = getSmoothPath(points);
  const gridValues = [0, 25, 50, 75];
  const clampedTipIdx = Math.min(tooltipIndex, points.length - 1);
  const tipPt = points[clampedTipIdx];
  const tipBoxW = 122;
  const tipBoxH = 22;
  const tipBoxX = Math.max(paddingLeft, Math.min(tipPt.x - tipBoxW / 2, paddingLeft + chartWidth - tipBoxW));
  const tipBoxY = Math.max(4, tipPt.y - tipBoxH - 10);

  return (
    <View style={styles.chartWrapper}>
      <Svg height={svgHeight} width={svgWidth}>
        {gridValues.map((gridVal) => {
          const yPos = topPadding + chartHeight - (gridVal / maxY) * chartHeight;
          return (
            <G key={gridVal}>
              <Line
                x1={paddingLeft}
                y1={yPos}
                x2={paddingLeft + chartWidth}
                y2={yPos}
                stroke="#ECDFF6"
                strokeWidth="1"
              />
              <SvgText
                x={paddingLeft - 5}
                y={yPos + 4}
                fill="#9E8CB0"
                fontSize="10"
                textAnchor="end"
              >
                {gridVal}
              </SvgText>
            </G>
          );
        })}

        <Path
          d={linePath}
          fill="none"
          stroke={`${accentColor}35`}
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <Path
          d={linePath}
          fill="none"
          stroke={accentColor}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {showTooltip && points.length > 0 && (
          <G>
            <Rect
              x={tipBoxX}
              y={tipBoxY}
              width={tipBoxW}
              height={tipBoxH}
              rx={6}
              fill="#2E1E43"
            />
            <SvgText
              x={tipBoxX + tipBoxW / 2}
              y={tipBoxY + 14}
              fill="#FFFFFF"
              fontSize="10"
              fontWeight="normal"
              textAnchor="middle"
            >
              {tooltipText}
            </SvgText>
            <Circle
              cx={tipPt.x}
              cy={tipPt.y}
              r={5.5}
              fill={accentColor}
              stroke="#FFFFFF"
              strokeWidth="2.5"
            />
          </G>
        )}

        {labels.map((label, idx) => {
          const xPos = paddingLeft + (idx * (chartWidth / numSegments));
          return (
            <SvgText
              key={`${label}-${idx}`}
              x={xPos}
              y={topPadding + chartHeight + 22}
              fill="#5A4570"
              fontSize="11"
              fontWeight="normal"
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
