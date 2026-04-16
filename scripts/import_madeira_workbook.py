from __future__ import annotations

import json
import re
import shutil
from pathlib import Path
from typing import Dict, List
from zipfile import ZipFile
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parent.parent
WORKBOOK_PATH = ROOT / "Miejscówki.xlsx"
OUTPUT_SQL_PATH = ROOT / "supabase" / "seeds" / "madeira_workbook_places.sql"
OUTPUT_IMAGE_DIR = ROOT / "public" / "workbook-images" / "madeira"

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
DOC_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
DRAWING_NS = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
DRAWING_MAIN_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"

NS = {
    "a": MAIN_NS,
    "r": DOC_REL_NS,
    "rel": PKG_REL_NS,
    "xdr": DRAWING_NS,
}


def slugify(value: str) -> str:
    normalized = (
        value.strip()
        .lower()
        .translate(
            str.maketrans(
                {
                    "ą": "a",
                    "ć": "c",
                    "ę": "e",
                    "ł": "l",
                    "ń": "n",
                    "ó": "o",
                    "ś": "s",
                    "ź": "z",
                    "ż": "z",
                    "ã": "a",
                    "á": "a",
                    "à": "a",
                    "â": "a",
                    "ä": "a",
                    "é": "e",
                    "è": "e",
                    "ê": "e",
                    "ë": "e",
                    "í": "i",
                    "ì": "i",
                    "î": "i",
                    "ï": "i",
                    "ú": "u",
                    "ù": "u",
                    "û": "u",
                    "ü": "u",
                    "ç": "c",
                }
            )
        )
    )
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized)
    normalized = re.sub(r"-+", "-", normalized).strip("-")
    return normalized


def sql_text(value: str) -> str:
    return value.replace("'", "''")


def sql_json(value) -> str:
    return sql_text(json.dumps(value, ensure_ascii=False))


def sql_num(value: float | int | str) -> str:
    try:
        return str(float(str(value).strip()))
    except ValueError:
        return "0"


def column_letters(cell_ref: str) -> str:
    return "".join(ch for ch in cell_ref if ch.isalpha())


def map_category(raw_type: str) -> str:
    value = raw_type.lower()
    if "szlak" in value:
        return "trail"
    if "plaża" in value or "plaza" in value or "woda" in value or "morze" in value:
        return "beach"
    if "bar" in value or "restauracja" in value or "kawi" in value:
        return "cafe"
    if "zabyt" in value or "jaskinia" in value:
        return "museum"
    if "miasto" in value:
        return "city"
    return "viewpoint"


def load_shared_strings(zip_file: ZipFile) -> List[str]:
    shared_strings_path = "xl/sharedStrings.xml"
    if shared_strings_path not in zip_file.namelist():
        return []

    shared_root = ET.fromstring(zip_file.read(shared_strings_path))
    return [
        "".join(node.text or "" for node in item.iter(f"{{{MAIN_NS}}}t"))
        for item in shared_root
    ]


def cell_value(cell: ET.Element, shared_strings: List[str]) -> str:
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.iter(f"{{{MAIN_NS}}}t"))

    value_node = cell.find("a:v", NS)
    if value_node is None or value_node.text is None:
        return ""

    if cell_type == "s":
        return shared_strings[int(value_node.text)]

    return value_node.text


def read_sheet_rows(zip_file: ZipFile, sheet_path: str) -> Dict[int, Dict[str, str]]:
    shared_strings = load_shared_strings(zip_file)
    sheet_root = ET.fromstring(zip_file.read(sheet_path))
    rows: Dict[int, Dict[str, str]] = {}
    sheet_data = sheet_root.find("a:sheetData", NS)

    if sheet_data is None:
        return rows

    for row in sheet_data:
        row_index = int(row.attrib["r"])
        rows[row_index] = {}
        for cell in row:
            rows[row_index][column_letters(cell.attrib["r"])] = cell_value(
                cell, shared_strings
            )

    return rows


