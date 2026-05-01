export const PLACE_CATEGORY_OPTIONS = [
  { value: "forest-park", label: "Las, wawoz, park" },
  { value: "trail", label: "Szlak" },
  { value: "cliff", label: "Klif" },
  { value: "forest-trail", label: "Las, wawoz, park / Szlak" },
  { value: "waterfall", label: "Wodospad" },
  { value: "viewpoint", label: "Punkt widokowy" },
  { value: "viewpoint-trail", label: "Punkt widokowy / Szlak" },
  { value: "mountains", label: "Gory" },
  { value: "water", label: "Woda, jezioro, morze" },
  { value: "beach", label: "Plaza" },
  { value: "cave", label: "Jaskinia" },
  { value: "city", label: "Miasto" },
  { value: "city-water", label: "Miasto / Woda, jezioro, morze" },
  { value: "heritage", label: "Zabytki" },
  { value: "food-drink", label: "Bar, restauracja" },
  { value: "museum", label: "Zabytki (legacy)" },
  { value: "cafe", label: "Bar, restauracja (legacy)" },
];

export const PLACE_CATEGORY_LABELS = {
  "forest-park": "Las, wawoz, park",
  trail: "Szlak",
  cliff: "Klif",
  "forest-trail": "Las, wawoz, park / Szlak",
  waterfall: "Wodospad",
  viewpoint: "Punkt widokowy",
  "viewpoint-trail": "Punkt widokowy / Szlak",
  mountains: "Gory",
  water: "Woda, jezioro, morze",
  beach: "Plaza",
  cave: "Jaskinia",
  city: "Miasto",
  "city-water": "Miasto / Woda, jezioro, morze",
  heritage: "Zabytki",
  "food-drink": "Bar, restauracja",

  // Legacy aliases kept for older records already in the database.
  cafe: "Bar, restauracja",
  museum: "Zabytki",
};

const TRAIL_LIKE_CATEGORIES = new Set(["trail", "forest-trail", "viewpoint-trail"]);

export function getPlaceCategoryLabel(category) {
  return PLACE_CATEGORY_LABELS[category] || category || "Miasto";
}

export function categoryImpliesTrail(category) {
  return TRAIL_LIKE_CATEGORIES.has(category);
}

export const MADEIRA_WORKBOOK_CATEGORY_ASSIGNMENTS = [
  { id: "madeira-workbook-levada-dos-balc-es", category: "forest-trail" },
  { id: "madeira-workbook-cabo-girao-skywalk", category: "cliff" },
  { id: "madeira-workbook-levada-do-moinho", category: "forest-trail" },
  { id: "madeira-workbook-wodospadem-aniolow", category: "waterfall" },
  { id: "madeira-workbook-farol-da-ponta-do-pargo", category: "viewpoint" },
  { id: "madeira-workbook-vereda-do-pesqueiro", category: "viewpoint-trail" },
  { id: "madeira-workbook-miradouro-do-fio", category: "viewpoint" },
  { id: "madeira-workbook-teleferico-das-achadas-da-cruz", category: "mountains" },
  { id: "madeira-workbook-piscinas-naturais-do-aquario", category: "water" },
  { id: "madeira-workbook-miradouro-do-porto-de-abrigo", category: "viewpoint" },
  { id: "madeira-workbook-cascata-da-ribeira-da-pedra-branca", category: "waterfall" },
  { id: "madeira-workbook-miradouro-da-ribeira-da-laje", category: "viewpoint" },
  { id: "madeira-workbook-seixal-beach", category: "beach" },
  { id: "madeira-workbook-cascata-do-praia-do-porto-do-seixal", category: "waterfall" },
  { id: "madeira-workbook-miradouro-do-veu-da-noiva", category: "viewpoint" },
  { id: "madeira-workbook-fanal", category: "forest-park" },
  { id: "madeira-workbook-baia-d-abra", category: "viewpoint" },
  { id: "madeira-workbook-sao-vicente-caves", category: "cave" },
  { id: "madeira-workbook-curral-das-freiras", category: "city" },
  { id: "madeira-workbook-pico-do-arieiro", category: "mountains" },
  { id: "madeira-workbook-pico-ruivo", category: "mountains" },
  { id: "madeira-workbook-pr6-levada-das-25-fontes", category: "forest-trail" },
  { id: "madeira-workbook-praia-da-calheta", category: "beach" },
  { id: "madeira-workbook-porto-camara-de-lobos", category: "city-water" },
  { id: "madeira-workbook-largo-do-poco", category: "heritage" },
  { id: "madeira-workbook-sealion-wall-sculpture", category: "heritage" },
  { id: "madeira-workbook-mercado-dos-lavradores", category: "food-drink" },
  { id: "madeira-workbook-ogrod-tropikalny-monte-palace", category: "forest-park" },
];
