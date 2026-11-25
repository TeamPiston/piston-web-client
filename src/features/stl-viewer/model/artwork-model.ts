export type ArtworkModelScale = [number, number, number];

export interface ArtworkModelDimensions {
  depth: number;
  height: number;
  width: number;
}

export interface ArtworkModelParams {
  color?: string;
  dimensions?: ArtworkModelDimensions;
  scale?: ArtworkModelScale;
  stlUrl?: string;
}
