export function retainActivationToken(fragment: string, retainedToken: string) {
  if (retainedToken) return retainedToken;
  return new URLSearchParams(fragment.replace(/^#/, '')).get('token') ?? '';
}
