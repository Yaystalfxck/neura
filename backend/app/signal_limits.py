"""
Utility for calculating signal limits based on user balance.
"""

def get_signal_limits(user_balance: float, role: str = "user"):
    """
    Returns the daily signal limit and the next balance tier required for an upgrade.
    """
    if role == 'admin':
        return {"limit": 999, "next_tier_balance": 0}

    if user_balance >= 200:
        return {"limit": 5, "next_tier_balance": 200} # Max tier
    elif user_balance >= 100:
        return {"limit": 4, "next_tier_balance": 200}
    elif user_balance >= 50:
        return {"limit": 3, "next_tier_balance": 100}
    elif user_balance >= 25:
        return {"limit": 2, "next_tier_balance": 50}
    else:
        return {"limit": 1, "next_tier_balance": 25}

def get_next_limit_balance(current_balance: float) -> float:
    """Wrapper for backward compatibility."""
    return get_signal_limits(current_balance, "user")["next_tier_balance"]
