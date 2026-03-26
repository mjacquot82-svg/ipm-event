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
  // Top Masthead Banner (1800x400)
  // Appears at the top of every screen below the status bar
  topBanner: {
    id: 'top-banner',
    name: 'Sponsor Spotlight',
    imageUrl: '',
    targetUrl: '',
    placeholderText: 'TOP BANNER AD (1800x400)',
    width: 1800,
    height: 400,
    enabled: true,
  },

  // Bottom Banner (1800x250)
  // Appears above the tab navigation on every screen
  bottomBanner: {
    id: 'bottom-banner',
    name: 'Official Souvenirs',
    imageUrl: '',
    targetUrl: '',
    placeholderText: 'BOTTOM BANNER AD (1800x250)',
    width: 1800,
    height: 250,
    enabled: true,
  },

  // Full-Screen Interstitial (1170x2532)
  // Appears once per session when app opens
  interstitial: {
    id: 'interstitial',
    name: 'Full-Screen Spotlight',
    imageUrl: '',
    targetUrl: '',
    placeholderText: 'FULL-SCREEN AD\n(1170x2532)\n\nTap anywhere to close',
    width: 1170,
    height: 2532,
    enabled: true,
  },
};

export default adCampaignsConfig;
