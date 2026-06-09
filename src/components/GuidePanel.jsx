import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Camera,
  Clock3,
  Download,
  Eye,
  Image as ImageIcon,
  Landmark,
  Link as LinkIcon,
  MapPin,
  Mountain,
  MousePointer2,
  Plus,
  RefreshCcw,
  Route,
  Type,
  Waves,
} from "lucide-react";
import {
  buildPlaceCoverCandidates,
  filterSupabaseMediaUrls,
  normalizeSupabaseMediaUrl,
} from "../lib/mediaUrls";
import { enrichPlaceForDisplay } from "../lib/placePresentation";
import { fetchGuideLayout, upsertGuideLayout } from "../lib/supabaseTravelData";
import { uploadGuideImage } from "../lib/storageMedia";
import RichText from "./RichText";

const categoryMeta = {
  beach: { label: "Plaze", singular: "Plaza", icon: Waves, color: "#008EA1" },
  viewpoint: { label: "Punkty widokowe", singular: "Punkt widokowy", icon: Eye, color: "#0F5964" },
  trail: { label: "Szlaki i lewady", singular: "Szlak", icon: Route, color: "#5F7A45" },
  mountains: { label: "Gory", singular: "Gory", icon: Mountain, color: "#52616D" },
  waterfall: { label: "Wodospady", singular: "Wodospad", icon: Waves, color: "#19A7B7" },
  "forest-park": { label: "Atrakcje przyrodnicze", singular: "Przyroda", icon: Mountain, color: "#4F7A5B" },
  "forest-trail": { label: "Szlaki i przyroda", singular: "Szlak", icon: Route, color: "#5F7A45" },
  "viewpoint-trail": { label: "Punkty widokowe i szlaki", singular: "Punkt widokowy", icon: Route, color: "#0F5964" },
  water: { label: "Woda i wybrzeze", singular: "Woda", icon: Waves, color: "#008EA1" },
  city: { label: "Miasta i wioski", singular: "Miasto", icon: Landmark, color: "#586575" },
  "city-water": { label: "Miasta i wybrzeze", singular: "Miasto", icon: Landmark, color: "#586575" },
  heritage: { label: "Kultura i tradycje", singular: "Kultura", icon: Landmark, color: "#6A5A7D" },
  cave: { label: "Jaskinie", singular: "Jaskinia", icon: Landmark, color: "#6D6F79" },
  cliff: { label: "Klify", singular: "Klif", icon: Mountain, color: "#52616D" },
  "food-drink": { label: "Kuchnia", singular: "Kuchnia", icon: Camera, color: "#A66A3F" },
  cafe: { label: "Kuchnia", singular: "Kuchnia", icon: Camera, color: "#A66A3F" },
  museum: { label: "Kultura i tradycje", singular: "Kultura", icon: Landmark, color: "#6A5A7D" },
};

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function slugify(value) {
  return String(value || "section")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function textToHtml(value) {
  return escapeHtml(value).replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br />");
}

function getCategoryMeta(category) {
  return (
    categoryMeta[category] || {
      label: category || "Inne miejsca",
      singular: category || "Miejsce",
      icon: MapPin,
      color: "#008EA1",
    }
  );
}

function uniqueImageUrls(urls = []) {
  return [...new Set(urls.filter(Boolean))];
}

function getPlaceImageCandidates(place) {
  if (!place) return [];

  return uniqueImageUrls([
    normalizeSupabaseMediaUrl(place.image),
    ...filterSupabaseMediaUrls(place.gallery),
    place.storageMedia?.cover?.url,
    ...(Array.isArray(place.storageMedia?.gallery)
      ? place.storageMedia.gallery.map((item) => item?.url)
      : []),
    ...buildPlaceCoverCandidates(place.countryId, place.destinationId, place.id),
  ]);
}

function getPlacePrimaryImage(place) {
  return getPlaceImageCandidates(place)[0] || "";
}

function getPlaceGalleryImages(place) {
  return uniqueImageUrls([
    ...filterSupabaseMediaUrls(place?.gallery),
    ...(Array.isArray(place?.storageMedia?.gallery)
      ? place.storageMedia.gallery.map((item) => item?.url)
      : []),
  ]).filter((url) => url && url !== getPlacePrimaryImage(place));
}

function getCoverImage(destination) {
  return (
    (destination?.places || []).map(getPlacePrimaryImage).find(Boolean) ||
    normalizeSupabaseMediaUrl(destination?.image || "")
  );
}

function normalizePlaces(destination) {
  return (destination?.places || [])
    .map((place) => enrichPlaceForDisplay(place))
    .filter(
      (place) =>
        Array.isArray(place.coordinates) &&
        Number.isFinite(Number(place.coordinates[0])) &&
        Number.isFinite(Number(place.coordinates[1]))
    );
}

function groupPlacesByCategory(places) {
  const grouped = new Map();

  places.forEach((place) => {
    const meta = getCategoryMeta(place.category || "other");
    const key = slugify(meta.label);
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        ...meta,
        places: [],
      });
    }
    grouped.get(key).places.push(place);
  });

  return [...grouped.values()].sort((a, b) => a.label.localeCompare(b.label, "pl"));
}

function formatDuration(place) {
  if (!place.durationHours) return "";
  return `${place.durationHours % 1 === 0 ? place.durationHours.toFixed(0) : place.durationHours.toFixed(1)} h`;
}

function formatDistance(place) {
  if (!place.distanceKm) return "";
  return `${place.distanceKm % 1 === 0 ? place.distanceKm.toFixed(0) : place.distanceKm.toFixed(1)} km`;
}

