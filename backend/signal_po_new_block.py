        print(f"✅ Лимиты: {used_today}/{daily_limit if current_user.role != 'admin' else '∞'} использовано")

        # ИСПОЛЬЗУЕМ ТОЛЬКО BinaryOptionsToolsV2 с TaskGroup (как Mastaaa1987)
        # Одно соединение для ВСЕГО — анализ + реальные цены
        print(f"\n🔌 Подключение через BinaryOptionsToolsV2...")
        
        from BinaryOptionsToolsV2 import PocketOptionAsync
        
        bot_client = PocketOptionAsync(ssid=settings.POCKETOPTION_SESSION_TOKEN)
        await bot_client.connect()
        
        # Ждём чтобы соединение установилось (как в Mastaaa1987)
        await asyncio.sleep(2)
        
        print("✅ BinaryOptionsToolsV2 подключено!")
        
        try:
            # Анализируем ВСЕ валютные пары через BinaryOptionsToolsV2
            # Используем history() с TaskGroup — как Mastaaa1987
            currency_pairs = [
                {"id": "EURUSD_otc", "name": "EUR/USD OTC", "payout": 90},
                {"id": "GBPUSD_otc", "name": "GBP/USD OTC", "payout": 88},
                {"id": "AUDUSD_otc", "name": "AUD/USD OTC", "payout": 90},
                {"id": "USDJPY_otc", "name": "USD/JPY OTC", "payout": 90},
                {"id": "USDCAD_otc", "name": "USD/CAD OTC", "payout": 90},
                {"id": "USDCHF_otc", "name": "USD/CHF OTC", "payout": 85},
                {"id": "AUDCAD_otc", "name": "AUD/CAD OTC", "payout": 90},
                {"id": "NZDUSD_otc", "name": "NZD/USD OTC", "payout": 88},
                {"id": "EURGBP_otc", "name": "EUR/GBP OTC", "payout": 85},
                {"id": "EURJPY_otc", "name": "EUR/JPY OTC", "payout": 88},
                {"id": "GBPJPY_otc", "name": "GBP/JPY OTC", "payout": 88},
                {"id": "AUDJPY_otc", "name": "AUD/JPY OTC", "payout": 88},
            ]
            
            print(f"\n🔍 Анализ {len(currency_pairs)} активов через TaskGroup...")
            
            # Mastaaa1987 pattern: TaskGroup для ПАРАЛЛЕЛЬНОГО получения данных
            history_tasks = {}
            async with asyncio.TaskGroup() as tg:
                for asset in currency_pairs:
                    task = tg.create_task(bot_client.history(asset['id'], 60))
                    history_tasks[asset['id']] = {'task': task, 'asset': asset}
            
            # Ждём чтобы все задачи завершились
            await asyncio.sleep(5)
            
            # Собираем результаты
            analyzed_signals = []
            
            for asset_id, data in history_tasks.items():
                asset = data['asset']
                try:
                    candles_data = data['task'].result()
                    
                    if not candles_data or len(candles_data) < 20:
                        print(f"   ⚠️ {asset['name']}: недостаточно данных ({len(candles_data) if candles_data else 0})")
                        continue
                    
                    # Конвертируем в формат для анализа
                    history = []
                    for c in candles_data:
                        history.append({
                            'time': c.get('time', 0),
                            'open': float(c.get('open', 0)),
                            'high': float(c.get('high', 0)),
                            'low': float(c.get('low', 0)),
                            'close': float(c.get('close', 0)),
                        })
                    
                    # Генерируем сигнал
                    signal = advanced_signal_strategy(history, asset, strategy_type)
                    if not signal:
                        signal = generate_signal_from_candles_simple(history, asset, strategy_type, 5)
                    
                    if signal:
                        # === УЛУЧШЕННЫЙ АНАЛИЗ ===
                        stoch = calculate_stochastic(
                            [c['close'] for c in history],
                            [c['high'] for c in history],
                            [c['low'] for c in history],
                            14
                        )
                        
                        cci = calculate_cci(
                            [c['high'] for c in history],
                            [c['low'] for c in history],
                            [c['close'] for c in history],
                            20
                        )
                        
                        pattern = detect_candlestick_pattern(
                            [c['open'] for c in history],
                            [c['high'] for c in history],
                            [c['low'] for c in history],
                            [c['close'] for c in history]
                        )
                        
                        support, resistance = calculate_support_resistance(
                            [c['close'] for c in history], 20
                        )
                        
                        # Корректируем уверенность
                        original_conf = float(signal.get('confidence', '50%').replace('%', ''))
                        
                        if signal['signal_type'] == 'call' and stoch < 30:
                            original_conf += 5
                        elif signal['signal_type'] == 'put' and stoch > 70:
                            original_conf += 5
                        elif signal['signal_type'] == 'call' and stoch > 70:
                            original_conf -= 5
                        elif signal['signal_type'] == 'put' and stoch < 30:
                            original_conf -= 5
                        
                        if signal['signal_type'] == 'call' and cci < -100:
                            original_conf += 5
                        elif signal['signal_type'] == 'put' and cci > 100:
                            original_conf += 5
                        
                        if pattern['type'] == signal['signal_type']:
                            original_conf += pattern['strength'] * 10
                        
                        current_price = history[-1]['close']
                        dist_to_support = abs(current_price - support) / current_price if current_price > 0 else 1
                        dist_to_resistance = abs(current_price - resistance) / current_price if current_price > 0 else 1
                        
                        if signal['signal_type'] == 'call' and dist_to_support < 0.002:
                            original_conf += 5
                        elif signal['signal_type'] == 'put' and dist_to_resistance < 0.002:
                            original_conf += 5
                        
                        original_conf = max(50, min(95, original_conf))
                        confidence = original_conf
                        
                        if confidence > 80:
                            signal['strength'] = 'strong'
                        elif confidence > 65:
                            signal['strength'] = 'medium'
                        else:
                            signal['strength'] = 'weak'
                        
                        signal['confidence'] = f"{int(confidence)}%"
                        signal['enhanced_indicators'] = {
                            'stochastic_k': round(stoch, 2),
                            'cci': round(cci, 2),
                            'candle_pattern': pattern['name'],
                            'support': round(support, 5),
                            'resistance': round(resistance, 5),
                            'dist_to_support_pct': f"{dist_to_support*100:.3f}%",
                            'dist_to_resistance_pct': f"{dist_to_resistance*100:.3f}%"
                        }
                        
                        # РЕАЛЬНАЯ цена из BinaryOptionsToolsV2 (последняя свеча)
                        realtime_price = history[-1]['close']
                        signal['current_price'] = float(realtime_price)
                        
                        analyzed_signals.append({
                            'asset': asset,
                            'signal': signal,
                            'history': history,
                            'confidence': confidence,
                            'realtime_price': realtime_price
                        })
                        
                        print(f"   📊 {asset['name']}: {signal.get('signal_type', '?').upper()} ({confidence:.1f}%) | price:{realtime_price:.5f} [stoch:{stoch:.1f} cci:{cci:.1f}]")
                    
                except Exception as e:
                    print(f"   ❌ {asset['name']}: {e}")
            
            if not analyzed_signals:
                print("❌ Не удалось проанализировать ни один актив")
                await bot_client.disconnect()
                raise FastAPIHTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Не удалось сгенерировать сигнал"
                )
            
            # 🏆 Выбираем с МАКСИМАЛЬНОЙ уверенностью
            best = max(analyzed_signals, key=lambda x: x['confidence'])
            best_asset = best['asset']
            signal = best['signal']
            history = best['history']
            realtime_price = best['realtime_price']
            
            print(f"\n🏆 ЛУЧШИЙ СИГНАЛ: {best_asset['name']}")
            print(f"   Направление: {signal.get('signal_type', '?').upper()}")
            print(f"   Уверенность: {best['confidence']:.1f}%")
            print(f"   💰 Реальная цена: {realtime_price:.5f}")
            
            # Обновляем цену в сигнале
            signal['current_price'] = float(realtime_price)
            
            # Закрываем соединение
            print(f"\n🔌 Отключение...")
            await bot_client.disconnect()
            print("✅ Отключено!")
            
            # Форматируем и возвращаем
            return {
                "success": True,
                "signal": format_signal_response(signal, user_balance),
                "balance": float(user_balance),
                "market_data_summary": {
                    "assets_analyzed": len(currency_pairs),
                    "timeframe": timeframe,
                    "market": market,
                    "strategy": strategy_type,
                    "min_payout": min_payout,
                    "timestamp": datetime.utcnow().isoformat(),
                    "data_source": "BinaryOptionsToolsV2"
                }
            }
            
        except FastAPIHTTPException:
            raise
        except Exception as e:
            print(f"❌ Ошибка: {e}")
            import traceback
            traceback.print_exc()
            await bot_client.disconnect()
            raise FastAPIHTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при генерации сигнала: {str(e)}"
            )
