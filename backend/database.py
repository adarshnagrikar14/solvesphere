import aiosqlite
import json
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "ultravox.db"


async def init_db():
    """Initialize the SQLite database with required tables."""
    async with aiosqlite.connect(DB_PATH) as db:
        # Calls table - stores all Ultravox call information
        await db.execute("""
            CREATE TABLE IF NOT EXISTS calls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                call_id TEXT UNIQUE NOT NULL,
                agent_id TEXT NOT NULL,
                join_url TEXT,
                status TEXT DEFAULT 'created',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                joined_at TIMESTAMP,
                ended_at TIMESTAMP,
                end_reason TEXT,
                short_summary TEXT,
                summary TEXT,
                metadata TEXT,
                response_json TEXT
            )
        """)

        # Webhooks table - stores all webhook events received
        await db.execute("""
            CREATE TABLE IF NOT EXISTS webhooks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                call_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                payload TEXT NOT NULL,
                received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (call_id) REFERENCES calls(call_id)
            )
        """)

        # Tool invocations table - stores tool calls (escalate_to_human, log_call_engagement)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS tool_invocations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                call_id TEXT NOT NULL,
                tool_name TEXT NOT NULL,
                parameters TEXT NOT NULL,
                invoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (call_id) REFERENCES calls(call_id)
            )
        """)

        await db.commit()
        print(f"Database initialized at {DB_PATH}")


async def create_call(call_id: str, agent_id: str, join_url: str, response_json: dict):
    """Store a new call in the database."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO calls (call_id, agent_id, join_url, status, response_json)
            VALUES (?, ?, ?, ?, ?)
        """,
            (call_id, agent_id, join_url, "created", json.dumps(response_json)),
        )
        await db.commit()


async def update_call_status(call_id: str, status: str, **kwargs):
    """Update call status and optional fields."""
    async with aiosqlite.connect(DB_PATH) as db:
        set_clauses = ["status = ?"]
        params = [status]

        if "joined_at" in kwargs:
            set_clauses.append("joined_at = ?")
            params.append(kwargs["joined_at"])
        if "ended_at" in kwargs:
            set_clauses.append("ended_at = ?")
            params.append(kwargs["ended_at"])
        if "end_reason" in kwargs:
            set_clauses.append("end_reason = ?")
            params.append(kwargs["end_reason"])
        if "short_summary" in kwargs:
            set_clauses.append("short_summary = ?")
            params.append(kwargs["short_summary"])
        if "summary" in kwargs:
            set_clauses.append("summary = ?")
            params.append(kwargs["summary"])

        params.append(call_id)
        query = f"UPDATE calls SET {', '.join(set_clauses)} WHERE call_id = ?"
        await db.execute(query, params)
        await db.commit()


async def log_webhook(call_id: str, event_type: str, payload: dict):
    """Log a webhook event."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO webhooks (call_id, event_type, payload)
            VALUES (?, ?, ?)
        """,
            (call_id, event_type, json.dumps(payload)),
        )
        await db.commit()


async def log_tool_invocation(call_id: str, tool_name: str, parameters: dict):
    """Log a tool invocation and return the inserted ID."""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """
            INSERT INTO tool_invocations (call_id, tool_name, parameters)
            VALUES (?, ?, ?)
        """,
            (call_id, tool_name, json.dumps(parameters)),
        )
        await db.commit()
        return cursor.lastrowid


async def get_call(call_id: str):
    """Retrieve call information."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM calls WHERE call_id = ?", (call_id,))
        row = await cursor.fetchone()
        if row:
            return dict(row)
        return None


async def get_all_calls():
    """Retrieve all calls."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM calls ORDER BY created_at DESC")
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def get_call_webhooks(call_id: str):
    """Retrieve all webhooks for a call."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM webhooks WHERE call_id = ? ORDER BY received_at", (call_id,)
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def get_call_tool_invocations(call_id: str):
    """Retrieve all tool invocations for a call."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM tool_invocations WHERE call_id = ? ORDER BY invoked_at",
            (call_id,),
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]
