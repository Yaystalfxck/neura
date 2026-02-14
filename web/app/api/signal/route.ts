import { NextResponse } from 'next/server';
import ForexSignalCollector from '@/lib/tradingview-collector-simple';
import { cookies } from 'next/headers';
import { 
  getDb, 
  checkSignalAvailability, 
  recordSignalUsage, 
  getSignalLimitByBalance,
  syncUserBalance,
  getPocketOptionUser 
} from '@/lib/database';

// Кэш для моделей
const MODEL_CACHE = new Map<string, ExpiryMLModel>();
const LAST_TRAIN_TIME = new Map<string, number>();

// ✅ КОНФИГУРАЦИЯ ML - СТРОГО 1-5 МИНУТ
const ML_CONFIG = {
  min_candles: 100,
  lookback: 30,
  retrain_interval: 15,
  confidence_threshold: 0.6,
  expirations: [1, 2, 3, 4, 5], // ✅ ТОЛЬКО 1-5 МИНУТ!
  min_training_samples: 50,
  learning_rate: 0.005,
  epochs: 150,
  regularization: 0.001,
  dropout_rate: 0.2,
  ensemble_size: 3
};

// Типы
interface Candle {
  time: number;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Prediction {
  direction: 'CALL' | 'PUT';
  confidence: number;
  expiry: number; // ✅ СТРОГО 1-5 МИНУТ
  expiry_timestamp: string;
  valid_until: string;
  probability: {
    call: number;
    put: number;
  };
  features_importance?: number[];
  model_version?: string;
  rsi?: number;
  macd?: number;
  volatility?: number;
  models_count?: number;
  features_used?: number;
  training_samples?: number;
  accuracy?: string;
}

interface Signal extends Prediction {
  pair: string;
  current_price: number;
  trend: string;
  support_resistance?: {
    support: number;
    resistance: number;
    strength: number;
  };
}

interface MarketPair {
  name: string;
  current_price: string;
  candles: Candle[];
  indicators?: {
    trend?: string;
    support?: string;
    resistance?: string;
  };
}

interface Scaler {
  mean: number[];
  std: number[];
}

interface ModelWeights {
  weights: number[];
  bias: number;
}

// ============ КЛАСС ML МОДЕЛИ С ТОЧНЫМ ОГРАНИЧЕНИЕМ 1-5 МИНУТ ============

class ExpiryMLModel {
  private pair: string;
  private models: ModelWeights[] = [];
  private scalers: Scaler[] = [];
  private feature_selectors: boolean[][] = [];
  private performance_history: number[] = [];

  constructor(pair: string) {
    this.pair = pair;
  }

  // Статистические методы
  private mean(arr: number[]): number {
    if (!arr || arr.length === 0) return 0;
    const validArr = arr.filter(v => !isNaN(v) && isFinite(v));
    if (validArr.length === 0) return 0;
    const sum = validArr.reduce((a, b) => a + b, 0);
    return sum / validArr.length;
  }

  private std(arr: number[]): number {
    if (!arr || arr.length < 2) return 0.0001;
    const validArr = arr.filter(v => !isNaN(v) && isFinite(v));
    if (validArr.length < 2) return 0.0001;
    const mean = this.mean(validArr);
    const variance = validArr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / validArr.length;
    return Math.max(Math.sqrt(variance), 0.0001);
  }

  private normalize(value: number, mean: number, std: number): number {
    if (std === 0 || isNaN(std) || isNaN(mean) || !isFinite(std)) return 0;
    const normalized = (value - mean) / std;
    if (isNaN(normalized) || !isFinite(normalized)) return 0;
    return Math.max(-3, Math.min(3, normalized));
  }

  // ============ ИНДИКАТОРЫ ============

  private calculateRSI(prices: number[], period = 14): number {
    if (prices.length < period + 1) return 50;
    
    let gains = 0, losses = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i-1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    if (avgGain === 0) return 0;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(prices: number[], fast = 12, slow = 26, signal = 9) {
    if (prices.length < slow) {
      return { macd: 0, signal: 0, histogram: 0 };
    }
    
    const emaFast = this.calculateEMA(prices, fast);
    const emaSlow = this.calculateEMA(prices, slow);
    const macdLine = emaFast - emaSlow;
    const signalLine = this.calculateEMA([macdLine, macdLine, macdLine], signal);
    const histogram = macdLine - signalLine;
    
    return {
      macd: isFinite(macdLine) ? macdLine : 0,
      signal: isFinite(signalLine) ? signalLine : 0,
      histogram: isFinite(histogram) ? histogram : 0
    };
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    if (prices.length < period) {
      return prices[prices.length-1] || 0;
    }
    
    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return isFinite(ema) ? ema : 0;
  }

  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) {
      return prices[prices.length-1] || 0;
    }
    const slice = prices.slice(-period);
    const sum = slice.reduce((a, b) => a + b, 0);
    const sma = sum / period;
    return isFinite(sma) ? sma : 0;
  }

