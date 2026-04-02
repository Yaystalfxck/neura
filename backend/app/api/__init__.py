from fastapi import APIRouter
from app.api.routes import auth, login, register, reset_password, profile, user, partner, admin, otc, market_data, signal_po, signal_tv, po_signals, referral_tracking, pocketoption_check, po_affiliate, support, admin_support, websocket

router = APIRouter()

router.include_router(auth.router, tags=["Auth"])
router.include_router(login.router, tags=["Auth"])
router.include_router(register.router, tags=["Auth"])
router.include_router(reset_password.router, tags=["Auth"])
router.include_router(profile.router, tags=["Profile"])
router.include_router(user.router, tags=["User"])
router.include_router(partner.router, tags=["Partner"])
router.include_router(admin.router, tags=["Admin"])
router.include_router(otc.router, tags=["OTC Signals"])
router.include_router(market_data.router, tags=["Market Data"])
router.include_router(signal_po.router, tags=["Signals"])  # Pocket Option (OTC/Demo) - основной
router.include_router(signal_tv.router, tags=["Signals"])  # TradingView (Market)
router.include_router(po_signals.router, tags=["Pocket Option Signals"])
router.include_router(referral_tracking.router, tags=["Referral Tracking"])
router.include_router(pocketoption_check.router, tags=["PocketOption"])
router.include_router(po_affiliate.router, tags=["PocketOption Affiliate"])
router.include_router(support.router, tags=["Support"])
router.include_router(admin_support.router, tags=["Admin Support"])
router.include_router(websocket.router, tags=["WebSocket"])
