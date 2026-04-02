/**
 * TradingView Data API
 * Получение данных из TradingView для анализа
 */

import { NextRequest, NextResponse } from 'next/server';
import ForexSignalCollector from '@/lib/tradingview-collector-simple';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { market = 'market', timeframe = '5' } = body;

    console.log(`📊 Запрос TradingView данных: market=${market}, timeframe=${timeframe}m`);

    const collector = new ForexSignalCollector();
    
    try {
      await collector.init();
      const data = await collector.getCurrentData(market, parseInt(timeframe));
      
      return NextResponse.json({
        success: true,
        data: data,
        count: data.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Ошибка получения данных TradingView:', error);
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: []
      }, { status: 500 });
    } finally {
      await collector.shutdown();
    }
    
  } catch (error) {
    console.error('❌ Ошибка API TradingView:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