function SelectInput({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-[#61717D]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-[0.85rem] border border-[#DDEDF0] bg-white px-4 text-sm font-semibold text-[#132334] outline-none transition focus:border-[#008EA1] focus:ring-4 focus:ring-[#EAFBFD]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function GuideCover({ destination, coverImage }) {
  return (
    <div className="relative h-full min-h-full overflow-hidden bg-[#EAF4F6]">
      {coverImage ? (
        <img src={coverImage} alt={destination?.name} className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.62)_0%,rgba(255,255,255,0.16)_42%,rgba(15,58,66,0.22)_100%)]" />
      <div className="relative z-10 flex h-full min-h-full flex-col justify-between p-10 text-[#132334]">
        <div>
          <p className="text-2xl font-medium tracking-[0.2em]">01</p>
          <p className="mt-10 text-3xl uppercase tracking-[0.22em]">Przewodnik</p>
          <span className="mt-7 block h-1 w-20 bg-[#008EA1]" />
        </div>
        <div>
          <h2 className="text-[clamp(4.2rem,9vw,8rem)] font-black uppercase leading-none text-[#D7E3EA]/80">
            {destination?.name}
          </h2>
          <p className="mt-6 font-serif text-2xl tracking-[0.08em] text-[#3F4D56]">
            gotowy do druku przewodnik po destynacji
          </p>
        </div>
      </div>
    </div>
  );
}

function buildPrintMapMarkers(places) {
  if (!places.length) return "";
  return getMarkerPositions(places)
    .map(
      ({ place, index, x, y }) =>
        `<a class="map-marker" href="#place-${escapeHtml(place.id)}" style="left:${x}%;top:${y}%;" title="${escapeHtml(place.name)}"><i><b>${CategorySymbol({ label: getCategoryMeta(place.category).label })}</b>${index + 1}</i></a>`
    )
    .join("");
}

function getMarkerPositions(places) {
  if (!places.length) return [];
  const madeira = getMadeiraBoundsIfNeeded(places);
  const lats = places.map((place) => Number(place.coordinates[0]));
  const lngs = places.map((place) => Number(place.coordinates[1]));
  const minLat = madeira?.minLat ?? Math.min(...lats);
  const maxLat = madeira?.maxLat ?? Math.max(...lats);
  const minLng = madeira?.minLng ?? Math.min(...lngs);
  const maxLng = madeira?.maxLng ?? Math.max(...lngs);
  const latRange = Math.max(maxLat - minLat, 0.01);
  const lngRange = Math.max(maxLng - minLng, 0.01);

  return places
    .map((place, index) => ({
      place,
      index,
      x: Math.min(Math.max(((Number(place.coordinates[1]) - minLng) / lngRange) * 76 + 12, 8), 92),
      y: Math.min(Math.max((1 - (Number(place.coordinates[0]) - minLat) / latRange) * 76 + 12, 8), 92),
    }));
}

function getMadeiraBoundsIfNeeded(places) {
  const looksLikeMadeira = places.some((place) => {
    const lat = Number(place.coordinates?.[0]);
    const lng = Number(place.coordinates?.[1]);
    return lat > 32.55 && lat < 33.05 && lng > -17.35 && lng < -16.55;
  });

  return looksLikeMadeira
    ? { minLat: 32.61, maxLat: 32.91, minLng: -17.32, maxLng: -16.62 }
    : null;
}

function isMadeiraMap(places) {
  return Boolean(getMadeiraBoundsIfNeeded(places));
}

const madeiraOutlinePath =
  "M38 222 C56 190 92 160 132 132 C185 94 235 62 286 54 C348 44 381 86 420 88 C462 91 494 64 538 70 C596 78 637 52 690 64 C744 77 757 121 805 131 C853 141 897 125 934 151 C970 176 958 219 914 236 C867 254 816 252 768 276 C705 307 664 350 594 361 C525 371 469 345 410 363 C349 382 298 421 234 411 C172 402 153 345 112 321 C76 300 9 295 24 250 C27 241 32 232 38 222 Z";

function StaticMapShape({ places }) {
  if (isMadeiraMap(places)) {
    return (
      <svg viewBox="0 0 1000 460" className="absolute inset-[7%] h-[86%] w-[86%] overflow-visible">
        <path d={madeiraOutlinePath} fill="#A9AD86" opacity="0.86" />
        <path d={madeiraOutlinePath} fill="none" stroke="#97A07A" strokeWidth="2" opacity="0.5" />
        <path d="M170 260 C260 230 338 214 430 206 C552 195 648 180 812 142" fill="none" stroke="#DDE6D7" strokeWidth="3" opacity="0.6" />
        <path d="M304 85 C318 142 330 185 366 232 C407 286 472 304 552 342" fill="none" stroke="#DDE6D7" strokeWidth="3" opacity="0.55" />
        <path d="M642 104 C608 160 598 220 622 284 C640 331 676 357 726 381" fill="none" stroke="#DDE6D7" strokeWidth="2.5" opacity="0.45" />
      </svg>
    );
  }

  return (
    <>
      <div className="absolute -left-[18%] top-[58%] h-[42%] w-[75%] rotate-[-10deg] rounded-full bg-[#008EA1]/10" />
      <div className="absolute -right-[14%] -top-[4%] h-[28%] w-[48%] rotate-[18deg] rounded-full bg-[#5F7A45]/10" />
      <div className="absolute left-[10%] top-[44%] h-0.5 w-[78%] rotate-[-14deg] bg-[#52616D]/20" />
      <div className="absolute left-[17%] top-[62%] h-0.5 w-[70%] rotate-[12deg] bg-[#52616D]/20" />
      <div className="absolute left-[34%] top-[30%] h-0.5 w-[50%] rotate-[38deg] bg-[#52616D]/20" />
    </>
  );
}

function CategorySymbol({ label }) {
  if (/plaz|woda|wybrzez/i.test(label)) return "~";
  if (/szlak|lew/i.test(label)) return "⌁";
  if (/kuch|bar|rest/i.test(label)) return "◎";
  if (/kultur|miast|wiosk|zabyt/i.test(label)) return "⌂";
  if (/punkt|widok|gor|klif/i.test(label)) return "⌃";
  return "✦";
}

function StaticGuideMap({ title, places, color = "#008EA1", className = "" }) {
  const firstMeta = getCategoryMeta(places[0]?.category);
  return (
    <div
      className={cn(
        "relative overflow-hidden border border-[#DDEDF0] bg-[linear-gradient(135deg,#E8F4F6_0%,#F8FCFD_58%,#DCECF0_100%)]",
        className
      )}
      style={{ "--marker-color": color }}
    >
      <div className="absolute left-4 top-4 z-10 border border-[#DDEDF0]/90 bg-white/90 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#52616D]">
        {title}
      </div>
      <StaticMapShape places={places} />
      {getMarkerPositions(places).map(({ place, index, x, y }) => (
        <a
          key={`${place.id}-${index}`}
          href={`#place-${place.id}`}
          className="absolute z-20 inline-flex h-[42px] w-9 translate-x-[-50%] translate-y-[-100%] rotate-[-45deg] items-start justify-center rounded-[999px_999px_999px_0] border-[3px] border-white pt-1 text-[11px] font-black text-white shadow-[0_8px_18px_rgba(15,58,66,0.2)]"
          style={{ left: `${x}%`, top: `${y}%`, background: "var(--marker-color)" }}
          title={place.name}
        >
          <span className="flex rotate-45 flex-col items-center leading-none">
            <span className="text-[9px] opacity-90"><CategorySymbol label={firstMeta.label} /></span>
            <span>{index + 1}</span>
          </span>
        </a>
      ))}
    </div>
  );
}

function buildMapLegend(places) {
  return places
    .map(
      (place, index) =>
        `<li><a href="#place-${escapeHtml(place.id)}"><span>${index + 1}</span>${escapeHtml(place.name)}</a></li>`
    )
    .join("");
}

function getDestinationDescription(destination, groups) {
  const totalPlaces = groups.reduce((sum, group) => sum + group.places.length, 0);
  const categoryNames = groups.map((group) => group.label.toLowerCase()).slice(0, 4).join(", ");
  const baseDescription = destination?.summary || destination?.area || "";

  if (baseDescription) {
    return baseDescription;
  }

  return `${destination?.name || "Ta destynacja"} zostala opracowana jako gotowy przewodnik z ${totalPlaces} miejscami pogrupowanymi wedlug kategorii. W srodku znajdziesz najwazniejsze punkty, zdjecia, praktyczne informacje oraz osobne mapki dla kategorii takich jak ${categoryNames || "najciekawsze miejsca"}.`;
}

function getCategorySummary(group, destination) {
  const names = group.places.slice(0, 3).map((place) => place.name).join(", ");
  const countText =
    group.places.length === 1
      ? "1 miejsce"
      : `${group.places.length} miejsc`;

  return `W kategorii ${group.label.toLowerCase()} przygotowano ${countText} dla destynacji ${destination.name}. Zacznij od mapki z numerami, a potem przejdz przez kolejne opisy miejsc${names ? `, w tym ${names}` : ""}.`;
}

function buildPrintStaticMap({ title, places, color = "#008EA1", large = false }) {
  const madeiraShape = isMadeiraMap(places)
    ? `
      <svg viewBox="0 0 1000 460" class="map-outline" aria-hidden="true">
        <path d="${madeiraOutlinePath}" fill="#A9AD86" opacity=".86"></path>
        <path d="${madeiraOutlinePath}" fill="none" stroke="#97A07A" stroke-width="2" opacity=".5"></path>
        <path d="M170 260 C260 230 338 214 430 206 C552 195 648 180 812 142" fill="none" stroke="#DDE6D7" stroke-width="3" opacity=".6"></path>
        <path d="M304 85 C318 142 330 185 366 232 C407 286 472 304 552 342" fill="none" stroke="#DDE6D7" stroke-width="3" opacity=".55"></path>
        <path d="M642 104 C608 160 598 220 622 284 C640 331 676 357 726 381" fill="none" stroke="#DDE6D7" stroke-width="2.5" opacity=".45"></path>
      </svg>
    `
    : `
      <div class="map-coast map-coast-a"></div>
      <div class="map-coast map-coast-b"></div>
      <div class="map-road map-road-a"></div>
      <div class="map-road map-road-b"></div>
      <div class="map-road map-road-c"></div>
    `;

  return `
    <div class="static-map ${large ? "static-map-large" : ""}" style="--marker-color:${escapeHtml(color)}">
      <div class="map-title">${escapeHtml(title)}</div>
      ${madeiraShape}
      ${buildPrintMapMarkers(places)}
    </div>
  `;
}

function buildPlaceDetails(place) {
  const rows = [
    ["Dojazd", place.access || place.transport || ""],
    ["Bilety", place.ticket || ""],
    ["Rezerwacja", place.reservation || ""],
    ["Platnosc", place.paid || ""],
    ["Czas", formatDuration(place)],
    ["Dystans", formatDistance(place)],
  ].filter(([, value]) => value);

  if (!rows.length) return "";

  return `
    <div class="info-grid">
      ${rows
        .map(
          ([label, value]) => `
            <div>
              <strong>${escapeHtml(label)}</strong>
              <span>${escapeHtml(value)}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function exportEditorPagesToPdf({ destination, pages }) {
  const printable = window.open("", "_blank", "width=1200,height=900");
  if (!printable) return;

  const pagesMarkup = pages
    .map(
      (page) => `
        <section id="${escapeHtml(page.id)}" class="editor-print-page">
          ${page.blocks
            .map((block) => {
              const style = `left:${block.x}%;top:${block.y}%;width:${block.w}%;height:${block.h}%;`;
              if (block.type === "image") {
                return `<div class="editor-block" style="${style}">${block.src ? `<img src="${escapeHtml(block.src)}" alt="" />` : ""}</div>`;
              }
              if (block.type === "map") {
                return `<div class="editor-block" style="${style}">${buildPrintStaticMap({
                  title: block.text,
                  places: block.places || [],
                  color: block.color,
                })}</div>`;
              }
              return `<div class="editor-block editor-text" style="${style}">${block.text || ""}</div>`;
            })
            .join("")}
        </section>
      `
    )
    .join("");

  printable.document.write(`
    <html>
      <head>
        <title>Przewodnik ${escapeHtml(destination?.name || "")}</title>
        <style>
          @page { size: A4; margin: 0; }
          * { box-sizing: border-box; }
          body { margin: 0; background: white; color: #132334; font-family: Inter, Arial, sans-serif; }
          .editor-print-page { width: 210mm; height: 297mm; page-break-after: always; position: relative; overflow: hidden; background: white; }
          .editor-block { position: absolute; overflow: hidden; }
          .editor-block img { width: 100%; height: 100%; object-fit: cover; display: block; }
          .editor-text { padding: 2mm; line-height: 1.65; color: #132334; overflow: visible; }
          .editor-text a { color: #008ea1; text-decoration: none; }
          .static-map { position: relative; width: 100%; height: 100%; overflow: hidden; border: 1px solid #dcecf0; background: linear-gradient(135deg,#e8f4f6 0%,#f8fcfd 58%,#dcecf0 100%); }
          .map-outline { position: absolute; inset: 7%; width: 86%; height: 86%; overflow: visible; }
          .map-title { position:absolute; left: 12px; top: 12px; z-index: 3; border:1px solid rgba(220,236,240,.9); background: rgba(255,255,255,.86); padding: 8px 10px; font-size: 10px; letter-spacing:.16em; text-transform: uppercase; color:#52616d; }
          .map-coast { position:absolute; border-radius:50%; background: rgba(0,142,161,.08); }
          .map-coast-a { width: 75%; height: 42%; left:-18%; top:58%; transform: rotate(-10deg); }
          .map-coast-b { width: 48%; height: 28%; right:-14%; top:-4%; transform: rotate(18deg); background: rgba(95,122,69,.08); }
          .map-road { position:absolute; height: 2px; background: rgba(82,97,109,.16); transform-origin:left center; }
          .map-road-a { width: 78%; left: 10%; top: 44%; transform: rotate(-14deg); }
          .map-road-b { width: 70%; left: 17%; top: 62%; transform: rotate(12deg); }
          .map-road-c { width: 50%; left: 34%; top: 30%; transform: rotate(38deg); }
          .map-marker { position: absolute; z-index: 4; transform: translate(-50%,-100%); display: inline-flex; width: 34px; height: 42px; align-items: flex-start; justify-content:center; padding-top: 4px; border-radius: 999px 999px 999px 0; background: var(--marker-color,#008ea1); color: white; border: 3px solid white; font-size: 11px; font-weight: 800; box-shadow: 0 8px 18px rgba(15,58,66,.2); rotate: -45deg; text-decoration: none; }
          .map-marker i { display:flex; flex-direction:column; align-items:center; font-style: normal; line-height: .95; rotate: 45deg; }
          .map-marker b { font-size: 9px; line-height: 1; opacity: .9; }
        </style>
      </head>
      <body>${pagesMarkup}</body>
    </html>
  `);
  printable.document.close();
  printable.focus();
  printable.print();
}

function createEditorBlock(type, overrides = {}) {
  return {
    id: `block-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    x: 8,
    y: 8,
    w: 84,
    h: 18,
    text: "",
    src: "",
    color: "#008EA1",
    places: [],
    ...overrides,
  };
}

function createGuideEditorPages({ country, destination, groups, places, coverImage, destinationDescription }) {
  const pages = [
    {
      id: "cover",
      title: "Okladka",
      blocks: [
        createEditorBlock("image", { x: 0, y: 0, w: 100, h: 100, src: coverImage }),
        createEditorBlock("text", {
          x: 8,
          y: 8,
          w: 70,
          h: 20,
          text: `<p style="letter-spacing:.22em;text-transform:uppercase;font-size:28px;margin:0;">Przewodnik</p><div style="width:80px;height:4px;background:#008EA1;margin-top:22px;"></div>`,
        }),
        createEditorBlock("text", {
          x: 8,
          y: 64,
          w: 84,
          h: 24,
          text: `<h1 style="font-size:82px;line-height:.9;margin:0;color:rgba(215,227,234,.86);text-transform:uppercase;">${escapeHtml(destination.name)}</h1><p style="font-family:Georgia,serif;font-size:26px;margin:18px 0 0;color:#3F4D56;">${escapeHtml(country.countryName)} / przewodnik do druku</p>`,
        }),
      ],
    },
    {
      id: "toc",
      title: "Spis tresci",
      blocks: [
        createEditorBlock("text", {
          x: 10,
          y: 13,
          w: 80,
          h: 74,
          text: `<h2 style="font-family:Georgia,serif;font-size:48px;margin:0 0 22px;">Spis tresci</h2><div style="width:64px;height:4px;background:#008EA1;margin-bottom:24px;"></div>${[
            `<p><a href="#guide-destination"><strong>00</strong> O destynacji</a></p>`,
            ...groups.map(
              (group, index) =>
                `<p><a href="#chapter-${group.key}"><strong>${String(index + 1).padStart(2, "0")}</strong> ${escapeHtml(group.label)} / ${group.places.length} miejsc</a></p>`
            ),
          ].join("")}`,
        }),
      ],
    },
    {
      id: "destination",
      title: "O destynacji",
      blocks: [
        createEditorBlock("text", {
          x: 9,
          y: 8,
          w: 82,
          h: 28,
          text: `<p style="letter-spacing:.2em;text-transform:uppercase;color:#008EA1;font-weight:800;">O destynacji</p><h2 style="font-family:Georgia,serif;font-size:48px;margin:10px 0 18px;">${escapeHtml(destination.name)}</h2><p>${textToHtml(destinationDescription)}</p>`,
        }),
        createEditorBlock("map", {
          x: 9,
          y: 41,
          w: 82,
          h: 36,
          text: `${country.countryName} / ${destination.name}`,
          places,
          color: "#008EA1",
        }),
        createEditorBlock("text", {
          x: 9,
          y: 79,
          w: 82,
          h: 14,
          text: places
            .map((place, index) => `<a href="#place-${place.id}">${index + 1}. ${escapeHtml(place.name)}</a>`)
            .join("<br />"),
        }),
      ],
    },
  ];

  groups.forEach((group, groupIndex) => {
    pages.push({
      id: `chapter-${group.key}`,
      title: group.label,
      blocks: [
        createEditorBlock("image", { x: 0, y: 0, w: 100, h: 100, src: getPlacePrimaryImage(group.places[0]) }),
        createEditorBlock("text", {
          x: 9,
          y: 62,
          w: 78,
          h: 28,
          text: `<p style="letter-spacing:.18em;color:#B8F3F8;">${String(groupIndex + 1).padStart(2, "0")}</p><h2 style="font-family:Georgia,serif;font-size:58px;margin:12px 0;color:white;">${escapeHtml(group.label)}</h2><p style="color:white;">${escapeHtml(getCategorySummary(group, destination))}</p>`,
        }),
      ],
    });

    pages.push({
      id: `map-${group.key}`,
      title: `Mapa / ${group.label}`,
      blocks: [
        createEditorBlock("text", {
          x: 9,
          y: 8,
          w: 82,
          h: 14,
          text: `<p style="letter-spacing:.2em;text-transform:uppercase;color:#008EA1;font-weight:800;">Mapa kategorii</p><h2 style="font-family:Georgia,serif;font-size:46px;margin:8px 0;">${escapeHtml(group.label)}</h2>`,
        }),
        createEditorBlock("map", { x: 9, y: 25, w: 82, h: 52, text: `${destination.name} / ${group.label}`, places: group.places, color: group.color }),
        createEditorBlock("text", {
          x: 9,
          y: 80,
          w: 82,
          h: 14,
          text: group.places
            .map((place, index) => `<a href="#place-${place.id}">${index + 1}. ${escapeHtml(place.name)}</a>`)
            .join("<br />"),
        }),
      ],
    });

    group.places.forEach((place, placeIndex) => {
      const sideImage = placeIndex % 3 === 1;
      pages.push({
        id: `place-${place.id}`,
        title: place.name,
        blocks: [
          createEditorBlock("text", {
            x: 8,
            y: 7,
            w: 84,
            h: 16,
            text: `<p style="letter-spacing:.2em;text-transform:uppercase;color:#008EA1;font-weight:800;">${escapeHtml(group.singular)}</p><h2 style="font-family:Georgia,serif;font-size:40px;margin:8px 0;">${escapeHtml(place.name)}</h2>`,
          }),
          createEditorBlock("image", {
            x: sideImage ? 56 : 8,
            y: sideImage ? 25 : 24,
            w: sideImage ? 36 : 84,
            h: sideImage ? 46 : 32,
            src: getPlacePrimaryImage(place),
          }),
          createEditorBlock("text", {
            x: 8,
            y: sideImage ? 25 : 59,
            w: sideImage ? 44 : 58,
            h: sideImage ? 56 : 30,
            text: `<p>${textToHtml(place.description || place.note || place.subtitle || place.info || "")}</p>`,
          }),
          createEditorBlock("map", { x: 68, y: 59, w: 24, h: 18, text: place.name, places: [place], color: group.color }),
        ],
      });
    });
  });

  return pages;
}

function GuideEditorBlock({
  block,
  selected,
  onSelect,
  onChange,
  onRemove,
}) {
  const startDrag = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    const page = event.currentTarget.closest("[data-editor-page]");
    if (!page) return;
    const rect = page.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = { x: block.x, y: block.y };

    const move = (moveEvent) => {
      const dx = ((moveEvent.clientX - startX) / rect.width) * 100;
      const dy = ((moveEvent.clientY - startY) / rect.height) * 100;
      onChange({
        ...block,
        x: Math.min(Math.max(initial.x + dx, 0), 100 - block.w),
        y: Math.min(Math.max(initial.y + dy, 0), 100 - block.h),
      });
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  const startResize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    const page = event.currentTarget.closest("[data-editor-page]");
    if (!page) return;
    const rect = page.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = { w: block.w, h: block.h };

    const move = (moveEvent) => {
      const dw = ((moveEvent.clientX - startX) / rect.width) * 100;
      const dh = ((moveEvent.clientY - startY) / rect.height) * 100;
      onChange({
        ...block,
        w: Math.min(Math.max(initial.w + dw, 8), 100 - block.x),
        h: Math.min(Math.max(initial.h + dh, 6), 100 - block.y),
      });
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  return (
    <div
      className={cn(
        "group absolute overflow-hidden border bg-white/0",
        selected ? "border-[#008EA1] shadow-[0_0_0_2px_rgba(0,142,161,0.18)]" : "border-transparent hover:border-[#8EDAE3]"
      )}
      style={{
        left: `${block.x}%`,
        top: `${block.y}%`,
        width: `${block.w}%`,
        height: `${block.h}%`,
      }}
      onMouseDown={onSelect}
    >
      {block.type === "image" ? (
        block.src ? (
          <img src={block.src} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-[#F6FBFC] text-sm text-[#61717D]">Brak zdjecia</div>
        )
      ) : block.type === "map" ? (
        <StaticGuideMap title={block.text} places={block.places} color={block.color} className="h-full w-full" />
      ) : (
        <div
          className="h-full w-full overflow-auto p-2 text-[#132334] outline-none"
          contentEditable
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: block.text }}
          onBlur={(event) => onChange({ ...block, text: event.currentTarget.innerHTML })}
        />
      )}

      <button
        type="button"
        onPointerDown={startDrag}
        className="absolute left-1 top-1 hidden h-7 w-7 items-center justify-center rounded-full bg-[#008EA1] text-white shadow group-hover:flex"
        title="Przesun blok"
      >
        <MousePointer2 className="h-3.5 w-3.5" />
      </button>
      {selected ? (
        <>
          <button
            type="button"
            onClick={onRemove}
            className="absolute right-1 top-1 h-7 rounded-full bg-white px-2 text-xs font-bold text-[#8C4C43] shadow"
          >
            Usun
          </button>
          <button
            type="button"
            onPointerDown={startResize}
            className="absolute bottom-1 right-1 h-5 w-5 rounded-sm bg-[#008EA1] shadow"
            title="Zmien rozmiar"
          />
        </>
      ) : null}
    </div>
  );
}

function GuideEditor({ pages, selectedBlockId, onSelectBlock, onUpdateBlock, onRemoveBlock }) {
  const handleDrop = async (event, pageId) => {
    event.preventDefault();
    const file = [...(event.dataTransfer.files || [])].find((item) =>
      item.type?.startsWith("image/")
    );
    if (!file) return;
    const pageElement = event.currentTarget;
    const rect = pageElement.getBoundingClientRect();
    const objectUrl = URL.createObjectURL(file);
    const block = createEditorBlock("image", {
      x: Math.min(Math.max(((event.clientX - rect.left) / rect.width) * 100, 0), 80),
      y: Math.min(Math.max(((event.clientY - rect.top) / rect.height) * 100, 0), 80),
      w: 32,
      h: 22,
      src: objectUrl,
      pendingFile: file,
    });
    onUpdateBlock(pageId, block, { append: true });
    onSelectBlock(block.id);
  };

  return (
    <div className="mx-auto flex max-w-[980px] flex-col gap-7">
      {pages.map((page) => (
        <section
          key={page.id}
          id={`editor-${page.id}`}
          data-editor-page={page.id}
          className="relative aspect-[210/297] overflow-hidden rounded-[0.45rem] border border-[#DDEDF0] bg-white shadow-[0_18px_50px_rgba(15,58,66,0.08)]"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => handleDrop(event, page.id)}
        >
          {page.blocks.map((block) => (
            <GuideEditorBlock
              key={block.id}
              block={block}
              selected={selectedBlockId === block.id}
              onSelect={() => onSelectBlock(block.id)}
              onChange={(nextBlock) => onUpdateBlock(page.id, nextBlock)}
              onRemove={() => onRemoveBlock(page.id, block.id)}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function exportGuideToPdf({ country, destination, groups, coverImage }) {
  const printable = window.open("", "_blank", "width=1200,height=900");
  if (!printable) return;
  const allPlaces = groups.flatMap((group) => group.places);
  const destinationDescription = getDestinationDescription(destination, groups);
  const totalPlaces = allPlaces.length;

  const tocMarkup = groups
    .map(
      (group, index) => `
        <li>
          <span>${String(index + 1).padStart(2, "0")}</span>
          <strong><a href="#chapter-${escapeHtml(group.key)}">${escapeHtml(group.label)}</a></strong>
          <em>${group.places.length} ${group.places.length === 1 ? "miejsce" : "miejsc"}</em>
        </li>
      `
    )
    .join("");

  const categoryMarkup = groups
    .map(
      (group) => `
        <section id="chapter-${escapeHtml(group.key)}" class="print-page category-cover">
          ${getPlacePrimaryImage(group.places[0]) ? `<img src="${escapeHtml(getPlacePrimaryImage(group.places[0]))}" alt="${escapeHtml(group.label)}" />` : ""}
          <div class="category-cover-shade"></div>
          <div class="category-cover-content">
            <p class="section-number">${String(groups.findIndex((entry) => entry.key === group.key) + 1).padStart(2, "0")}</p>
            <p class="eyebrow">${escapeHtml(destination.name)}</p>
            <h2>${escapeHtml(group.label)}</h2>
            <p>${escapeHtml(getCategorySummary(group, destination))}</p>
            <div class="category-count">${group.places.length} ${group.places.length === 1 ? "miejsce" : "miejsc"}</div>
          </div>
        </section>

        <section id="map-${escapeHtml(group.key)}" class="print-page map-page">
          <p class="eyebrow">Mapa kategorii</p>
          <h2>${escapeHtml(group.label)}</h2>
          ${buildPrintStaticMap({ title: `${destination.name} / ${group.label}`, places: group.places, color: group.color, large: true })}
          <ol class="legend">${buildMapLegend(group.places)}</ol>
        </section>

        ${group.places
            .map((place, index) => {
              const image = getPlacePrimaryImage(place);
              const gallery = getPlaceGalleryImages(place).slice(0, 3);
              const layout = index % 3;
              return `
                <section id="place-${escapeHtml(place.id)}" class="print-page place-page place-layout-${layout}">
                  <div class="place-page-head">
                    <span>${String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <p>${escapeHtml(group.singular)}</p>
                      <h3>${escapeHtml(place.name)}</h3>
                    </div>
                  </div>
                  ${image ? `<img class="place-hero" src="${escapeHtml(image)}" alt="${escapeHtml(place.name)}" />` : ""}
                  <div class="place-body">
                    <div>
                      <p class="place-text">${textToHtml(place.description || place.note || place.subtitle || place.info || "")}</p>
                      ${gallery.length ? `<div class="gallery">${gallery.map((url) => `<img src="${escapeHtml(url)}" alt="${escapeHtml(place.name)}" />`).join("")}</div>` : ""}
                    </div>
                    <aside>
                      ${buildPlaceDetails(place)}
                      <div class="mini-map-wrap">
                        ${buildPrintStaticMap({ title: place.name, places: [place], color: group.color })}
                      </div>
                    </aside>
                  </div>
                </section>
              `;
            })
            .join("")}
      `
    )
    .join("");

  printable.document.write(`
    <html>
      <head>
        <title>Przewodnik ${escapeHtml(destination.name)}</title>
        <style>
          @page { size: A4; margin: 0; }
          * { box-sizing: border-box; }
          body { margin: 0; color: #132334; background: #eef6f8; font-family: Inter, Arial, sans-serif; }
          .print-page { width: 210mm; min-height: 297mm; page-break-after: always; background: #fff; padding: 18mm; position: relative; overflow: hidden; }
          .cover { display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; background: #edf5f7; }
          .cover::before { content: ""; position: absolute; inset: 0; background: ${coverImage ? `url("${escapeHtml(coverImage)}") center/cover` : "linear-gradient(135deg,#dfeff2,#ffffff)"}; opacity: .9; }
          .cover::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg,rgba(255,255,255,.8),rgba(255,255,255,.22),rgba(19,35,52,.18)); }
          .cover > * { position: relative; z-index: 1; }
          .cover .number { font-size: 20px; letter-spacing: .18em; }
          .cover .type { margin-top: 28px; font-size: 22px; letter-spacing: .24em; text-transform: uppercase; }
          .cover .line { display: block; width: 56px; height: 4px; margin-top: 24px; background: #008ea1; }
          .cover h1 { margin: 0; font-size: 82px; line-height: .9; text-transform: uppercase; color: rgba(86,113,129,.34); }
          .cover .sub { margin-top: 18px; font-family: Georgia, serif; font-size: 24px; letter-spacing: .08em; color: #3f4d56; }
          .eyebrow { margin: 0 0 12px; font-size: 11px; font-weight: 800; letter-spacing: .22em; text-transform: uppercase; color: #008ea1; }
          h2 { margin: 0 0 20px; font-family: Georgia, serif; font-size: 34px; font-weight: 500; color: #132334; }
          .lead { max-width: 146mm; font-size: 16px; line-height: 1.85; color: #52616d; }
          .toc-page { display: flex; flex-direction: column; justify-content: center; }
          .toc { list-style: none; margin: 34px 0 0; padding: 0; border-top: 1px solid #dcecf0; }
          .toc li { display: grid; grid-template-columns: 54px 1fr auto; gap: 16px; align-items: center; padding: 15px 0; border-bottom: 1px solid #dcecf0; }
          .toc span { color: #52616d; font-weight: 700; }
          .toc strong { text-transform: uppercase; letter-spacing: .08em; }
          .toc a { color: inherit; text-decoration: none; }
          .toc em { color: #61717d; font-style: normal; }
          .destination-page { display: grid; grid-template-rows: auto 1fr auto; gap: 14mm; }
          .destination-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; }
          .destination-stats div { border: 1px solid #dcecf0; padding: 12px; background: #f8fcfd; }
          .destination-stats strong { display:block; font-size: 24px; font-family: Georgia, serif; }
          .destination-stats span { display:block; margin-top: 4px; color:#61717d; font-size: 11px; text-transform: uppercase; letter-spacing: .16em; }
          .category-cover { padding: 0; color: #fff; display: flex; align-items: flex-end; }
          .category-cover img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
          .category-cover-shade { position: absolute; inset: 0; background: linear-gradient(180deg,rgba(19,35,52,.06),rgba(19,35,52,.78)); }
          .category-cover-content { position: relative; z-index: 1; padding: 22mm; max-width: 170mm; }
          .category-cover h2 { color: #fff; font-size: 44px; margin: 0 0 14px; }
          .category-cover p { line-height: 1.8; color: rgba(255,255,255,.9); }
          .section-number { font-size: 22px; letter-spacing: .18em; }
          .category-count { display: inline-flex; margin-top: 18px; border: 1px solid rgba(255,255,255,.5); padding: 8px 12px; letter-spacing: .14em; text-transform: uppercase; font-size: 11px; }
          .place-page-head { display: flex; gap: 14px; align-items: flex-start; }
          .place-page-head > span { display: inline-flex; width: 40px; height: 40px; border-radius: 999px; align-items: center; justify-content: center; background: #eafbfd; color: #008ea1; font-weight: 800; }
          .place-page-head p { margin: 0; font-size: 10px; letter-spacing: .2em; text-transform: uppercase; color: #008ea1; font-weight: 800; }
          .place-page-head h3 { margin: 6px 0 0; font-family: Georgia, serif; font-size: 32px; font-weight: 500; }
          .place-page { overflow: visible; break-after: page; }
          .place-hero { width: 100%; height: 104mm; object-fit: cover; margin-top: 12mm; display: block; }
          .place-layout-1 .place-hero { float: right; width: 78mm; height: 150mm; margin: 0 0 8mm 10mm; }
          .place-layout-1 .place-body { display: block; }
          .place-layout-1 aside { clear: both; display: grid; grid-template-columns: 1fr 58mm; gap: 8mm; margin-top: 8mm; }
          .place-layout-2 .place-hero { height: 86mm; margin-top: 8mm; }
          .place-layout-2 .place-body { grid-template-columns: 58mm 1fr; }
          .place-layout-2 .place-body aside { order: -1; }
          .place-body { display: grid; grid-template-columns: 1fr 58mm; gap: 10mm; margin-top: 10mm; }
          .place-text { margin: 0; line-height: 1.75; color: #52616d; font-size: 14px; }
          .info-grid { display: grid; grid-template-columns: 1fr; gap: 8px; }
          .info-grid div { border: 1px solid #dcecf0; padding: 9px; background: #f8fcfd; }
          .info-grid strong { display: block; font-size: 10px; letter-spacing: .18em; text-transform: uppercase; color: #008ea1; }
          .info-grid span { display: block; margin-top: 5px; color: #52616d; }
          .gallery { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-top: 12px; }
          .gallery img { width: 100%; height: 88px; object-fit: cover; }
          .static-map { position: relative; height: 58mm; overflow: hidden; border: 1px solid #dcecf0; background: linear-gradient(135deg,#e8f4f6 0%,#f8fcfd 58%,#dcecf0 100%); }
          .static-map-large { height: 166mm; margin-top: 12mm; }
          .map-outline { position: absolute; inset: 7%; width: 86%; height: 86%; overflow: visible; }
          .map-title { position:absolute; left: 12px; top: 12px; z-index: 3; border:1px solid rgba(220,236,240,.9); background: rgba(255,255,255,.86); padding: 8px 10px; font-size: 10px; letter-spacing:.16em; text-transform: uppercase; color:#52616d; }
          .map-coast { position:absolute; border-radius:50%; background: rgba(0,142,161,.08); filter: blur(.2px); }
          .map-coast-a { width: 75%; height: 42%; left:-18%; top:58%; transform: rotate(-10deg); }
          .map-coast-b { width: 48%; height: 28%; right:-14%; top:-4%; transform: rotate(18deg); background: rgba(95,122,69,.08); }
          .map-road { position:absolute; height: 2px; background: rgba(82,97,109,.16); transform-origin:left center; }
          .map-road-a { width: 78%; left: 10%; top: 44%; transform: rotate(-14deg); }
          .map-road-b { width: 70%; left: 17%; top: 62%; transform: rotate(12deg); }
          .map-road-c { width: 50%; left: 34%; top: 30%; transform: rotate(38deg); }
          .map-marker { position: absolute; z-index: 4; transform: translate(-50%,-100%); display: inline-flex; width: 34px; height: 42px; align-items: flex-start; justify-content:center; padding-top: 4px; border-radius: 999px 999px 999px 0; background: var(--marker-color,#008ea1); color: white; border: 3px solid white; font-size: 11px; font-weight: 800; box-shadow: 0 8px 18px rgba(15,58,66,.2); rotate: -45deg; text-decoration: none; }
          .map-marker i { display:flex; flex-direction:column; align-items:center; font-style: normal; line-height: .95; rotate: 45deg; }
          .map-marker b { font-size: 9px; line-height: 1; opacity: .9; }
          .legend { columns: 2; margin: 0; padding: 0; list-style: none; }
          .legend li { break-inside: avoid; display: flex; gap: 8px; margin-bottom: 8px; color: #52616d; }
          .legend a { color: inherit; display: inline-flex; gap: 8px; text-decoration: none; }
          .legend span { display: inline-flex; width: 22px; height: 22px; flex: 0 0 22px; border-radius: 999px; align-items: center; justify-content: center; background: #eafbfd; color: #008ea1; font-size: 11px; font-weight: 800; }
          @media print { body { background: white; } .print-page { box-shadow: none; } }
        </style>
      </head>
      <body>
        <section class="print-page cover">
          <div>
            <div class="number">01</div>
            <div class="type">Przewodnik</div>
            <span class="line"></span>
          </div>
          <div>
            <h1>${escapeHtml(destination.name)}</h1>
            <p class="sub">${escapeHtml(country.countryName)} / ${groups.reduce((sum, group) => sum + group.places.length, 0)} miejsc</p>
          </div>
        </section>
        <section class="print-page toc-page">
          <p class="eyebrow">Spis tresci</p>
          <h2>${escapeHtml(destination.name)}</h2>
          <ul class="toc">
            <li><span>00</span><strong><a href="#destination">O destynacji</a></strong><em>mapa i opis</em></li>
            ${tocMarkup}
          </ul>
        </section>
        <section id="destination" class="print-page destination-page">
          <div>
            <p class="eyebrow">O destynacji</p>
            <h2>${escapeHtml(destination.name)}</h2>
            <p class="lead">${textToHtml(destinationDescription)}</p>
          </div>
          ${buildPrintStaticMap({ title: `${country.countryName} / ${destination.name}`, places: allPlaces, color: "#008EA1", large: true })}
          <div>
            <div class="destination-stats">
              <div><strong>${totalPlaces}</strong><span>miejscowki</span></div>
              <div><strong>${groups.length}</strong><span>kategorie</span></div>
              <div><strong>${escapeHtml(country.countryName)}</strong><span>kraj</span></div>
            </div>
            <ol class="legend">${buildMapLegend(allPlaces)}</ol>
          </div>
        </section>
        ${categoryMarkup}
      </body>
    </html>
  `);
  printable.document.close();
  printable.focus();
  printable.print();
}

export default function GuidePanel({ countries, initialCountryId, initialDestinationId }) {
  const [selectedCountryId, setSelectedCountryId] = useState(initialCountryId || countries[0]?.id || "");
  const [selectedDestinationId, setSelectedDestinationId] = useState(
    initialDestinationId || countries[0]?.destinations?.[0]?.id || ""
  );
  const [guideMode, setGuideMode] = useState("preview");
  const [editorPages, setEditorPages] = useState([]);
  const [selectedEditorBlockId, setSelectedEditorBlockId] = useState("");
  const [guideStatus, setGuideStatus] = useState("");
  const [guideSaving, setGuideSaving] = useState(false);

  const selectedCountry = useMemo(
    () => countries.find((country) => country.id === selectedCountryId) || countries[0],
    [countries, selectedCountryId]
  );

  const selectedDestination =
    selectedCountry?.destinations?.find((destination) => destination.id === selectedDestinationId) ||
    selectedCountry?.destinations?.[0];
  const safeSelectedCountryId = selectedCountry?.id || "";
  const safeSelectedDestinationId = selectedDestination?.id || "";

  const places = useMemo(() => normalizePlaces(selectedDestination), [selectedDestination]);
  const groups = useMemo(() => groupPlacesByCategory(places), [places]);
  const coverImage = useMemo(() => getCoverImage(selectedDestination), [selectedDestination]);
  const destinationDescription = useMemo(
    () => getDestinationDescription(selectedDestination, groups),
    [selectedDestination, groups]
  );
  const imageLibrary = useMemo(
    () => uniqueImageUrls(places.flatMap((place) => getPlaceImageCandidates(place))).slice(0, 60),
    [places]
  );

  const createEditorFromCurrentGuide = () => {
    if (!selectedCountry || !selectedDestination) return;
    setEditorPages(
      createGuideEditorPages({
        country: selectedCountry,
        destination: selectedDestination,
        groups,
        places,
        coverImage,
        destinationDescription,
      })
    );
    setSelectedEditorBlockId("");
    setGuideMode("edit");
  };

  const updateEditorBlock = (pageId, nextBlock, options = {}) => {
    setEditorPages((current) =>
      current.map((page) =>
        page.id === pageId
          ? {
              ...page,
              blocks: options.append
                ? [...page.blocks, nextBlock]
                : page.blocks.map((block) =>
                    block.id === nextBlock.id ? nextBlock : block
                  ),
            }
          : page
      )
    );
  };

  const removeEditorBlock = (pageId, blockId) => {
    setEditorPages((current) =>
      current.map((page) =>
        page.id === pageId
          ? { ...page, blocks: page.blocks.filter((block) => block.id !== blockId) }
          : page
      )
    );
    setSelectedEditorBlockId("");
  };

  const addBlockToFirstPage = (block) => {
    setEditorPages((current) => {
      if (!current.length) return current;
      const [firstPage, ...rest] = current;
      return [{ ...firstPage, blocks: [...firstPage.blocks, block] }, ...rest];
    });
    setSelectedEditorBlockId(block.id);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadSavedLayout() {
      if (!selectedDestination?.id) {
        setEditorPages([]);
        return;
      }

      setGuideStatus("");
      try {
        const layout = await fetchGuideLayout(selectedDestination.id);
        if (!cancelled && layout?.pages?.length) {
          setEditorPages(layout.pages);
        } else if (!cancelled) {
          setEditorPages([]);
        }
      } catch (error) {
        if (!cancelled) {
          setGuideStatus(error.message || "Nie udalo sie pobrac zapisanego ukladu przewodnika.");
        }
      }
    }

    loadSavedLayout();

    return () => {
      cancelled = true;
    };
  }, [selectedDestination?.id]);

  const preparePagesForSave = async () => {
    const destinationId = selectedDestination?.id;
    if (!destinationId) return editorPages;

    const preparedPages = [];
    for (const page of editorPages) {
      const nextBlocks = [];
      for (const block of page.blocks) {
        if (block.pendingFile) {
          const uploaded = await uploadGuideImage(destinationId, block.pendingFile);
          const rest = { ...block };
          delete rest.pendingFile;
          nextBlocks.push({ ...rest, src: uploaded.url });
        } else {
          const rest = { ...block };
          delete rest.pendingFile;
          nextBlocks.push(rest);
        }
      }
      preparedPages.push({ ...page, blocks: nextBlocks });
    }
    return preparedPages;
  };

  const saveEditorLayout = async () => {
    if (!selectedDestination?.id) return;
    setGuideSaving(true);
    setGuideStatus("");
    try {
      const preparedPages = await preparePagesForSave();
      const saved = await upsertGuideLayout(selectedDestination.id, preparedPages);
      setEditorPages(saved?.pages || preparedPages);
      setGuideStatus("Zapisano uklad przewodnika.");
    } catch (error) {
      setGuideStatus(error.message || "Nie udalo sie zapisac ukladu przewodnika.");
    } finally {
      setGuideSaving(false);
    }
  };

  return (
    <section className="theme-planner-shell space-y-5">
      <div className="flex flex-col gap-4 rounded-[1.25rem] border border-[#DDEDF0] bg-white p-5 shadow-[0_18px_50px_rgba(15,58,66,0.06)] xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#61717D]">Przewodnik &gt; {selectedDestination?.name || "Destynacja"}</p>
          <h1 className="mt-3 text-3xl font-bold text-[#132334] md:text-4xl">
            Przewodnik po {selectedDestination?.name || "destynacji"}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#61717D]">
            Gotowy material do druku z miejscowkami pogrupowanymi wedlug kategorii, waznymi informacjami, zdjeciami i mapkami kategorii.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-[190px_220px_auto_auto]">
          <SelectInput
            label="Kraj"
            value={safeSelectedCountryId}
            onChange={(countryId) => {
              const nextCountry = countries.find((country) => country.id === countryId) || countries[0];
              setSelectedCountryId(countryId);
              setSelectedDestinationId(nextCountry?.destinations?.[0]?.id || "");
            }}
            options={countries.map((country) => ({ value: country.id, label: country.countryName }))}
          />
          <SelectInput
            label="Destynacja"
            value={safeSelectedDestinationId}
            onChange={setSelectedDestinationId}
            options={(selectedCountry?.destinations || []).map((destination) => ({
              value: destination.id,
              label: destination.name,
            }))}
          />
          <button
            type="button"
            onClick={() =>
              selectedDestination &&
              editorPages.length
                ? exportEditorPagesToPdf({ destination: selectedDestination, pages: editorPages })
                : selectedCountry &&
                  selectedDestination &&
                  exportGuideToPdf({
                    country: selectedCountry,
                    destination: selectedDestination,
                    groups,
                    coverImage,
                  })
            }
            disabled={!groups.length}
            className="inline-flex h-12 items-center justify-center gap-2 self-end rounded-[0.85rem] border border-[#008EA1] bg-white px-4 text-sm font-bold text-[#008EA1] transition hover:bg-[#EAFBFD] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Eksportuj do PDF
          </button>
          <button
            type="button"
            onClick={editorPages.length ? () => setGuideMode((mode) => (mode === "edit" ? "preview" : "edit")) : createEditorFromCurrentGuide}
            disabled={!groups.length}
            className={cn(
              "inline-flex h-12 items-center justify-center gap-2 self-end rounded-[0.85rem] px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50",
              guideMode === "edit"
                ? "bg-[#008EA1] text-white hover:bg-[#007485]"
                : "border border-[#DDEDF0] bg-white text-[#132334] hover:bg-[#F6FBFC]"
            )}
          >
            <MousePointer2 className="h-4 w-4" />
            {guideMode === "edit" ? "Wroc do podgladu" : "Edytuj jak Canva"}
          </button>
        </div>
      </div>

      {selectedDestination && groups.length ? (
        guideMode === "edit" ? (
          <div className="rounded-[1.25rem] border border-[#DDEDF0] bg-white p-5 shadow-[0_18px_50px_rgba(15,58,66,0.06)]">
            <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#008EA1]">Tryb edycji przewodnika</p>
                <p className="mt-2 text-sm text-[#61717D]">
                  Przeciagnij zdjecie z dysku bezposrednio na kartke. Kliknij tekst, aby go edytowac. Uzyj niebieskiego uchwytu do przesuwania blokow i kwadratu w rogu do zmiany rozmiaru.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveEditorLayout}
                  disabled={guideSaving || !editorPages.length}
                  className="inline-flex h-10 items-center gap-2 rounded-[0.75rem] bg-[#008EA1] px-3 text-sm font-bold text-white hover:bg-[#007485] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {guideSaving ? "Zapisywanie..." : "Zapisz uklad"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    addBlockToFirstPage(
                      createEditorBlock("text", {
                        x: 12,
                        y: 12,
                        w: 42,
                        h: 12,
                        text: "<h3>Nowy naglowek</h3><p>Wpisz tekst...</p>",
                      })
                    )
                  }
                  className="inline-flex h-10 items-center gap-2 rounded-[0.75rem] border border-[#DDEDF0] bg-white px-3 text-sm font-bold text-[#132334] hover:bg-[#F6FBFC]"
                >
                  <Type className="h-4 w-4" />
                  Tekst
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const url = window.prompt("Wklej link");
                    if (!url) return;
                    addBlockToFirstPage(
                      createEditorBlock("text", {
                        x: 12,
                        y: 26,
                        w: 42,
                        h: 8,
                        text: `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`,
                      })
                    );
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-[0.75rem] border border-[#DDEDF0] bg-white px-3 text-sm font-bold text-[#132334] hover:bg-[#F6FBFC]"
                >
                  <LinkIcon className="h-4 w-4" />
                  Link
                </button>
                <button
                  type="button"
                  onClick={createEditorFromCurrentGuide}
                  className="inline-flex h-10 items-center gap-2 rounded-[0.75rem] border border-[#DDEDF0] bg-white px-3 text-sm font-bold text-[#132334] hover:bg-[#F6FBFC]"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Wygeneruj od nowa
                </button>
              </div>
            </div>

            {guideStatus ? (
              <div className="mb-5 rounded-[0.85rem] border border-[#DDEDF0] bg-[#F8FCFD] px-4 py-3 text-sm text-[#52616D]">
                {guideStatus}
              </div>
            ) : null}

            <div className="mb-5 rounded-[0.9rem] border border-[#DDEDF0] bg-[#F8FCFD] p-3">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#61717D]">Biblioteka zdjec z miejscowek</p>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {imageLibrary.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() =>
                      addBlockToFirstPage(
                        createEditorBlock("image", {
                          x: 12,
                          y: 38,
                          w: 42,
                          h: 22,
                          src: url,
                        })
                      )
                    }
                    className="h-20 w-28 shrink-0 overflow-hidden rounded-[0.7rem] border border-[#DDEDF0] bg-white"
                    title="Dodaj zdjecie na pierwsza strone"
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
                {!imageLibrary.length ? (
                  <span className="inline-flex h-20 items-center gap-2 rounded-[0.7rem] border border-dashed border-[#DDEDF0] px-4 text-sm text-[#61717D]">
                    <ImageIcon className="h-4 w-4" />
                    Brak zdjec w bibliotece
                  </span>
                ) : null}
              </div>
            </div>

            <GuideEditor
              pages={editorPages}
              selectedBlockId={selectedEditorBlockId}
              onSelectBlock={setSelectedEditorBlockId}
              onUpdateBlock={updateEditorBlock}
              onRemoveBlock={removeEditorBlock}
            />
          </div>
        ) : (
        <div className="rounded-[1.25rem] border border-[#DDEDF0] bg-white p-5 shadow-[0_18px_50px_rgba(15,58,66,0.06)]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#008EA1]">Podglad kartek A4</p>
          <div className="mx-auto mt-5 flex max-w-[860px] flex-col gap-7">
            <section id="guide-cover" className="aspect-[210/297] overflow-hidden rounded-[0.45rem] border border-[#DDEDF0] bg-white shadow-[0_18px_50px_rgba(15,58,66,0.08)]">
              <GuideCover destination={selectedDestination} coverImage={coverImage} />
            </section>

            <section id="guide-toc" className="aspect-[210/297] rounded-[0.45rem] border border-[#DDEDF0] bg-white p-[8%] shadow-[0_18px_50px_rgba(15,58,66,0.08)]">
              <div className="flex h-full flex-col justify-center">
                <BookOpen className="h-9 w-9 text-[#A9B8C0]" />
                <h2 className="mt-7 font-serif text-5xl text-[#132334]">Spis tresci</h2>
                <span className="mt-5 block h-1 w-16 bg-[#008EA1]" />
                <div className="mt-10 divide-y divide-[#DDEDF0] border-y border-[#DDEDF0]">
                  <a href="#guide-destination" className="grid grid-cols-[42px_1fr_auto] gap-4 py-4 text-sm transition hover:bg-[#F6FBFC]">
                    <span className="font-bold text-[#52616D]">00</span>
                    <span className="font-bold uppercase tracking-[0.12em] text-[#132334]">O destynacji</span>
                    <span className="text-[#61717D]">mapa i opis</span>
                  </a>
                  {groups.map((group, index) => (
                    <a key={`preview-toc-${group.key}`} href={`#chapter-${group.key}`} className="grid grid-cols-[42px_1fr_auto] gap-4 py-4 text-sm transition hover:bg-[#F6FBFC]">
                      <span className="font-bold text-[#52616D]">{String(index + 1).padStart(2, "0")}</span>
                      <span className="font-bold uppercase tracking-[0.12em] text-[#132334]">{group.label}</span>
                      <span className="text-[#61717D]">{group.places.length} miejsc</span>
                    </a>
                  ))}
                </div>
              </div>
            </section>

            <section id="guide-destination" className="aspect-[210/297] rounded-[0.45rem] border border-[#DDEDF0] bg-white p-[8%] shadow-[0_18px_50px_rgba(15,58,66,0.08)]">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#008EA1]">O destynacji</p>
              <h2 className="mt-4 font-serif text-5xl text-[#132334]">{selectedDestination.name}</h2>
              <RichText
                text={destinationDescription}
                className="mt-6 text-base leading-8 text-[#52616D]"
                paragraphClassName="leading-8 text-[#52616D]"
                listClassName="text-[#52616D]"
              />
              <StaticGuideMap title={`${selectedCountry?.countryName} / ${selectedDestination.name}`} places={places} className="mt-8 h-[45%]" />
              <ol className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-[#52616D]">
                {places.map((place, index) => (
                  <li key={`dest-legend-${place.id}`} className="flex gap-2">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EAFBFD] text-xs font-black text-[#008EA1]">{index + 1}</span>
                    <a href={`#place-${place.id}`} className="transition hover:text-[#008EA1]">{place.name}</a>
                  </li>
                ))}
              </ol>
            </section>

            {groups.map((group, groupIndex) => {
              const image = getPlacePrimaryImage(group.places[0]);
              return (
                <div key={`chapter-preview-${group.key}`} className="contents">
                  <section id={`chapter-${group.key}`} className="relative aspect-[210/297] overflow-hidden rounded-[0.45rem] border border-[#DDEDF0] bg-[#132334] shadow-[0_18px_50px_rgba(15,58,66,0.08)]">
                    {image ? <img src={image} alt={group.label} className="absolute inset-0 h-full w-full object-cover" /> : null}
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(19,35,52,0.04)_0%,rgba(19,35,52,0.78)_100%)]" />
                    <div className="relative z-10 flex h-full flex-col justify-end p-[8%] text-white">
                      <p className="text-xl tracking-[0.18em]">{String(groupIndex + 1).padStart(2, "0")}</p>
                      <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-[#B8F3F8]">{selectedDestination.name}</p>
                      <h2 className="mt-4 font-serif text-6xl text-white">{group.label}</h2>
                      <p className="mt-6 max-w-2xl text-base leading-8 text-white/90">{getCategorySummary(group, selectedDestination)}</p>
                    </div>
                  </section>

                  <section id={`map-${group.key}`} className="aspect-[210/297] rounded-[0.45rem] border border-[#DDEDF0] bg-white p-[8%] shadow-[0_18px_50px_rgba(15,58,66,0.08)]">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#008EA1]">Mapa kategorii</p>
                    <h2 className="mt-4 font-serif text-5xl text-[#132334]">{group.label}</h2>
                    <StaticGuideMap title={`${selectedDestination.name} / ${group.label}`} places={group.places} color={group.color} className="mt-8 h-[58%]" />
                    <ol className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-[#52616D]">
                      {group.places.map((place, index) => (
                        <li key={`legend-${group.key}-${place.id}`} className="flex gap-2">
                          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EAFBFD] text-xs font-black text-[#008EA1]">{index + 1}</span>
                          <a href={`#place-${place.id}`} className="transition hover:text-[#008EA1]">{place.name}</a>
                        </li>
                      ))}
                    </ol>
                  </section>

                  {group.places.map((place, placeIndex) => {
                    const placeImage = getPlacePrimaryImage(place);
                    const gallery = getPlaceGalleryImages(place).slice(0, 3);
                    const layoutClass =
                      placeIndex % 3 === 1
                        ? "lg:grid-cols-[0.92fr_1.08fr]"
                        : placeIndex % 3 === 2
                          ? "lg:grid-cols-[1.08fr_0.92fr]"
                          : "lg:grid-cols-1";
                    return (
                      <section key={`place-page-${place.id}`} id={`place-${place.id}`} className="min-h-[min(1180px,calc((100vw-2rem)*1.414))] rounded-[0.45rem] border border-[#DDEDF0] bg-white p-[8%] shadow-[0_18px_50px_rgba(15,58,66,0.08)]">
                        <div className="flex gap-4">
                          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EAFBFD] font-black text-[#008EA1]">{placeIndex + 1}</span>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#008EA1]">{group.singular}</p>
                            <h2 className="mt-2 font-serif text-4xl text-[#132334]">{place.name}</h2>
                          </div>
                        </div>
                        <div className={cn("mt-8 grid gap-7", layoutClass)}>
                          {placeImage ? (
                            <img
                              src={placeImage}
                              alt={place.name}
                              className={cn(
                                "w-full object-cover",
                                placeIndex % 3 === 1 ? "h-[560px] lg:order-2" : placeIndex % 3 === 2 ? "h-[420px]" : "h-[440px]"
                              )}
                            />
                          ) : null}
                          <div>
                            <RichText
                              text={place.description || place.note || place.subtitle || place.info}
                              className="text-sm leading-7 text-[#52616D]"
                              paragraphClassName="leading-7 text-[#52616D]"
                              listClassName="text-[#52616D]"
                            />
                            {gallery.length ? (
                              <div className="mt-5 grid grid-cols-3 gap-2">
                                {gallery.map((url) => (
                                  <img key={url} src={url} alt={place.name} className="h-24 w-full object-cover" />
                                ))}
                              </div>
                            ) : null}
                            <aside className="mt-6 grid gap-4 lg:grid-cols-[1fr_230px]">
                            <div className="grid gap-2">
                              {[
                                ["Bilety", place.ticket],
                                ["Rezerwacja", place.reservation],
                                ["Platnosc", place.paid],
                                ["Czas", formatDuration(place)],
                                ["Dystans", formatDistance(place)],
                              ]
                                .filter(([, value]) => value)
                                .map(([label, value]) => (
                                  <div key={label} className="border border-[#DDEDF0] bg-[#F8FCFD] p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#008EA1]">{label}</p>
                                    <p className="mt-1 text-sm text-[#52616D]">{value}</p>
                                  </div>
                                ))}
                            </div>
                            <StaticGuideMap title={place.name} places={[place]} color={group.color} className="mt-4 h-48" />
                          </aside>
                          </div>
                        </div>
                      </section>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        )
      ) : (
        <div className="rounded-[1.25rem] border border-dashed border-[#DDEDF0] bg-white px-6 py-12 text-center text-sm text-[#61717D]">
          Dla tej destynacji nie ma jeszcze miejscowek z koordynatami, z ktorych mozna zlozyc przewodnik.
        </div>
      )}
    </section>
  );
}
