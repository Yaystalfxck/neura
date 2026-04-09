"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface TradingBackgroundProps {
  variant?: 'search' | 'signal';
  signalType?: 'BUY' | 'SELL' | null;
}

// Генерация данных для свечей
const generateCandleData = (count: number) => {
  const candles = [];
  let price = 1.0850;
  for (let i = 0; i < count; i++) {
    const open = price;
    const change = (Math.random() - 0.5) * 0.003;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * 0.001;
    const low = Math.min(open, close) - Math.random() * 0.001;
    candles.push({ open, close, high, low });
    price = close;
  }
  return candles;
};

// Компонент свечи
const CandleStick: React.FC<{
  x: number;
  open: number;
  close: number;
  high: number;
  low: number;
  minPrice: number;
  maxPrice: number;
  height: number;
  delay: number;
}> = ({ x, open, close, high, low, minPrice, maxPrice, height, delay }) => {
  const isBullish = close > open;
  const priceRange = maxPrice - minPrice;
  
  const scaleY = (price: number) => {
    return height - ((price - minPrice) / priceRange) * height;
  };

  const candleHeight = Math.abs(scaleY(close) - scaleY(open));
  const wickHeight = scaleY(low) - scaleY(high);
  const candleY = Math.min(scaleY(open), scaleY(close));
  const wickY = scaleY(high);

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.5 }}
    >
      {/* Фитиль */}
      <line
        x1={x}
        y1={wickY}
        x2={x}
        y2={wickY + wickHeight}
        stroke={isBullish ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}
        strokeWidth={1}
      />
      {/* Тело свечи */}
      <rect
        x={x - 3}
        y={candleY}
        width={6}
        height={Math.max(candleHeight, 1)}
        fill={isBullish ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)'}
        rx={1}
      />
    </motion.g>
  );
};

export const TradingBackground: React.FC<TradingBackgroundProps> = ({
  variant = 'search',
  signalType = null,
}) => {
  const [candles, setCandles] = useState<Array<{ open: number; close: number; high: number; low: number }>>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    // Генерируем свечи
    const candleCount = Math.floor(window.innerWidth / 12);
    setCandles(generateCandleData(candleCount));

    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  if (candles.length === 0) return null;

  const allPrices = candles.flatMap(c => [c.open, c.close, c.high, c.low]);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);

  // Цветовая схема в зависимости от типа
  const accentColor = signalType === 'BUY' 
    ? 'rgba(34, 197, 94, 0.15)' 
    : signalType === 'SELL' 
    ? 'rgba(239, 68, 68, 0.15)' 
    : 'rgba(59, 130, 246, 0.15)';

  const lineColor = signalType === 'BUY'
    ? 'rgba(34, 197, 94, 0.3)'
    : signalType === 'SELL'
    ? 'rgba(239, 68, 68, 0.3)'
    : 'rgba(59, 130, 246, 0.3)';

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* SVG фон со свечами */}
      <svg
        className="absolute inset-0 w-full h-full opacity-30"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        preserveAspectRatio="none"
      >
        {/* Свечи */}
        {candles.map((candle, i) => (
          <CandleStick
            key={i}
            x={i * 12 + 6}
            open={candle.open}
            close={candle.close}
            high={candle.high}
            low={candle.low}
            minPrice={minPrice}
            maxPrice={maxPrice}
            height={dimensions.height}
            delay={i * 0.02}
          />
        ))}

        {/* Линия тренда */}
        <motion.polyline
          points={candles
            .map((c, i) => `${i * 12 + 6},${dimensions.height - ((c.close - minPrice) / (maxPrice - minPrice)) * dimensions.height}`)
            .join(' ')}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 3, ease: 'easeInOut' }}
          style={{
            strokeDasharray: 1000,
            strokeDashoffset: 1000,
          }}
        />
      </svg>

      {/* Градиентный оверлей */}
      <div
        className="absolute inset-0"
        style={{
          background: variant === 'search'
            ? 'linear-gradient(to bottom, rgba(17, 24, 39, 0.9) 0%, rgba(17, 24, 39, 0.7) 50%, rgba(17, 24, 39, 0.9) 100%)'
            : `linear-gradient(to bottom, rgba(17, 24, 39, 0.95) 0%, rgba(17, 24, 39, 0.85) 50%, rgba(17, 24, 39, 0.95) 100%)`,
        }}
      />

      {/* Анимированные точки (как на графике) */}
      {variant === 'signal' && (
        <>
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                backgroundColor: accentColor,
                left: `${20 + i * 15}%`,
                top: `${30 + Math.sin(i) * 10}%`,
              }}
              animate={{
                scale: [1, 2, 1],
                opacity: [0.3, 0.8, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.3,
              }}
            />
          ))}
        </>
      )}

      {/* Сетка как на TradingView */}
      <div className="absolute inset-0 opacity-5">
        <div className="w-full h-full" style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }} />
      </div>
    </div>
  );
};
