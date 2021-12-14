import { stripIndentTransformer, TemplateTag } from 'common-tags';
import { promises as fs } from 'fs';
import { TFunction } from 'i18next';
import path from 'path';
import {
  ButtonStyle,
  ComponentContext,
  ComponentType,
  InteractionResponseFlags,
  MessageInteractionContext,
  MessageOptions
} from 'slash-create';
import { createT } from './locale';
import { prisma } from './prisma';
import Trello from './trello';
import { TrelloBoard, TrelloCard, TrelloLabel, TrelloList } from './types';

export function truncate(text: string, limit = 2000) {
  return text.length > limit ? text.slice(0, limit - 1) + '…' : text;
}

export function truncateList(texts: string[], t: TFunction, limit = 256, sep = '\n') {
  const result = [];
  const maxItemLen = t('common.more', { count: texts.length }).length;
  for (const text of texts) {
    if (result.join(sep).length + sep.length + (maxItemLen > text.length ? maxItemLen : text.length) > limit) {
      result.push(`*${t('common.more', { count: texts.length - result.length })}*`);
      break;
    }
    result.push(text);
  }
  return result.join(sep);
}

export function toColorInt(hex: string) {
  return parseInt(hex.slice(1), 16);
}

export async function getData(ctx: MessageInteractionContext) {
  const userData = await prisma.user.findUnique({
    where: { userID: ctx.user.id }
  });
  const serverData = ctx.guildID
    ? await prisma.server.findUnique({
        where: { serverID: ctx.guildID }
      })
    : null;
  const t = createT(userData?.locale || serverData?.locale);
  const trello = new Trello(userData?.trelloToken);
  return { userData, serverData, t, trello, locale: userData?.locale || serverData?.locale || 'en' };
}

/** Strip indents, extra newlines and trim the result. */
export const stripIndentsAndNewlines = new TemplateTag(stripIndentTransformer('all'), {
  onEndResult: (endResult) =>
    endResult
      .replace(/[^\S\n]+$/gm, '')
      .replace(/^\n/, '')
      .replace(/\n(\n+)/g, '\n')
});

export async function iterateFolder(
  folderPath: string,
  callback: (filePath: string) => void | Promise<void>,
  extension: string = '.js'
) {
  const files = await fs.readdir(folderPath);
  await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(folderPath, file);
      const stat = await fs.lstat(filePath);
      if (stat.isSymbolicLink()) {
        const realPath = await fs.readlink(filePath);
        if (stat.isFile() && file.endsWith(extension)) {
          await callback(realPath);
        } else if (stat.isDirectory()) {
          await iterateFolder(realPath, callback, extension);
        }
      } else if (stat.isFile() && file.endsWith(extension)) await callback(filePath);
      else if (stat.isDirectory()) await iterateFolder(filePath, callback, extension);
    })
  );
}

export function formatTime(dateString: string) {
  const timestamp = Math.round(new Date(dateString).valueOf() / 1000);
  return `<t:${timestamp}:F> *(<t:${timestamp}:R>)*`;
}

export interface SplitOptions {
  /** Maximum character length per message piece */
  maxLength?: number;
  /** Character to split the message with */
  char?: string;
  /** Text to prepend to every piece except the first */
  prepend?: string;
  /** Text to append to every piece except the last */
  append?: string;
}

/**
 * Splits a string into multiple chunks at a designated character that do not exceed a specific length.
 * @param string text Content to split
 * @param options Options controlling the behavior of the split
 */
export function splitMessage(
  text: string,
  { maxLength = 2000, char = '\n', prepend = '', append = '' }: SplitOptions = {}
) {
  if (text.length <= maxLength) return [text];
  const splitText = text.split(char);
  if (splitText.some((chunk) => chunk.length > maxLength)) throw new RangeError('SPLIT_MAX_LEN');
  const messages = [];
  let msg = '';
  for (const chunk of splitText) {
    if (msg && (msg + char + chunk + append).length > maxLength) {
      messages.push(msg + append);
      msg = prepend;
    }
    msg += (msg && msg !== prepend ? char : '') + chunk;
  }
  return messages.concat(msg).filter((m) => m);
}

export function noAuthResponse(t: TFunction): MessageOptions {
  return {
    content: t('auth.no_auth'),
    ephemeral: true,
    components: [
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.LINK,
            label: t('auth.button'),
            url: process.env.AUTH_LINK
          }
        ]
      }
    ]
  };
}

export function isElevated(user: string) {
  if (!process.env.COMMANDS_ELEVATED) return false;
  return process.env.COMMANDS_ELEVATED.split(',').includes(user);
}

export async function deleteInteraction(ctx: ComponentContext, t: TFunction) {
  if (ctx.message.flags === InteractionResponseFlags.EPHEMERAL)
    await ctx.editParent(t('interactions.dismiss'), { components: [] });
  else {
    await ctx.acknowledge();
    await ctx.delete();
  }
}

export function getBoardTextLabel(board: TrelloBoard) {
  return `${[board.starred ? '⭐' : '', board.subscribed ? '🔔' : '', board.closed ? '🗃️' : '']
    .filter((v) => !!v)
    .join('')} ${truncate(board.name, 85)} (${board.shortLink})`.trim();
}

export function getListTextLabel(list: TrelloList, subscribed?: boolean) {
  return `${[subscribed || list.subscribed ? '🔔' : '', list.closed ? '🗃️' : '']
    .filter((v) => !!v)
    .join('')} ${truncate(list.name, 90)}`.trim();
}

export function getCardTextLabel(card: TrelloCard, lists: TrelloList[], subscribed?: boolean) {
  const listName = lists.find((list) => list.id === card.idList).name;
  return `${[subscribed || card.subscribed ? '🔔' : '', card.closed ? '🗃️' : '']
    .filter((v) => !!v)
    .join('')} ${truncate(card.name, 65)} (${truncate(listName, 20)})`.trim();
}

export function getLabelTextLabel(label: TrelloLabel, t: TFunction) {
  return `${truncate(label.name, 30) || '[unnamed]'}${
    label.color ? ` (${t(`common.label_color.${label.color}`)})` : ''
  }`.trim();
}

export function sortBoards(boards: TrelloBoard[]) {
  return boards.sort((a, b) => {
    if (a.starred && !b.starred) return -1;
    if (!a.starred && b.starred) return 1;
    if (a.closed && !b.closed) return 1;
    if (!a.closed && b.closed) return -1;
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  });
}

export function sortLists(list: TrelloList[]) {
  return list.sort((a, b) => {
    if (a.closed && !b.closed) return 1;
    if (!a.closed && b.closed) return -1;
    if (a.pos < b.pos) return -1;
    if (a.pos > b.pos) return 1;
    return 0;
  });
}

export function sortCards(card: TrelloCard[]) {
  return card.sort((a, b) => {
    if (a.closed && !b.closed) return 1;
    if (!a.closed && b.closed) return -1;
    if (a.pos < b.pos) return -1;
    if (a.pos > b.pos) return 1;
    return 0;
  });
}