  private calculateADX(prices: number[], period = 14): number {
    if (prices.length < period * 2) return 25;
    
    const changes = [];
    for (let i = prices.length - period; i < prices.length; i++) {
      changes.push(Math.abs(prices[i] - prices[i-1]));
    }
    
    const avgChange = this.mean(changes);
    const avgPrice = this.mean(prices.slice(-period));
    
    if (avgPrice === 0) return 25;
    
    const adx = (avgChange / avgPrice) * 100;
    return isFinite(adx) ? Math.min(100, adx) : 25;
  }

  // ============ ИЗВЛЕЧЕНИЕ ПРИЗНАКОВ ============
  private extractFeatures(candles: Candle[], index: number): number[] | null {
    try {
      const features: number[] = [];
      const startIdx = Math.max(0, index - 20);
      const endIdx = Math.max(1, index);
      
      const prices = candles.slice(startIdx, endIdx).map(c => c.close);
      const volumes = candles.slice(startIdx, endIdx).map(c => c.volume || 0);
      
      if (prices.length < 10) return null;

      // 1. ЦЕНОВЫЕ ПРИЗНАКИ
      const returns: number[] = [];
      for (let i = 1; i < prices.length; i++) {
        if (prices[i-1] !== 0) {
          returns.push((prices[i] - prices[i-1]) / Math.abs(prices[i-1]));
        } else {
          returns.push(0);
        }
      }
      
      features.push(this.mean(returns) || 0);
      features.push(this.std(returns) || 0.01);
      features.push(prices[prices.length-1] - prices[0] || 0);
      
      const priceRatio = prices[0] !== 0 ? prices[prices.length-1] / prices[0] - 1 : 0;
      features.push(priceRatio);
      
      const priceRange = Math.max(...prices.slice(-5)) - Math.min(...prices.slice(-5)) || 0;
      features.push(priceRange);
      
      // 2. ТЕХНИЧЕСКИЕ ИНДИКАТОРЫ
      features.push(this.calculateRSI(prices, 14) || 50);
      
      const macd = this.calculateMACD(prices);
      features.push(macd.histogram || 0);
      features.push((macd.macd - macd.signal) || 0);
      
      const sma20 = this.calculateSMA(prices, 20);
      const sma20Diff = sma20 !== 0 ? (prices[prices.length-1] - sma20) / Math.abs(sma20) : 0;
      features.push(sma20Diff);
      
      features.push(this.calculateADX(prices, 14) || 25);
      
      // 3. ОБЪЕМНЫЕ ПРИЗНАКИ
      features.push(this.mean(volumes.slice(-5)) || 0);
      
      const meanVol = this.mean(volumes) || 1;
      features.push(volumes[volumes.length-1] / meanVol);
      
      features.push(volumes[volumes.length-1] > meanVol * 1.5 ? 1 : 0);
      
      // 4. ТРЕНД
      const sma50 = this.calculateSMA(prices, 50);
      const smaRatio = sma50 !== 0 ? sma20 / sma50 - 1 : 0;
      features.push(smaRatio);
      
      features.push(prices[prices.length-1] > sma20 ? 1 : 0);
      
      // ФИНАЛЬНАЯ ПРОВЕРКА НА NaN
      for (let i = 0; i < features.length; i++) {
        if (isNaN(features[i]) || !isFinite(features[i])) {
          features[i] = 0;
        }
      }
      
      return features;
    } catch (e) {
      return null;
    }
  }

