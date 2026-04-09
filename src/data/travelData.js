const fallbackImage =
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1400&q=80";

export const categoryMeta = {
  beach: { label: "Plaże" },
  viewpoint: { label: "Punkty widokowe" },
  cafe: { label: "Kawiarnie / relax" },
  museum: { label: "Muzea / architektura" },
  city: { label: "Miasto / spacer" },
};

function createPlace(id, name, category, coordinates, note, extra = {}) {
  const primaryImage = extra.image || fallbackImage;
  return {
    id,
    name,
    category,
    coordinates, // [lat, lng] for Leaflet
    note,
    status: extra.status || "visited",
    subtitle: extra.subtitle || note,
    description:
      extra.description ||
      "To miejsce możesz później uzupełnić własnym opisem, wspomnieniem albo praktyczną notatką do planowania wyjazdu.",
    image: primaryImage,
    gallery:
      extra.gallery || [primaryImage, primaryImage, primaryImage, primaryImage, primaryImage],
    video: extra.video || null,
    videos: extra.videos || [],
    rating: extra.rating ?? 4.6,
    info: extra.info || "Najlepiej odwiedzić rano lub pod wieczór.",
    ticket: extra.ticket || "Brak informacji",
    reservation: extra.reservation || "Nie wymaga rezerwacji",
    paid: extra.paid || "Bezpłatne lub zależne od atrakcji",
  };
}

