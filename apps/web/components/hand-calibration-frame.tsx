"use client";

import React from "react";

type Props = {
  width: number;
  height: number;
  x?: number;
  y?: number;
  scale?: number;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
};

/**
 * Hand calibration frame - simple realistic hand outline with 5 fingers
 */
export default function HandCalibrationFrame({
  width,
  height,
  x,
  y,
  scale = 1,
  stroke = "#22c55e",
  strokeWidth = 3,
  opacity = 1,
}: Props) {
  const cx = x ?? width / 2;
  const cy = y ?? height / 2;

  // Simple hand path - proper proportions
  // ViewBox: 0 0 200 280 (width x height ratio ~0.71)
  const vbW = 200;
  const vbH = 280;

  const transform = `
    translate(${cx} ${cy})
    scale(${scale})
    translate(${-vbW / 2} ${-vbH / 2})
  `;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <g transform={transform}>
        {/* Main hand outline - 5 fingers with proper proportions */}
        <path
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={opacity}
          vectorEffect="non-scaling-stroke"
          d="
            M 85 280
            L 85 220
            Q 40 210, 30 180
            Q 20 150, 25 130
            L 30 100
            Q 32 85, 40 80
            Q 50 75, 55 85
            L 60 110
            L 60 95
            L 55 45
            Q 54 30, 62 25
            Q 72 20, 80 25
            Q 88 30, 88 45
            L 88 75
            L 90 40
            L 92 15
            Q 93 3, 100 2
            Q 110 1, 115 3
            Q 122 8, 122 20
            L 118 70
            L 122 35
            Q 124 18, 133 16
            Q 143 14, 150 18
            Q 157 24, 155 40
            L 148 90
            L 155 60
            Q 158 45, 168 45
            Q 178 45, 182 55
            Q 186 65, 182 85
            L 170 130
            Q 175 150, 175 175
            Q 175 210, 140 225
            L 115 235
            L 115 280
            Z
          "
        />

        {/* Wrist line */}
        <line
          x1="85"
          y1="245"
          x2="115"
          y2="245"
          stroke={stroke}
          strokeWidth={strokeWidth * 0.5}
          opacity={opacity * 0.5}
          strokeDasharray="5 5"
        />
      </g>
    </svg>
  );
}