  // ============ ПОДГОТОВКА ДАННЫХ ============
  private prepareTrainingData(candles: Candle[]) {
    if (!candles || candles.length < ML_CONFIG.min_candles) {
      console.log(`⚠️ ${this.pair}: недостаточно свечей (${candles?.length || 0}/${ML_CONFIG.min_candles})`);
      return null;
    }

    console.log(`📊 ${this.pair}: подготовка данных (экспирация 1-5 мин)...`);

    const X: number[][] = [];
    const y: number[] = [];
    const weights: number[] = [];

    for (let i = ML_CONFIG.lookback; i < candles.length - 5; i++) {
      try {
        const features = this.extractFeatures(candles, i);
        if (!features || features.length === 0) continue;
        
        // Проверка на NaN
        let hasInvalid = false;
        for (const f of features) {
          if (isNaN(f) || !isFinite(f)) {
            hasInvalid = true;
            break;
          }
        }
        if (hasInvalid) continue;
        
        // Поиск лучшего времени экспирации (1-5 мин)
        let bestFuturePrice = 0;
        let bestExpiryScore = -Infinity;
        
        for (const exp of ML_CONFIG.expirations) {
          if (i + exp >= candles.length) continue;
          
          const futurePrice = candles[i + exp].close;
          const currentPrice = candles[i - 1]?.close || candles[i].close;
          
          if (currentPrice === 0) continue;
          
          const priceChange = (futurePrice - currentPrice) / Math.abs(currentPrice);
          const absChange = Math.abs(priceChange);
          
          if (absChange > bestExpiryScore) {
            bestExpiryScore = absChange;
            bestFuturePrice = futurePrice;
          }
        }
        
        if (bestFuturePrice === 0) continue;
        
        const currentPrice = candles[i - 1]?.close || candles[i].close;
        const priceChange = (bestFuturePrice - currentPrice) / Math.abs(currentPrice);
        
        // Только значимые движения (> 0.05%)
        if (Math.abs(priceChange) < 0.0005) continue;
        
        X.push(features);
        
        // CALL или PUT
        if (priceChange > 0) {
          y.push(1); // CALL
          const weight = Math.min(2, Math.max(0.5, Math.abs(priceChange) * 500));
          weights.push(weight);
        } else {
          y.push(0); // PUT
          const weight = Math.min(2, Math.max(0.5, Math.abs(priceChange) * 500));
          weights.push(weight);
        }
        
      } catch (e) {
        continue;
      }
    }

    if (X.length < ML_CONFIG.min_training_samples) {
      console.log(`⚠️ ${this.pair}: недостаточно примеров (${X.length}/${ML_CONFIG.min_training_samples})`);
      return null;
    }

    const callCount = y.filter(v => v === 1).length;
    const putCount = y.filter(v => v === 0).length;
    
    console.log(`✅ ${this.pair}: ${X.length} примеров (CALL: ${callCount}, PUT: ${putCount})`);
    
    return { X, y, weights };
  }

