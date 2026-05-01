import { supabase } from "./supabase";
import {
  buildPlannerPlanCoverCandidates,
  buildPlaceCoverCandidates,
  filterSupabaseMediaUrls,
  normalizeSupabaseMediaUrl,
} from "./mediaUrls";

export const IMAGE_BUCKET = "travel-images";
export const VIDEO_BUCKET = "travel-videos";

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif"];
const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v"];
const bucketAvailability = new Map();
const BUCKET_STATE_STORAGE_KEY = "travel-dashboard-storage-bucket-state";

function sortByName(items) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

function fileExtension(name = "") {
  const parts = name.split(".");
  return parts.length > 1 ? parts.at(-1).toLowerCase() : "";
}

function stripExtension(name = "") {
  return name.replace(/\.[^/.]+$/, "");
}

function publicUrl(bucket, path) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function versionedPublicUrl(bucket, path) {
  const baseUrl = publicUrl(bucket, path);
  if (!baseUrl) return "";
  return `${baseUrl}?v=${Date.now()}`;
}

function uniqueUrls(urls = []) {
  return [...new Set(urls.filter(Boolean))];
}

function readPersistedBucketAvailability() {
  if (typeof window === "undefined") return;

  try {
    const raw = window.sessionStorage.getItem(BUCKET_STATE_STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;

    Object.entries(parsed).forEach(([bucket, available]) => {
      if (typeof available === "boolean") {
        bucketAvailability.set(bucket, available);
      }
    });
  } catch {
    // Ignore corrupted session cache and re-detect bucket state.
  }
}

function persistBucketAvailability() {
  if (typeof window === "undefined") return;

  try {
    const payload = Object.fromEntries(bucketAvailability.entries());
    window.sessionStorage.setItem(
      BUCKET_STATE_STORAGE_KEY,
      JSON.stringify(payload)
    );
  } catch {
    // Ignore sessionStorage write failures.
  }
}

function remoteExtension(url = "", fallback = "jpg") {
  try {
    const pathname = new URL(url).pathname || "";
    const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
    return match?.[1]?.toLowerCase() || fallback;
  } catch {
    return fallback;
  }
}

function shouldDisableBucket(error) {
  const statusCode = Number(error?.statusCode || error?.status || 0);
  const message = String(error?.message || "").toLowerCase();

  return (
    statusCode === 400 ||
    statusCode === 403 ||
    statusCode === 404 ||
    message.includes("not found") ||
    message.includes("does not exist") ||
    message.includes("bucket")
  );
}

readPersistedBucketAvailability();

async function safeListBucket(bucket, folder) {
  if (!supabase) {
    return [];
  }

  if (bucketAvailability.get(bucket) === false) {
    return [];
  }

  const { data, error } = await supabase.storage.from(bucket).list(folder, {
    limit: 100,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) {
    if (shouldDisableBucket(error)) {
      bucketAvailability.set(bucket, false);
      persistBucketAvailability();
      return [];
    }

    throw error;
  }

  bucketAvailability.set(bucket, true);
  persistBucketAvailability();
  return data || [];
}

export function placeFolder(countryId, destinationId, placeId) {
  return `${countryId}/${destinationId}/${placeId}`;
}

export function plannerPlanFolder(destinationId, planId) {
  return `planner-plans/${destinationId}/${planId}`;
}

export async function listPlaceMedia(countryId, destinationId, placeId) {
  if (!supabase) {
    return {
      cover: null,
      gallery: [],
      videos: [],
    };
  }

  const folder = placeFolder(countryId, destinationId, placeId);

  const [imageFiles, videoFiles] = await Promise.all([
    safeListBucket(IMAGE_BUCKET, folder),
    safeListBucket(VIDEO_BUCKET, folder),
  ]);

  const validImages = sortByName(imageFiles || []).filter((file) =>
    IMAGE_EXTENSIONS.includes(fileExtension(file.name))
  );
  const validVideos = sortByName(videoFiles || []).filter((file) =>
    VIDEO_EXTENSIONS.includes(fileExtension(file.name))
  );

  const coverFile =
    validImages.find((file) => stripExtension(file.name) === "cover") || null;

  const galleryFiles = validImages.filter((file) => file.name !== coverFile?.name);

  return {
    cover: coverFile
      ? {
          bucket: IMAGE_BUCKET,
          name: coverFile.name,
          path: `${folder}/${coverFile.name}`,
          url: publicUrl(IMAGE_BUCKET, `${folder}/${coverFile.name}`),
        }
      : null,
    gallery: galleryFiles.map((file) => ({
      bucket: IMAGE_BUCKET,
      name: file.name,
      path: `${folder}/${file.name}`,
      url: publicUrl(IMAGE_BUCKET, `${folder}/${file.name}`),
    })),
    videos: validVideos.map((file) => ({
      bucket: VIDEO_BUCKET,
      name: file.name,
      path: `${folder}/${file.name}`,
      url: publicUrl(VIDEO_BUCKET, `${folder}/${file.name}`),
    })),
  };
}

export async function hydrateCountriesWithStorage(countries) {
  const hydratedCountries = await Promise.all(
    countries.map(async (country) => ({
      ...country,
      destinations: await Promise.all(
        country.destinations.map(async (destination) => ({
          ...destination,
          places: await Promise.all(
            destination.places.map(async (place) => {
              try {
                const media = await listPlaceMedia(country.id, destination.id, place.id);
                const hasStorageImages = Boolean(media.cover || media.gallery.length);
                const hasStorageVideos = media.videos.length > 0;
                const mergedImages = uniqueUrls([
                  normalizeSupabaseMediaUrl(place.image),
                  ...filterSupabaseMediaUrls(place.gallery),
                  media.cover?.url,
                  ...media.gallery.map((item) => item.url),
                ]);
                const mergedVideos = uniqueUrls([
                  place.video,
                  ...(Array.isArray(place.videos) ? place.videos : []),
                  ...media.videos.map((item) => item.url),
                ]);

                return {
                  ...place,
                  image: mergedImages[0] || "",
                  gallery: mergedImages,
                  video: mergedVideos[0] || null,
                  videos: mergedVideos,
                  storageMedia: media,
                };
              } catch {
                return {
                  ...place,
                  storageMedia: {
                    cover: null,
                    gallery: [],
                    videos: [],
                  },
                };
              }
            })
          ),
        }))
      ),
    }))
  );

  return hydratedCountries;
}

export async function replaceCover(countryId, destinationId, placeId, file) {
  const folder = placeFolder(countryId, destinationId, placeId);
  const extension = fileExtension(file.name) || "jpg";
  const path = `${folder}/cover.${extension}`;

  const coverPaths = IMAGE_EXTENSIONS.map((ext) => `${folder}/cover.${ext}`);

  if (coverPaths.length) {
    await supabase.storage.from(IMAGE_BUCKET).remove([...new Set(coverPaths)]);
  }

  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || `image/${extension}`,
  });

  if (error) throw error;

  return {
    bucket: IMAGE_BUCKET,
    path,
    url: versionedPublicUrl(IMAGE_BUCKET, path),
  };
}

