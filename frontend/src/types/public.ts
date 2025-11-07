export interface OverviewResponse {
  kpi: {
    participants_total: number;
    partenaires_ordinaires_total: number;
    sponsors_candidats_total: number;
    investisseurs_total: number;
    sponsors_par_secteur: Record<string, number>;
  };
  seuil: {
    target: number;
    percent: number;   // peut déjà être fourni par l'API (sinon on recalcule)
    reached: boolean;
  };
  encheres: Array<{
    id?: string;
    title: string;
    sector: string;
    status: "PREPARED" | "OPEN" | "CLOSED";
    ends_at?: string | null;
    opens_on_threshold?: boolean;
    duration_days?: number;
    offers: number;
    top_amount_cents: number | null;
  }>;
  last_updated: string;
}
