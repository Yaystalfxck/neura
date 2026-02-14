const TradingView = require('@mathieuc/tradingview');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

// Конфигурация
const CONFIG = {
    PAIRS: {
        OTC: ['FX_IDC:EURUSD', 'FX_IDC:GBPUSD', 'FX_IDC:USDJPY'],
        REGULAR: ['FX:EURUSD', 'FX:GBPUSD', 'FX:USDJPY']
    },
    
    TIMEFRAMES: ['5', '15', '60'], // 5мин, 15мин, 1час
    HISTORY_BARS: 100, // Для истории
    SIGNAL_BARS: 20,   // Для запросов
    
    // Пути
    DATA_DIR: path.join(__dirname, '../ai-forex-data'),
    HISTORY_DIR: path.join(__dirname, '../ai-forex-data/history'),
    REQUESTS_DIR: path.join(__dirname, '../ai-forex-data/requests'),
    
    // Обновление
    UPDATE_INTERVAL: 1800000, // 30 минут
    MAX_RETRIES: 3
};

class SimpleForexCollector extends EventEmitter {
    constructor() {
        super();
        this.client = null;
        this.updateTimer = null;
        this.isRunning = false;
        
        // Статистика
        this.stats = {
            history_updates: 0,
            ai_requests: 0,
            last_update: null
        };
        
        this.initDirectories();
    }
    
    // ==================== ИНИЦИАЛИЗАЦИЯ ====================
    
    async init() {
        console.log('🤖 ИНИЦИАЛИЗАЦИЯ COLLECTOR ДЛЯ AI');
        console.log('='.repeat(60));
        
        try {
            // Создаем клиент
            this.client = new TradingView.Client();
            await this.waitForConnection();
            console.log('✅ Подключение к TradingView установлено');
            
            // СБОР ИСТОРИИ ПРИ ЗАПУСКЕ
            await this.collectHistoryNow();
            
            // ЗАПУСК АВТООБНОВЛЕНИЯ
            this.startAutoUpdate();
            
            this.isRunning = true;
            this.stats.last_update = new Date().toISOString();
            
            this.printStatus();
            
        } catch (error) {
            console.error('❌ Ошибка инициализации:', error.message);
            throw error;
        }
    }
    
    // ==================== 1. СОБРАТЬ ИСТОРИЮ ====================
    