def read_sheet_hyperlinks(zip_file: ZipFile, rels_path: str, sheet_path: str) -> Dict[str, str]:
    sheet_root = ET.fromstring(zip_file.read(sheet_path))
    rels_root = ET.fromstring(zip_file.read(rels_path))
    rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels_root}
    hyperlinks: Dict[str, str] = {}

    hyperlinks_root = sheet_root.find("a:hyperlinks", NS)
    if hyperlinks_root is None:
        return hyperlinks

    for hyperlink in hyperlinks_root:
        rel_id = hyperlink.attrib.get(f"{{{DOC_REL_NS}}}id")
        if rel_id:
            hyperlinks[hyperlink.attrib["ref"]] = rel_map.get(rel_id, "")

    return hyperlinks


def read_row_images(zip_file: ZipFile, drawing_rels_path: str, drawing_path: str) -> Dict[int, str]:
    drawing_root = ET.fromstring(zip_file.read(drawing_path))
    rels_root = ET.fromstring(zip_file.read(drawing_rels_path))
    rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels_root}
    images: Dict[int, str] = {}

    for anchor in drawing_root:
        from_node = anchor.find("xdr:from", NS)
        picture_node = anchor.find("xdr:pic", NS)
        if from_node is None or picture_node is None:
            continue

        row_index = int(from_node.find("xdr:row", NS).text) + 1
        blip = picture_node.find(f".//{{{DRAWING_MAIN_NS}}}blip")
        rel_id = blip.attrib.get(f"{{{DOC_REL_NS}}}embed") if blip is not None else ""
        if not rel_id or rel_id not in rel_map:
            continue

        images[row_index] = f"xl/{rel_map[rel_id].replace('..', '').lstrip('/')}"

    return images


def build_rows() -> List[dict]:
    with ZipFile(WORKBOOK_PATH) as zip_file:
        rows = read_sheet_rows(zip_file, "xl/worksheets/sheet1.xml")
        hyperlinks = read_sheet_hyperlinks(
            zip_file,
            "xl/worksheets/_rels/sheet1.xml.rels",
            "xl/worksheets/sheet1.xml",
        )
        images = read_row_images(
            zip_file,
            "xl/drawings/_rels/drawing1.xml.rels",
            "xl/drawings/drawing1.xml",
        )

        workbook_rows: List[dict] = []
        for row_index in sorted(rows):
            if row_index < 5:
                continue

            row = rows[row_index]
            name = row.get("D", "").strip()
            if not name:
                continue

            workbook_rows.append(
                {
                    "row": row_index,
                    "id": f"madeira-workbook-{slugify(name)}",
                    "name": name,
                    "raw_type": row.get("C", "").strip(),
                    "category": map_category(row.get("C", "").strip()),
                    "place_label": row.get("E", "").strip(),
                    "latitude": row.get("G", "").strip(),
                    "longitude": row.get("H", "").strip(),
                    "comment": row.get("K", "").strip(),
                    "maps_url": hyperlinks.get(f"D{row_index}")
                    or hyperlinks.get(f"E{row_index}", ""),
                    "image_path": images.get(row_index, ""),
                    "image_ext": Path(images.get(row_index, "")).suffix.lower() or ".png",
                }
            )

        for item in workbook_rows:
            image_path = item["image_path"]
            if not image_path:
                item["public_image_path"] = ""
                continue

            destination_dir = OUTPUT_IMAGE_DIR / item["id"]
            destination_dir.mkdir(parents=True, exist_ok=True)
            destination_image_path = destination_dir / f"cover{item['image_ext']}"
            with zip_file.open(image_path) as source, destination_image_path.open("wb") as target:
                shutil.copyfileobj(source, target)
            item["public_image_path"] = (
                f"workbook-images/madeira/{item['id']}/cover{item['image_ext']}"
            )

        return workbook_rows


