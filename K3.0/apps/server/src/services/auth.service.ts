import { prisma } from '../db/prismaClient.js';
import { v4 as uuidv4 } from 'uuid';

export interface UserOutput {
  id: string;
  email?: string;
  displayName: string;
  avatar?: string;
  createdAt: Date;
  isGuest: boolean;
}

export interface AuthResult {
  user: UserOutput;
  token: string;
}

export async function createGuestUser(displayName: string): Promise<UserOutput> {
  const guestId = `guest_${uuidv4().slice(0, 8)}`;
  const finalName = displayName || `Guest_${guestId.slice(-4)}`;
  
  const user = await prisma.user.create({
    data: {
      guestId,
      username: finalName,
      isGuest: true,
    },
  });

  return {
    id: user.id,
    email: user.email ?? undefined,
    displayName: user.username,
    avatar: user.avatar ?? undefined,
    createdAt: user.createdAt,
    isGuest: user.isGuest,
  };
}

export async function findUserById(id: string): Promise<UserOutput | null> {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email ?? undefined,
    displayName: user.username,
    avatar: user.avatar ?? undefined,
    createdAt: user.createdAt,
    isGuest: user.isGuest,
  };
}

export async function findUserByGuestId(guestId: string): Promise<UserOutput | null> {
  const user = await prisma.user.findUnique({
    where: { guestId },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email ?? undefined,
    displayName: user.username,
    avatar: user.avatar ?? undefined,
    createdAt: user.createdAt,
    isGuest: user.isGuest,
  };
}

export async function findUserByEmail(email: string): Promise<UserOutput | null> {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email ?? undefined,
    displayName: user.username,
    avatar: user.avatar ?? undefined,
    createdAt: user.createdAt,
    isGuest: user.isGuest,
  };
}

export async function findUserByUsername(username: string): Promise<UserOutput | null> {
  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email ?? undefined,
    displayName: user.username,
    avatar: user.avatar ?? undefined,
    createdAt: user.createdAt,
    isGuest: user.isGuest,
  };
}

export async function createUser(email: string, username: string): Promise<UserOutput> {
  const user = await prisma.user.create({
    data: {
      email,
      username,
      isGuest: false,
    },
  });

  return {
    id: user.id,
    email: user.email ?? undefined,
    displayName: user.username,
    avatar: user.avatar ?? undefined,
    createdAt: user.createdAt,
    isGuest: user.isGuest,
  };
}

export async function updateUserAvatar(userId: string, avatar: string): Promise<UserOutput | null> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatar },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email ?? undefined,
    displayName: user.username,
    avatar: user.avatar ?? undefined,
    createdAt: user.createdAt,
    isGuest: user.isGuest,
  };
}
