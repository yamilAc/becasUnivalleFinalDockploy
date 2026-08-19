"""Extrae oportunidades, enlaces e imágenes de un documento Word de becas.

Uso:
  python extract_word_becas.py documento.docx imagen_default.png directorio_salida
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path
from zipfile import ZipFile

from docx import Document


NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
}
REL_ID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
EMBED_ID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed"


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").replace("\xa0", " ")).strip()


def normalized_type(value: str, institution: str) -> str | None:
    value = clean(value).lower()
    if "bolet" in institution.lower():
        return "beca"
    if "pasant" in value or "práctica" in value:
        return "pasantia"
    if "intercambio" in value or "movilidad" in value:
        return "intercambio"
    if "curso" in value or "webinar" in value:
        return "curso"
    if "concurso" in value:
        return "concurso"
    if "beca" in value:
        return "beca"
    return None


def is_header(cells: list[str]) -> bool:
    joined = " ".join(cells).lower()
    return "instituci" in joined and ("curso" in joined or "beca" in joined) and ("país" in joined or "pais" in joined)


def relationship_target(part, rel_id: str) -> str | None:
    try:
        rel = part.rels[rel_id]
        return rel.target_ref if rel.is_external else None
    except KeyError:
        return None


def row_links(row) -> list[str]:
    links: list[str] = []
    for cell in row.cells:
        for hyperlink in cell._tc.xpath('.//w:hyperlink'):
            rel_id = hyperlink.get(REL_ID)
            if rel_id:
                target = relationship_target(cell.part, rel_id)
                if target:
                    links.append(target)
        for instruction in cell._tc.xpath('.//w:instrText'):
            match = re.search(r'HYPERLINK\s+"?([^"\\ ]+)', instruction.text or '', re.IGNORECASE)
            if match:
                links.append(match.group(1))
    return list(dict.fromkeys(links))


def row_image_rel_ids(row) -> list[str]:
    relation_ids: list[str] = []
    for cell in row.cells:
        for blip in cell._tc.xpath('.//a:blip'):
            rel_id = blip.get(EMBED_ID)
            if rel_id:
                relation_ids.append(rel_id)
    return list(dict.fromkeys(relation_ids))


def extension_for_content_type(content_type: str) -> str:
    return {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/gif": ".gif",
        "image/bmp": ".bmp",
        "image/tiff": ".tiff",
        "image/x-emf": ".emf",
        "image/x-wmf": ".wmf",
    }.get(content_type, ".bin")


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit("Uso: extract_word_becas.py documento.docx imagen_default.png directorio_salida")

    doc_path = Path(sys.argv[1])
    default_image = Path(sys.argv[2])
    output_dir = Path(sys.argv[3])
    image_dir = output_dir / "images"
    image_dir.mkdir(parents=True, exist_ok=True)

    document = Document(doc_path)
    opportunities = []
    images_written: dict[str, str] = {}

    for table_index, table in enumerate(document.tables):
        for row_index, row in enumerate(table.rows):
            cells = [clean(cell.text) for cell in row.cells]
            if not any(cells) or is_header(cells) or len(set(cells)) == 1:
                continue

            # Todas las tablas del documento tienen tipo, institución, país y tema
            # desde la segunda columna. La primera es numeración cuando existe.
            raw_type = cells[1] if len(cells) > 1 else ""
            institution = cells[2] if len(cells) > 2 else ""
            country = cells[3] if len(cells) > 3 else ""
            topic = cells[4] if len(cells) > 4 else ""
            detail = cells[5] if len(cells) > 5 else ""
            kind = normalized_type(raw_type, institution)

            if not kind or not institution or not country:
                continue

            links = row_links(row)
            image_name = None
            for rel_id in row_image_rel_ids(row):
                if rel_id in images_written:
                    image_name = images_written[rel_id]
                    break
                try:
                    image_part = row.cells[0].part.related_parts[rel_id]
                except KeyError:
                    continue
                suffix = extension_for_content_type(image_part.content_type)
                if suffix not in {".png", ".jpg", ".jpeg", ".webp"}:
                    continue
                image_name = f"word-{table_index:02d}-{row_index:03d}{suffix}"
                (image_dir / image_name).write_bytes(image_part.blob)
                images_written[rel_id] = image_name
                break

            if image_name is None:
                image_name = "imagen_default.png"

            title = topic if topic and topic.lower() not in {"enlace a arte", "ver oferta"} else institution
            description_parts = [part for part in [topic, detail] if part and part.lower() not in {"enlace a arte", "ver oferta"}]
            opportunities.append({
                "tipo": kind,
                "titulo": title[:255],
                "institucion": institution[:255],
                "pais": country[:100],
                "area": topic[:255] if topic else None,
                "descripcion": " | ".join(description_parts)[:5000] or None,
                "linkOficial": links[0] if links else None,
                "image": image_name,
                "source": {"table": table_index, "row": row_index},
            })

    shutil.copy2(default_image, image_dir / "imagen_default.png")
    (output_dir / "becas.json").write_text(
        json.dumps(opportunities, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    with_images = sum(item["image"] != "imagen_default.png" for item in opportunities)
    with_links = sum(bool(item["linkOficial"]) for item in opportunities)
    print(json.dumps({
        "opportunities": len(opportunities),
        "with_images": with_images,
        "with_links": with_links,
        "output": str(output_dir / "becas.json"),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
