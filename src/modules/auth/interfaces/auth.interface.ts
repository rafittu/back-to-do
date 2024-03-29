import { Request } from 'express';

export interface IUserToken {
  accessToken: string;
}

export interface IJtwPayload {
  sub: string;
  username: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface IUserFromJwt {
  almaId: string;
  username: string;
  email: string;
}

export interface IAuthRequest extends Request {
  user: IUserFromJwt;
}
