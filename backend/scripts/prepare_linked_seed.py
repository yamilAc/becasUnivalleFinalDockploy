"""Genera el archivo de carga inicial con oportunidades que tienen imagen y enlace."""

from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Uso: prepare_linked_seed.py becas_extraidas.json becas.json")

    source = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    selected = []
    for item in source:
        link = (item.get("linkOficial") or "").strip()
        image = item.get("image")
        if not link or not image or image == "imagen_default.png":
            continue
        selected.append({
            "tipo": item["tipo"],
            "titulo": item["titulo"],
            "institucion": item["institucion"],
            "pais": item["pais"],
            # La columna `area` en MySQL es VARCHAR(100); el detalle completo
            # permanece en `descripcion`.
            "area": (item.get("area") or "")[:100] or None,
            "descripcion": item.get("descripcion"),
            "link_oficial": link,
            "logo": f"/uploads/importadas/{image}",
        })

    Path(sys.argv[2]).write_text(
        json.dumps(selected, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Archivo generado con {len(selected)} oportunidades válidas.")


if __name__ == "__main__":
    main()
