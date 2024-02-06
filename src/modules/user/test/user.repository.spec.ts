import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../../../prisma.service';
import { UserRepository } from '../repository/user.repository';
import { AppError } from '../../../common/errors/Error';
import {
  MockAccessToken,
  MockAlmaUser,
  MockCreateUserAxiosResponse,
  MockCreateUserDto,
  MockGetUserAxiosResponse,
  MockPrismaUser,
  MockUser,
  MockUserData,
} from './mocks/user.mock';

jest.mock('axios');

describe('UserRepository', () => {
  let userRepository: UserRepository;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserRepository, PrismaService],
    }).compile();

    userRepository = module.get<UserRepository>(UserRepository);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(userRepository).toBeDefined();
  });

  describe('handle alma api requests', () => {
    it('should make a post request and return response data', async () => {
      (
        axios.post as jest.MockedFunction<typeof axios.post>
      ).mockResolvedValueOnce(MockCreateUserAxiosResponse);

      const path = 'example.com/api/create';

      const result = await userRepository['almaRequest'](
        path,
        null,
        'post',
        MockCreateUserDto,
      );

      expect(axios.post).toHaveBeenCalledWith(
        path,
        MockCreateUserDto,
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${null}`,
          },
        }),
      );
      expect(result).toEqual(MockCreateUserAxiosResponse.data);
    });

    it('should make a get request and return response data', async () => {
      (
        axios.get as jest.MockedFunction<typeof axios.get>
      ).mockResolvedValueOnce(MockGetUserAxiosResponse);

      const path = 'example.com/api/';

      const result = await userRepository['almaRequest'](
        path,
        MockAccessToken,
        'get',
      );

      expect(axios.get).toHaveBeenCalledWith(
        path,
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${MockAccessToken}`,
          },
        }),
      );
      expect(result).toEqual(MockGetUserAxiosResponse.data);
    });

    it('should throw an AppError if request fails', async () => {
      (
        axios.get as jest.MockedFunction<typeof axios.get>
      ).mockRejectedValueOnce(AppError);

      const path = 'example.com/api/';

      try {
        await userRepository['almaRequest'](path, MockAccessToken, 'patch');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect(error.code).toBe(500);
        expect(error.message).toBe('Internal server error');
      }
    });
  });

  describe('format user responses', () => {
    it('should format user properties to camelCase', () => {
      const result = userRepository['formatUserResponse'](
        MockUser.id,
        MockAlmaUser,
      );
      expect(result).toEqual(MockUserData);
    });
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      jest
        .spyOn(userRepository as any, 'almaRequest')
        .mockResolvedValueOnce(MockAlmaUser);

      jest
        .spyOn(prismaService.user, 'create')
        .mockResolvedValueOnce(MockPrismaUser);

      const result = await userRepository.createUser({
        ...MockCreateUserDto,
        originChannel: 'WOPHI',
      });

      expect(userRepository['almaRequest']).toHaveBeenCalledTimes(1);
      expect(prismaService.user.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual(MockUser);
    });

    it('should throw an AppError when almaRequest throws an error', async () => {
      jest
        .spyOn(userRepository as any, 'almaRequest')
        .mockRejectedValueOnce(
          new AppError('error.code', 400, 'Error message'),
        );

      try {
        await userRepository.createUser({
          ...MockCreateUserDto,
          originChannel: 'WOPHI',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect(error.code).toBe(400);
        expect(error.message).toBe('Error message');
      }
    });

    it('should throw an AppError for PrismaClientKnownRequestError', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'error message',
        {
          code: 'error code',
          clientVersion: '',
        },
      );

      jest
        .spyOn(userRepository as any, 'almaRequest')
        .mockRejectedValueOnce(prismaError);

      try {
        await userRepository.createUser({
          ...MockCreateUserDto,
          originChannel: 'WOPHI',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect(error.code).toBe(400);
        expect(error.message).toBe(
          `[ '${error.meta?.target}' ] already in use`,
        );
      }
    });

    it('should throw an error if user is not created', async () => {
      jest
        .spyOn(userRepository as any, 'almaRequest')
        .mockResolvedValueOnce(MockAlmaUser);

      jest
        .spyOn(prismaService.user, 'create')
        .mockRejectedValueOnce(new Error());

      try {
        await userRepository.createUser({
          ...MockCreateUserDto,
          originChannel: 'WOPHI',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect(error.code).toBe(500);
        expect(error.message).toBe('user not created');
      }
    });
  });
});
