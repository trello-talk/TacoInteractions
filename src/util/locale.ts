import { User } from '@prisma/client';
import i18next, { TFunction } from 'i18next';
import Backend from 'i18next-fs-backend';
import { isInDist } from './dev';
import { prisma } from './prisma';

export const init = async () => {
  await i18next.use(Backend).init({
    lng: 'en',
    fallbackLng: 'en',
    ns: ['bot', 'commands'],
    defaultNS: 'commands',
    debug: true,
    interpolation: {
      escapeValue: false
    },
    backend: {
      loadPath: `${isInDist ? '../' : ''}locale/{{ns}}/{{lng}}.json`,
    },
  });
};

export function createT(lang: string) {
  return i18next.getFixedT(lang);
}

export async function createUserT(id: string) {
  const [t] = await createAndGetUserT(id);
  return t;
}

export async function createAndGetUserT(id: string): Promise<[TFunction, User]> {
  const userData = await prisma.user.findUnique({
    where: { userID: id }
  });
  return [userData?.locale ? i18next.getFixedT(userData.locale) : i18next.t, userData];
}
