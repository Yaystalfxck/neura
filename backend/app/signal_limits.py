"""
Utility for calculating signal limits based on user balance and referrals.
"""

def get_signal_limits(user_balance: float, role: str = "user", referrals_count: int = 0):
    """
    Returns the daily signal limit considering balance and referrals.
    
    Args:
        user_balance: Current user balance
        role: User role (admin gets unlimited)
        referrals_count: Number of active referrals
    
    Returns:
        Dict with limit info
    """
    if role == 'admin':
        return {
            "limit": 999, 
            "next_tier_balance": 0,
            "base_limit": 999,
            "referral_bonus": 0,
            "referral_tiers": []
        }

    # Базовые лимиты от баланса
    balance_tiers = [
        {"min_balance": 0, "limit": 1},
        {"min_balance": 25, "limit": 2},
        {"min_balance": 50, "limit": 3},
        {"min_balance": 100, "limit": 4},
        {"min_balance": 200, "limit": 5},
    ]
    
    base_limit = 1
    next_tier_balance = 25
    
    for tier in reversed(balance_tiers):
        if user_balance >= tier["min_balance"]:
            base_limit = tier["limit"]
            # Находим следующий тир
            idx = balance_tiers.index(tier)
            if idx < len(balance_tiers) - 1:
                next_tier_balance = balance_tiers[idx + 1]["min_balance"]
            else:
                next_tier_balance = user_balance + 50  # Показываем "цель" для роста
            break

    # Бонусы за рефералов
    referral_tiers = [
        {"min_referrals": 3, "bonus": 1},
        {"min_referrals": 5, "bonus": 2},
        {"min_referrals": 10, "bonus": 4},
        {"min_referrals": 20, "bonus": 7},
        {"min_referrals": 50, "bonus": 15},
    ]
    
    referral_bonus = 0
    for tier in reversed(referral_tiers):
        if referrals_count >= tier["min_referrals"]:
            referral_bonus = tier["bonus"]
            break

    # Следующий тир рефералов
    next_referral_tier = None
    for tier in referral_tiers:
        if referrals_count < tier["min_referrals"]:
            next_referral_tier = tier
            break

    total_limit = base_limit + referral_bonus

    return {
        "limit": total_limit,
        "next_tier_balance": next_tier_balance,
        "base_limit": base_limit,
        "referral_bonus": referral_bonus,
        "referrals_count": referrals_count,
        "next_referral_tier": next_referral_tier,
        "referral_tiers": referral_tiers
    }


def get_next_limit_balance(current_balance: float) -> float:
    """Wrapper for backward compatibility."""
    return get_signal_limits(current_balance, "user")["next_tier_balance"]