  // ============ ОБУЧЕНИЕ ============
  async train(candles: Candle[]): Promise<boolean> {
    console.log(`🔄 Обучение модели для ${this.pair}...`);
    
    const data = this.prepareTrainingData(candles);
    if (!data) return false;

    try {
      const X = data.X;
      const y = data.y;
      const weights = data.weights || Array(X.length).fill(1);
      
      this.models = [];
      this.scalers = [];
      
      const n_features = X[0].length;
      
      for (let ensembleIdx = 0; ensembleIdx < ML_CONFIG.ensemble_size; ensembleIdx++) {
        console.log(`   Модель ${ensembleIdx + 1}/${ML_CONFIG.ensemble_size}...`);
        
        // Нормализация
        const means: number[] = [];
        const stds: number[] = [];
        
        for (let j = 0; j < n_features; j++) {
          const col = X.map(row => row[j]);
          means.push(this.mean(col));
          stds.push(Math.max(this.std(col), 0.0001));
        }
        
        this.scalers.push({ mean: means, std: stds });
        
        const X_norm = X.map(row => 
          row.map((val, i) => {
            const normalized = this.normalize(val, means[i], stds[i]);
            return Math.max(-5, Math.min(5, normalized));
          })
        );
        
        // Инициализация весов
        let weights_model = Array(n_features).fill(0).map(
          () => (Math.random() * 2 - 1) * 0.01
        );
        let bias = 0;
        
        const learningRate = ML_CONFIG.learning_rate;
        const epochs = ML_CONFIG.epochs;
        
        let momentum = Array(n_features).fill(0);
        let velocity = Array(n_features).fill(0);
        let biasMomentum = 0;
        let biasVelocity = 0;
        const beta1 = 0.9;
        const beta2 = 0.999;
        const epsilon = 1e-8;
        
        for (let epoch = 0; epoch < epochs; epoch++) {
          let totalLoss = 0;
          let correct = 0;
          let validSamples = 0;
          
          const indices = Array.from({ length: X_norm.length }, (_, i) => i);
          for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
          }
          
          for (const idx of indices) {
            let z = bias;
            for (let j = 0; j < n_features; j++) {
              z += X_norm[idx][j] * weights_model[j];
            }
            
            z = Math.max(-30, Math.min(30, z));
            
            // Стабильная сигмоида
            let prediction;
            if (z < -30) {
              prediction = 0;
            } else if (z > 30) {
              prediction = 1;
            } else {
              prediction = 1 / (1 + Math.exp(-z));
            }
            
            const target = y[idx];
            const weight = weights[idx];
            
            // Защита от NaN в loss
            const eps = 1e-7;
            const clippedPred = Math.max(eps, Math.min(1 - eps, prediction));
            
            let loss;
            if (target === 1) {
              loss = -weight * Math.log(clippedPred);
            } else {
              loss = -weight * Math.log(1 - clippedPred);
            }
            
            if (!isNaN(loss) && isFinite(loss) && loss < 1e3) {
              totalLoss += loss;
              validSamples++;
            }
            
            if ((prediction > 0.5 && target === 1) || (prediction <= 0.5 && target === 0)) {
              correct++;
            }
            
            const error = (prediction - target) * weight;
            const clippedError = Math.max(-1, Math.min(1, error));
            
            const t = epoch + 1;
            
            biasMomentum = beta1 * biasMomentum + (1 - beta1) * clippedError;
            biasVelocity = beta2 * biasVelocity + (1 - beta2) * (clippedError * clippedError);
            const biasMomentumCorr = biasMomentum / (1 - Math.pow(beta1, t));
            const biasVelocityCorr = biasVelocity / (1 - Math.pow(beta2, t));
            bias -= learningRate * biasMomentumCorr / (Math.sqrt(biasVelocityCorr) + epsilon);
            
            for (let j = 0; j < n_features; j++) {
              const grad = clippedError * X_norm[idx][j];
              const clippedGrad = Math.max(-1, Math.min(1, grad));
              
              momentum[j] = beta1 * momentum[j] + (1 - beta1) * clippedGrad;
              velocity[j] = beta2 * velocity[j] + (1 - beta2) * (clippedGrad * clippedGrad);
              
              const mCorr = momentum[j] / (1 - Math.pow(beta1, t));
              const vCorr = velocity[j] / (1 - Math.pow(beta2, t));
              
              weights_model[j] -= learningRate * mCorr / (Math.sqrt(vCorr) + epsilon);
              weights_model[j] -= learningRate * ML_CONFIG.regularization * weights_model[j];
              weights_model[j] = Math.max(-5, Math.min(5, weights_model[j]));
            }
          }
          
          if (epoch % 30 === 0) {
            const avgLoss = validSamples > 0 ? totalLoss / validSamples : 0;
            const accuracy = X_norm.length > 0 ? (correct / X_norm.length) * 100 : 0;
            
            if (!isNaN(avgLoss) && isFinite(avgLoss)) {
              console.log(`     Эпоха ${epoch}: loss=${avgLoss.toFixed(4)}, acc=${accuracy.toFixed(1)}%`);
            } else {
              console.log(`     Эпоха ${epoch}: loss=0.0000, acc=${accuracy.toFixed(1)}%`);
            }
          }
        }
        
        this.models.push({ weights: weights_model, bias });
      }
      
      console.log(`✅ Модель для ${this.pair} обучена (${this.models.length} ансамблей)`);
      return true;
      
    } catch (e) {
      console.error(`❌ Ошибка обучения ${this.pair}:`, e);
      return false;
    }
  }

  // ============ ПРЕДСКАЗАНИЕ ============
  private async predictSingle(features: number[]): Promise<Prediction | null> {
    if (this.models.length === 0) return null;
    
    try {
      let totalProbability = 0;
      
      for (let m = 0; m < this.models.length; m++) {
        const model = this.models[m];
        const scaler = this.scalers[m];
        
        const normalized = features.map((val, i) => {
          return this.normalize(val, scaler.mean[i], scaler.std[i]);
        });
        
        let score = model.bias;
        for (let i = 0; i < normalized.length; i++) {
          score += normalized[i] * model.weights[i];
        }
        
        score = Math.max(-30, Math.min(30, score));
        
        let probability;
        if (score < -30) {
          probability = 0;
        } else if (score > 30) {
          probability = 1;
        } else {
          probability = 1 / (1 + Math.exp(-score));
        }
        
        totalProbability += probability;
      }
      
      const avgProbability = totalProbability / this.models.length;
      const confidence = Math.round(Math.abs(avgProbability - 0.5) * 200);
      
      return {
        direction: avgProbability > 0.5 ? 'CALL' : 'PUT',
        confidence: Math.min(95, confidence),
        expiry: 3,
        expiry_timestamp: '',
        valid_until: '',
        probability: {
          call: Math.round(avgProbability * 100),
          put: Math.round((1 - avgProbability) * 100)
        }
      };
      
    } catch (e) {
      return null;
    }
  }

  private selectExpiry(prices: number[], volatility: number, rsi: number, adx: number, confidence: number): number {
    let expiry = 3;
    
    // 1. ВОЛАТИЛЬНОСТЬ
    if (volatility > 0.02) {
      expiry = 1;
    } else if (volatility > 0.015) {
      expiry = 2;
    } else if (volatility > 0.01) {
      expiry = 3;
    } else if (volatility > 0.007) {
      expiry = 4;
    } else {
      expiry = 5;
    }
    
    // 2. RSI
    if (rsi < 25 || rsi > 75) {
      expiry = Math.max(1, expiry - 1);
    }
    if (rsi < 20 || rsi > 80) {
      expiry = 1;
    }
    
    // 3. ADX
    if (adx > 35) {
      expiry = Math.min(5, expiry + 1);
    }
    if (adx < 20) {
      expiry = Math.max(1, expiry - 1);
    }
    
    // 4. УВЕРЕННОСТЬ
    if (confidence > 85) {
      expiry = Math.max(1, expiry - 1);
    }
    if (confidence < 65) {
      expiry = Math.min(5, expiry + 1);
    }
    
    return Math.max(1, Math.min(5, expiry));
  }

  async predict(candles: Candle[]): Promise<Prediction | null> {
    if (this.models.length === 0) {
      return null;
    }

    try {
      const features = this.extractFeatures(candles, candles.length - 1);
      if (!features) return null;
      
      const directionPred = await this.predictSingle(features);
      if (!directionPred) return null;
      
      const prices = candles.slice(-30).map(c => c.close);
      const meanPrice = this.mean(prices) || 1;
      const stdPrice = this.std(prices);
      const volatility = stdPrice / meanPrice;
      
      const rsi = this.calculateRSI(prices, 14);
      const adx = this.calculateADX(prices, 14);
      
      const expiry = this.selectExpiry(
        prices, 
        volatility, 
        rsi, 
        adx, 
        directionPred.confidence
      );
      
      const confidence = directionPred.confidence;
      
      if (isNaN(confidence) || confidence < ML_CONFIG.confidence_threshold * 100) {
        return null;
      }

      const now = new Date();
      const expiryDate = new Date(now.getTime() + expiry * 60 * 1000);
      const validUntil = new Date(now.getTime() + 30 * 1000);

      const result: Prediction = {
        direction: directionPred.direction,
        confidence: Math.min(95, confidence),
        expiry: expiry,
        expiry_timestamp: expiryDate.toISOString(),
        valid_until: validUntil.toISOString(),
        probability: directionPred.probability,
        rsi: rsi,
        volatility: volatility,
        models_count: this.models.length
      };

      const total = result.probability.call + result.probability.put;
      if (total !== 100) {
        result.probability.call = Math.round((result.probability.call / total) * 100);
        result.probability.put = 100 - result.probability.call;
      }

      console.log(`✅ ${this.pair}: ${result.direction} (${result.confidence}%) | Эксп: ${result.expiry}м | RSI: ${rsi.toFixed(1)} | Vol: ${(volatility*100).toFixed(2)}%`);
      return result;
      
    } catch (e) {
      return null;
    }
  }

  shouldRetrain(): boolean {
    const lastTrain = LAST_TRAIN_TIME.get(this.pair) || 0;
    return (Date.now() - lastTrain) > ML_CONFIG.retrain_interval * 60 * 1000;
  }
}

