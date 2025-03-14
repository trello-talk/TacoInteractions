import axios from 'axios';
import { stripIndentTransformer, TemplateTag } from 'common-tags';
import { promises as fs } from 'fs';
import i18next, { TFunction } from 'i18next';
import path from 'path';
import {
  ApplicationIntegrationType,
  ButtonStyle,
  ComponentContext,
  ComponentType,
  InteractionContextType,
  InteractionResponseFlags,
  MessageInteractionContext,
  MessageOptions
} from 'slash-create';

import { logger } from '../logger';
import { VERSION } from './constants';
import { createT } from './locale';
import { prisma } from './prisma';
import { client } from './redis';
import Trello from './trello';
import { DiscordWebhook, TrelloBoard, TrelloCard, TrelloLabel, TrelloList } from './types';

export const isEntitlementsEnabled = () => !!process.env.DISCORD_SKU_TIER_1 && !!process.env.DISCORD_SKU_TIER_2;

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

async function resolveBenefits(ctx: MessageInteractionContext, serverData?: { maxWebhooks: number; manualBenefits: boolean } | null | undefined) {
  if (!ctx.guildID || !isEntitlementsEnabled() || serverData?.manualBenefits) return null;

  const maxWebhooks = ctx.entitlements.find((e) => e.sku_id === process.env.DISCORD_SKU_TIER_2)
    ? 200
    : ctx.entitlements.find((e) => e.sku_id === process.env.DISCORD_SKU_TIER_1)
      ? 20
      : 5;

  if (maxWebhooks !== serverData?.maxWebhooks || (!serverData && maxWebhooks !== 5)) {
    logger.info(`Benefits for ${ctx.guildID} updated (maxWebhooks=${maxWebhooks})`);
    await prisma.server.upsert({
      where: {
        serverID: ctx.guildID
      },
      create: {
        serverID: ctx.guildID,
        maxWebhooks
      },
      update: {
        maxWebhooks
      }
    });

    // Upsert all entitlements to make sure they are in sync
    if (ctx.entitlements.length !== 0)
      await prisma.$transaction(
        ctx.entitlements.map((entitlement) =>
          prisma.discordEntitlement.upsert({
            where: {
              id: entitlement.id
            },
            update: {
              active: entitlement.ends_at ? Date.now() < new Date(entitlement.ends_at).valueOf() : true,
              startsAt: entitlement.starts_at ? new Date(entitlement.starts_at) : null,
              endsAt: entitlement.ends_at ? new Date(entitlement.ends_at) : null
            },
            create: {
              id: entitlement.id,
              skuId: entitlement.sku_id,
              type: entitlement.type,
              guildId: entitlement.guild_id,
              userId: entitlement.user_id,
              active: entitlement.ends_at ? Date.now() < new Date(entitlement.ends_at).valueOf() : true,
              startsAt: entitlement.starts_at ? new Date(entitlement.starts_at) : null,
              endsAt: entitlement.ends_at ? new Date(entitlement.ends_at) : null
            }
          })
        )
      );

    return maxWebhooks;
  }
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
  const t = createT(userData?.locale || serverData?.locale || 'en');
  const trello = new Trello(userData?.trelloToken);
  let discordLocale = null;
  if (ctx.locale) {
    if (i18next.hasResourceBundle(ctx.locale, 'commands')) discordLocale = ctx.locale;
    else if (i18next.hasResourceBundle(ctx.locale.split('-')[0], 'commands')) discordLocale = ctx.locale.split('-')[0];
  }

  const newMaxWebhooks = await resolveBenefits(ctx, serverData);
  if (!!newMaxWebhooks && serverData) serverData.maxWebhooks = newMaxWebhooks;

  return { userData, serverData, t, trello, locale: userData?.locale || serverData?.locale || discordLocale || 'en' };
}

/** Strip indents, extra newlines and trim the result. */
export const stripIndentsAndNewlines = new TemplateTag(stripIndentTransformer('all'), {
  onEndResult: (endResult) =>
    endResult
      .replace(/[^\S\n]+$/gm, '')
      .replace(/^\n/, '')
      .replace(/\n(\n+)/g, '\n')
});

/** @see https://stackoverflow.com/a/19101235/6467130 */
export function flattenObject(data: any) {
  const result = {};
  function recurse(cur: any, prop: string) {
    if (Object(cur) !== cur) {
      result[prop] = cur;
    } else if (Array.isArray(cur)) {
      const l = cur.length;
      for (let i = 0; i < l; i++) recurse(cur[i], prop + '[' + i + ']');
      if (l == 0) result[prop] = [];
    } else {
      let isEmpty = true;
      for (const p in cur) {
        isEmpty = false;
        recurse(cur[p], prop ? prop + '.' + p : p);
      }
      if (isEmpty && prop) result[prop] = {};
    }
  }
  recurse(data, '');
  return result;
}

