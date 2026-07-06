export type IUserRole = 'admin' | 'tenant' | 'guardian';

export interface IUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: IUserRole;
  isActive: boolean;
  profilePhoto?: string;
  ntfyTopic?: string;
  tenantId?: string;
  guardianId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IUserCreate {
  name: string;
  email: string;
  phone: string;
  password: string;
  role?: IUserRole;
}

export interface IUserWithTokens {
  accessToken: string;
  refreshToken: string;
  user: IUser;
}

export interface ILoginRequest {
  email: string;
  password: string;
}

export interface IChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
