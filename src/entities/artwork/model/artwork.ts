export interface Artwork {
  id: string;
  title: string;
  author: string;
  stlUrl: string;
}

export interface FilamentColor {
  name: string;
  value: string;
}

export interface ArtworkDetail extends Artwork {
  description: string;
  filamentColors: FilamentColor[];
  filamentUsage: {
    length: string;
    weight: string;
  };
  estimatedPrintTime: string;
}