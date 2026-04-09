"use client";

import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

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
  const particlesRef = useRef<Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    opacity: number;
  }>>([]);

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

    // Инициализация частиц
    const particleCount = Math.min(50, Math.floor(window.innerWidth / 30));
    particlesRef.current = Array.from({ length: particleCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.5 + 0.1,
    }));

    // Генерация данных свечей
    const candleData: Array<{ x: number; open: number; close: number; high: number; low: number }> = [];
    let price = 1.0850;
    const candleWidth = 8;
    const gap = 4;
    const totalCandles = Math.floor(canvas.width / (candleWidth + gap));
    
    for (let i = 0; i < totalCandles; i++) {
      const open = price;
      const change = (Math.random() - 0.5) * 0.002;
      const close = open + change;
      const high = Math.max(open, close) + Math.random() * 0.001;
      const low = Math.min(open, close) - Math.random() * 0.001;
      candleData.push({ x: i * (candleWidth + gap), open, close, high, low });
      price = close;
    }

    const allPrices = candleData.flatMap(c => [c.open, c.close, c.high, c.low]);
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = maxPrice - minPrice;

    const scaleY = (p: number) => {
      return canvas.height - ((p - minPrice) / priceRange) * canvas.height * 0.8 - canvas.height * 0.1;
    };

    // Цвета
    const isBuy = signalType === 'BUY';
    const isSell = signalType === 'SELL';
    const bullColor = 'rgba(34, 197, 94,';
    const bearColor = 'rgba(239, 68, 68,';
    const lineColor = isBuy ? 'rgba(34, 197, 94, 0.4)' : isSell ? 'rgba(239, 68, 68, 0.4)' : 'rgba(59, 130, 246, 0.4)';
    const gridColor = 'rgba(255, 255, 255, 0.03)';

    let time = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 0.01;

      // Сетка
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
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

      // Свечи
      candleData.forEach((candle, i) => {
        const isBullish = candle.close > candle.open;
        const color = isBullish ? bullColor : bearColor;
        
        const x = candle.x;
        const openY = scaleY(candle.open);
        const closeY = scaleY(candle.close);
        const highY = scaleY(candle.high);
        const lowY = scaleY(candle.low);

        // Фитиль
        ctx.strokeStyle = `${color} 0.3)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + candleWidth / 2, highY);
        ctx.lineTo(x + candleWidth / 2, lowY);
        ctx.stroke();

        // Тело
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(Math.abs(closeY - openY), 1);
        
        ctx.fillStyle = `${color} 0.5)`;
        ctx.fillRect(x, bodyTop, candleWidth, bodyHeight);
      });

      // Линия тренда с анимацией
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = lineColor;
      ctx.shadowBlur = 10;
      ctx.beginPath();

      const visibleCandles = Math.min(candleData.length, Math.floor(time * 20) + 10);
      for (let i = 0; i < visibleCandles; i++) {
        const x = candleData[i].x + candleWidth / 2;
        const y = scaleY(candleData[i].close);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Градиент под линией
      if (visibleCandles > 1) {
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        const alpha = isBuy ? 'rgba(34, 197, 94, 0.05)' : isSell ? 'rgba(239, 68, 68, 0.05)' : 'rgba(59, 130, 246, 0.05)';
        gradient.addColorStop(0, alpha);
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(candleData[0].x + candleWidth / 2, scaleY(candleData[0].close));
        for (let i = 1; i < visibleCandles; i++) {
          ctx.lineTo(candleData[i].x + candleWidth / 2, scaleY(candleData[i].close));
        }
        ctx.lineTo(candleData[visibleCandles - 1].x + candleWidth / 2, canvas.height);
        ctx.lineTo(candleData[0].x + candleWidth / 2, canvas.height);
        ctx.closePath();
        ctx.fill();
      }

      // Частицы
      particlesRef.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        const pulseOpacity = p.opacity * (0.5 + 0.5 * Math.sin(time * 2 + p.x));
        ctx.fillStyle = `rgba(59, 130, 246, ${pulseOpacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Соединительные линии между близкими частицами
      particlesRef.current.forEach((p1, i) => {
        particlesRef.current.slice(i + 1).forEach(p2 => {
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.strokeStyle = `rgba(59, 130, 246, ${0.1 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        });
      });

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
      {/* Canvas фон */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full opacity-40"
      />

      {/* Градиентный оверлей для читаемости */}
      <div
        className="absolute inset-0"
        style={{
          background: variant === 'search'
            ? 'radial-gradient(ellipse at center, rgba(17, 24, 39, 0.7) 0%, rgba(17, 24, 39, 0.95) 100%)'
            : 'radial-gradient(ellipse at center, rgba(17, 24, 39, 0.6) 0%, rgba(17, 24, 39, 0.95) 100%)',
        }}
      />

      {/* Виньетка */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow: 'inset 0 0 150px rgba(0, 0, 0, 0.8)',
        }}
      />
    </div>
  );
};
