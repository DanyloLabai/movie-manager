export interface MovieTextMetadataRow {
  text: string;
  metadata: unknown;
}

export interface MovieTextMetadataDistanceRow extends MovieTextMetadataRow {
  distance: number;
}

export interface MovieMetadataRow {
  metadata: unknown;
}

export interface TasteCompatibilityRow {
  countA: string;
  countB: string;
  similarity: number | null;
}

export interface UserFactSimilarityRow {
  text: string;
  similarity: number;
}

export interface GeminiEmbedResponse {
  embedding: {
    values: number[];
  };
}
