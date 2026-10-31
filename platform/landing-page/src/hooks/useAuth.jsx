/*
 * Standalone landing build: there is no auth backend here, so the landing
 * page always renders its signed-out state (the "Log in" slot in Nav).
 * Kept in the same shape as the app's useAuth so Nav renders unchanged.
 */
const EMPTY = { user: null, isAdmin: false, signOut: async () => {} }

export function useAuth() {
  return EMPTY
}