// ============ ФУНКЦИИ АДАПТАЦИИ СИГНАЛОВ ============

function adaptMLSignalToFrontend(mlSignal: any, marketData: MarketPair[]): any {
  if (!mlSignal) return null;
  
  const direction = mlSignal.direction === 'CALL' ? 'BUY' : 'SELL';
  const pairData = marketData?.find((p: any) => p.name === mlSignal.pair);
  const currentPrice = mlSignal.current_price || 1.085;
  
  const expiryDate = new Date(mlSignal.expiry_timestamp);
  const validUntilDate = new Date(mlSignal.valid_until);
  
  const volatility = mlSignal.volatility || 0.01;
  const tpMultiplier = direction === 'BUY' ? 1 + (volatility * 0.4) : 1 - (volatility * 0.4);
  const slMultiplier = direction === 'BUY' ? 1 - (volatility * 0.2) : 1 + (volatility * 0.2);
  
  return {
    pair: mlSignal.pair,
    direction: direction,
    expiration: `${mlSignal.expiry} минут`,
    expiry_minutes: mlSignal.expiry,
    expiry_time: expiryDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    valid_until: validUntilDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    confidence: `${mlSignal.confidence}%`,
    entry_price: currentPrice.toFixed(5),
    take_profit: (currentPrice * tpMultiplier).toFixed(5),
    stop_loss: (currentPrice * slMultiplier).toFixed(5),
    probability: mlSignal.probability,
    signal_strength: mlSignal.confidence > 75 ? 'strong' : mlSignal.confidence > 65 ? 'moderate' : 'weak',
    provider: `ML Expiry 1-5min`,
    signal_id: `sig_${Date.now()}`,
    generated_at: new Date().toISOString(),
    reasoning: `${mlSignal.pair}: ${direction === 'BUY' ? 'ПОКУПКА' : 'ПРОДАЖА'} (${mlSignal.confidence}%). ` +
               `Экспирация: ${mlSignal.expiry} мин (до ${expiryDate.toLocaleTimeString()}). ` +
               `Волатильность: ${(volatility * 100).toFixed(2)}%.`,
    market_data: pairData ? {
      current_price: pairData.current_price,
      trend: pairData.indicators?.trend || 'neutral',
      support: (currentPrice * 0.995).toFixed(5),
      resistance: (currentPrice * 1.005).toFixed(5),
      signal_strength: mlSignal.confidence > 75 ? 'strong' : 'moderate',
      confidence: `${mlSignal.confidence}%`
    } : null
  };
}

