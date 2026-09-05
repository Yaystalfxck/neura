import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.po_models import POSignal, SignalDirection, SignalResult, SignalStatus
from app.po_strategies import get_ml_strategy
from app.tradingview_collector import Candle, TradingViewCollector

try:
    from BinaryOptionsToolsV2 import PocketOptionAsync
    from BinaryOptionsToolsV2.config import Config
    USE_BOT_V2 = True
except ImportError:
    PocketOptionAsync = None
    Config = None
    USE_BOT_V2 = False

logger = logging.getLogger(__name__)
settings = get_settings()


def serialize_candles(candles: List[Any]) -> List[Dict[str, Any]]:
    serialized: List[Dict[str, Any]] = []

    for candle in candles:
        if isinstance(candle, dict):
            serialized.append({
                "time": candle.get("time"),
                "timestamp": candle.get("timestamp"),
                "open": float(candle.get("open", candle.get("close", 0.0))),
                "high": float(candle.get("high", candle.get("close", 0.0))),
                "low": float(candle.get("low", candle.get("close", 0.0))),
                "close": float(candle.get("close", 0.0)),
                "volume": float(candle.get("volume", 0.0)),
            })
            continue

        if isinstance(candle, Candle):
            serialized.append({
                "time": candle.time,
                "timestamp": candle.timestamp,
                "open": float(candle.open),
                "high": float(candle.high),
                "low": float(candle.low),
                "close": float(candle.close),
                "volume": float(candle.volume),
            })

    return serialized


def map_asset_to_symbol(asset_name: str) -> Tuple[str, str]:
    normalized = asset_name.upper().replace("_", " ").strip()
    normalized = normalized.replace(" OTC", "").replace("/", "")

    market = "otc" if "OTC" in asset_name.upper() else "market"
    prefix = "FX_IDC:" if market == "otc" else "FX:"
    symbol = f"{prefix}{normalized}"

    return market, symbol


def normalize_po_asset_name(asset_name: str) -> str:
    normalized = asset_name.strip()

    if normalized.endswith("_otc"):
        return normalized

    upper_name = normalized.upper().replace(" ", "")

    if "/" in normalized:
        upper_name = upper_name.replace("/", "")

    if upper_name.endswith("OTC"):
        upper_name = upper_name[:-3]
        return f"{upper_name}_otc"

    return upper_name


def resolve_signal_market(signal: POSignal) -> str:
    strategy_data = signal.strategy_data or {}
    market = strategy_data.get("market")
    if market in {"otc", "demo", "market"}:
        return market

    asset_name = (signal.asset_name or "").upper()
    if "_OTC" in asset_name or " OTC" in asset_name:
        return "otc"

    return "market"


def calculate_trade_outcome(
    direction: SignalDirection,
    entry_price: Optional[float],
    exit_price: Optional[float],
    amount: float,
) -> Tuple[SignalResult, float]:
    if entry_price is None or exit_price is None:
        return SignalResult.PENDING, 0.0

    if abs(exit_price - entry_price) < 1e-9:
        return SignalResult.DRAW, 0.0

    is_win = (
        direction == SignalDirection.CALL and exit_price > entry_price
    ) or (
        direction == SignalDirection.PUT and exit_price < entry_price
    )

    if is_win:
        return SignalResult.WIN, round(amount * 0.8, 2)

    return SignalResult.LOSS, round(-amount, 2)


def build_po_config() -> Optional[Config]:
    if not USE_BOT_V2 or Config is None:
        return None

    return Config(
        reconnect_time=5,
        max_allowed_loops=100,
        connection_initialization_timeout_secs=30,
        timeout_secs=30,
    )


