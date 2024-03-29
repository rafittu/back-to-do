import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../../../prisma.service';
import { AppError } from '../../../common/errors/Error';
import { IUserRepository, IAlmaUser } from '../interfaces/repository.interface';
import { IUser, IUserData } from '../interfaces/user.interface';
import { CreateUserDtoWithChannel } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private prisma: PrismaService) {}

  private async almaRequest<T>(
    path: string,
    accessToken: string,
    method: 'post' | 'get' | 'patch' | 'delete',
    body?: object,
  ): Promise<T> {
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      };

      const response =
        method === 'post'
          ? await axios.post(path, body, config)
          : method === 'get'
            ? await axios.get(path, config)
            : method === 'patch'
              ? await axios.patch(path, body, config)
              : await axios.delete(path, config);

      return response.data;
    } catch (error) {
      const { status, code, message } = error.response?.data?.error || {};
      throw new AppError(status, code, message);
    }
  }

  private formatUserResponse = (
    userId: string,
    almaUser: IAlmaUser,
  ): IUserData => {
    const { personal, contact, security, createdAt, updatedAt } = almaUser;

    const { firstName, lastName, socialName, bornDate, motherName } = personal;
    const { username, email, phone } = contact;
    const { status } = security;

    return {
      id: userId,
      name: `${firstName} ${lastName}`,
      socialName,
      bornDate,
      motherName,
      username,
      email,
      phone,
      status,
      createdAt,
      updatedAt,
    };
  };

  async createUser(createUser: CreateUserDtoWithChannel): Promise<IUser> {
    const signUpPath: string = process.env.SIGNUP_PATH;

    try {
      const almaUser = await this.almaRequest<IAlmaUser>(
        signUpPath,
        null,
        'post',
        createUser,
      );

      const user = await this.prisma.user.create({
        data: {
          alma_id: almaUser.id,
          name: `${createUser.firstName} ${createUser.lastName}`,
          social_name: createUser.socialName,
        },
      });

      const { id, name, social_name, created_at, updated_at } = user;
      const userResponse = {
        id,
        name,
        socialName: social_name,
        createdAt: created_at,
        updatedAt: updated_at,
      };

      return userResponse;
    } catch (error) {
      const { status, message } = error || {};

      if (error instanceof AppError) {
        throw new AppError(status, 400, message);
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(
          `user-repository.createUser`,
          400,
          `[ '${error.meta?.target}' ] already in use`,
        );
      }

      throw new AppError('user-repository.createUser', 500, 'user not created');
    }
  }

  findById = async (
    userAlmaId: string,
    accessToken: string,
  ): Promise<IUserData> => {
    const getUserPath: string = process.env.GET_USER_PATH;

    try {
      const user = await this.prisma.user.findFirst({
        where: {
          alma_id: userAlmaId,
        },
      });

      if (!user) {
        throw new AppError('user-repository.findById', 404, 'user not found');
      }

      const almaUser = await this.almaRequest<IAlmaUser>(
        getUserPath,
        accessToken,
        'get',
      );

      return this.formatUserResponse(user.id, almaUser);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError('user-repository.findById', 500, 'could not get user');
    }
  };

  updateUser = async (
    accessToken: string,
    dataToUpdate: UpdateUserDto,
  ): Promise<IUserData> => {
    const updateUserPath: string = process.env.UPDATE_USER_PATH;

    let userId: string;

    try {
      const almaUser = await this.almaRequest<IAlmaUser>(
        updateUserPath,
        accessToken,
        'patch',
        dataToUpdate,
      );

      const { firstName, lastName, socialName } = almaUser.personal;

      if (
        'firstName' in dataToUpdate ||
        'lastName' in dataToUpdate ||
        'socialName' in dataToUpdate
      ) {
        const user = await this.prisma.user.update({
          data: {
            name: `${firstName} ${lastName}`,
            social_name: socialName,
          },
          where: {
            alma_id: almaUser.id,
          },
        });

        userId = user.id;
      }

      return this.formatUserResponse(userId, almaUser);
    } catch (error) {
      const { status, message } = error || {};

      if (error instanceof AppError) {
        throw new AppError(status, 400, message);
      }

      throw new AppError(
        'user-repository.findById',
        500,
        'could not update user',
      );
    }
  };

  deleteUser = async (
    accessToken: string,
    userAlmaId: string,
  ): Promise<void> => {
    const deleteUserPath: string = process.env.DELETE_USER_PATH;

    try {
      await this.almaRequest<IAlmaUser>(deleteUserPath, accessToken, 'delete');

      await this.prisma.taskCategory.deleteMany({
        where: {
          task: {
            user: {
              alma_id: userAlmaId,
            },
          },
        },
      });

      await this.prisma.task.deleteMany({
        where: {
          user: {
            alma_id: userAlmaId,
          },
        },
      });

      await this.prisma.user.delete({
        where: {
          alma_id: userAlmaId,
        },
      });
    } catch (error) {
      const { status, message } = error || {};

      if (error instanceof AppError) {
        throw new AppError(status, 400, message);
      }

      throw new AppError(
        'user-repository.findById',
        500,
        'could not delete user',
      );
    }
  };
}
