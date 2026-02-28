"""CityShield — Immutable ledger with SHA-256 hash chaining and Solana Devnet.

Each record is hashed and chained to its predecessor, creating a
blockchain-like append-only audit trail in MongoDB.  Optionally, a
reference transaction is formatted for Solana Devnet to anchor the hash
on-chain.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from database import ledger_col

logger = logging.getLogger(__name__)

# Solana imports are optional — gracefully degrade if not installed.
try:
    from solders.keypair import Keypair  # type: ignore[import-untyped]
    from solders.pubkey import Pubkey  # type: ignore[import-untyped]
    from solders.system_program import TransferParams, transfer  # type: ignore[import-untyped]
    from solders.transaction import Transaction  # type: ignore[import-untyped]
    from solders.hash import Hash as SolHash  # type: ignore[import-untyped]

    SOLANA_AVAILABLE = True
except ImportError:
    SOLANA_AVAILABLE = False
    logger.warning("solders not installed — Solana features will be simulated.")


def _compute_hash(entry_type: str, description: str, prev_hash: str, ts: str) -> str:
    """Compute a deterministic SHA-256 hash for a ledger entry."""
    payload = f"{entry_type}|{description}|{prev_hash}|{ts}"
    return hashlib.sha256(payload.encode()).hexdigest()


async def _get_prev_hash() -> str:
    """Retrieve the hash of the most recent ledger entry (genesis = 64 zeros)."""
    col = ledger_col()
    last = await col.find_one(sort=[("timestamp", -1)])
    if last and "tx_hash" in last:
        return last["tx_hash"]
    return "0" * 64


async def log_entry(
    entry_type: str,
    description: str,
    source_module: str,
    data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Append an immutable record to the CityShield ledger.

    Args:
        entry_type: Classification tag (e.g. ``RECORD_LOGGED``).
        description: Human-readable event summary.
        source_module: Name of the originating NerveCenter module.
        data: Arbitrary JSON-serialisable payload.

    Returns:
        The persisted ledger record including ``tx_hash`` and ``prev_hash``.
    """
    col = ledger_col()
    now = datetime.now(timezone.utc)
    prev_hash = await _get_prev_hash()
    tx_hash = _compute_hash(entry_type, description, prev_hash, now.isoformat())

    record = {
        "timestamp": now,
        "entry_type": entry_type,
        "description": description,
        "source_module": source_module,
        "data": data or {},
        "tx_hash": tx_hash,
        "prev_hash": prev_hash,
    }

    result = await col.insert_one(record)
    record["_id"] = str(result.inserted_id)

    logger.info(
        "Ledger entry %s [%s] from %s — hash %s…",
        record["_id"], entry_type, source_module, tx_hash[:12],
    )
    return record


async def get_entries(limit: int = 50) -> List[Dict[str, Any]]:
    """Return the most recent ledger entries, newest first.

    Args:
        limit: Maximum number of entries to return.

    Returns:
        List of ledger records with ``_id`` serialised as string.
    """
    col = ledger_col()
    entries: List[Dict[str, Any]] = []
    async for doc in col.find().sort("timestamp", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        doc["timestamp"] = doc["timestamp"].isoformat()
        entries.append(doc)
    return entries


async def verify_entry(entry_id: str) -> Dict[str, Any]:
    """Verify the hash integrity of a single ledger entry.

    Args:
        entry_id: The ``_id`` string of the record to verify.

    Returns:
        Dict with ``valid`` boolean and computed vs stored hashes.
    """
    from bson import ObjectId

    col = ledger_col()
    doc = await col.find_one({"_id": ObjectId(entry_id)})
    if doc is None:
        raise ValueError(f"Ledger entry '{entry_id}' not found")

    expected = _compute_hash(
        doc["entry_type"],
        doc["description"],
        doc["prev_hash"],
        doc["timestamp"].isoformat(),
    )
    return {
        "entry_id": entry_id,
        "valid": expected == doc["tx_hash"],
        "stored_hash": doc["tx_hash"],
        "computed_hash": expected,
    }


def format_solana_tx(tx_hash: str) -> Dict[str, Any]:
    """Format a reference Solana Devnet transaction (simulation).

    In production this would sign and submit a real transaction anchoring
    the ``tx_hash`` in on-chain memo data.  For the hackathon demo we
    simulate the structure.

    Args:
        tx_hash: The SHA-256 hash to anchor on-chain.

    Returns:
        Dict describing the simulated Solana transaction.
    """
    rpc_url = os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com")

    if SOLANA_AVAILABLE and os.getenv("SOLANA_PRIVATE_KEY"):
        try:
            keypair = Keypair.from_base58_string(os.getenv("SOLANA_PRIVATE_KEY", ""))
            return {
                "network": rpc_url,
                "signer": str(keypair.pubkey()),
                "memo": tx_hash[:32],
                "status": "formatted",
                "note": "Submit via solana CLI or RPC to anchor on-chain.",
            }
        except Exception as exc:
            logger.warning("Solana key parse failed: %s", exc)

    return {
        "network": rpc_url,
        "signer": "SimulatedWallet",
        "memo": tx_hash[:32],
        "status": "simulated",
        "note": "Install solders and set SOLANA_PRIVATE_KEY for real transactions.",
    }
