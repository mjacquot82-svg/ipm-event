import { openExternalLink } from '../utils/externalLinks';
import { queueAnalyticsEvent } from './analyticsClient';
import { buildOutboundAnalyticsProperties } from './analyticsCore';

export const IPM_DESTINATIONS = {
  partners: { id: 'partners', type: 'information', url: 'https://www.plowingmatch.org/ipm2026/partners-and-sponsors/' },
  volunteer: { id: 'volunteer', type: 'registration', url: 'https://www.plowingmatch.org/ipm2026/get-involved/become-a-volunteer/' },
  exhibitor: { id: 'exhibitor', type: 'registration', url: 'https://www.plowingmatch.org/ipm2026/get-involved/become-an-exhibitor/' },
  tickets: { id: 'tickets', type: 'ticketing', url: 'https://www.tix123.com/tickets/?code=IPMRE26' },
  camping: { id: 'camping', type: 'registration', url: 'https://letscamp.ca/camps/ipm-2026' },
  merchandise: { id: 'merchandise', type: 'shopping', url: 'https://ipm26.itemorder.com/shop/home/' },
  celebration_of_excellence: { id: 'celebration_of_excellence', type: 'ticketing', url: 'https://www.zeffy.com/en-CA/ticketing/2026-ipm-celebration-of-excellence' },
  worship_service_pdf: { id: 'worship_service_pdf', type: 'information', url: 'https://www.plowingmatch.org/ipm2026/wp-content/uploads/2026/03/IPM-2026-Worship-Service.pdf' },
  show_guide: { id: 'show_guide', type: 'information', url: 'https://www.plowingmatch.org/ipm2026/wp-content/uploads/2026/08/IPM-2026-Show-Guide.pdf' },
  past_ipm_photos: { id: 'past_ipm_photos', type: 'information', url: 'https://www.plowingmatch.org/ipm2026/visitor-info/photos-of-past-ipms/' },
  faq: { id: 'faq', type: 'information', url: 'https://www.plowingmatch.org/ipm2026/visitor-info/faq/' },
  accessibility: { id: 'accessibility', type: 'information', url: 'https://www.plowingmatch.org/ipm2026/visitor-info/accessibility/' },
  jds_studio: { id: 'jds_studio', type: 'developer', url: 'https://jdsstudio.ca' },
} as const;

export type IpmDestinationId = keyof typeof IPM_DESTINATIONS;

export function trackControlledOutbound(destinationId: string, destinationType: string, source: string): void {
  void queueAnalyticsEvent('outbound_link_clicked', buildOutboundAnalyticsProperties(destinationId, destinationType, source));
}

export function openTrackedLink(destinationId: IpmDestinationId, source: string) {
  const destination = IPM_DESTINATIONS[destinationId];
  trackControlledOutbound(destination.id, destination.type, source);
  return openExternalLink(destination.url);
}