def merge_price_history(
    original_history: Optional[List[Dict[str, Any]]],
    recent_candles: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    merged: Dict[Any, Dict[str, Any]] = {}

    for candle in original_history or []:
        if not isinstance(candle, dict):
            continue
        key = candle.get("timestamp") or candle.get("time")
        if key is not None:
            merged[key] = candle

    for candle in recent_candles:
        key = candle.get("timestamp") or candle.get("time")
        if key is not None:
            merged[key] = candle

    return [merged[key] for key in sorted(merged)]


async def fetch_exit_price(signal: POSignal) -> Tuple[Optional[float], List[Dict[str, Any]]]:
    signal_market = resolve_signal_market(signal)
    timeframe_seconds = max(60, int(signal.timeframe or 60))

    if signal_market in {"otc", "demo"}:
        if not USE_BOT_V2 or PocketOptionAsync is None:
            logger.warning("BinaryOptionsToolsV2 unavailable for OTC signal %s", signal.id)
            return None, []

        session_token = (
            settings.POCKETOPTION_SESSION_TOKEN_DEMO
            if signal_market == "demo" and settings.POCKETOPTION_SESSION_TOKEN_DEMO
            else settings.POCKETOPTION_SESSION_TOKEN
        )
        asset = normalize_po_asset_name(signal.asset_name)
        client = PocketOptionAsync(ssid=session_token, config=build_po_config())

        try:
            logger.info("Connecting BinaryOptionsToolsV2 for signal %s (%s)", signal.id, asset)
            await client.connect()

            if hasattr(client, "wait_for_assets"):
                try:
                    await asyncio.wait_for(client.wait_for_assets(timeout=30.0), timeout=35.0)
                except Exception as exc:
                    logger.warning("Asset sync timeout for signal %s: %s", signal.id, exc)

            await asyncio.sleep(2)
            candles = await client.get_candles(asset, timeframe_seconds, 5)
            serialized = serialize_candles(candles or [])

            if not serialized:
                logger.warning("No OTC candles received for signal %s", signal.id)
                return None, []

            exit_price = float(serialized[-1]["close"])
            logger.info(
                "Fetched OTC exit price for signal %s: entry=%s exit=%s candles=%s",
                signal.id,
                signal.entry_price,
                exit_price,
                len(serialized),
            )
            return exit_price, serialized
        except Exception as exc:
            logger.warning("Failed to fetch OTC exit price for signal %s: %s", signal.id, exc)
            return None, []
        finally:
            disconnect = getattr(client, "disconnect", None)
            shutdown = getattr(client, "shutdown", None)

            try:
                if callable(disconnect):
                    await disconnect()
                elif callable(shutdown):
                    await shutdown()
            except Exception:
                logger.debug("Failed to close OTC client for signal %s", signal.id, exc_info=True)

    collector = TradingViewCollector()
    try:
        market, symbol = map_asset_to_symbol(signal.asset_name)
        timeframe_minutes = max(1, int(timeframe_seconds / 60))
        candles = await collector.get_candles(symbol, str(timeframe_minutes), 5)
        serialized = serialize_candles(candles)

        if not serialized:
            fallback_data = await collector.get_current_data(market, str(timeframe_minutes))
            for pair in fallback_data:
                if signal.asset_name.upper().replace("_", " ").split()[0] in pair.name.upper():
                    return float(pair.current_price), serialized
            return None, serialized

        return float(serialized[-1]["close"]), serialized
    finally:
        await collector.close()


def build_resolution_payload(
    signal: POSignal,
    exit_price: Optional[float],
    result: SignalResult,
    profit_loss: float,
    recent_candles: List[Dict[str, Any]],
) -> Dict[str, Any]:
    strategy_data = dict(signal.strategy_data or {})
    strategy_data["resolution"] = {
        "resolved_at": datetime.utcnow().isoformat(),
        "entry_price": signal.entry_price,
        "exit_price": exit_price,
        "result": result.value,
        "profit_loss": profit_loss,
        "recent_candles": recent_candles,
    }
    return strategy_data


def build_training_set(signals: List[POSignal]) -> Tuple[List[Dict[str, Any]], List[int]]:
    historical_data: List[Dict[str, Any]] = []
    labels: List[int] = []

    for signal in signals:
        if not signal.price_history or signal.result not in {SignalResult.WIN, SignalResult.LOSS}:
            continue

        closes = [
            float(candle.get("close", 0.0))
            for candle in signal.price_history
            if isinstance(candle, dict) and candle.get("close") is not None
        ]
        closes = [close for close in closes if close > 0]
        if len(closes) < 50:
            continue

        if signal.signal_type == SignalDirection.CALL:
            label = 1 if signal.result == SignalResult.WIN else 0
        else:
            label = 0 if signal.result == SignalResult.WIN else 1

        historical_data.append({"prices": closes})
        labels.append(label)

    return historical_data, labels


async def retrain_ml_from_db() -> Dict[str, Any]:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(POSignal).where(
                POSignal.status == SignalStatus.COMPLETED,
                POSignal.result.in_([SignalResult.WIN, SignalResult.LOSS]),
                POSignal.price_history.is_not(None),
            )
        )
        signals = result.scalars().all()

    historical_data, labels = build_training_set(signals)
    if len(historical_data) < 20 or len(set(labels)) < 2:
        return {
            "trained": False,
            "samples": len(historical_data),
            "reason": "not_enough_balanced_samples",
        }

    ml_strategy = get_ml_strategy()
    ml_strategy.train_model(historical_data, labels)

    return {
        "trained": ml_strategy.is_trained,
        "samples": len(historical_data),
        "classes": {
            "call": sum(1 for label in labels if label == 1),
            "put": sum(1 for label in labels if label == 0),
        },
    }