export const countries = [
  {
    id: "cz",
    countryName: "Czechia",
    status: "visited",
    year: "2024",
    region: "Europa Środkowa",
    summary: "Bardzo wdzięczny kierunek na krótki wyjazd.",
    destinations: [
      {
        id: "prague",
        name: "Praga",
        area: "Old Town & Castle District",
        video: "https://drive.google.com/file/d/PASTE_YOUR_VIDEO_ID/preview",
        summary: "Praga działa dzięki detalom: mostom, uliczkom i architekturze.",
        itinerary: [
          { day: "Day 1 — Old Town", items: ["old-town-square", "astronomical-clock", "charles-bridge"] },
        ],
        places: [
          createPlace("old-town-square", "Rynek Staromiejski", "city", [50.087, 14.4205], "Centralny punkt spacerów i najważniejszych kadrów Pragi.", {
            image: "https://images.unsplash.com/photo-1519677100203-a0e668c92439?auto=format&fit=crop&w=1400&q=80",
            gallery: [
              "https://images.unsplash.com/photo-1519677100203-a0e668c92439?auto=format&fit=crop&w=1400&q=80",
              "https://images.unsplash.com/photo-1541849546-216549ae216d?auto=format&fit=crop&w=1400&q=80",
              "https://images.unsplash.com/photo-1526481280695-3c4691f8f7a1?auto=format&fit=crop&w=1400&q=80",
              "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
              "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1400&q=80",
            ],
          }),
          createPlace("astronomical-clock", "Zegar Astronomiczny", "museum", [50.087, 14.4208], "Ikoniczny punkt starówki."),
          createPlace("prague-castle", "Zamek na Hradczanach i Katedra Wita", "museum", [50.0909, 14.4005], "Najbardziej monumentalna część Pragi."),
          createPlace("charles-bridge", "Most Karola", "city", [50.0865, 14.4114], "Absolutny klasyk spacerów i zdjęć w Pradze."),
        ],
      },
    ],
  },
  {
    id: "at",
    countryName: "Austria",
    status: "visited",
    year: "2024",
    region: "Europa Środkowa",
    summary: "Austria otwiera elegancki rozdział miejski.",
    destinations: [
      {
        id: "vienna",
        name: "Wiedeń",
        area: "Inner City & Belvedere",
        video: "https://drive.google.com/file/d/PASTE_YOUR_VIDEO_ID/preview",
        summary: "Wiedeń świetnie pasuje do bardziej eleganckiego klimatu projektu.",
        itinerary: [{ day: "Day 1 — City classics", items: ["st-stephens-vienna", "vienna-opera", "belvedere"] }],
        places: [
          createPlace("butterfly-house", "Motylarnia", "museum", [48.2044, 16.3664], "Lżejszy, bardziej szklarniowy punkt na trasie."),
          createPlace("st-stephens-vienna", "Katedra św. Szczepana", "museum", [48.2085, 16.3738], "Serce historycznego Wiednia i klasyczny punkt miasta."),
          createPlace("palm-house", "Palmiarnia", "museum", [48.1845, 16.3015], "Miejsce o bardziej ogrodowym, spokojnym klimacie."),
          createPlace("belvedere", "Belweder", "museum", [48.1915, 16.3808], "Jedno z najbardziej reprezentacyjnych miejsc w Wiedniu."),
          createPlace("vienna-opera", "Opera Wiedeńska", "museum", [48.2029, 16.3687], "Mocny klasyczny punkt w centrum miasta."),
        ],
      },
    ],
  },
  {
    id: "pl",
    countryName: "Poland",
    status: "visited",
    year: "Ongoing",
    region: "Europa Środkowa",
    summary: "Miejsce bazowe i kraj, do którego można stale dopisywać nowe krótkie wyjazdy.",
    destinations: [
      {
        id: "czestochowa",
        name: "Częstochowa",
        area: "City & local spots",
        video: "https://drive.google.com/file/d/PASTE_YOUR_VIDEO_ID/preview",
        summary: "Częstochowa może działać bardziej lokalnie i praktycznie.",
        itinerary: [{ day: "Day 1 — Local mix", items: ["jasna-gora", "czekoladowa-nuta", "lody-czewskie", "galeria-jurajska"] }],
        places: [
          createPlace("czekoladowa-nuta", "Czekoladowa Nuta", "cafe", [50.8114, 19.1208], "Słodszy przystanek na trasie."),
          createPlace("jasna-gora", "Jasna Góra", "museum", [50.8118, 19.1005], "Najbardziej rozpoznawalny punkt miasta."),
          createPlace("lody-czewskie", "Lody Czewskie", "cafe", [50.811, 19.1204], "Mały lokalny punkt na liście."),
          createPlace("galeria-jurajska", "Galeria Jurajska", "city", [50.8211, 19.137], "Praktyczny punkt miejski i zakupowy."),
        ],
      },
    ],
  },
  {
    id: "pt",
    countryName: "Portugal",
    status: "planned",
    year: "Planned",
    region: "Europa Południowo-Zachodnia",
    summary: "Portugalia jest na razie rozdziałem planowanym.",
    destinations: [
      {
        id: "madeira",
        name: "Madera",
        area: "Island trip",
        video: "https://drive.google.com/file/d/PASTE_YOUR_VIDEO_ID/preview",
        summary: "Madera będzie idealna do panelu planowania.",
        itinerary: [{ day: "Day 1 — East side", items: ["baia-dabra", "pico-do-arieiro", "pico-ruivo"] }],
        places: [
          createPlace("levada-dos-balcoes", "Levada dos Balcões", "viewpoint", [32.7383, -16.9059], "Krótka i bardzo fotogeniczna lewada.", { status: "planned" }),
          createPlace("cabo-girao", "Cabo Girão Skywalk", "viewpoint", [32.6556, -17.0036], "Jeden z najmocniejszych widoków na wyspie.", { status: "planned" }),
          createPlace("fanal", "Fanal", "viewpoint", [32.8154, -17.1425], "Mglisty, bajkowy klimat lasu.", { status: "planned" }),
          createPlace("seixal-beach", "Seixal beach", "beach", [32.8221, -17.1042], "Czarny piasek i fotogeniczna plaża.", { status: "planned" }),
          createPlace("pico-do-arieiro", "Pico do Arieiro", "viewpoint", [32.734, -16.928], "Absolutny klasyk planowania Madery.", { status: "planned" }),
          createPlace("pico-ruivo", "Pico Ruivo", "viewpoint", [32.7582, -16.9429], "Najwyższy punkt wyspy.", { status: "planned" }),
          createPlace("baia-dabra", "Baía D'Abra", "viewpoint", [32.7445, -16.7103], "Surowy, wschodni krajobraz Madery.", { status: "planned" }),
        ],
      },
    ],
  },
];
