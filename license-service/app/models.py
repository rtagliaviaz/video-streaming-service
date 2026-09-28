from sqlalchemy import Column, String, DateTime
from datetime import datetime, timezone
from .database import Base


class ContentKey(Base):
    __tablename__ = "content_keys"

    kid = Column(String(32), primary_key=True, index=True)  # hex, 32 chars
    key_hex = Column(String(32), nullable=False)            # hex, 32 chars
    video_id = Column(String(64), nullable=False, index=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self):
        return f"<ContentKey kid={self.kid} video_id={self.video_id}>"