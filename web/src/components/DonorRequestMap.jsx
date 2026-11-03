import { useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cx } from "../utils/cx";
import { Icon } from "./Icon";
import { asPoint } from "../utils/geo";
import { requestDistance } from "../utils/donorRequests";

const donorIcon = L.divIcon({
  className: "donation-map-person",
  html: "<span></span>",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});
const hospitalIcon = L.divIcon({
  className: "donation-map-hospital",
  html: "<span>+</span>",
  iconSize: [32, 36],
  iconAnchor: [16, 34],
});
function MapControls({ position, pins, expanded, onExpand }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => ({
    level: map.getZoom(),
    min: map.getMinZoom(),
    max: map.getMaxZoom(),
  }));
  const syncZoom = () =>
    setZoom({
      level: map.getZoom(),
      min: map.getMinZoom(),
      max: map.getMaxZoom(),
    });
  useMapEvents({ zoomend: syncZoom, zoomlevelschange: syncZoom });
  useEffect(syncZoom, [map]);
  const zoomOptions = () => ({
    animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  });
  const signature = pins.map((pin) => pin.key).join("|") + Boolean(position);
  useEffect(() => {
    let fitted = false;
    const resize = () => {
      if (!map.getContainer().clientWidth) return;
      map.invalidateSize();
      if (fitted) return;
      fitted = true;
      const points = pins.map((pin) => [pin.facility.lat, pin.facility.lng]);
      if (position) points.push([position.lat, position.lng]);
      if (points.length === 1) map.setView(points[0], 14);
      else if (points.length)
        map.fitBounds(points, { padding: [48, 48], maxZoom: 14 });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(map.getContainer());
    resize();
    return () => observer.disconnect();
  }, [map, signature]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => map.invalidateSize());
    return () => cancelAnimationFrame(frame);
  }, [expanded, map]);
  return (
    <div
      className="donation-map-controls"
      role="group"
      aria-label="Map controls"
    >
      <div className="donation-map-zoom" role="group" aria-label="Map zoom">
        <button
          className="btn donation-icon-button"
          type="button"
          aria-label="Zoom in on map"
          title="Zoom in"
          disabled={zoom.level >= zoom.max}
          onClick={() => map.zoomIn(1, zoomOptions())}
        >
          <Icon name="plus" size={20} />
        </button>
        <button
          className="btn donation-icon-button"
          type="button"
          aria-label="Zoom out on map"
          title="Zoom out"
          disabled={zoom.level <= zoom.min}
          onClick={() => map.zoomOut(1, zoomOptions())}
        >
          <Icon name="minus" size={20} />
        </button>
      </div>
      <button
        className="btn donation-icon-button"
        type="button"
        aria-label="Center and zoom to my location"
        title="Center and zoom to my location"
        disabled={!position}
        onClick={() => {
          map.flyTo([position.lat, position.lng], Math.max(map.getZoom(), 16), {
            duration: 0.6,
            ...zoomOptions(),
          });
        }}
      >
        <Icon name="compass" size={21} />
      </button>
      <button
        className="btn donation-icon-button"
        type="button"
        aria-label={expanded ? "Collapse map" : "Expand map"}
        title={expanded ? "Collapse map" : "Expand map"}
        aria-expanded={expanded}
        onClick={onExpand}
      >
        <Icon name={expanded ? "collapse" : "expand"} size={20} />
      </button>
    </div>
  );
}
/** `items` carries resolved facilities; `onSelect` opens the request behind a pin. */
export function DonorRequestMap({
  items,
  position,
  activeItem,
  onSelect,
  className,
  ...rest
}) {
  const [expanded, setExpanded] = useState(false),
    root = useRef(null);
  const map = useRef(null);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keydown = (event) => {
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setExpanded(false);
      }
      if (event.key === "Tab") {
        const focusable = [
          ...root.current.querySelectorAll('button,a[href],[tabindex="0"]'),
        ].filter(
          (element) => !element.disabled && element.getClientRects().length,
        );
        const first = focusable[0],
          last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", keydown);
    };
  }, [expanded]);
  const recipient =
    activeItem &&
    asPoint(
      activeItem.request.recipientLatitude,
      activeItem.request.recipientLongitude,
    );
  const pins = useMemo(() => {
    const seen = new Map();
    for (const item of items)
      if (item.facility && !seen.has(item.request.hospitalId))
        seen.set(item.request.hospitalId, {
          ...item,
          key: item.request.hospitalId,
        });
    return [...seen.values()];
  }, [items]);
  return (
    <section
      ref={root}
      className={cx("donation-map-panel", className)}
      data-expanded={expanded}
      aria-label="Request locations"
      {...rest}
    >
      <div className="donation-map-heading">
        <div>
          <p className="donation-eyebrow">A little closer</p>
          <h2>Care, around you.</h2>
        </div>
        <span className="donation-count">
          {pins.length} {pins.length === 1 ? "hospital" : "hospitals"}
        </span>
      </div>
      <div className="donation-map-canvas">
        <MapContainer
          ref={map}
          center={position ? [position.lat, position.lng] : [14.8443, 120.8114]}
          zoom={12}
          scrollWheelZoom={false}
          zoomControl={false}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapControls
            position={position}
            pins={pins}
            expanded={expanded}
            onExpand={() => setExpanded((value) => !value)}
          />
          {position && (
            <Marker position={[position.lat, position.lng]} icon={donorIcon}>
              <Popup>
                {position.source === "profile"
                  ? "Your saved location"
                  : "Your device location"}
              </Popup>
            </Marker>
          )}
          {position?.source === "approximate" && (
            <Circle
              center={[position.lat, position.lng]}
              radius={position.accuracy || 200}
              pathOptions={{ className: "donation-map-radius" }}
            />
          )}
          {recipient && (
            <Marker position={[recipient.lat, recipient.lng]} icon={donorIcon}>
              <Popup>
                Recipient area
                {activeItem.request.recipientCity
                  ? ": " + activeItem.request.recipientCity
                  : ""}
              </Popup>
            </Marker>
          )}
          {pins.map((item) => (
            <Marker
              key={item.key}
              position={[item.facility.lat, item.facility.lng]}
              icon={hospitalIcon}
              title={item.hospital?.name || item.request.hospitalName}
              eventHandlers={{
                click: () => {
                  map.current?.flyTo(
                    [item.facility.lat, item.facility.lng],
                    Math.max(map.current.getZoom(), 16),
                    {
                      duration: 0.6,
                      animate: !window.matchMedia(
                        "(prefers-reduced-motion: reduce)",
                      ).matches,
                    },
                  );
                },
              }}
            >
              <Popup autoPan={false}>
                <strong>
                  {item.hospital?.name || item.request.hospitalName}
                </strong>
                <p>{requestDistance(item.distance)}</p>
                <button
                  type="button"
                  className="btn"
                  onClick={() => onSelect(item)}
                >
                  View request
                </button>
              </Popup>
            </Marker>
          ))}
          {position && activeItem?.facility && (
            <Polyline
              positions={[
                [position.lat, position.lng],
                [activeItem.facility.lat, activeItem.facility.lng],
              ]}
              pathOptions={{
                className: "donation-map-route",
                dashArray: "5 8",
              }}
            />
          )}
        </MapContainer>
      </div>
      <p className="donation-map-caption">
        <span className="donation-location-dot" />
        {position?.source === "profile"
          ? "Using your saved profile pin"
          : position?.source === "live"
            ? "Using your precise device location"
            : position
              ? "Using an approximate device location"
              : "Save a location on your profile to see distances."}
      </p>
      {items.some((item) => !item.facility) && (
        <p className="donation-map-note">
          Some hospitals have no saved location. Their requests are still
          listed.
        </p>
      )}
    </section>
  );
}
