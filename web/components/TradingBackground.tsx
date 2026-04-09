"use client";

import React, { useEffect, useRef } from 'react';

interface TradingBackgroundProps {
  variant?: 'search' | 'signal';
  signalType?: 'BUY' | 'SELL' | null;
}

export const TradingBackground: React.FC<TradingBackgroundProps> = ({
  variant = 'search',
  signalType = null,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener('resize', resize);

    // Параметры свечей
    const candleWidth = 8;
    const gap = 4;
    const speed = 0.3; // Скорость движения
    let time = 0;
    let offset = 0;

    // Генерация начальных свечей
    const candles: Array<{ open: number; close: number; high: number; low: number }> = [];
    let price = 1.0850;
    for (let i = 0; i < 200; i++) {
      const open = price;
      const change = (Math.random() - 0.5) * 0.002;
      const close = open + change;
      const high = Math.max(open, close) + Math.random() * 0.001;
      const low = Math.min(open, close) - Math.random() * 0.001;
      candles.push({ open, close, high, low });
      price = close;
    }

    // Цвета
    const isBuy = signalType === 'BUY';
    const isSell = signalType === 'SELL';
    const lineColor = isBuy ? 'rgba(34, 197, 94, 0.6)' : isSell ? 'rgba(239, 68, 68, 0.6)' : 'rgba(59, 130, 246, 0.6)';
    const glowColor = isBuy ? 'rgba(34, 197, 94, 0.15)' : isSell ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)';

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 0.016;
      offset += speed;

      // Генерируем новые свечи по мере необходимости
      const step = candleWidth + gap;
      const visibleCount = Math.floor(canvas.width / step) + 5;
      const startIndex = Math.floor(offset / step);
      const neededCandles = startIndex + visibleCount + 10;
      
      while (candles.length < neededCandles) {
        const lastCandle = candles[candles.length - 1];
        const open = lastCandle.close;
        const change = (Math.random() - 0.5) * 0.002;
        const close = open + change;
        const high = Math.max(open, close) + Math.random() * 0.001;
        const low = Math.min(open, close) - Math.random() * 0.001;
        candles.push({ open, close, high, low });
      }

      // Сетка
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < canvas.width; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Рисуем свечи
      // startIndex и visibleCount уже определены выше

      // Находим мин/макс цену для масштабирования
      let minP = Infinity, maxP = -Infinity;
      for (let i = startIndex; i < startIndex + visibleCount && i < candles.length; i++) {
        const c = candles[i];
        if (c) {
          minP = Math.min(minP, c.low);
          maxP = Math.max(maxP, c.high);
        }
      }
      const range = maxP - minP || 0.01;

      const scaleY = (p: number) => {
        return canvas.height - ((p - minP) / range) * canvas.height * 0.7 - canvas.height * 0.15;
      };

      // Рисуем видимые свечи
      for (let i = 0; i < visibleCount; i++) {
        const idx = startIndex + i;
        if (idx < 0 || idx >= candles.length) continue;

        const candle = candles[idx];
        const x = i * step - (offset % step);
        const isBullish = candle.close > candle.open;
        const color = isBullish ? 'rgba(34, 197, 94,' : 'rgba(239, 68, 68,';

        const openY = scaleY(candle.open);
        const closeY = scaleY(candle.close);
        const highY = scaleY(candle.high);
        const lowY = scaleY(candle.low);

        // Фитиль
        ctx.strokeStyle = `${color} 0.6)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + candleWidth / 2, highY);
        ctx.lineTo(x + candleWidth / 2, lowY);
        ctx.stroke();

        // Тело
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(Math.abs(closeY - openY), 1);
        ctx.fillStyle = `${color} 0.7)`;
        ctx.fillRect(x, bodyTop, candleWidth, bodyHeight);
      }

      // Линия тренда
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 3;
      ctx.shadowColor = lineColor;
      ctx.shadowBlur = 15;
      ctx.beginPath();

      let first = true;
      for (let i = 0; i < visibleCount; i++) {
        const idx = startIndex + i;
        if (idx < 0 || idx >= candles.length) continue;

        const x = i * step - (offset % step) + candleWidth / 2;
        const y = scaleY(candles[idx].close);

        if (first) {
          ctx.moveTo(x, y);
          first = false;
        } else {
          const prevIdx = startIndex + i - 1;
          if (prevIdx >= 0 && prevIdx < candles.length) {
            const prevX = (i - 1) * step - (offset % step) + candleWidth / 2;
            const prevY = scaleY(candles[prevIdx].close);
            const cpx = (prevX + x) / 2;
            ctx.quadraticCurveTo(prevX, prevY, cpx, (prevY + y) / 2);
          }
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Градиент под линией
      if (!first) {
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, glowColor);
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        first = true;
        for (let i = 0; i < visibleCount; i++) {
          const idx = startIndex + i;
          if (idx < 0 || idx >= candles.length) continue;
          const x = i * step - (offset % step) + candleWidth / 2;
          const y = scaleY(candles[idx].close);
          if (first) {
            ctx.moveTo(x, y);
            first = false;
          } else {
            const prevIdx = startIndex + i - 1;
            if (prevIdx >= 0 && prevIdx < candles.length) {
              const prevX = (i - 1) * step - (offset % step) + candleWidth / 2;
              const prevY = scaleY(candles[prevIdx].close);
              const cpx = (prevX + x) / 2;
              ctx.quadraticCurveTo(prevX, prevY, cpx, (prevY + y) / 2);
            }
          }
        }
        // Замыкаем для градиента
        const lastIdx = startIndex + visibleCount - 1;
        if (lastIdx >= 0 && lastIdx < candles.length) {
          ctx.lineTo((visibleCount - 1) * step - (offset % step) + candleWidth / 2, canvas.height);
          ctx.lineTo(- (offset % step) + candleWidth / 2, canvas.height);
        }
        ctx.closePath();
        ctx.fill();
      }

      // Пульсирующая точка
      if (!first && startIndex + visibleCount - 1 >= 0 && startIndex + visibleCount - 1 < candles.length) {
        const lastVisibleIdx = Math.min(startIndex + visibleCount - 1, candles.length - 1);
        const lastX = (lastVisibleIdx - startIndex) * step - (offset % step) + candleWidth / 2;
        const lastY = scaleY(candles[lastVisibleIdx].close);
        const pulseSize = 5 + 3 * Math.sin(time * 3);
        const pulseOpacity = 0.6 + 0.4 * Math.sin(time * 3);

        ctx.fillStyle = isBuy ? `rgba(34, 197, 94, ${pulseOpacity})` : isSell ? `rgba(239, 68, 68, ${pulseOpacity})` : `rgba(59, 130, 246, ${pulseOpacity})`;
        ctx.beginPath();
        ctx.arc(lastX, lastY, pulseSize, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isBuy ? 'rgba(34, 197, 94, 0.3)' : isSell ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)';
        ctx.beginPath();
        ctx.arc(lastX, lastY, pulseSize * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [signalType]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.7 }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: variant === 'search'
            ? 'radial-gradient(ellipse at center, rgba(17, 24, 39, 0.5) 0%, rgba(17, 24, 39, 0.85) 100%)'
            : 'radial-gradient(ellipse at center, rgba(17, 24, 39, 0.4) 0%, rgba(17, 24, 39, 0.8) 100%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          boxShadow: 'inset 0 0 150px rgba(0, 0, 0, 0.8)',
        }}
      />
    </div>
  );
};
