// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createLeafletMapProvider } from "./map-provider.js";

describe("Leaflet map provider adapter", () => {
  it("keeps provider calls and tile attribution behind one boundary", () => {
    const setView = vi.fn().mockReturnThis();
    const addTile = vi.fn();
    const bindPopup = vi.fn();
    const addMarker = vi.fn().mockReturnValue({ bindPopup });
    const leaflet = {
      map: vi.fn(() => ({ setView, remove: vi.fn() })),
      tileLayer: vi.fn(() => ({ addTo: addTile })),
      marker: vi.fn(() => ({ addTo: addMarker })),
    };
    const element = document.createElement("div");
    const provider = createLeafletMapProvider(leaflet, {
      tileUrl: "https://tiles.example/{z}/{x}/{y}.png",
      attribution: "Map data",
      zoom: 15,
    });

    provider.mount(element, {
      latitude: 10.7731,
      longitude: 106.7031,
      label: '<img src=x onerror="alert(1)">Sân Xanh',
    });

    expect(setView).toHaveBeenCalledWith([10.7731, 106.7031], 15);
    expect(leaflet.tileLayer).toHaveBeenCalledWith(
      "https://tiles.example/{z}/{x}/{y}.png",
      { attribution: "Map data" },
    );
    expect(leaflet.marker).toHaveBeenCalledWith([10.7731, 106.7031]);
    const popup = bindPopup.mock.calls[0][0];
    expect(popup).toBeInstanceOf(window.HTMLElement);
    expect(popup.textContent).toBe('<img src=x onerror="alert(1)">Sân Xanh');
    expect(popup.querySelector("img")).toBeNull();
  });
});
