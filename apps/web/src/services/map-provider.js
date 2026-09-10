import { MAP_CONFIG } from "../config/map.js";

export function createLeafletMapProvider(leaflet, config = MAP_CONFIG) {
  return {
    mount(element, location) {
      const coordinates = [location.latitude, location.longitude];
      const map = leaflet.map(element).setView(coordinates, config.zoom);
      leaflet
        .tileLayer(config.tileUrl, { attribution: config.attribution })
        .addTo(map);
      const popup = element.ownerDocument.createElement("span");
      popup.textContent = location.label;
      leaflet.marker(coordinates).addTo(map).bindPopup(popup);
      return { destroy: () => map.remove() };
    },
  };
}

export async function mountVenueMap(element, location) {
  const module = await import("leaflet");
  const leaflet = module.default ?? module;
  return createLeafletMapProvider(leaflet).mount(element, location);
}