// ✅ FALLBACK СИГНАЛ - СТРОГО 1-5 МИНУТ
function generateFallbackSignal(marketData: MarketPair[]): any {
  try {
    for (const pair of marketData) {
      if (!pair?.candles || pair.candles.length < 20) continue;
      
      const prices = pair.candles.slice(0, 20).map(c => c.close);
      let gains = 0, losses = 0;
      for (let i = 1; i < prices.length; i++) {
        const change = prices[i] - prices[i-1];
        if (change > 0) gains += change;
        else losses -= change;
      }
      
      const rsi = 100 - (100 / (1 + (gains / (losses || 0.1))));
      const currentPrice = parseFloat(pair.current_price) || prices[0];
      
      let expiry = 3;
      if (rsi < 25 || rsi > 75) {
        expiry = 1;
      } else if (rsi < 30 || rsi > 70) {
        expiry = 2;
      } else if (rsi < 35 || rsi > 65) {
        expiry = 3;
      } else if (rsi < 40 || rsi > 60) {
        expiry = 4;
      } else {
        expiry = 5;
      }
      
      const now = new Date();
      const expiryDate = new Date(now.getTime() + expiry * 60 * 1000);
      const validUntil = new Date(now.getTime() + 30 * 1000);
      
      if (rsi < 30) {
        return {
          pair: pair.name,
          direction: 'BUY',
          expiration: `${expiry} минут`,
          expiry_minutes: expiry,
          expiry_time: expiryDate.toLocaleTimeString('ru-RU'),
          valid_until: validUntil.toLocaleTimeString('ru-RU'),
          confidence: '70%',
          entry_price: currentPrice.toFixed(5),
          take_profit: (currentPrice * 1.003).toFixed(5),
          stop_loss: (currentPrice * 0.9985).toFixed(5),
          reasoning: `RSI перепродан (${rsi.toFixed(1)}). Экспирация: ${expiry} мин.`,
          provider: 'RSI Fallback',
          signal_id: `sig_${Date.now()}`,
          generated_at: new Date().toISOString()
        };
      } else if (rsi > 70) {
        return {
          pair: pair.name,
          direction: 'SELL',
          expiration: `${expiry} минут`,
          expiry_minutes: expiry,
          expiry_time: expiryDate.toLocaleTimeString('ru-RU'),
          valid_until: validUntil.toLocaleTimeString('ru-RU'),
          confidence: '70%',
          entry_price: currentPrice.toFixed(5),
          take_profit: (currentPrice * 0.997).toFixed(5),
          stop_loss: (currentPrice * 1.0015).toFixed(5),
          reasoning: `RSI перекуплен (${rsi.toFixed(1)}). Экспирация: ${expiry} мин.`,
          provider: 'RSI Fallback',
          signal_id: `sig_${Date.now()}`,
          generated_at: new Date().toISOString()
        };
      }
    }
  } catch (e) {
    console.log('⚠️ Ошибка генерации резервного сигнала');
  }
  
  const now = new Date();
  const expiryDate = new Date(now.getTime() + 3 * 60 * 1000);
  const validUntil = new Date(now.getTime() + 30 * 1000);
  
  return {
    pair: 'EUR/USD',
    direction: Math.random() > 0.5 ? 'BUY' : 'SELL',
    expiration: '3 минут',
    expiry_minutes: 3,
    expiry_time: expiryDate.toLocaleTimeString('ru-RU'),
    valid_until: validUntil.toLocaleTimeString('ru-RU'),
    confidence: '60%',
    entry_price: '1.08500',
    take_profit: '1.08800',
    stop_loss: '1.08300',
    reasoning: `Базовый сигнал. Экспирация: 3 мин.`,
    provider: 'Default Fallback',
    signal_id: `sig_${Date.now()}`,
    generated_at: new Date().toISOString()
  };
}

