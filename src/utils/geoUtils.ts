/**
 * Utilitários geográficos para cálculo de coordenadas e polígonos
 */

/**
 * Gera um polígono circular suave (GeoJSON) em torno de um ponto central.
 * Utilizado como fallback caso o OpenStreetMap não retorne uma fronteira administrativa oficial.
 */
export function createCirclePolygon(lat: number, lng: number, radiusKm: number = 1.2, points: number = 24) {
  const coords: [number, number][] = [];
  const kmToLat = 1 / 110.574;
  const kmToLng = 1 / (111.320 * Math.cos((lat * Math.PI) / 180));

  for (let i = 0; i <= points; i++) {
    const angle = (i * 2 * Math.PI) / points;
    const dx = radiusKm * Math.cos(angle);
    const dy = radiusKm * Math.sin(angle);
    coords.push([lng + dx * kmToLng, lat + dy * kmToLat]);
  }

  return {
    type: 'Polygon' as const,
    coordinates: [coords]
  };
}

/**
 * Calcula a distância em linha reta (Haversine) em quilômetros entre duas coordenadas.
 */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Estima o tempo de entrega em minutos com base na distância em km (moto urbana ~ 25km/h + curvas).
 */
export function estimateMinutes(distKm: number): number {
  if (distKm <= 0.1) return 2;
  // Fator de correção de curvas urbanas ~ 1.35x distância linear
  const roadDistKm = distKm * 1.35;
  // 25 km/h = ~0.417 km por minuto + 2 minutos de manobra/semáforo
  const minutes = Math.round((roadDistKm / 25) * 60) + 2;
  return Math.max(3, minutes);
}

/**
 * Busca a rota real e tempo estimado via OpenStreetMap / OSRM público com timeout seguro.
 */
export async function fetchOsrmRoute(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number
): Promise<{ coords: [number, number][]; minutes: number; distanceKm: number } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.routes || data.routes.length === 0) return null;

    const route = data.routes[0];
    const durationSeconds = route.duration || 0;
    const distanceMeters = route.distance || 0;
    const geojsonCoords: [number, number][] = route.geometry?.coordinates || [];

    // OSRM retorna [lng, lat], o Leaflet Polyline precisa de [lat, lng]
    const leafletCoords: [number, number][] = geojsonCoords.map(([lng, lat]) => [lat, lng]);

    const minutes = Math.max(2, Math.ceil(durationSeconds / 60));
    const distanceKm = Number((distanceMeters / 1000).toFixed(1));

    return {
      coords: leafletCoords,
      minutes,
      distanceKm,
    };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

