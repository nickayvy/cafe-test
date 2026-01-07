export type GooglePlace = {
  id: string; // place_id
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string; // enum-like
  types?: string[];
};

export async function searchNearbyPlaces(params: {
  lat: number;
  lng: number;
  radiusM: number;
}) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY!;
  const url = "https://places.googleapis.com/v1/places:searchNearby";

  const body = {
    includedTypes: ["cafe"],
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: params.lat, longitude: params.lng },
        radius: params.radiusM,
      },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      // FieldMask keeps responses small + cheaper
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.types",
    },
    body: JSON.stringify(body),
    // For server routes, ensure no caching surprises:
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Places error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const places: GooglePlace[] = json.places ?? [];
  return places;
}
