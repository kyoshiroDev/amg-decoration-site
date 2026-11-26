// Réponse de `GET /api/health` : vivacité du processus seulement, sans aucune information sur
// l'environnement, les versions ou les dépendances (rien d'utile à un attaquant).
import { z } from 'zod';

export const healthResponseSchema = z.strictObject({
  status: z.literal('ok'),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
