from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from datetime import datetime


# === Auth Schemas ===
class LoginSchema(BaseModel):
    email: EmailStr
    password: str


class TokenData(BaseModel):
    user_id: Optional[int] = None
    email: Optional[str] = None


# === User Schemas ===
class UserBase(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    country: Optional[str] = "Россия"
    language: Optional[str] = "Русский"


class UserCreate(UserBase):
    password: str
    pocket_option_id: str
    referral_code: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    language: Optional[str] = None


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    pocket_option_id: str
    balance: float
    status: str
    role: str
    referral_code: Optional[str] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class TokenSchema(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Optional[UserResponse] = None


# === Password Reset Schemas ===
class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetVerify(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)


class PasswordResetConfirm(BaseModel):
    email: EmailStr
    code: str
    new_password: str = Field(..., min_length=6)


# === Referral Schemas ===
class ReferralLinkResponse(BaseModel):
    code: str
    url: str
    clicks: int
    unique_clicks: int
    registrations: int
    conversions: int


class ReferralStats(BaseModel):
    total_referrals: int
    active_referrals: int
    total_commission: float
    pending_commission: float
    paid_commission: float
    lifetime_value: float
    referral_rank: str


class ReferralInfo(BaseModel):
    id: int
    name: str
    email: str
    joined_at: datetime
    status: str
    total_deposit: float
    commission_earned: float


# === Commission Schemas ===
class CommissionInfo(BaseModel):
    id: int
    amount: float
    type: str
    status: str
    description: Optional[str]
    created_at: datetime
    paid_at: Optional[datetime] = None


# === Payout Schemas ===
class PayoutRequest(BaseModel):
    amount: float = Field(..., gt=0)
    method: str


class PayoutResponse(BaseModel):
    id: int
    amount: float
    method: str
    status: str
    created_at: datetime
    processed_at: Optional[datetime] = None


# === Admin Schemas ===
class UserStatusUpdate(BaseModel):
    status: str  # active, blocked, inactive


class PayoutStatusUpdate(BaseModel):
    status: str  # pending, processing, completed, failed, cancelled


# === Response Models ===
class APIResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    error: Optional[str] = None


class UserListResponse(BaseModel):
    users: List[UserResponse]
    total: int
    page: int
    per_page: int