def build_sql(rows: List[dict]) -> str:
    values = []
    for index, row in enumerate(rows, start=1):
        description_parts = [row["raw_type"], row["place_label"]]
        description = " | ".join(part for part in description_parts if part)
        note_parts = []
        if row["comment"]:
            note_parts.append(row["comment"])
        if row["maps_url"]:
            note_parts.append(f"Google Maps: {row['maps_url']}")
        note = " | ".join(note_parts)
        gallery = [row["public_image_path"]] if row["public_image_path"] else []

        values.append(
            "    (\n"
            f"      '{sql_text(row['id'])}',\n"
            f"      '{sql_text(row['name'])}',\n"
            f"      '{sql_text(row['category'])}',\n"
            f"      {sql_num(row['latitude'])},\n"
            f"      {sql_num(row['longitude'])},\n"
            f"      '{sql_text(row['place_label'])}',\n"
            f"      '{sql_text(note)}',\n"
            f"      '{sql_text(description)}',\n"
            f"      '{sql_text(row['public_image_path'])}',\n"
            f"      '{sql_json(gallery)}'::jsonb,\n"
            f"      {index}\n"
            "    )"
        )

    return f"""-- Generated from Miejscówki.xlsx (sheet: Madera).
-- Inserts only missing Madeira places by id, name, or near-identical coordinates.

with target_destination as (
  select id
  from public.destinations
  where lower(name) like '%madeira%' or lower(name) like '%madera%'
  order by sort_order asc, name asc
  limit 1
),
max_sort as (
  select coalesce(max(p.sort_order), 0) as value
  from public.places p
  join target_destination d on d.id = p.destination_id
),
seed_rows (
  place_id,
  name,
  category,
  latitude,
  longitude,
  subtitle,
  note,
  description,
  image,
  gallery,
  order_idx
) as (
  values
{",\n".join(values)}
),
prepared_rows as (
  select
    s.place_id as id,
    d.id as destination_id,
    s.name,
    s.category,
    s.latitude,
    s.longitude,
    s.note,
    'planned'::text as status,
    s.subtitle,
    s.description,
    s.image,
    s.gallery,
    ''::text as video,
    '[]'::jsonb as videos,
    4.5::double precision as rating,
    ''::text as info,
    ''::text as ticket,
    ''::text as reservation,
    ''::text as paid,
    0::double precision as distance_km,
    0::double precision as duration_hours,
    '[]'::jsonb as route_path,
    0::double precision as start_latitude,
    0::double precision as start_longitude,
    0::double precision as end_latitude,
    0::double precision as end_longitude,
    (select value from max_sort) + s.order_idx as sort_order
  from seed_rows s
  cross join target_destination d
)
insert into public.places (
  id,
  destination_id,
  name,
  category,
  latitude,
  longitude,
  note,
  status,
  subtitle,
  description,
  image,
  gallery,
  video,
  videos,
  rating,
  info,
  ticket,
  reservation,
  paid,
  distance_km,
  duration_hours,
  route_path,
  start_latitude,
  start_longitude,
  end_latitude,
  end_longitude,
  sort_order
)
select
  p.id,
  p.destination_id,
  p.name,
  p.category,
  p.latitude,
  p.longitude,
  p.note,
  p.status,
  p.subtitle,
  p.description,
  p.image,
  p.gallery,
  p.video,
  p.videos,
  p.rating,
  p.info,
  p.ticket,
  p.reservation,
  p.paid,
  p.distance_km,
  p.duration_hours,
  p.route_path,
  p.start_latitude,
  p.start_longitude,
  p.end_latitude,
  p.end_longitude,
  p.sort_order
from prepared_rows p
where not exists (
  select 1
  from public.places existing
  where existing.destination_id = p.destination_id
    and (
      lower(existing.id) = lower(p.id)
      or lower(existing.name) = lower(p.name)
      or (
        abs(coalesce(existing.latitude, 0) - p.latitude) < 0.0003
        and abs(coalesce(existing.longitude, 0) - p.longitude) < 0.0003
      )
    )
);
"""


def main() -> None:
    OUTPUT_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    rows = build_rows()
    OUTPUT_SQL_PATH.write_text(build_sql(rows), encoding="utf-8")
    print(f"Generated {OUTPUT_SQL_PATH.relative_to(ROOT)} with {len(rows)} workbook rows.")


if __name__ == "__main__":
    main()
