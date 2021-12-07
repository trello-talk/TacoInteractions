import { promises as fs } from 'fs';
import { TFunction } from 'i18next';
import path from 'path';
import { ButtonStyle, ComponentContext, ComponentType, InteractionResponseFlags, MessageOptions } from 'slash-create';
import { TrelloBoard, TrelloCard, TrelloLabel, TrelloList } from './types';

export function truncate(text: string, limit = 2000) {
  return text.length > limit ? text.slice(0, limit - 1) + '…' : text;
}

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

// TODO localize
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
  }
}

// @deprecated
export const noBoardSelectedResponse: MessageOptions = {
  content: 'Select a board to switch to before using this command!',
  ephemeral: true
}

export function isElevated(user: string) {
  if (!process.env.COMMANDS_ELEVATED) return false;
  return process.env.COMMANDS_ELEVATED.split(',').includes(user);
}

export async function deleteInteraction(ctx: ComponentContext) {
  if (ctx.message.flags === InteractionResponseFlags.EPHEMERAL) await ctx.editParent('You can dismiss this message.', { components: [] })
  else {
    await ctx.acknowledge();
    await ctx.delete();
  }
}

export function getBoardTextLabel(board: TrelloBoard) {
  return `${[
    board.starred ? '⭐' : '',
    board.subscribed ? '🔔' : '',
    board.closed ? '🗃️' : '',
  ].filter(v => !!v).join('')} ${truncate(board.name, 85)} (${board.shortLink})`.trim();
}

export function getListTextLabel(list: TrelloList, subscribed?: boolean) {
  return `${[
    subscribed || list.subscribed ? '🔔' : '',
    list.closed ? '🗃️' : '',
  ].filter(v => !!v).join('')} ${truncate(list.name, 90)}`.trim();
}

export function getCardTextLabel(card: TrelloCard, subscribed?: boolean) {
  return `${[
    subscribed || card.subscribed ? '🔔' : '',
    card.closed ? '🗃️' : '',
  ].filter(v => !!v).join('')} ${truncate(card.name, 90)}`.trim();
}

export function getLabelTextLabel(label: TrelloLabel, t: TFunction) {
  return `${truncate(label.name, 30)}${label.color ? ` (${t(`common.label_color.${label.color}`)})` : ''}`.trim();
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
