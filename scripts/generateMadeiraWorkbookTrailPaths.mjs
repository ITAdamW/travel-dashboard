import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveTrailGeometryForPlace } from "../src/lib/trailGeometry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_PATH = path.resolve(
  __dirname,
  "../supabase/seeds/madeira_workbook_trail_paths.sql"
);

const WORKBOOK_TRAILS = [
  {
    id: "madeira-workbook-levada-dos-balc-es",
    name: "Levada dos Balcões",
    category: "trail",
    coordinates: [32.73524928653939, -16.88633623651135],
    subtitle: "PR11 Levada dos Balcões Miradouro dos Balcões",
    note: "Miradouro dos Balcões: 32.741578804502915, -16.890283882421336",
  },
  {
    id: "madeira-workbook-levada-do-moinho",
    name: "Levada do Moinho",
    category: "trail",
    coordinates: [32.845761284036236, -17.1937167037166],
    subtitle: "Levada do Moinho",
    note: "~4h z wodospadem na końcu",
  },
  {
    id: "madeira-workbook-vereda-do-pesqueiro",
    name: "Vereda do pesqueiro",
    category: "trail",
    coordinates: [32.80561491064324, -17.24919641842664],
    subtitle: "Vereda do pesqueiro",
    note: "",
  },
  {
    id: "madeira-workbook-pr6-levada-das-25-fontes",
    name: "PR6 Levada das 25 Fontes",
    category: "trail",
    coordinates: [32.7549076, -17.1360567],
    subtitle: "PR6 25 Fontes hike & Levada do Risco",
    note: "",
  },
];

const ROUTE_HINTS = {
  "madeira-workbook-levada-dos-balc-es": {
    ref: "PR 11",
    officialName: "Vereda dos Balcoes",
    aliases: [
      "balcoes",
      "levada dos balcoes",
      "vereda dos balcoes",
    ],
    refs: ["pr 11"],
    startCoordinates: [32.7354261, -16.8863142],
    targetCoordinates: [32.741578804502915, -16.890283882421336],
  },
  "madeira-workbook-levada-do-moinho": {
    ref: "PR 7",
    officialName: "Levada do Moinho",
    aliases: ["levada do moinho", "pr 7"],
    refs: ["pr 7"],
    startCoordinates: [32.845761284036236, -17.1937167037166],
  },
  "madeira-workbook-vereda-do-pesqueiro": {
    officialName: "Vereda do pesqueiro",
    aliases: ["vereda do pesqueiro", "pesqueiro"],
    refs: [],
    startCoordinates: [32.80561491064324, -17.24919641842664],
  },
  "madeira-workbook-pr6-levada-das-25-fontes": {
    ref: "PR 6",
    officialName: "Levada das 25 Fontes",
    aliases: ["25 fontes", "levada das 25 fontes", "levada do risco"],
    refs: ["pr 6"],
    startCoordinates: [32.7549076, -17.1360567],
  },
};

function toSqlJson(value) {
  return JSON.stringify(value).replace(/'/g, "''");
}

async function main() {
  const lines = [
    "-- Generated route_path patch for Madeira workbook trail places.",
    "-- Source: runtime trail resolution via Overpass / path graph fallback.",
    "",
  ];

  for (const place of WORKBOOK_TRAILS) {
    const routeHint = ROUTE_HINTS[place.id] || null;

    try {
      const geometry = await resolveTrailGeometryForPlace(place, routeHint);
      if (geometry.length < 3) {
        console.log(`${place.id}: skipped (${geometry.length} pts)`);
        continue;
      }

      console.log(`${place.id}: ${geometry.length} pts`);
      lines.push(`-- ${place.name}`);
      lines.push(
        `update public.places\nset route_path = '${toSqlJson(
          geometry
        )}'::jsonb\nwhere id = '${place.id}';`
      );
      lines.push("");
    } catch (error) {
      console.log(`${place.id}: error -> ${error.message}`);
    }
  }

  await fs.writeFile(OUTPUT_PATH, lines.join("\n"), "utf8");
  console.log(`Written ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main();
