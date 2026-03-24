// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface MapContextType {
  highlightedLocation: string | null;
  setHighlightedLocation: (locationName: string | null) => void;
}

const MapContext = createContext<MapContextType | undefined>(undefined);

export const MapProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [highlightedLocation, setHighlightedLocation] = useState<string | null>(null);

  return (
    <MapContext.Provider value={{ highlightedLocation, setHighlightedLocation }}>
      {children}
    </MapContext.Provider>
  );
};

export const useMapContext = (): MapContextType => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMapContext must be used within a MapProvider');
  }
  return context;
};

export default MapContext;