export async function iterateFolder(folderPath: string, callback: (filePath: string) => void | Promise<void>, extensions = ['.js', '.ts']) {
  const files = await fs.readdir(folderPath);
  await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(folderPath, file);
      const stat = await fs.lstat(filePath);
      if (stat.isSymbolicLink()) {
        const realPath = await fs.readlink(filePath);
        if (stat.isFile() && extensions.find((e) => realPath.endsWith(e))) {
          await callback(realPath);
        } else if (stat.isDirectory()) {
          await iterateFolder(realPath, callback, extensions);
        }
      } else if (stat.isFile() && extensions.find((e) => file.endsWith(e))) await callback(filePath);
      else if (stat.isDirectory()) await iterateFolder(filePath, callback, extensions);
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
export function splitMessage(text: string, { maxLength = 2000, char = '\n', prepend = '', append = '' }: SplitOptions = {}) {
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
  if (ctx.message.flags === InteractionResponseFlags.EPHEMERAL) await ctx.editParent({ content: t('interactions.dismiss'), components: [] });
  else {
    await ctx.acknowledge();
    await ctx.delete();
  }
}

export function getBoardTextLabel(board: TrelloBoard) {
  return `${[board.starred ? '⭐' : '', board.subscribed ? '🔔' : '', board.closed ? '🗃️' : ''].filter((v) => !!v).join('')} ${truncate(
    board.name,
    85
  )} (${board.shortLink})`.trim();
}

export function getListTextLabel(list: TrelloList, subscribed?: boolean) {
  return `${[subscribed || list.subscribed ? '🔔' : '', list.closed ? '🗃️' : ''].filter((v) => !!v).join('')} ${truncate(list.name, 90)}`.trim();
}

export function getCardTextLabel(card: TrelloCard, lists: TrelloList[], subscribed?: boolean) {
  const listName = lists.find((list) => list.id === card.idList).name;
  return `${[subscribed || card.subscribed ? '🔔' : '', card.closed ? '🗃️' : ''].filter((v) => !!v).join('')} ${truncate(card.name, 65)} (${truncate(
    listName,
    20
  )})`.trim();
}

export function getLabelTextLabel(label: TrelloLabel, t: TFunction) {
  return `${truncate(label.name, 30) || '[unnamed]'}${label.color ? ` (${t(`common.label_color.${label.color}`)})` : ''}`.trim();
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

// https://discord.com/developers/docs/resources/user#usernames-and-nicknames
export const BLACKLISTED_WEBHOOK_SUBSTRINGS = ['clyde', 'discord', '@', ':', '#', '```'];
export const BLACKLISTED_WEBHOOK_NAMES = ['everyone', 'here'];

/**
 * An error will be returned if a webhook name (`name`) is not valid. A webhook name is valid if:
 * - It does not contain the substrings `clyde` or `discord` (case-insensitive)
 * - It follows the nickname guidelines in the Usernames and Nicknames documentation, with an exception that webhook names can be up to 80 characters
 * https://discord.com/developers/docs/resources/webhook#create-webhook
 */
export function filterWebhookName(webhookName: string, defaultName: string) {
  if (!webhookName) return defaultName;
  const boardName = webhookName.toLowerCase();
  const nameInvalid = BLACKLISTED_WEBHOOK_SUBSTRINGS.find((str) => boardName.includes(str)) || BLACKLISTED_WEBHOOK_NAMES.includes(boardName);
  return (nameInvalid ? '' : truncate(webhookName, 80)) || defaultName;
}

export async function createDiscordWebhook(guildID: string, channelID: string, body: any, reason?: string): Promise<DiscordWebhook> {
  await client.del(`discord.webhooks:${guildID}`);
  const response = await axios.post(`https://discord.com/api/v9/channels/${channelID}/webhooks`, body, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': `TacoInteractions (https://github.com/trello-talk/TacoInteractions, ${VERSION}) Node.js/${process.version}`,
      ...(reason ? { 'X-Audit-Log-Reason': reason.replace(/[^\t\x20-\x7e\x80-\xff]/g, '').slice(0, 512) || '-' } : {})
    }
  });

  return response.data;
}

export async function postToWebhook(webhook: DiscordWebhook, body: any, threadID?: string): Promise<any> {
  const response = await axios.post(
    `https://discord.com/api/v9/webhooks/${webhook.id}/${webhook.token}${threadID ? `?thread_id=${threadID}` : ''}`,
    body,
    {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `TacoInteractions (https://github.com/trello-talk/TacoInteractions, ${VERSION}) Node.js/${process.version}`
      }
    }
  );

  return response.data;
}

export function parseBigInt(value: string, radix: number) {
  const size = 10,
    factor = BigInt(radix ** size);
  let i = value.length % size || size;
  const parts = [value.slice(0, i)];

  while (i < value.length) parts.push(value.slice(i, (i += size)));

  return parts.reduce((r, v) => r * factor + BigInt(parseInt(v, radix)), 0n);
}

const BOARD_ID_REGEX = /^(?:https?:\/\/trello\.com\/b\/)?([0-9a-f]{24}|[a-zA-Z0-9]{7,10})(?:[/\w?=&%-]*)$/;

export function getBoardID(value: string) {
  const match = BOARD_ID_REGEX.exec(value);
  if (!match) return null;
  return match[1];
}

export const defaultContexts = {
  contexts: [InteractionContextType.BOT_DM, InteractionContextType.GUILD, InteractionContextType.PRIVATE_CHANNEL],
  integrationTypes: [ApplicationIntegrationType.USER_INSTALL, ApplicationIntegrationType.GUILD_INSTALL]
};
