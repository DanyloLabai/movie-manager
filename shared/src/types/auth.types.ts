// Mirrors what the backend actually puts on the wire (verified in
// movie-backend/src/auth/auth.service.ts signIn() and common/dto/auth-response.dto.ts),
// not the User entity, which carries extra fields (isVerified, isAdmin) that no
// endpoint currently exposes.

export interface AuthUser {
  id: number;
  username: string;
  email: string;
}

// users.service.ts updateProfile() response shape.
export interface UserProfile {
  id: number;
  username: string;
  email: string;
  avatarUrl: string | null;
}

// Friend list / friend search / friend-request response shape.
export interface UserSummary {
  id: number;
  username: string;
  avatarUrl: string | null;
}
