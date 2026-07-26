import type { IUser } from './user';

export interface ILoginRequest {
  email: string;
  password: string;
}

export interface ILoginResponse {
  accessToken: string;
  refreshToken: string;
  user: IUser;
}

export interface IChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface IForgotPasswordRequest {
  email: string;
}

export interface IResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface IRefreshTokenRequest {
  refreshToken: string;
}