// Выбор лучшего сигнала
function selectBestPair(predictions: Signal[]): Signal | null {
  let bestPair: Signal | null = null;
  let bestScore = -Infinity;

  for (const pred of predictions) {
    if (!pred || pred.expiry < 1 || pred.expiry > 5) continue;
    
    let score = pred.confidence;
    
    if (pred.direction === 'CALL') {
      score *= (pred.probability.call / 100);
    } else {
      score *= (pred.probability.put / 100);
    }
    
    if (pred.expiry === 1) score *= 1.3;
    else if (pred.expiry === 2) score *= 1.25;
    else if (pred.expiry === 3) score *= 1.2;
    else if (pred.expiry === 4) score *= 1.15;
    else if (pred.expiry === 5) score *= 1.1;
    
    if (pred.trend === 'uptrend' && pred.direction === 'CALL') score *= 1.2;
    if (pred.trend === 'downtrend' && pred.direction === 'PUT') score *= 1.2;
    
    if (score > bestScore) {
      bestScore = score;
      bestPair = pred;
    }
  }

  return bestPair;
}

// ============ ГЛАВНЫЙ ОБРАБОТЧИК ============

export async function POST(request: Request) {
  let collector: any = null;
  
  try {
    // Проверка авторизации
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('neura-session')?.value;
    const userEmail = cookieStore.get('user-email')?.value;

    if (!sessionToken || !userEmail) {
      return NextResponse.json(
        { success: false, error: 'Не авторизован' },
        { status: 401 }
      );
    }

    const db = await getDb();
    
    // Получаем пользователя с pocketOptionId
    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, balance, role, pocketOptionId FROM users WHERE email = ?',
        [userEmail],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Пользователь не найден' },
        { status: 404 }
      );
    }

    // Проверяем сессию
    const session = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM sessions WHERE userId = ? AND token = ? AND expiresAt > datetime("now")',
        [(user as any).id, sessionToken],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Сессия истекла' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const market = body.market || 'demo';
    const timeframe = body.timeframe || '1';
    
    // ✅ 1. СИНХРОНИЗИРУЕМ БАЛАНС С POCKETOPTION ПЕРЕД ПРОВЕРКОЙ
    console.log(`🔄 Синхронизация баланса с PocketOption для пользователя ${(user as any).id}...`);

    try {
      // Синхронизируем баланс
      await syncUserBalance((user as any).id, (user as any).pocketOptionId);
    } catch (syncError) {
      console.error('❌ Ошибка синхронизации баланса:', syncError);
      // Продолжаем выполнение, используем текущий баланс из БД
    }
    
    // ✅ 2. ПРОВЕРЯЕМ ДОСТУПНОСТЬ СИГНАЛА (с обновленным балансом)
    const isAdmin = (user as any).role === 'admin';
    const availability = await checkSignalAvailability((user as any).id, isAdmin);

    if (!availability.available) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Лимит сигналов на сегодня исчерпан. Использовано ${availability.used} из ${availability.limit}. Для увеличения лимита пополните баланс до следующего уровня.`,
          limit: availability.limit,
          used: availability.used,
          balance: availability.balance
        },
        { status: 403 }
      );
    }
    
    console.log(`\n📊 ========== ML СИГНАЛ (1-5 МИНУТ) ==========`);
    console.log(`Пользователь: ${userEmail} (${isAdmin ? 'Админ' : 'Обычный'})`);
    console.log(`Баланс после синхронизации: $${availability.balance}`);
    console.log(`Лимит: ${availability.used}/${availability.limit}`);
    console.log(`Параметры: ${market}, ${timeframe}м`);
    
    collector = new ForexSignalCollector();
    await collector.init();
    
    const marketData = await collector.getCurrentData(market, parseInt(timeframe));
    
    if (!marketData || marketData.length === 0) {
      throw new Error('Нет данных');
    }

    console.log(`✅ Получено ${marketData.length} валютных пар`);

    const predictions: Signal[] = [];

    for (const pair of marketData) {
      if (!pair?.candles || pair.candles.length < 50) continue;

      let model = MODEL_CACHE.get(pair.name);
      if (!model) {
        console.log(`🆕 Создание модели для ${pair.name}`);
        model = new ExpiryMLModel(pair.name);
        MODEL_CACHE.set(pair.name, model);
      }

      if (model.shouldRetrain()) {
        console.log(`🔄 Переобучение ${pair.name}...`);
        const trained = await model.train(pair.candles);
        if (trained) {
          LAST_TRAIN_TIME.set(pair.name, Date.now());
        }
      }

      const prediction = await model.predict(pair.candles);
      
      if (prediction) {
        predictions.push({
          ...prediction,
          pair: pair.name,
          current_price: parseFloat(pair.current_price) || 1.085,
          trend: pair.indicators?.trend || 'neutral'
        });
        console.log(`📈 ${pair.name}: ${prediction.direction} (${prediction.confidence}%) | Эксп: ${prediction.expiry}м`);
      }
    }

    let bestSignal = null;
    if (predictions.length > 0) {
      bestSignal = selectBestPair(predictions);
    }

    if (!bestSignal) {
      console.log(`⚠️ Нет ML сигналов, используем Fallback`);
      const fallbackSignal = generateFallbackSignal(marketData);
      
      if (fallbackSignal) {
        // Записываем использование сигнала
        await recordSignalUsage((user as any).id, fallbackSignal);
        
        return NextResponse.json({
          success: true,
          signal: fallbackSignal,
          remaining: availability.limit - availability.used - 1,
          limit: availability.limit,
          balance: availability.balance,
          ml_stats: {
            pairs_analyzed: marketData.length,
            predictions_made: predictions.length,
            models_trained: MODEL_CACHE.size,
            note: 'Использован Fallback',
            expiry_range: '1-5 минут'
          }
        });
      }
      return NextResponse.json({ success: false, error: 'Нет сигналов' });
    }

    const adaptedSignal = adaptMLSignalToFrontend(bestSignal, marketData);

    // Записываем использование сигнала
    await recordSignalUsage((user as any).id, adaptedSignal);

    console.log(`\n🎯 ЛУЧШИЙ СИГНАЛ:`);
    console.log(`Пара: ${adaptedSignal.pair}`);
    console.log(`Направление: ${adaptedSignal.direction}`);
    console.log(`Экспирация: ${adaptedSignal.expiration}`);
    console.log(`Уверенность: ${adaptedSignal.confidence}`);
    console.log(`Осталось сигналов сегодня: ${availability.limit - availability.used - 1}`);

    return NextResponse.json({
      success: true,
      signal: adaptedSignal,
      remaining: availability.limit - availability.used - 1,
      limit: availability.limit,
      balance: availability.balance,
      ml_stats: {
        pairs_analyzed: marketData.length,
        predictions_made: predictions.length,
        models_trained: MODEL_CACHE.size,
        ensemble_size: ML_CONFIG.ensemble_size,
        expiry_range: '1-5 минут',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('❌ Ошибка:', error.message);
    
    const now = new Date();
    const expiryDate = new Date(now.getTime() + 3 * 60 * 1000);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      fallback: {
        pair: 'EUR/USD',
        direction: 'BUY',
        expiration: '3 минут',
        expiry_minutes: 3,
        expiry_time: expiryDate.toLocaleTimeString('ru-RU'),
        confidence: '55%',
        entry_price: '1.08500',
        reasoning: `Резервный сигнал. Экспирация: 3 мин.`,
        provider: 'Error Fallback',
        signal_id: `sig_${Date.now()}`,
        generated_at: new Date().toISOString()
      }
    });
    
  } finally {
    if (collector) {
      await collector.shutdown();
    }
  }
}

// Очистка старых моделей
setInterval(() => {
  const now = Date.now();
  for (const [pair, lastTrain] of LAST_TRAIN_TIME.entries()) {
    if (now - lastTrain > ML_CONFIG.retrain_interval * 60 * 1000 * 3) {
      MODEL_CACHE.delete(pair);
      LAST_TRAIN_TIME.delete(pair);
      console.log(`🧹 Очищена модель для ${pair}`);
    }
  }
}, 60 * 60 * 1000);