export async function replacePlannerPlanCover(destinationId, planId, file) {
  const folder = plannerPlanFolder(destinationId, planId);
  const extension = fileExtension(file.name) || "jpg";
  const path = `${folder}/cover.${extension}`;

  const coverPaths = IMAGE_EXTENSIONS.map((ext) => `${folder}/cover.${ext}`);

  if (coverPaths.length) {
    await supabase.storage.from(IMAGE_BUCKET).remove([...new Set(coverPaths)]);
  }

  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || `image/${extension}`,
  });

  if (error) throw error;

  return {
    bucket: IMAGE_BUCKET,
    path,
    url: versionedPublicUrl(IMAGE_BUCKET, path),
  };
}

export async function uploadGalleryFiles(countryId, destinationId, placeId, files) {
  const folder = placeFolder(countryId, destinationId, placeId);
  const uploaded = [];

  for (const file of files) {
    const extension = fileExtension(file.name) || "jpg";
    const safeBase = stripExtension(file.name)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const path = `${folder}/gallery-${Date.now()}-${safeBase || "image"}.${extension}`;

    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
      contentType: file.type || `image/${extension}`,
      upsert: false,
    });

    if (error) throw error;

    uploaded.push({
      bucket: IMAGE_BUCKET,
      path,
      url: publicUrl(IMAGE_BUCKET, path),
    });
  }

  return uploaded;
}

