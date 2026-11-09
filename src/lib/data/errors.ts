export class AccessDenied extends Error { constructor() { super("Accès refusé"); } }
export class QuotaReached extends Error { constructor() { super("Quota d'articles atteint pour ce mois."); } }
export class Conflict extends Error {}