async def resolve_signal_outcome(signal_id: int) -> Dict[str, Any]:
    logger.info("Starting auto-resolution for signal %s", signal_id)

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(POSignal).where(POSignal.id == signal_id))
        signal = result.scalar_one_or_none()

        if not signal:
            logger.warning("Auto-resolution skipped, signal %s not found", signal_id)
            return {"resolved": False, "reason": "signal_not_found"}

        if signal.status == SignalStatus.COMPLETED:
            logger.info("Signal %s already completed, skipping auto-resolution", signal_id)
            return {"resolved": False, "reason": "already_completed", "signal_id": signal_id}

        exit_price: Optional[float] = None
        recent_candles: List[Dict[str, Any]] = []
        for attempt in range(1, 4):
            exit_price, recent_candles = await fetch_exit_price(signal)
            if exit_price is not None:
                break
            if attempt < 3:
                logger.warning(
                    "Retrying exit price for signal %s (%s/3)",
                    signal_id,
                    attempt + 1,
                )
                await asyncio.sleep(1)

        outcome, profit_loss = calculate_trade_outcome(
            signal.signal_type,
            signal.entry_price,
            exit_price,
            signal.amount,
        )

        if outcome == SignalResult.PENDING:
            logger.warning("Exit price unavailable for signal %s", signal_id)
            return {"resolved": False, "reason": "exit_price_unavailable", "signal_id": signal_id}

        signal.result = outcome
        signal.profit_loss = profit_loss
        signal.status = SignalStatus.COMPLETED
        signal.completed_at = datetime.utcnow()
        signal.current_price = exit_price
        signal.price_history = merge_price_history(signal.price_history, recent_candles)
        signal.strategy_data = build_resolution_payload(
            signal,
            exit_price,
            outcome,
            profit_loss,
            recent_candles,
        )

        await db.commit()

    training_info = await retrain_ml_from_db()
    logger.info(
        "Signal %s resolved as %s with pnl=%s. ML retrain=%s samples=%s",
        signal_id,
        outcome.value,
        profit_loss,
        training_info.get("trained"),
        training_info.get("samples"),
    )
    return {
        "resolved": True,
        "signal_id": signal_id,
        "result": outcome.value,
        "profit_loss": profit_loss,
        "training": training_info,
    }


def queue_signal_resolution(signal_id: int, expires_at: Optional[datetime]) -> None:
    async def _runner() -> None:
        try:
            logger.info("Queued auto-resolution for signal %s at %s", signal_id, expires_at)
            if expires_at:
                now = datetime.now(expires_at.tzinfo) if expires_at.tzinfo else datetime.utcnow()
                delay = (expires_at - now).total_seconds()
                if delay > 0:
                    await asyncio.sleep(delay + 1)
            await resolve_signal_outcome(signal_id)
        except Exception as exc:
            logger.exception("Failed to auto-resolve signal %s: %s", signal_id, exc)

    asyncio.create_task(_runner())
