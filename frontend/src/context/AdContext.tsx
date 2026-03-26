// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AdContextType {
  hasSeenInterstitial: boolean;
  setHasSeenInterstitial: (seen: boolean) => void;
}

const AdContext = createContext<AdContextType | undefined>(undefined);

export const AdProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Session-based frequency capping for interstitial
  const [hasSeenInterstitial, setHasSeenInterstitial] = useState(false);

  return (
    <AdContext.Provider value={{ hasSeenInterstitial, setHasSeenInterstitial }}>
      {children}
    </AdContext.Provider>
  );
};

export const useAdContext = (): AdContextType => {
  const context = useContext(AdContext);
  if (!context) {
    throw new Error('useAdContext must be used within an AdProvider');
  }
  return context;
};

export default AdContext;
