import geometryData from '../data/rv-park-campsite-geometry.json';

export type RvRect = { x: number; y: number; w: number; h: number };

export type RvParkSite = {
  SITE_ID: string;
  ROW: string | null;
  NUMBER: number | null;
  KIND?: 'campsite' | 'office' | 'dump';
  search_aliases?: string[];
  GEOMETRY: {
    space: string;
    image_size: number[];
    rect?: number[];
    rect_pct: RvRect;
    label_center_pct?: { x: number; y: number };
  };
  SOURCE_CONFIDENCE: string;
  label_instances?: number;
};

type GeometryFile = {
  source_pdf: string;
  base_image: string;
  image_size: number[];
  total_campsites: number;
  irregular: Record<string, unknown>;
  sites: RvParkSite[];
  landmarks: RvParkSite[];
  non_searchable: string[];
};

const data = geometryData as GeometryFile;

export const RV_PARK_MAP = {
  imageWidth: data.image_size[0],
  imageHeight: data.image_size[1],
  assetPath: '../../assets/images/rv-park-detail-map.png',
  coordinateSpace: 'percent' as const,
};

export const RV_PARK_IRREGULAR = data.irregular;
export const RV_PARK_NON_SEARCHABLE = data.non_searchable;
export const RV_PARK_CAMPSITES: RvParkSite[] = data.sites.map((site) => ({
  ...site,
  KIND: 'campsite' as const,
}));
export const RV_PARK_LANDMARKS: RvParkSite[] = data.landmarks;
export const RV_PARK_ALL_PLACES: RvParkSite[] = [...RV_PARK_CAMPSITES, ...RV_PARK_LANDMARKS];

const byId = new Map(RV_PARK_ALL_PLACES.map((site) => [site.SITE_ID, site]));

export function getRvParkSite(id: string): RvParkSite | undefined {
  return byId.get(id);
}

export function rvParkSiteRect(site: RvParkSite): RvRect {
  return site.GEOMETRY.rect_pct;
}

export const RV_PARK_UNIQUE_SITE_IDS = RV_PARK_CAMPSITES.map((s) => s.SITE_ID);
export const RV_PARK_TOTAL_CAMPSITES = data.total_campsites;
