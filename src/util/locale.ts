import { User } from '@prisma/client';
import i18next, { TFunction } from 'i18next';
import Backend from 'i18next-fs-backend';
import { isInDist } from './dev';
import { prisma } from './prisma';
import { promises as fs } from 'fs';
import { flattenObject } from '.';

export interface LanguageInfo {
  code: string;
  available: boolean;
  name: string;
  emoji: string;
  percent: string;
}

export const langs: LanguageInfo[] = [];
let srcKeys: string[] = [];

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

  srcKeys = Object.keys(flattenObject(i18next.getResourceBundle('en', 'commands'))).filter(
    (key) => !(key.startsWith('_one') || key.startsWith('_many'))
  );

  const lngs = await fs.readdir(`${isInDist ? '../' : ''}locale/commands`);
  await i18next.loadLanguages(lngs.map((lng) => lng.replace('.json', '')));
  lngs.map((lng) => {
    const l = lng.replace('.json', '');
    const available = i18next.getResource(l, 'commands', '_');
    langs.push({
      code: l,
      available: !!available,
      name: available ? available.name : l,
      percent: getLangPercent(l),
      emoji: available
        ? available.emoji.startsWith('$')
          ? available.emoji.slice(1)
          : `flag_${available.emoji}`
        : 'grey_question'
    });
  });
};

function getLangPercent(lang: string) {
  const langKeys = Object.keys(flattenObject(i18next.getResourceBundle(lang, 'commands'))).filter(
    (key) => !(key.startsWith('_one') || key.startsWith('_many'))
  );
  return ((langKeys.length / srcKeys.length) * 100).toFixed(0);
}

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
