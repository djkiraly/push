export type NormalizedMetrics = {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  raw: Record<string, unknown>;
};

export type FetchOutcome =
  | { ok: true; metrics: NormalizedMetrics }
  | { ok: false; error: string; permanent: boolean };
