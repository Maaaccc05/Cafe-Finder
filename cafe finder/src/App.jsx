 import React, { useEffect, useRef, useState } from "react";

export default function App() {
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const placesServiceRef = useRef(null);
  const infoWindowRef = useRef(null);
  const [cafes, setCafes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [radius, setRadius] = useState(1500);
  const [query, setQuery] = useState("");
  const [filterOpenNow, setFilterOpenNow] = useState(false);
  const markersRef = useRef([]);
  const [center, setCenter] = useState({ lat: 37.7749, lng: -122.4194 }); // default: SF

  // Dynamically load Google Maps script
  useEffect(() => {
    if (window.google && window.google.maps) {
      initMap();
      return;
    }

    const script = document.createElement("script");
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!key) {
      console.error("GOOGLE_MAPS_API_KEY not set in .env");
      return;
    }
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => initMap();
    document.head.appendChild(script);

    return () => {
      if (script) document.head.removeChild(script);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function initMap() {
    googleMapRef.current = new window.google.maps.Map(mapRef.current, {
      center,
      zoom: 15,
      streetViewControl: false,
      mapTypeControl: false,
    });

    infoWindowRef.current = new window.google.maps.InfoWindow();
    placesServiceRef.current = new window.google.maps.places.PlacesService(
      googleMapRef.current
    );

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCenter(p);
          googleMapRef.current.setCenter(p);
          searchNearby(p);
        },
        () => {
          searchNearby(center);
        }
      );
    } else {
      searchNearby(center);
    }
  }

  function clearMarkers() {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
  }


function createMarker(place) {
  if (!place.geometry || !place.geometry.location) return;
  const marker = new window.google.maps.Marker({
    map: googleMapRef.current,
    position: place.geometry.location,
  });

  marker.addListener("click", () => {
    const mapsLink = `https://www.google.com/maps/place/?q=place_id:${place.place_id}`;
    const content = `
      <div style="max-width:240px; font-family: sans-serif;">
        <strong>${place.name}</strong><br/>
        ${place.vicinity || place.formatted_address || ""}<br/>
        Rating: ${place.rating || "N/A"} (${place.user_ratings_total || 0})<br/>
        ${place.opening_hours && place.opening_hours.isOpen() ? "Open now" : ""}<br/>
        <a href="${mapsLink}" target="_blank"
          style="display:inline-block; margin-top:6px; padding:6px 10px; background:#f59e0b; color:#fff; border-radius:6px; text-decoration:none; font-size:13px;">
          View on Maps
        </a>
      </div>
    `;
    infoWindowRef.current.setContent(content);
    infoWindowRef.current.open({ anchor: marker, map: googleMapRef.current });
  });

  markersRef.current.push(marker);
}

  function searchNearby(loc = center) {
    if (!placesServiceRef.current) return;
    setLoading(true);
    clearMarkers();

    const request = {
      location: new window.google.maps.LatLng(loc.lat, loc.lng),
      radius,
      type: "cafe",
      keyword: query || undefined,
    };

    placesServiceRef.current.nearbySearch(request, (results, status, pagination) => {
      setLoading(false);
      if (status !== window.google.maps.places.PlacesServiceStatus.OK) {
        console.error("PlacesService status:", status);
        setCafes([]);
        return;
      }

      results.forEach((r) => createMarker(r));

      let filtered = results;
      if (filterOpenNow)
        filtered = filtered.filter(
          (r) => r.opening_hours && r.opening_hours.isOpen()
        );
      setCafes(filtered);

      const bounds = new window.google.maps.LatLngBounds();
      results.forEach((r) => r.geometry && bounds.extend(r.geometry.location));
      googleMapRef.current.fitBounds(bounds);

      if (pagination && pagination.hasNextPage) {
        setTimeout(() => {
          pagination.nextPage();
        }, 2000);
      }
    });
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    searchNearby(center);
  }

  function goToPlace(place) {
    if (!place.geometry || !place.geometry.location) return;
    googleMapRef.current.panTo(place.geometry.location);
    googleMapRef.current.setZoom(17);
    const match = markersRef.current.find((m) =>
      m.getPosition().equals(place.geometry.location)
    );
    if (match) {
      window.google.maps.event.trigger(match, "click");
    }
  }

  return (
    <div className="flex h-screen font-sans bg-gray-100">
      {/* Sidebar */}
      <aside className="w-96 border-r border-gray-200 bg-white p-5 shadow-md overflow-y-auto">
        <h2 className="text-2xl font-bold text-amber-700">☕ Cafe Finder</h2>
        <p className="text-gray-500 text-sm">
          Find cafes near you using Google Maps + Places API.
        </p>

        <form onSubmit={handleSearchSubmit} className="mt-4 space-y-3">
          <input
            aria-label="Search keywords"
            placeholder="Search (e.g., latte, bakery)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
          />

          <div>
            <label className="text-sm text-gray-600">
              Radius: <span className="font-semibold">{radius} m</span>
            </label>
            <input
              type="range"
              min={200}
              max={5000}
              step={100}
              value={radius}
              onChange={(e) => setRadius(parseInt(e.target.value, 10))}
              className="w-full accent-amber-600"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-amber-600 text-white py-2 rounded-lg hover:bg-amber-700 transition"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setFilterOpenNow(false);
                setRadius(1500);
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition((pos) => {
                    const p = {
                      lat: pos.coords.latitude,
                      lng: pos.coords.longitude,
                    };
                    setCenter(p);
                    googleMapRef.current.setCenter(p);
                    searchNearby(p);
                  });
                }
              }}
              className="flex-1 bg-gray-200 py-2 rounded-lg hover:bg-gray-300 transition"
            >
              Re-center
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={filterOpenNow}
              onChange={(e) => setFilterOpenNow(e.target.checked)}
              className="accent-amber-600"
            />
            Show only open now
          </label>
        </form>

        <div className="mt-5">
          <h3 className="font-semibold text-gray-700">Results</h3>
          {loading && <div className="text-sm text-gray-500">Loading…</div>}
          {!loading && cafes.length === 0 && (
            <div className="text-sm text-gray-400 mt-2">No cafes found.</div>
          )}

          <ul className="mt-3 space-y-2">
            {cafes.map((c) => (
              <li
                key={c.place_id}
                className="p-3 bg-gray-50 rounded-lg shadow hover:bg-amber-50 cursor-pointer transition"
                onClick={() => goToPlace(c)}
              >
                <div className="flex justify-between">
                  <div>
                    <div className="font-semibold text-gray-800">{c.name}</div>
                    <div className="text-xs text-gray-500">
                      {c.vicinity || c.formatted_address}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-amber-600 font-bold">
                      {c.rating || "—"}
                    </div>
                    <div className="text-xs text-gray-400">
                      {c.user_ratings_total || 0} reviews
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <footer style={{ marginTop: 16, fontSize: 12, color: '#999', textAlign: "center" }}>
  <div>
    Built with ❤️ using Google Maps + React
  </div>
  <div>
    <a href="https://github.com/Maaaccc05" target="_blank" rel="noopener noreferrer" style={{ color: "#0077cc" }}>
      GitHub
    </a>{" | "}
    <a href="https://www.linkedin.com/in/mayuresh-kamble-79ba97306" target="_blank" rel="noopener noreferrer" style={{ color: "#0077cc" }}>
      LinkedIn
    </a>
  </div>
</footer>
      </aside>

      {/* Map */}
      <main className="flex-1 relative">
        <div ref={mapRef} className="h-full w-full" />
      </main>
    </div>
  );
}

 