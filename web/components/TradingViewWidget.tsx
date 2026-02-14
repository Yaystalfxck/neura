"use client";

import React, { useEffect, useRef } from 'react';

interface TradingViewWidgetProps {
  symbol: string;
  interval?: string;
  height?: number;
}

export default function TradingViewWidget({ 
  symbol, 
  interval = '15', 
  height = 500 
}: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    // Очищаем предыдущий виджет
    if (widgetRef.current && containerRef.current) {
      widgetRef.current.remove();
      widgetRef.current = null;
    }

    // Создаем новый виджет
    if (containerRef.current && !widgetRef.current) {
      const cleanSymbol = symbol.replace('FX:', '').replace('FX_IDC:', '');
      
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = () => {
        if (window.TradingView && containerRef.current) {
          // @ts-ignore
          widgetRef.current = new window.TradingView.widget({
            container_id: containerRef.current.id,
            width: '100%',
            height: height,
            symbol: cleanSymbol,
            interval: interval,
            timezone: 'Etc/UTC',
            theme: 'dark',
            style: '1',
            locale: 'ru',
            toolbar_bg: '#1a1a1a',
            enable_publishing: false,
            hide_side_toolbar: false,
            allow_symbol_change: true,
            details: true,
            studies: [
              'MASimple@tv-basicstudies',
              'RSI@tv-basicstudies',
              'MACD@tv-basicstudies',
              'Volume@tv-basicstudies'
            ],
            show_popup_button: true,
            popup_width: '1000',
            popup_height: '650',
          });
        }
      };
      
      document.head.appendChild(script);
    }

    return () => {
      // Очищаем при размонтировании
      if (widgetRef.current) {
        widgetRef.current.remove();
        widgetRef.current = null;
      }
    };
  }, [symbol, interval, height]);

  return (
    <div className="tradingview-widget-container relative">
      <div 
        id={`tradingview_${symbol}_${Date.now()}`}
        ref={containerRef} 
        style={{ height: `${height}px` }}
        className="rounded-xl overflow-hidden border border-gray-700"
      />
      
      {/* Заглушка если TradingView не загрузился */}
      {!window.TradingView && (
        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
          <div className="text-center p-8">
            <div className="text-4xl mb-4">📈</div>
            <h3 className="text-xl font-bold mb-2">График TradingView</h3>
            <p className="text-gray-400">Загрузка живого графика...</p>
            <p className="text-sm text-gray-500 mt-2">
              Символ: {symbol.replace('FX:', '').replace('FX_IDC:', '')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Добавляем декларацию для TradingView
declare global {
  interface Window {
    TradingView: any;
  }
}