import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

export default defineNuxtPlugin(() => {
  // Fix Leaflet default marker icon paths broken by Vite bundling.
  // Leaflet resolves icon URLs from CSS background-image which breaks
  // in production builds. Importing the images lets Vite hash and
  // bundle them correctly.
  // @ts-expect-error - patching internal Leaflet prototype
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
  })
})
