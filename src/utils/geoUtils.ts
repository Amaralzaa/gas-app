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
