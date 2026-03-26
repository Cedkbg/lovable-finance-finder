export const getErrorMessage = (error: unknown, defaultMsg = 'Une erreur est survenue'): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as any).message);
  }
  return defaultMsg;
};

export const getSupabaseErrorMessage = (error: unknown): string => {
  const msg = getErrorMessage(error);
  if (msg.includes('PGRST116')) return 'Données non trouvées';
  if (msg.includes('23505')) return 'Déjà existant';
  if (msg.includes('auth')) return 'Erreur d\'authentification';
  return msg;
};

export const getApiErrorMessage = (error: unknown, apiName = ''): string => {
  const msg = getErrorMessage(error);
  if (msg.includes('indisponible')) return `${apiName} temporairement indisponible`;
  return msg;
};