    async collectHistoryNow() {
        console.log('\n📜 СБОР ИСТОРИЧЕСКИХ ДАННЫХ');
        console.log('='.repeat(60));
        
        const allPairs = [
            ...CONFIG.PAIRS.OTC,
            ...CONFIG.PAIRS.REGULAR
        ];
        
        console.log(`📊 Пар: ${allPairs.length}`);
        console.log(`⏱️  Таймфреймы: ${CONFIG.TIMEFRAMES.join(', ')}`);
        console.log(`📈 Свечей на пару: ${CONFIG.HISTORY_BARS}`);
        console.log('='.repeat(60));
        
        let collected = 0;
        let errors = 0;
        
        for (const [index, symbol] of allPairs.entries()) {
            console.log(`\n[${index + 1}/${allPairs.length}] ${symbol}`);
            
            for (const timeframe of CONFIG.TIMEFRAMES) {
                try {
                    console.log(`  📊 TF ${timeframe} мин...`);
                    
                    // Получаем данные
                    const candles = await this.getCandles(symbol, timeframe, CONFIG.HISTORY_BARS);
                    
                    if (candles && candles.length > 0) {
                        // Сохраняем в файл
                        await this.saveHistory(symbol, timeframe, candles);
                        
                        console.log(`    ✅ ${candles.length} свечей сохранено`);
                        console.log(`    💰 Цена: ${candles[0]?.close}`);
                        console.log(`    📅 От: ${candles[candles.length-1]?.timestamp}`);
                        console.log(`    📅 До: ${candles[0]?.timestamp}`);
                        
                        collected++;
                    }
                    
                } catch (error) {
                    console.log(`    ❌ Ошибка: ${error.message}`);
                    errors++;
                }
                
                // Пауза между запросами
                await this.delay(800);
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 ИТОГИ СБОРА ИСТОРИИ');
        console.log('='.repeat(60));
        console.log(`✅ Успешно: ${collected}`);
        console.log(`❌ Ошибок: ${errors}`);
        console.log(`📁 Путь: ${CONFIG.HISTORY_DIR}`);
        console.log('='.repeat(60));
        
        this.stats.history_updates++;
        this.stats.last_update = new Date().toISOString();
    }
    
    // ==================== 2. АВТООБНОВЛЕНИЕ ИСТОРИИ ====================
    
    startAutoUpdate() {
        console.log(`\n🔄 АВТООБНОВЛЕНИЕ КАЖДЫЕ ${CONFIG.UPDATE_INTERVAL/60000} МИНУТ`);
        
        this.updateTimer = setInterval(async () => {
            console.log('\n⏰ АВТООБНОВЛЕНИЕ ИСТОРИИ...');
            await this.collectHistoryNow();
        }, CONFIG.UPDATE_INTERVAL);
    }
    
    // ==================== 3. ЗАПРОС ДЛЯ AI ====================
    
    async getDataForAI(request) {
        console.log('\n🤖 ЗАПРОС ДАННЫХ ДЛЯ AI');
        console.log('='.repeat(60));
        console.log('Запрос:', JSON.stringify(request, null, 2));
        
        this.stats.ai_requests++;
        
        try {
            const {
                symbol = 'FX:EURUSD',
                timeframe = '15',
                pair_type = 'auto', // auto, otc, regular
                candles_count = 20,
                include_indicators = true,
                include_history = true
            } = request;
            
            console.log(`📡 Получение данных: ${symbol} (${timeframe}м)`);
            
            // 1. ПОЛУЧАЕМ ТЕКУЩИЕ ДАННЫЕ
            console.log('📈 Получение текущих данных...');
            const currentCandles = await this.getCandles(symbol, timeframe, candles_count);
            
            if (!currentCandles || currentCandles.length < 5) {
                throw new Error(`Недостаточно данных: ${currentCandles?.length || 0} свечей`);
            }
            
            // 2. ПОЛУЧАЕМ ИСТОРИЧЕСКИЕ ДАННЫЕ (если нужно)
            let historicalCandles = null;
            if (include_history) {
                try {
                    historicalCandles = await this.loadHistory(symbol, timeframe);
                    console.log(`📚 Загружено истории: ${historicalCandles?.length || 0} свечей`);
                } catch (error) {
                    console.log(`⚠️  История не загружена: ${error.message}`);
                }
            }
            
            // 3. РАССЧИТЫВАЕМ ИНДИКАТОРЫ (если нужно)
            let indicators = {};
            if (include_indicators) {
                indicators = this.calculateIndicators(currentCandles);
                console.log(`📊 Рассчитано индикаторов: ${Object.keys(indicators).length}`);
            }
            
            // 4. ФОРМИРУЕМ ОТВЕТ В ФОРМАТЕ ДЛЯ AI
            const aiData = this.formatForAI({
                request: request,
                symbol: symbol,
                timeframe: timeframe,
                current_candles: currentCandles,
                historical_candles: historicalCandles,
                indicators: indicators,
                metadata: this.getMetadata()
            });
            
            // 5. СОХРАНЯЕМ ЗАПРОС
            await this.saveAIRequest(request, aiData);
            
            console.log('✅ Данные подготовлены для AI');
            console.log(`📊 Текущая цена: ${currentCandles[0]?.close}`);
            console.log(`🕯️  Свечей: ${currentCandles.length}`);
            console.log(`📁 Сохранено в: ${CONFIG.REQUESTS_DIR}`);
            
            return {
                success: true,
                data: aiData,
                file_saved: true,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`❌ Ошибка: ${error.message}`);
            
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    // ==================== ФОРМАТ ДЛЯ AI ====================
    
    formatForAI(data) {
        const {
            request,
            symbol,
            timeframe,
            current_candles,
            historical_candles,
            indicators,
            metadata
        } = data;
        
        // Определяем тип пары
        const pair_type = symbol.includes('FX_IDC:') ? 'otc' : 'regular';
        
        // Форматируем свечи
        const formatted_candles = current_candles.map(candle => ({
            timestamp: candle.timestamp,
            time_unix: candle.time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume || 0,
            time_human: new Date(candle.time * 1000).toLocaleString('ru-RU')
        }));
        
        // Основные данные для AI
        const aiFormat = {
            // Метаданные
            metadata: {
                request_id: Date.now(),
                processed_at: new Date().toISOString(),
                symbol: symbol,
                pair_type: pair_type,
                timeframe: `${timeframe} minutes`,
                candles_count: current_candles.length,
                data_source: 'TradingView',
                data_freshness: 'realtime'
            },
            
            // Параметры запроса
            request_params: request,
            
            // Текущие данные
            current_data: {
                latest_price: current_candles[0]?.close,
                price_24h_ago: current_candles[current_candles.length - 1]?.close,
                price_change: this.calculatePriceChange(current_candles),
                volume_info: this.getVolumeInfo(current_candles),
                latest_candle: formatted_candles[0],
                last_5_candles: formatted_candles.slice(0, 5)
            },
            
            // Все свечи для анализа
            candles: formatted_candles,
            
            // Индикаторы (если есть)
            technical_indicators: indicators,
            
            // Контекстная информация
            context: {
                market_hours: this.getMarketHours(),
                volatility_level: this.getVolatilityLevel(current_candles),
                trend_direction: this.getTrendDirection(current_candles),
                support_resistance: this.getSupportResistance(current_candles)
            },
            
            // Исторические данные (если есть)
            historical_context: historical_candles ? {
                has_history: true,
                total_historical_candles: historical_candles.length,
                historical_range: {
                    from: historical_candles[historical_candles.length - 1]?.timestamp,
                    to: historical_candles[0]?.timestamp
                },
                // Пример исторических свечей
                sample_candles: historical_candles.slice(0, 5).map(c => ({
                    timestamp: c.timestamp,
                    close: c.close
                }))
            } : {
                has_history: false
            },
            
            // Инструкция для AI
            ai_instructions: {
                analysis_type: 'forex_technical_analysis',
                expected_output: 'market_analysis',
                data_usage: 'Use this forex data to provide market analysis, predictions, or trading insights',
                timestamp_context: 'All times are in UTC'
            }
        };
        
        return aiFormat;
    }
    
    // ==================== ОСНОВНЫЕ МЕТОДЫ РАБОТЫ С ДАННЫМИ ====================
    
    async getCandles(symbol, timeframe, bars) {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                reject(new Error('Клиент не инициализирован'));
                return;
            }
            
            const chart = new this.client.Session.Chart();
            let dataReceived = false;
            
            const timeout = setTimeout(() => {
                if (!dataReceived) {
                    chart.delete();
                    reject(new Error(`Таймаут получения данных для ${symbol}`));
                }
            }, 15000);
            
            chart.onError((error) => {
                if (!dataReceived) {
                    clearTimeout(timeout);
                    dataReceived = true;
                    chart.delete();
                    reject(new Error(`TradingView: ${error.message || 'Unknown error'}`));
                }
            });
            
            chart.onUpdate(() => {
                const candles = chart.periods;
                if (candles && candles.length > 0 && !dataReceived) {
                    clearTimeout(timeout);
                    dataReceived = true;
                    
                    const formattedCandles = candles.map(candle => ({
                        time: candle.time,
                        timestamp: new Date(candle.time * 1000).toISOString(),
                        open: candle.open,
                        high: candle.high,
                        low: candle.low,
                        close: candle.close,
                        volume: candle.volume || 0
                    })).reverse(); // Старые свечи первыми
                    
                    chart.delete();
                    resolve(formattedCandles);
                }
            });
            
            chart.setMarket(symbol, {
                timeframe: timeframe,
                range: bars
            });
        });
    }
    
    // ==================== РАСЧЕТ ИНДИКАТОРОВ ====================
    
    calculateIndicators(candles) {
        if (candles.length < 10) return { note: 'Недостаточно данных для расчета индикаторов' };
        
        return {
            // Простые индикаторы
            simple: {
                current_price: candles[0]?.close,
                price_24h_change: this.calculatePriceChange(candles),
                high_24h: Math.max(...candles.map(c => c.high)),
                low_24h: Math.min(...candles.map(c => c.low)),
                avg_price: this.calculateAverage(candles.map(c => c.close))
            },
            
            // Тренд
            trend: {
                direction: this.getSimpleTrend(candles),
                strength: this.calculateTrendStrength(candles),
                sma_10: this.calculateSMA(candles.slice(0, 10)),
                sma_20: this.calculateSMA(candles.slice(0, 20))
            },
            
            // Волатильность
            volatility: {
                atr: this.calculateSimpleATR(candles.slice(0, 14)),
                daily_range: (Math.max(...candles.map(c => c.high)) - Math.min(...candles.map(c => c.low))).toFixed(5),
                is_high_volatility: this.isHighVolatility(candles)
            },
            
            // Объем
            volume: {
                current: candles[0]?.volume || 0,
                average: this.calculateAverage(candles.slice(0, 20).map(c => c.volume || 0)),
                trend: this.getVolumeTrend(candles.slice(0, 5))
            }
        };
    }
    
    // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================
    
    calculateSMA(candles) {
        const sum = candles.reduce((acc, c) => acc + c.close, 0);
        return (sum / candles.length).toFixed(5);
    }
    
    calculateSimpleATR(candles) {
        if (candles.length < 5) return 0;
        
        let trSum = 0;
        for (let i = 1; i < Math.min(candles.length, 5); i++) {
            const range = candles[i].high - candles[i].low;
            trSum += range;
        }
        
        return (trSum / 5).toFixed(5);
    }
    
    getSimpleTrend(candles) {
        if (candles.length < 5) return 'neutral';
        
        const first = candles[candles.length - 1].close;
        const last = candles[0].close;
        
        if (last > first * 1.005) return 'bullish';
        if (last < first * 0.995) return 'bearish';
        return 'neutral';
    }
    
    calculateTrendStrength(candles) {
        if (candles.length < 10) return 0;
        
        let upCount = 0;
        for (let i = 1; i < Math.min(candles.length, 10); i++) {
            if (candles[i].close > candles[i-1].close) upCount++;
        }
        
        return ((upCount / 10) * 100).toFixed(0) + '%';
    }
    
    isHighVolatility(candles) {
        if (candles.length < 5) return false;
        
        const ranges = [];
        for (let i = 0; i < Math.min(candles.length, 5); i++) {
            ranges.push(candles[i].high - candles[i].low);
        }
        
        const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;
        const currentRange = candles[0].high - candles[0].low;
        
        return currentRange > avgRange * 1.5;
    }
    
    getVolumeTrend(candles) {
        if (candles.length < 3) return 'stable';
        
        const volumes = candles.map(c => c.volume || 0);
        const current = volumes[0];
        const avg = volumes.slice(1).reduce((a, b) => a + b, 0) / (volumes.length - 1);
        
        if (current > avg * 1.3) return 'increasing';
        if (current < avg * 0.7) return 'decreasing';
        return 'stable';
    }
    
    calculatePriceChange(candles) {
        if (candles.length < 2) return { percent: '0%', value: '0' };
        
        const first = candles[candles.length - 1].close;
        const last = candles[0].close;
        const change = last - first;
        const percent = (change / first) * 100;
        
        return {
            percent: percent.toFixed(2) + '%',
            value: change.toFixed(5),
            direction: change > 0 ? 'up' : change < 0 ? 'down' : 'unchanged'
        };
    }
    
    getVolumeInfo(candles) {
        if (candles.length < 5) return { current: 0, avg: 0 };
        
        const volumes = candles.map(c => c.volume || 0);
        const current = volumes[0];
        const avg = volumes.slice(1).reduce((a, b) => a + b, 0) / (volumes.length - 1);
        
        return {
            current: current,
            average_5_periods: avg.toFixed(0),
            relative: (current / avg).toFixed(2)
        };
    }
    
    getMarketHours() {
        const now = new Date();
        const hour = now.getUTCHours();
        
        if (hour >= 0 && hour < 5) return 'asian_session';
        if (hour >= 5 && hour < 14) return 'european_session';
        if (hour >= 14 && hour < 21) return 'american_session';
        return 'after_hours';
    }
    
    getVolatilityLevel(candles) {
        if (candles.length < 5) return 'low';
        
        const ranges = candles.slice(0, 5).map(c => c.high - c.low);
        const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;
        
        if (avgRange > 0.005) return 'high';
        if (avgRange > 0.002) return 'medium';
        return 'low';
    }
    
    getTrendDirection(candles) {
        const trend = this.getSimpleTrend(candles);
        return trend;
    }
    
    getSupportResistance(candles) {
        if (candles.length < 10) return { support: 0, resistance: 0 };
        
        const prices = candles.map(c => c.close);
        const recent = prices.slice(0, 10);
        
        return {
            support: Math.min(...recent).toFixed(5),
            resistance: Math.max(...recent).toFixed(5),
            current_position: ((candles[0].close - Math.min(...recent)) / (Math.max(...recent) - Math.min(...recent)) * 100).toFixed(1) + '%'
        };
    }
    
    calculateAverage(numbers) {
        if (!numbers || numbers.length === 0) return 0;
        const sum = numbers.reduce((a, b) => a + b, 0);
        return sum / numbers.length;
    }
    
    getMetadata() {
        return {
            collector_version: '1.0',
            last_update: this.stats.last_update,
            total_updates: this.stats.history_updates,
            total_requests: this.stats.ai_requests
        };
    }
    
    // ==================== СОХРАНЕНИЕ ДАННЫХ ====================
    
    async saveHistory(symbol, timeframe, candles) {
        try {
            // Безопасное имя для папки
            const safeSymbol = symbol.replace(/[:]/g, '_');
            
            // Создаем директории
            const dir = path.join(
                CONFIG.HISTORY_DIR,
                safeSymbol,
                timeframe.toString()
            );
            
            await fs.mkdir(dir, { recursive: true });
            
            // Имя файла с датой
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
            const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
            
            const filename = `${dateStr}_${timeStr}.json`;
            const filepath = path.join(dir, filename);
            
            // Данные для сохранения
            const saveData = {
                metadata: {
                    symbol: symbol,
                    timeframe: timeframe,
                    collected_at: new Date().toISOString(),
                    candles_count: candles.length,
                    date: dateStr,
                    time: timeStr
                },
                candles: candles
            };
            
            // Сохраняем
            await fs.writeFile(filepath, JSON.stringify(saveData, null, 2));
            
            return filepath;
            
        } catch (error) {
            console.log(`Ошибка сохранения истории: ${error.message}`);
            throw error;
        }
    }
    
    async loadHistory(symbol, timeframe) {
        try {
            const safeSymbol = symbol.replace(/[:]/g, '_');
            const dir = path.join(
                CONFIG.HISTORY_DIR,
                safeSymbol,
                timeframe.toString()
            );
            
            // Получаем все файлы в директории
            const files = await fs.readdir(dir);
            
            if (files.length === 0) {
                return null;
            }
            
            // Берем последний файл
            const latestFile = files.sort().reverse()[0];
            const filepath = path.join(dir, latestFile);
            
            const data = await fs.readFile(filepath, 'utf8');
            const parsed = JSON.parse(data);
            
            return parsed.candles;
            
        } catch (error) {
            return null;
        }
    }
    
    async saveAIRequest(request, aiData) {
        try {
            // Создаем директорию если нет
            await fs.mkdir(CONFIG.REQUESTS_DIR, { recursive: true });
            
            // Имя файла
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `ai_request_${timestamp}.json`;
            const filepath = path.join(CONFIG.REQUESTS_DIR, filename);
            
            // Сохраняем
            await fs.writeFile(
                filepath,
                JSON.stringify({
                    request: request,
                    ai_data: aiData,
                    saved_at: new Date().toISOString()
                }, null, 2)
            );
            
            console.log(`💾 Запрос сохранен: ${filepath}`);
            
        } catch (error) {
            console.log(`Ошибка сохранения запроса: ${error.message}`);
        }
    }
    
    // ==================== СЛУЖЕБНЫЕ МЕТОДЫ ====================
    
    async initDirectories() {
        const dirs = [
            CONFIG.DATA_DIR,
            CONFIG.HISTORY_DIR,
            CONFIG.REQUESTS_DIR
        ];
        
        for (const dir of dirs) {
            try {
                await fs.mkdir(dir, { recursive: true });
                console.log(`📁 Создана директория: ${dir}`);
            } catch (error) {
                // Уже существует
            }
        }
    }
    
    async waitForConnection() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Таймаут подключения к TradingView'));
            }, 10000);
            
            if (this.client.onReady) {
                this.client.onReady(() => {
                    clearTimeout(timeout);
                    resolve();
                });
            } else {
                setTimeout(() => {
                    clearTimeout(timeout);
                    resolve();
                }, 3000);
            }
            
            this.client.onError(reject);
        });
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    printStatus() {
        console.log('\n' + '='.repeat(60));
        console.log('🤖 СТАТУС COLLECTOR');
        console.log('='.repeat(60));
        console.log(`✅ Состояние: ${this.isRunning ? 'РАБОТАЕТ' : 'ОСТАНОВЛЕН'}`);
        console.log(`📊 Обновлений истории: ${this.stats.history_updates}`);
        console.log(`🤖 Запросов для AI: ${this.stats.ai_requests}`);
        console.log(`🕐 Последнее обновление: ${this.stats.last_update}`);
        console.log(`📁 Данные в: ${CONFIG.DATA_DIR}`);
        console.log('='.repeat(60));
    }
    
    async shutdown() {
        console.log('\n🛑 ОСТАНОВКА COLLECTOR...');
        
        this.isRunning = false;
        
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        
        if (this.client) {
            this.client.end();
        }
        
        console.log('✅ Collector остановлен');
    }
}

