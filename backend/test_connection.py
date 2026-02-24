"""
Test Supabase connection: connect, insert a dummy row into the cards table, print new ID.

Usage:
  Set SUPABASE_URL and SUPABASE_KEY in the environment, or edit the defaults below.
  Ensure the `cards` table exists with at least: id (uuid), design_data (JSONB, not null).
  Then: python test_connection.py
"""

import os
import uuid
from datetime import datetime

# Use env vars or your project values (prefer env for keys)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://xawdqdceyihcbclbhgow.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "sb_publishable_Rp8FkZSGo0M2bPUJYLqJUw_7BYtpFc2")


def main():
    # Prefer the installed supabase package over a local backend/supabase folder
    import sys
    import site
    for sp in site.getsitepackages():
        if sp not in sys.path:
            sys.path.insert(0, sp)
    try:
        from supabase import create_client
    except ImportError:
        # If you see this, remove or rename the local folder backend/supabase so it doesn't shadow the package
        raise SystemExit(
            "Could not import supabase. Install with: pip install supabase\n"
            "If you have a local folder named 'supabase', rename it (e.g. to supabase_schema) and try again."
        ) from None

    print("Connecting to Supabase...")
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Insert a minimal row (only default columns). If your table has a JSONB column
    # (e.g. "data", "payload", "metadata"), add it here, e.g. {"payload": {...}}.
    dummy_data = {
        "test": True,
        "random_id": str(uuid.uuid4()),
        "message": "Hello from test_connection.py",
        "count": 42,
        "nested": {"a": 1, "b": "two"},
        "created": datetime.utcnow().isoformat() + "Z",
    }

    print("Inserting dummy row into 'cards' table...")
    # Your cards table has a required design_data column (JSONB)
    result = client.table("cards").insert({"design_data": dummy_data}).execute()

    if not result.data or len(result.data) == 0:
        print("Insert returned no data. Check that the table exists and RLS allows insert.")
        return

    row = result.data[0]
    new_id = row.get("id")
    print(f"Success. New card ID: {new_id}")
    if new_id is None:
        print("(Row keys returned:", list(row.keys()), ")")


if __name__ == "__main__":
    main()
