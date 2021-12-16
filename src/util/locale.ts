import { User } from '@prisma/client';
import i18next, { TFunction } from 'i18next';
import Backend from 'i18next-fs-backend';
import { isInDist } from './dev';
import { prisma } from './prisma';
import { promises as fs } from 'fs';

export const langs: string[] = [];

export const init = async () => {
  await i18next.use(Backend).init({
    fallbackLng: 'en',
    ns: ['commands', 'webhook'],
    defaultNS: 'commands',
    debug: process.env.COMMANDS_DEBUG === 'true',
    interpolation: {
      escapeValue: false
    },
    backend: {
      loadPath: `${isInDist ? '../' : ''}locale/{{ns}}/{{lng}}.json`
    }
  });
  const lngs = await fs.readdir(`${isInDist ? '../' : ''}locale/commands`);
  await i18next.loadLanguages(lngs.map((lng) => lng.replace('.json', '')));
  lngs.map((lng) => langs.push(lng.replace('.json', '')));
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

export function formatNumber(number: number, lang: string) {
  try {
    return new Intl.NumberFormat(lang.replace('_', '-')).format(number);
  } catch (e) {
    return number.toLocaleString();
  }
}