// ==================== ЗАПУСК ====================

async function main() {
    console.clear();
    console.log('🤖 FOREX DATA COLLECTOR FOR AI');
    console.log('='.repeat(60));
    console.log('Назначение: Сбор данных для отправки в ChatGPT/другие ИИ');
    console.log('='.repeat(60));
    
    const collector = new SimpleForexCollector();
    
    try {
        // Запускаем коллектор
        await collector.init();
        
        // Пример запроса данных для AI
        console.log('\n' + '='.repeat(60));
        console.log('📝 ПРИМЕР ЗАПРОСА ДАННЫХ ДЛЯ AI');
        console.log('='.repeat(60));
        
        const exampleRequest = {
            symbol: 'FX:EURUSD',
            timeframe: '15',
            candles_count: 20,
            include_indicators: true,
            include_history: true
        };
        
        console.log('Пример команды для получения данных:');
        console.log(`
        const data = await collector.getDataForAI({
            symbol: 'FX:EURUSD',
            timeframe: '15',
            candles_count: 20,
            include_indicators: true,
            include_history: true
        });
        `);
        
        // Ожидаем команды остановки
        await new Promise((resolve) => {
            process.on('SIGINT', async () => {
                console.log('\n👋 Остановка по команде пользователя...');
                await collector.shutdown();
                resolve();
            });
            
            console.log('\n📌 Collector работает в фоне...');
            console.log('📌 Нажмите Ctrl+C для остановки');
            console.log('📌 Данные сохраняются автоматически');
        });
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    }
}

// Запуск с параметрами
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--history')) {
        // Только сбор истории
        const collector = new SimpleForexCollector();
        collector.init()
            .then(() => collector.collectHistoryNow())
            .then(() => collector.shutdown())
            .catch(console.error);
            
    } else if (args.includes('--test-ai')) {
        // Тестовый запрос для AI
        const collector = new SimpleForexCollector();
        collector.init()
            .then(() => {
                return collector.getDataForAI({
                    symbol: 'FX:EURUSD',
                    timeframe: '15',
                    candles_count: 20,
                    include_indicators: true
                });
            })
            .then(result => {
                console.log('\n📄 РЕЗУЛЬТАТ ДЛЯ AI:');
                console.log(JSON.stringify(result, null, 2));
                return collector.shutdown();
            })
            .catch(console.error);
            
    } else {
        // Полный запуск
        main();
    }
}

module.exports = SimpleForexCollector;