export async function uploadVideoFiles(countryId, destinationId, placeId, files) {
  const folder = placeFolder(countryId, destinationId, placeId);
  const uploaded = [];

  for (const file of files) {
    const extension = fileExtension(file.name) || "mp4";
    const safeBase = stripExtension(file.name)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const path = `${folder}/video-${Date.now()}-${safeBase || "clip"}.${extension}`;

    const { error } = await supabase.storage.from(VIDEO_BUCKET).upload(path, file, {
      contentType: file.type || `video/${extension}`,
      upsert: false,
    });

    if (error) throw error;

    uploaded.push({
      bucket: VIDEO_BUCKET,
      path,
      url: publicUrl(VIDEO_BUCKET, path),
    });
  }

  return uploaded;
}

export async function removeStorageObject(bucket, path) {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

export async function migrateRemoteImagesToStorage(
  countryId,
  destinationId,
  placeId,
  imageUrls = []
) {
  if (!supabase) {
    return { uploadedCount: 0, failedUrls: imageUrls };
  }

  const sourceUrls = [...new Set(imageUrls.filter(Boolean))];
  if (!sourceUrls.length) {
    return { uploadedCount: 0, failedUrls: [] };
  }

  const folder = placeFolder(countryId, destinationId, placeId);
  const existingMedia = await listPlaceMedia(countryId, destinationId, placeId);
  const existingPaths = [
    existingMedia.cover?.path,
    ...existingMedia.gallery.map((item) => item.path),
  ].filter(Boolean);

  if (existingPaths.length) {
    const { error } = await supabase.storage.from(IMAGE_BUCKET).remove(existingPaths);
    if (error) throw error;
  }

  let uploadedCount = 0;
  const uploadedImages = [];
  const failedUrls = [];

  for (const [index, imageUrl] of sourceUrls.entries()) {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        failedUrls.push(imageUrl);
        continue;
      }

      const blob = await response.blob();
      const extension = remoteExtension(imageUrl);
      const path =
        index === 0
          ? `${folder}/cover.${extension}`
          : `${folder}/gallery-${index}.${extension}`;

      const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, {
        upsert: true,
        contentType: blob.type || `image/${extension}`,
      });

      if (error) {
        failedUrls.push(imageUrl);
        continue;
      }

      uploadedCount += 1;
      uploadedImages.push({
        bucket: IMAGE_BUCKET,
        path,
        url: publicUrl(IMAGE_BUCKET, path),
      });
    } catch {
      failedUrls.push(imageUrl);
    }
  }

  return { uploadedCount, failedUrls, uploadedImages };
}

export async function resolvePlaceCoverFromStorage(countryId, destinationId, placeId) {
  const candidates = buildPlaceCoverCandidates(countryId, destinationId, placeId);

  for (const url of candidates) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok) {
        return url;
      }
    } catch {
      // Ignore and continue with the next candidate.
    }
  }

  return "";
}

export async function resolvePlannerPlanCoverFromStorage(destinationId, planId) {
  const candidates = buildPlannerPlanCoverCandidates(destinationId, planId);

  for (const url of candidates) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok) {
        return url;
      }
    } catch {
      // Ignore and continue with the next candidate.
    }
  }

  return "";
}
