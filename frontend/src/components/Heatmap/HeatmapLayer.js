import { useEffect } from 'react';
import { useMap, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

const HeatmapLayer = ({ points }) => {
  const map = useMap();
  
  useEffect(() => {
    if (!map) return;

    const canvas = document.createElement('canvas');
    canvas.willReadFrequently = true;

    const heatLayer = L.heatLayer(points, {
      radius: 40,
      blur: 20,
      maxZoom: 15,
      max: 1.0,
      minOpacity: 0.3,
      maxOpacity: 0.7,
      gradient: {
        0.2: 'rgba(0, 0, 255, 0.7)',
        0.4: 'rgba(0, 255, 255, 0.7)',
        0.6: 'rgba(255, 255, 0, 0.7)',
        0.8: 'rgba(255, 165, 0, 0.7)',
        1.0: 'rgba(255, 0, 0, 0.7)'
      },
      canvas: canvas
    }).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return (
    <TileLayer
      url={`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${process.env.REACT_APP_MAPTILER_KEY}`}
      attribution='&copy; <a href="https://www.maptiler.com/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    />
  );
};

export default HeatmapLayer; 