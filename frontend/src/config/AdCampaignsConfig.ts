// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// Central Ad Campaigns Configuration
// Edit this file to control all ad content and destinations

export interface AdUnit {
  id: string;
  name: string;
  imageUrl: string | null;  // null = use placeholder
  targetUrl: string;
  placeholderText: string;
  width: number;
  height: number;
  enabled: boolean;
}

export interface AdCampaignsConfig {
  topBanner: AdUnit;
  bottomBanner: AdUnit;
  interstitial: AdUnit;
}

// ============================================
// EDIT YOUR AD CAMPAIGNS BELOW
// ============================================

const adCampaignsConfig: AdCampaignsConfig = {
  // Top Masthead Banner (320x80) - Reduced height to not cut off logo
  // Appears at the top of every screen below the status bar
  topBanner: {
    id: 'top-banner',
    name: 'Sponsor Spotlight',
    imageUrl: null,  // Set to image URL when you have sponsor artwork
    targetUrl: 'https://ipm2026.ca/sponsors',
    placeholderText: 'SPONSOR SPOTLIGHT (320x80) - CLICK HERE',
    width: 320,
    height: 80,
    enabled: true,
  },

  // Bottom Banner (320x50)
  // Appears above the tab navigation on every screen
  bottomBanner: {
    id: 'bottom-banner',
    name: 'Official Souvenirs',
    imageUrl: null,  // Set to image URL when you have artwork
    targetUrl: 'https://ipm26.itemorder.com/shop/home/',
    placeholderText: 'OFFICIAL SOUVENIRS (320x50) - CLICK HERE',
    width: 320,
    height: 50,
    enabled: true,
  },

  // Full-Screen Interstitial
  // Appears once per session when Map screen loads
  interstitial: {
    id: 'interstitial',
    name: 'Full-Screen Spotlight',
    imageUrl: null,  // Set to image URL when you have artwork
    targetUrl: 'https://www.tix123.com/tickets/?code=IPMRE26',
    placeholderText: 'FULL-SCREEN SPOTLIGHT AD\n(CLICK TO DISMISS)',
    width: 390,
    height: 844,
    enabled: true,
  },
};

export default adCampaignsConfig;
