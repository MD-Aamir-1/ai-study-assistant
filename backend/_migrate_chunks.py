"""
One-time migration: drops document_chunks table so it can be
recreated with the new `embedding` column.
"""
from database import engine, Base
from sqlalchemy import text
import models  # noqa: F401  (import to register models)


def run():
    print("Dropping old `document_chunks` table...")
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS document_chunks"))
        conn.commit()
    print("Recreating tables with new schema...")
    Base.metadata.create_all(bind=engine)
    print("✅ Migration complete. You can now re-upload PDFs.")


if __name__ == "__main__":
    run()