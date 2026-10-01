#!/usr/bin/env python3
"""Convierte la base de datos de la versión anterior (backend/prisma/dev.db,
SQLite de Prisma) en una copia de seguridad JSON que la app nueva puede
importar desde Ajustes -> Restaurar copia.

Uso: python3 scripts/migrar-datos-antiguos.py [ruta/dev.db] [salida.json]
"""
import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "backend" / "prisma" / "dev.db"
out = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "gestor-dinero-migrado.json"


def iso(ms):
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def day(ms):
    # La app nueva guarda la fecha de cada movimiento como medianoche UTC del
    # día del calendario. La versión anterior mezclaba medianoche local y UTC,
    # así que tomamos el día según la hora local de este ordenador.
    local = datetime.fromtimestamp(ms / 1000)
    return datetime(local.year, local.month, local.day, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


con = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
con.row_factory = sqlite3.Row


def rows(table):
    return [dict(r) for r in con.execute(f'SELECT * FROM "{table}"')]


data = {
    "kind": "gestor-dinero-backup",
    "exportedAt": datetime.now(timezone.utc).isoformat(),
    "version": 2,
    "accounts": [
        {**r, "archived": bool(r["archived"]), "createdAt": iso(r["createdAt"]), "updatedAt": iso(r["updatedAt"])}
        for r in rows("Account")
    ],
    "categories": [{**r, "budget": None, "createdAt": iso(r["createdAt"])} for r in rows("Category")],
    "transactions": [{**r, "date": day(r["date"]), "createdAt": iso(r["createdAt"])} for r in rows("Transaction")],
    "transfers": [{**r, "date": day(r["date"]), "createdAt": iso(r["createdAt"])} for r in rows("Transfer")],
}

out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
print(
    f"Exportado a {out}: {len(data['accounts'])} cuentas, {len(data['categories'])} categorías, "
    f"{len(data['transactions'])} movimientos, {len(data['transfers'])} transferencias.\n"
    "Ábrelo desde la app: Ajustes -> Restaurar copia."
)
