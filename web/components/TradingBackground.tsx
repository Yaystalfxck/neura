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
      time += 0.016;

      // Сетка с пульсацией
      const gridOpacity = 0.03 + 0.01 * Math.sin(time);
      ctx.strokeStyle = `rgba(255, 255, 255, ${gridOpacity})`;
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

      // Свечи с анимацией появления
      const visibleCount = Math.min(candleData.length, Math.floor(time * 15) + 20);
      candleData.slice(0, visibleCount).forEach((candle, i) => {
        const isBullish = candle.close > candle.open;
        const color = isBullish ? bullColor : bearColor;
        
        const x = candle.x;
        const openY = scaleY(candle.open);
        const closeY = scaleY(candle.close);
        const highY = scaleY(candle.high);
        const lowY = scaleY(candle.low);

        // Фитиль с пульсацией - более видимый
        const wickOpacity = 0.5 + 0.2 * Math.sin(time * 2 + i * 0.1);
        ctx.strokeStyle = `${color} ${wickOpacity})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + candleWidth / 2, highY);
        ctx.lineTo(x + candleWidth / 2, lowY);
        ctx.stroke();

        // Тело свечи с анимацией - более видимое
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(Math.abs(closeY - openY), 1);
        
        const bodyOpacity = 0.6 + 0.2 * Math.sin(time * 1.5 + i * 0.05);
        ctx.fillStyle = `${color} ${bodyOpacity})`;
        ctx.fillRect(x, bodyTop, candleWidth, bodyHeight);
      });

      // Линия тренда с анимацией и свечением - более видимая
      if (visibleCount > 1) {
        // Свечение - ярче
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 6;
        ctx.shadowColor = lineColor;
        ctx.shadowBlur = 20;
        ctx.beginPath();

        for (let i = 0; i < visibleCount; i++) {
          const x = candleData[i].x + candleWidth / 2;
          const y = scaleY(candleData[i].close);
          if (i === 0) ctx.moveTo(x, y);
          else {
            const prevX = candleData[i-1].x + candleWidth / 2;
            const prevY = scaleY(candleData[i-1].close);
            const cpx = (prevX + x) / 2;
            ctx.quadraticCurveTo(prevX, prevY, cpx, (prevY + y) / 2);
          }
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Основная линия - толще и ярче
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < visibleCount; i++) {
          const x = candleData[i].x + candleWidth / 2;
          const y = scaleY(candleData[i].close);
          if (i === 0) ctx.moveTo(x, y);
          else {
            const prevX = candleData[i-1].x + candleWidth / 2;
            const prevY = scaleY(candleData[i-1].close);
            const cpx = (prevX + x) / 2;
            ctx.quadraticCurveTo(prevX, prevY, cpx, (prevY + y) / 2);
          }
        }
        ctx.stroke();

        // Градиент под линией - ярче
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        const alpha = isBuy ? 'rgba(34, 197, 94, 0.12)' : isSell ? 'rgba(239, 68, 68, 0.12)' : 'rgba(59, 130, 246, 0.12)';
        gradient.addColorStop(0, alpha);
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(candleData[0].x + candleWidth / 2, scaleY(candleData[0].close));
        for (let i = 1; i < visibleCount; i++) {
          const x = candleData[i].x + candleWidth / 2;
          const y = scaleY(candleData[i].close);
          const prevX = candleData[i-1].x + candleWidth / 2;
          const prevY = scaleY(candleData[i-1].close);
          const cpx = (prevX + x) / 2;
          ctx.quadraticCurveTo(prevX, prevY, cpx, (prevY + y) / 2);
        }
        ctx.lineTo(candleData[visibleCount - 1].x + candleWidth / 2, canvas.height);
        ctx.lineTo(candleData[0].x + candleWidth / 2, canvas.height);
        ctx.closePath();
        ctx.fill();

        // Пульсирующая точка на конце линии - больше и ярче
        const lastX = candleData[visibleCount - 1].x + candleWidth / 2;
        const lastY = scaleY(candleData[visibleCount - 1].close);
        const pulseSize = 6 + 3 * Math.sin(time * 3);
        const pulseOpacity = 0.7 + 0.3 * Math.sin(time * 3);
        
        ctx.fillStyle = isBuy ? `rgba(34, 197, 94, ${pulseOpacity})` : isSell ? `rgba(239, 68, 68, ${pulseOpacity})` : `rgba(59, 130, 246, ${pulseOpacity})`;
        ctx.beginPath();
        ctx.arc(lastX, lastY, pulseSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Внешнее свечение точки - больше
        ctx.fillStyle = isBuy ? 'rgba(34, 197, 94, 0.3)' : isSell ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)';
        ctx.beginPath();
        ctx.arc(lastX, lastY, pulseSize * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [signalType]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Canvas фон - более видимый */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.6 }}
      />

      {/* Градиентный оверлей для читаемости - более прозрачный */}
      <div
        className="absolute inset-0"
        style={{
          background: variant === 'search'
            ? 'radial-gradient(ellipse at center, rgba(17, 24, 39, 0.5) 0%, rgba(17, 24, 39, 0.8) 100%)'
            : 'radial-gradient(ellipse at center, rgba(17, 24, 39, 0.4) 0%, rgba(17, 24, 39, 0.75) 100%)',
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
