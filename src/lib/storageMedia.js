import { supabase } from "./supabase";

export const IMAGE_BUCKET = "travel-images";
export const VIDEO_BUCKET = "travel-videos";

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif"];
const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v"];

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

function remoteExtension(url = "", fallback = "jpg") {
  try {
    const pathname = new URL(url).pathname || "";
    const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
    return match?.[1]?.toLowerCase() || fallback;
  } catch {
    return fallback;
  }
}

export function placeFolder(countryId, destinationId, placeId) {
  return `${countryId}/${destinationId}/${placeId}`;
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

  const [{ data: imageFiles, error: imageError }, { data: videoFiles, error: videoError }] =
    await Promise.all([
      supabase.storage.from(IMAGE_BUCKET).list(folder, {
        limit: 100,
        sortBy: { column: "name", order: "asc" },
      }),
      supabase.storage.from(VIDEO_BUCKET).list(folder, {
        limit: 100,
        sortBy: { column: "name", order: "asc" },
      }),
    ]);

  if (imageError) throw imageError;
  if (videoError) throw videoError;

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

                return {
                  ...place,
                  image: media.cover?.url || media.gallery[0]?.url || place.image,
                  gallery: hasStorageImages
                    ? [media.cover?.url, ...media.gallery.map((item) => item.url)].filter(Boolean)
                    : place.gallery,
                  video: hasStorageVideos ? media.videos[0].url : place.video || null,
                  videos: hasStorageVideos
                    ? media.videos.map((item) => item.url)
                    : place.videos || [],
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
  const { cover } = await listPlaceMedia(countryId, destinationId, placeId);
  const extension = fileExtension(file.name) || "jpg";
  const path = `${folder}/cover.${extension}`;

  if (cover) {
    await supabase.storage.from(IMAGE_BUCKET).remove([cover.path]);
  }

  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || `image/${extension}`,
  });

  if (error) throw error;
}

export async function uploadGalleryFiles(countryId, destinationId, placeId, files) {
  const folder = placeFolder(countryId, destinationId, placeId);

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
  }
}

export async function uploadVideoFiles(countryId, destinationId, placeId, files) {
  const folder = placeFolder(countryId, destinationId, placeId);

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
  }
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
    } catch {
      failedUrls.push(imageUrl);
    }
  }

  return { uploadedCount, failedUrls };
}
