// /lib/tradingview-collector-advanced.js
const TradingView = require('@mathieuc/tradingview');

class ForexSignalCollector {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.lastData = new Map();
        this.currentPrices = new Map();
    }

    async init() {
        if (this.isConnected) return;
        
        try {
            console.log('🔧 Инициализация TradingView...');
            this.client = new TradingView.Client();
            this.isConnected = true;
            console.log('✅ TradingView подключен');
        } catch (error) {
            console.error('❌ Ошибка подключения:', error.message);
            this.isConnected = false;
        }
    }

    // ✅ ИСПРАВЛЕНО: Используем chart.delete() вместо chart.close()
    async getCurrentPrice(symbol) {
        return new Promise((resolve) => {
            try {
                if (!this.client) {
                    resolve(null);
                    return;
                }

                const chart = new this.client.Session.Chart();
                let resolved = false;

                const timeout = setTimeout(() => {
                    if (!resolved) {
                        chart.delete(); // ✅ chart.delete() работает!
                        const cached = this.currentPrices.get(symbol);
                        resolve(cached || null);
                    }
                }, 5000);

                chart.onError(() => {
                    if (!resolved) {
                        clearTimeout(timeout);
                        resolved = true;
                        chart.delete(); // ✅ chart.delete() работает!
                        const cached = this.currentPrices.get(symbol);
                        resolve(cached || null);
                    }
                });

                chart.onUpdate(() => {
                    if (!resolved) {
                        const periods = chart.periods;
                        if (periods && periods.length > 0) {
                            clearTimeout(timeout);
                            resolved = true;
                            
                            // Берем цену закрытия последней свечи
                            const price = periods[periods.length - 1].close;
                            
                            if (price && !isNaN(price)) {
                                console.log(`💰 ${symbol}: ${price.toFixed(5)}`);
                                this.currentPrices.set(symbol, price);
                                chart.delete(); // ✅ chart.delete() работает!
                                resolve(price);
                            } else {
                                const cached = this.currentPrices.get(symbol);
                                chart.delete(); // ✅ chart.delete() работает!
                                resolve(cached || null);
                            }
                        }
                    }
                });

                // Запрашиваем 1-минутный график
                chart.setMarket(symbol, {
                    timeframe: '1',
                    range: 1
                });

            } catch (error) {
                console.log(`⚠️ Ошибка получения цены ${symbol}:`, error.message);
                resolve(this.currentPrices.get(symbol) || null);
            }
        });
    }

    // ✅ ИСПРАВЛЕНО: НЕТ .reverse()!
    async getCandles(symbol, timeframe, bars = 500) {
        return new Promise((resolve) => {
            try {
                if (!this.client) {
                    resolve([]);
                    return;
                }

                const chart = new this.client.Session.Chart();
                let dataReceived = false;
                
                const timeout = setTimeout(() => {
                    if (!dataReceived) {
                        chart.delete(); // ✅ chart.delete() работает!
                        resolve([]);
                    }
                }, 15000);

                chart.onError(() => {
                    if (!dataReceived) {
                        clearTimeout(timeout);
                        dataReceived = true;
                        chart.delete(); // ✅ chart.delete() работает!
                        resolve([]);
                    }
                });

                chart.onUpdate(() => {
                    const periods = chart.periods;
                    if (periods && periods.length > 0 && !dataReceived) {
                        clearTimeout(timeout);
                        dataReceived = true;
                        
                        // ✅ НЕТ REVERSE! 0 = старая, length-1 = новая
                        const candles = periods.map(p => ({
                            time: p.time,
                            timestamp: new Date(p.time * 1000).toISOString(),
                            open: p.open,
                            high: p.high,
                            low: p.low,
                            close: p.close,
                            volume: p.volume || 0
                        })); // УБРАЛИ .reverse()!
                        
                        // ✅ Сохраняем цену с ПОСЛЕДНЕЙ свечи
                        if (candles.length > 0) {
                            this.currentPrices.set(symbol, candles[candles.length - 1].close);
                        }
                        
                        chart.delete(); // ✅ chart.delete() работает!
                        resolve(candles);
                    }
                });

                chart.setMarket(symbol, {
                    timeframe: timeframe.toString(),
                    range: bars
                });

            } catch (error) {
                console.error(`❌ Ошибка getCandles ${symbol}:`, error.message);
                resolve([]);
            }
        });
    }

    async getCurrentData(market, timeframe) {
        if (!this.isConnected) await this.init();

        const symbolsByMarket = {
            'otc': [
                { symbol: 'FX_IDC:EURUSD', name: 'EUR/USD' },
                { symbol: 'FX_IDC:GBPUSD', name: 'GBP/USD' },
                { symbol: 'FX_IDC:USDJPY', name: 'USD/JPY' },
                { symbol: 'FX_IDC:AUDUSD', name: 'AUD/USD' },
                { symbol: 'FX_IDC:USDCAD', name: 'USD/CAD' },
                { symbol: 'FX_IDC:USDCHF', name: 'USD/CHF' },
                { symbol: 'FX_IDC:NZDUSD', name: 'NZD/USD' },
                { symbol: 'FX_IDC:GBPJPY', name: 'GBP/JPY' },
                { symbol: 'FX_IDC:EURJPY', name: 'EUR/JPY' },
                { symbol: 'FX_IDC:AUDJPY', name: 'AUD/JPY' }
            ],
            'market': [
                { symbol: 'FX:EURUSD', name: 'EUR/USD' },
                { symbol: 'FX:GBPUSD', name: 'GBP/USD' },
                { symbol: 'FX:USDJPY', name: 'USD/JPY' },
                { symbol: 'FX:AUDUSD', name: 'AUD/USD' },
                { symbol: 'FX:USDCAD', name: 'USD/CAD' },
                { symbol: 'FX:USDCHF', name: 'USD/CHF' },
                { symbol: 'FX:NZDUSD', name: 'NZD/USD' },
                { symbol: 'FX:GBPJPY', name: 'GBP/JPY' },
                { symbol: 'FX:EURJPY', name: 'EUR/JPY' },
                { symbol: 'FX:AUDJPY', name: 'AUD/JPY' },
                { symbol: 'FX:EURGBP', name: 'EUR/GBP' },
                { symbol: 'FX:EURCHF', name: 'EUR/CHF' },
                { symbol: 'FX:GBPCHF', name: 'GBP/CHF' },
                { symbol: 'FX:CADJPY', name: 'CAD/JPY' },
                { symbol: 'FX:CHFJPY', name: 'CHF/JPY' }
            ],
            'demo': [
                { symbol: 'FX:EURUSD', name: 'EUR/USD' },
                { symbol: 'FX:GBPUSD', name: 'GBP/USD' },
                { symbol: 'FX:USDJPY', name: 'USD/JPY' },
                { symbol: 'FX:AUDUSD', name: 'AUD/USD' },
                { symbol: 'FX:USDCAD', name: 'USD/CAD' },
                { symbol: 'FX:USDCHF', name: 'USD/CHF' },
                { symbol: 'FX:NZDUSD', name: 'NZD/USD' },
                { symbol: 'FX:GBPJPY', name: 'GBP/JPY' },
                { symbol: 'FX:EURJPY', name: 'EUR/JPY' },
                { symbol: 'FX:AUDJPY', name: 'AUD/JPY' }
            ]
        };

        const symbols = symbolsByMarket[market] || symbolsByMarket['demo'];
        const allData = [];
        
        console.log(`\n📊 ========== АНАЛИЗ РЫНКА ==========`);
        console.log(`📈 Таймфрейм: ${timeframe}м`);
        console.log(`🎯 Всего пар: ${symbols.length}`);
        console.log(`=====================================\n`);
        
        for (const pair of symbols) {
            try {
                console.log(`🔍 Анализ: ${pair.name}`);
                
                // ✅ ПОЛУЧАЕМ ИСТОРИЧЕСКИЕ СВЕЧИ (0 = старая, length-1 = новая)
                const candles = await this.getCandles(pair.symbol, timeframe, 500);
                
                // ✅ ПОЛУЧАЕМ ТЕКУЩУЮ ЦЕНУ
                const livePrice = await this.getCurrentPrice(pair.symbol);
                
                let currentPrice = null;
                
                if (livePrice && !isNaN(livePrice) && livePrice > 0) {
                    currentPrice = livePrice;
                    console.log(`   💰 Live цена: ${currentPrice.toFixed(5)}`);
                } 
                else if (candles && candles.length > 0) {
                    // ✅ Берем цену с ПОСЛЕДНЕЙ свечи
                    currentPrice = candles[candles.length - 1].close;
                    console.log(`   📊 Цена свечи: ${currentPrice.toFixed(5)}`);
                }
                
                if (!currentPrice) {
                    console.log(`   ⚠️ Нет цены для ${pair.name}`);
                    continue;
                }
                
                if (candles && candles.length > 50) {
                    console.log(`   ✅ Свечей: ${candles.length} (${new Date(candles[0].time*1000).toLocaleTimeString()} - ${new Date(candles[candles.length-1].time*1000).toLocaleTimeString()})`);
                    
                    const indicators = this.calculateIndicatorsForML(candles, currentPrice);
                    
                    // ✅ Предыдущая цена = предпоследняя свеча
                    const prevPrice = candles[candles.length - 2]?.close || currentPrice;
                    const priceChange = prevPrice > 0 ? ((currentPrice - prevPrice) / prevPrice * 100) : 0;
                    
                    allData.push({
                        symbol: pair.symbol,
                        name: pair.name,
                        current_price: currentPrice,
                        price_change: priceChange.toFixed(3) + '%',
                        change_direction: priceChange >= 0 ? 'up' : 'down',
                        candles: candles, // ✅ ПРАВИЛЬНЫЙ ПОРЯДОК!
                        indicators: indicators,
                        timestamp: new Date().toISOString(),
                        timeframe: timeframe + 'm',
                        volume: candles[candles.length - 1]?.volume || 0,
                        analysis_time: new Date().toLocaleTimeString(),
                        candles_count: candles.length,
                        has_enough_data: candles.length >= 200,
                        price_source: livePrice ? 'live' : 'candle'
                    });
                    
                    console.log(`   ✅ ${pair.name} | Цена: ${currentPrice.toFixed(5)} | RSI: ${indicators?.rsi?.toFixed(1) || 50}`);
                    console.log(`   ----------------------------------------`);
                    
                    await this.delay(250);
                } else {
                    console.log(`   ⚠️ ${pair.name}: недостаточно свечей (${candles?.length || 0}/50)`);
                }
            } catch (error) {
                console.log(`   ❌ Ошибка ${pair.symbol}: ${error.message}`);
                continue;
            }
        }

        if (allData.length === 0) {
            throw new Error('Не удалось получить данные');
        }
        
        console.log(`\n====================================`);
        console.log(`🎯 Анализ завершен: ${allData.length} пар`);
        console.log(`📈 Проанализированы: ${allData.map(d => d.name).join(', ')}`);
        console.log(`====================================\n`);
        
        return allData;
    }

    // ✅ ИСПРАВЛЕНО: Индикаторы с правильным порядком
    calculateIndicatorsForML(candles, currentPrice = null) {
        if (!candles || candles.length < 30) {
            return this.getDefaultIndicators(currentPrice);
        }

        try {
            // ✅ prices[0] = старая, prices[length-1] = новая
            const prices = candles.map(c => c.close);
            const highs = candles.map(c => c.high);
            const lows = candles.map(c => c.low);
            
            // ✅ Последняя свеча
            const lastIndex = candles.length - 1;
            const price = currentPrice || candles[lastIndex]?.close || 0;
            const prevPrice = candles[lastIndex - 1]?.close || price;
            
            // ✅ Индикаторы на всем массиве
            const rsi = this.calculateRSI(prices, 14);
            const macd = this.calculateMACD(prices);
            const bb = this.calculateBollingerBands(prices, 20);
            const atr = this.calculateATR(highs, lows, prices, 14);
            
            const sma20 = this.calculateSMA(prices, 20);
            const sma50 = this.calculateSMA(prices, 50);
            const volume = candles[lastIndex]?.volume || 0;
            const avgVolume = this.calculateAverageVolume(candles);
            
            const trend = this.determineTrend(prices, 20);
            const volatility = this.calculateVolatility(prices, 20);
            
            // ✅ Последние 20 свечей для поддержки/сопротивления
            const last20Prices = prices.slice(-20);
            
            return {
                current_price: price,
                prev_price: prevPrice,
                price_change: prevPrice > 0 ? ((price - prevPrice) / prevPrice * 100) : 0,
                
                rsi: Math.round(rsi * 100) / 100,
                rsi_signal: this.getRSISignal(rsi),
                
                macd_line: macd.macdLine,
                macd_signal: macd.signalLine,
                macd_histogram: macd.histogram,
                macd_signal_direction: macd.signal,
                
                bb_upper: bb.upper,
                bb_middle: bb.middle,
                bb_lower: bb.lower,
                bb_position: this.getBBPosition(price, bb),
                bb_width: bb.middle > 0 ? ((bb.upper - bb.lower) / bb.middle) * 100 : 0,
                
                sma20: sma20,
                sma50: sma50,
                price_above_sma20: price > sma20 ? 1 : 0,
                price_above_sma50: price > sma50 ? 1 : 0,
                sma20_above_sma50: sma20 > sma50 ? 1 : 0,
                
                atr: atr,
                volatility: volatility,
                
                volume: volume,
                avg_volume: avgVolume,
                volume_ratio: avgVolume > 0 ? volume / avgVolume : 1,
                
                trend: trend,
                trend_strength: atr > 0 ? Math.abs(price - sma20) / atr : 0,
                
                support: Math.min(...last20Prices),
                resistance: Math.max(...last20Prices),
                
                candle_pattern: this.identifyCandlePattern(candles[lastIndex]),
                candle_size: price > 0 ? ((candles[lastIndex]?.high - candles[lastIndex]?.low) / price * 100) : 0,
                
                timestamp: Date.now(),
                has_enough_data: candles.length >= 200
            };
            
        } catch (error) {
            console.log('⚠️ Ошибка расчета индикаторов:', error.message);
            return this.getDefaultIndicators(currentPrice);
        }
    }

    getDefaultIndicators(currentPrice = null) {
        return {
            current_price: currentPrice || 0,
            rsi: 50,
            rsi_signal: 'neutral',
            macd_line: 0,
            macd_signal: 0,
            macd_histogram: 0,
            macd_signal_direction: 'neutral',
            bb_upper: 0,
            bb_middle: 0,
            bb_lower: 0,
            bb_position: 'middle',
            bb_width: 0,
            sma20: 0,
            sma50: 0,
            price_above_sma20: 0,
            price_above_sma50: 0,
            sma20_above_sma50: 0,
            atr: 0,
            volatility: 0,
            volume: 0,
            avg_volume: 0,
            volume_ratio: 1,
            trend: 'neutral',
            trend_strength: 0,
            support: 0,
            resistance: 0,
            candle_pattern: 'unknown',
            candle_size: 0,
            has_enough_data: false
        };
    }

    // ✅ Методы индикаторов (без изменений)
    calculateSMA(prices, period) {
        if (prices.length < period) return prices[prices.length - 1] || 0;
        const slice = prices.slice(-period);
        return slice.reduce((a, b) => a + b, 0) / period;
    }

    calculateRSI(prices, period = 14) {
        if (prices.length < period + 1) return 50;
        
        let gains = 0, losses = 0;
        for (let i = prices.length - period; i < prices.length; i++) {
            const change = prices[i] - prices[i-1];
            if (change > 0) gains += change;
            else losses -= change;
        }
        
        const avgGain = gains / period;
        const avgLoss = losses / period || 0.0001;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    calculateMACD(prices) {
        if (prices.length < 26) {
            return { macdLine: 0, signalLine: 0, histogram: 0, signal: 'neutral' };
        }
        
        const ema12 = this.calculateEMA(prices, 12);
        const ema26 = this.calculateEMA(prices, 26);
        const macdLine = ema12 - ema26;
        const signalLine = this.calculateEMA(prices.slice(-9), 9);
        const histogram = macdLine - signalLine;
        
        let signal = 'neutral';
        if (histogram > 0 && macdLine > signalLine) signal = 'bullish';
        else if (histogram < 0 && macdLine < signalLine) signal = 'bearish';
        
        return { macdLine, signalLine, histogram, signal };
    }

    calculateEMA(prices, period) {
        if (prices.length < period) return prices[prices.length - 1] || 0;
        const multiplier = 2 / (period + 1);
        let ema = prices.slice(-period).reduce((a, b) => a + b, 0) / period;
        return ema;
    }

    calculateBollingerBands(prices, period = 20) {
        if (prices.length < period) {
            return { upper: 0, middle: 0, lower: 0 };
        }
        
        const slice = prices.slice(-period);
        const mean = slice.reduce((a, b) => a + b, 0) / period;
        const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
        const std = Math.sqrt(variance);
        
        return {
            upper: mean + (std * 2),
            middle: mean,
            lower: mean - (std * 2)
        };
    }

    calculateATR(highs, lows, closes, period = 14) {
        if (highs.length < period + 1) return 0;
        
        const trValues = [];
        for (let i = highs.length - period; i < highs.length; i++) {
            const highLow = highs[i] - lows[i];
            const highPrevClose = Math.abs(highs[i] - closes[i-1]);
            const lowPrevClose = Math.abs(lows[i] - closes[i-1]);
            const trueRange = Math.max(highLow, highPrevClose, lowPrevClose);
            trValues.push(trueRange);
        }
        
        return trValues.reduce((a, b) => a + b, 0) / period;
    }

    calculateAverageVolume(candles) {
        if (!candles || candles.length < 10) return 0;
        const volumes = candles.slice(-10).map(c => c.volume || 0);
        return volumes.reduce((a, b) => a + b, 0) / volumes.length;
    }

    calculateVolatility(prices, period = 20) {
        if (prices.length < period) return 0;
        const slice = prices.slice(-period);
        const returns = [];
        for (let i = 1; i < slice.length; i++) {
            returns.push((slice[i] - slice[i-1]) / slice[i-1]);
        }
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
        return Math.sqrt(variance) * Math.sqrt(365);
    }

    determineTrend(prices, period = 20) {
        if (prices.length < period) return 'neutral';
        const sma = this.calculateSMA(prices, period);
        const currentPrice = prices[prices.length - 1];
        const priceChange = ((currentPrice - sma) / sma) * 100;
        
        if (priceChange > 1) return 'bullish';
        if (priceChange < -1) return 'bearish';
        return 'neutral';
    }

    getRSISignal(rsi) {
        if (rsi > 70) return 'overbought';
        if (rsi < 30) return 'oversold';
        if (rsi > 55) return 'bullish';
        if (rsi < 45) return 'bearish';
        return 'neutral';
    }

    getBBPosition(price, bb) {
        if (price > bb.upper) return 'above_upper';
        if (price < bb.lower) return 'below_lower';
        if (price > bb.middle) return 'above_middle';
        return 'below_middle';
    }

    identifyCandlePattern(candle) {
        if (!candle) return 'unknown';
        const body = Math.abs(candle.close - candle.open);
        const wick = candle.high - Math.max(candle.open, candle.close);
        const tail = Math.min(candle.open, candle.close) - candle.low;
        const range = candle.high - candle.low;
        
        if (range === 0) return 'doji';
        if (body < range * 0.1) return 'doji';
        if (candle.close > candle.open && wick > body * 2) return 'hammer';
        if (candle.close < candle.open && tail > body * 2) return 'shooting_star';
        if (candle.close > candle.open && body > range * 0.7) return 'strong_bull';
        if (candle.close < candle.open && body > range * 0.7) return 'strong_bear';
        return 'normal';
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async shutdown() {
        if (this.client) {
            try {
                this.client.end();
                this.isConnected = false;
                console.log('🔌 TradingView соединение закрыто');
            } catch (error) {
                console.log('⚠️ Ошибка закрытия:', error.message);
            }
        }
    }
}

module.exports = ForexSignalCollector;