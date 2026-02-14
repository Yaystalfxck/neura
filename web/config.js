// config.js
module.exports = {
    // ВАЛЮТНЫЕ ПАРЫ (2 версии каждой - OTC и Regular)
    PAIRS: {
        // OTC версии (внебиржевые) - FX_IDC:
        OTC: [
            'FX_IDC:EURUSD',      // Euro/US Dollar OTC
            'FX_IDC:GBPUSD',      // British Pound/US Dollar OTC
            'FX_IDC:USDJPY',      // US Dollar/Japanese Yen OTC
            'FX_IDC:USDCHF',      // US Dollar/Swiss Franc OTC
            'FX_IDC:AUDUSD',      // Australian Dollar/US Dollar OTC
            'FX_IDC:USDCAD',      // US Dollar/Canadian Dollar OTC
            'FX_IDC:NZDUSD',      // New Zealand Dollar/US Dollar OTC
            'FX_IDC:EURGBP',      // Euro/British Pound OTC
            'FX_IDC:EURJPY',      // Euro/Japanese Yen OTC
            'FX_IDC:GBPJPY',      // British Pound/Japanese Yen OTC
        ],
        
        // Обычные версии (биржевые/стандартные) - FX:
        REGULAR: [
            'FX:EURUSD',          // Euro/US Dollar Regular
            'FX:GBPUSD',          // British Pound/US Dollar Regular
            'FX:USDJPY',          // US Dollar/Japanese Yen Regular
            'FX:USDCHF',          // US Dollar/Swiss Franc Regular
            'FX:AUDUSD',          // Australian Dollar/US Dollar Regular
            'FX:USDCAD',          // US Dollar/Canadian Dollar Regular
            'FX:NZDUSD',          // New Zealand Dollar/US Dollar Regular
            'FX:EURGBP',          // Euro/British Pound Regular
            'FX:EURJPY',          // Euro/Japanese Yen Regular
            'FX:GBPJPY',          // British Pound/Japanese Yen Regular
        ]
    },
    
    // НАСТРОЙКИ СБОРА ДАННЫХ
    SETTINGS: {
        // 4 разных таймфрейма для анализа
        timeframes: ['3', '5', '7', '10'], // 3, 5, 7, 10 минут
        
        // История для каждого таймфрейма
        historyBars: 50,          // 50 свечей истории на каждый таймфрейм
        
        // Задержки для стабильности
        delayBetweenPairs: 2000,  // 2 сек между парами
        delayBetweenTimeframes: 1000, // 1 сек между таймфреймами
        timeoutPerRequest: 15000, // 15 сек на запрос
        maxRetries: 3,            // 3 попытки при ошибке
        
        // Параметры сбора
        batchSize: 4,             // Пачек по 4 пары
        saveIntermediate: true,   // Сохранять промежуточные данные
    },
    
    // НАСТРОЙКИ ДЛЯ AI
    AI_CONFIG: {
        // Мультитаймфреймные фичи
        features: {
            price: ['open', 'high', 'low', 'close'],
            volume: ['volume', 'volume_ma'],
            technical: ['returns', 'volatility', 'spread'],
            time: ['hour', 'day_of_week', 'minute'],
            multi_timeframe: true  // Использовать несколько таймфреймов
        },
        
        // Целевые переменные
        targets: {
            classification: 'direction_3m',   // Направление через 3 минуты
            regression: 'price_change_5m',    // Изменение цены через 5 мин
            volatility: 'volatility_10m'      // Волатильность через 10 мин
        },
        
        // Обработка данных
        preprocessing: {
            normalize: true,
            handleMissing: 'interpolate',
            featureEngineering: true,
            createSequences: true,
            sequenceLength: 50
        },
        
        // Разделение данных
        split: {
            train: 0.65,    // 65% тренировочных
            validation: 0.15, // 15% валидационных
            test: 0.20      // 20% тестовых
        }
    },
    
    // СТРУКТУРА ХРАНЕНИЯ
    PATHS: {
        raw: {
            base: './data/raw',
            by_pair: './data/raw/by_pair',      // Данные по парам
            by_timeframe: './data/raw/by_tf',   // Данные по таймфреймам
            daily: './data/raw/daily'           // Ежедневные дампы
        },
        processed: {
            base: './data/processed',
            sequences: './data/processed/sequences',  // Последовательности
            features: './data/processed/features',    // Фичи
            normalized: './data/processed/normalized' // Нормализованные
        },
        ai_ready: {
            base: './data/ai_ready',
            tensorflow: './data/ai_ready/tf',        // Для TensorFlow
            pytorch: './data/ai_ready/torch',        // Для PyTorch
            csv: './data/ai_ready/csv'               // CSV для других ML
        },
        logs: './logs'
    },
    
    // ЛОГГИРОВАНИЕ
    LOGGING: {
        level: 'info',  // debug, info, warn, error
        file: true,
        console: true,
        rotation: 'daily'  // daily, hourly, 10mb
    }
};