import { TFunction } from 'i18next';
import { ButtonStyle, ComponentContext, ComponentType, EditMessageOptions } from 'slash-create';
import { oneLine } from 'common-tags';
import { deleteInteraction, getData, toColorInt } from '.';
import { Action, actions } from './actions';
import { LABEL_COLORS } from './constants';
import { formatNumber } from './locale';
import { client } from './redis';
import { TrelloAttachment } from './types';

const filterGroups: Record<string, string[]> = {
  board: ['ADD_MEMBER_TO_BOARD', 'REMOVE_MEMBER_FROM_BOARD', 'MAKE_ADMIN_OF_BOARD', 'MAKE_NORMAL_MEMBER_OF_BOARD'],
  boardUpdate: ['UPDATE_BOARD_NAME', 'UPDATE_BOARD_DESC', 'UPDATE_BOARD_PREFS', 'UPDATE_BOARD_CLOSED'],
  label: ['CREATE_LABEL', 'DELETE_LABEL'],
  labelUpdate: ['UPDATE_LABEL_NAME', 'UPDATE_LABEL_COLOR'],
  card: [
    'DELETE_CARD',
    'CREATE_CARD',
    'VOTE_ON_CARD',
    'ADD_ATTACHMENT_TO_CARD',
    'DELETE_ATTACHMENT_FROM_CARD',
    'ADD_LABEL_TO_CARD',
    'REMOVE_LABEL_FROM_CARD',
    'ADD_MEMBER_TO_CARD',
    'REMOVE_MEMBER_FROM_CARD',
    'MOVE_CARD_FROM_BOARD',
    'MOVE_CARD_TO_BOARD',
    'COPY_CARD',
    'EMAIL_CARD'
  ],
  cardUpdate: [
    'UPDATE_CARD_NAME',
    'UPDATE_CARD_DESC',
    'UPDATE_CARD_LIST',
    'UPDATE_CARD_POS',
    'UPDATE_CARD_CLOSED',
    'UPDATE_CARD_DUE'
  ],
  comment: ['COMMENT_CARD', 'UPDATE_COMMENT', 'DELETE_COMMENT'],
  checklist: ['ADD_CHECKLIST_TO_CARD', 'REMOVE_CHECKLIST_FROM_CARD', 'COPY_CHECKLIST'],
  checklistUpdate: ['UPDATE_CHECKLIST_NAME', 'UPDATE_CHECKLIST_POS'],
  checkItem: [
    'UPDATE_CHECK_ITEM_STATE_ON_CARD',
    'CREATE_CHECK_ITEM',
    'DELETE_CHECK_ITEM',
    'CONVERT_TO_CARD_FROM_CHECK_ITEM'
  ],
  checkItemUpdate: ['UPDATE_CHECK_ITEM_NAME', 'UPDATE_CHECK_ITEM_POS'],
  list: ['CREATE_LIST', 'MOVE_LIST_FROM_BOARD', 'MOVE_LIST_TO_BOARD'],
  listUpdate: ['UPDATE_LIST_NAME', 'UPDATE_LIST_POS', 'UPDATE_LIST_CLOSED'],
  customField: ['CREATE_CUSTOM_FIELD', 'DELETE_CUSTOM_FIELD', 'UPDATE_CUSTOM_FIELD_ITEM'],
  customFieldUpdate: ['UPDATE_CUSTOM_FIELD_NAME', 'UPDATE_CUSTOM_FIELD_DISPLAY']
};

export enum PromptType {
  LIST,
  QUERY,
  SELECT,
  ATTACHMENT,
  FILTERS
}

export enum PromptAction {
  PREVIOUS,
  NEXT,
  STOP,
  SELECT,
  DONE,
  SET_PAGE
}

export interface PromptBase {
  /** The content of the message */
  content?: string;
  /** The title of the prompt */
  title?: string;
  /** The footer text of the prompt */
  footer?: string;
  /** The embed color of the prompt */
  color?: number;
  /** The page the list is currently on */
  page: number;
  /** The action redis key that is determined by this prompt, TTL should be updated with this key */
  action?: string;
}

/** A listing prompt */
export interface ListPrompt extends PromptBase {
  type: PromptType.LIST;
  /** Page content, also determining max pages */
  pages: string[];
}

/** A partial select menu option */
export interface PartialSelectMenuOption {
  label: string;
  description?: string;
  emoji?: {
    name?: string;
    id?: string;
    animated?: boolean;
  };
}

/** Uses select menus to select one item, 25 items per page */
export interface QueryPrompt extends PromptBase {
  type: PromptType.QUERY;
  /** The display options, also determining max pages */
  display: PartialSelectMenuOption[];
  /** The values paired with the index of the display array */
  values: any[];
  /** The placeholder string to use in select menu */
  placeholder?: string;
}

/** Uses select menus to select multiple items, 25 items per page */
export interface SelectPrompt extends PromptBase {
  type: PromptType.SELECT;
  /** The display options, also determining max pages */
  display: PartialSelectMenuOption[];
  /** The values paired with the index of the display array */
  values: any[];
  /** The value indexes that are selected per page */
  selected: number[][];
  /** The placeholder string to use in select menu, max 100 characters */
  placeholder?: string;
}

/** A listing prompt for Trello attachments */
export interface AttachmentPrompt extends PromptBase {
  type: PromptType.ATTACHMENT;
  /** The attachments to display */
  attachments: TrelloAttachment[];
}

/** A select prompt for webhook filters */
export interface FiltersPrompt extends PromptBase {
  type: PromptType.FILTERS;
  /** The filters selected */
  selected: string[];
}

export type Prompt = ListPrompt | QueryPrompt | SelectPrompt | AttachmentPrompt | FiltersPrompt;

export async function handlePrompt(ctx: ComponentContext) {
  const { t, locale } = await getData(ctx);

  if (ctx.message.interaction!.user.id !== ctx.user.id)
    return ctx.send({
      content: t(['interactions.prompt_wrong_user', 'interactions.wrong_user']),
      ephemeral: true
    });

  const [, type, action] = ctx.customID.split(':').map((a) => parseInt(a, 10)) as [never, PromptType, PromptAction];
  const promptCache = await client.get(`prompt:${ctx.message.id}`);

  if (!promptCache) {
    if (action === PromptAction.STOP) return await deleteInteraction(ctx, t);
    await ctx.acknowledge();
    if (type === PromptType.LIST) await ctx.editParent({ components: [] });
    await ctx.sendFollowUp({ content: t('interactions.prompt_expired'), ephemeral: true });
    if (type !== PromptType.LIST) await ctx.delete();
    return;
  }

  const prompt: Prompt = JSON.parse(promptCache);

  switch (type) {
    case PromptType.LIST:
      return handleListPrompt(ctx, prompt as ListPrompt, action, t, locale);
    case PromptType.QUERY:
      return handleQueryPrompt(ctx, prompt as QueryPrompt, action, t, locale);
    case PromptType.SELECT:
      return handleSelectPrompt(ctx, prompt as SelectPrompt, action, t, locale);
    case PromptType.ATTACHMENT:
      return handleAttachmentPrompt(ctx, prompt as AttachmentPrompt, action, t, locale);
    case PromptType.FILTERS:
      return handleFiltersPrompt(ctx, prompt as FiltersPrompt, action, t);
    default:
      return ctx.send({
        content: t('interactions.prompt_no_function'),
        ephemeral: true
      });
  }
}

async function handoffAction(ctx: ComponentContext, actionID: string, data: any, t: TFunction) {
  if (!actionID)
    return ctx.send({
      content: t('interactions.prompt_no_action_id'),
      ephemeral: true
    });

  const actionCache = await client.get(`action:${actionID}`);
  if (!actionCache)
    return ctx.send({
      content: t('interactions.prompt_action_expired'),
      ephemeral: true
    });

  await client.del(`action:${actionID}`);
  const action: Action = JSON.parse(actionCache);

  if (!actions.has(action.type))
    return ctx.send({
      content: t('interactions.prompt_action_invalid_type'),
      ephemeral: true
    });

  return actions.get(action.type).onAction(ctx, action, data);
}

export async function createListPrompt(
  options: Omit<ListPrompt, 'page' | 'type'>,
  messageID: string,
  t: TFunction,
  lang?: string
): Promise<EditMessageOptions> {
  const prompt: ListPrompt = {
    ...options,
    type: PromptType.LIST,
    page: 1
  };

  if (prompt.pages.length > 1) await client.set(`prompt:${messageID}`, JSON.stringify(prompt), 'EX', 10 * 60);

  return {
    content: prompt.content || '',
    embeds: [
      {
        title: prompt.title,
        description: prompt.pages[prompt.page - 1],
        color: prompt.color,
        ...(prompt.footer ? { footer: { text: prompt.footer } } : {})
      }
    ],
    components: [
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.PRIMARY,
            label: '',
            custom_id: `prompt:${PromptType.LIST}:${PromptAction.PREVIOUS}`,
            emoji: { id: '902219517969727488' },
            disabled: prompt.page <= 1
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.SECONDARY,
            label: `${t('common.page')} ${formatNumber(prompt.page, lang)}/${formatNumber(prompt.pages.length, lang)}`,
            custom_id: 'none',
            disabled: true
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.DESTRUCTIVE,
            label: '',
            custom_id: `prompt:${PromptType.LIST}:${PromptAction.STOP}`,
            emoji: { id: '887142796560060426' }
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.PRIMARY,
            label: '',
            custom_id: `prompt:${PromptType.LIST}:${PromptAction.NEXT}`,
            emoji: { id: '902219517965525042' },
            disabled: prompt.page >= prompt.pages.length
          }
        ]
      }
    ]
  };
}

async function handleListPrompt(
  ctx: ComponentContext,
  prompt: ListPrompt,
  action: PromptAction,
  t: TFunction,
  lang?: string
) {
  // Filter out actions that shouldn't be possible
  if (
    (prompt.page <= 1 && action === PromptAction.PREVIOUS) ||
    (prompt.page >= prompt.pages.length && action === PromptAction.NEXT)
  )
    return ctx.acknowledge();

  // Handle action
  switch (action) {
    case PromptAction.PREVIOUS:
      prompt.page--;
      break;
    case PromptAction.NEXT:
      prompt.page++;
      break;
    case PromptAction.STOP:
      await deleteInteraction(ctx, t);
      await client.del(`prompt:${ctx.message.id}`);
      if (prompt.action) await client.del(`action:${prompt.action}`);
      return;
  }

  // Set cache
  await client.set(`prompt:${ctx.message.id}`, JSON.stringify(prompt), 'EX', 10 * 60);
  if (prompt.action) await client.expire(`action:${prompt.action}`, 10 * 60);

  // Display page
  await ctx.editParent({
    content: prompt.content || '',
    embeds: [
      {
        title: prompt.title,
        description: prompt.pages[prompt.page - 1],
        color: prompt.color,
        ...(prompt.footer ? { footer: { text: prompt.footer } } : {})
      }
    ],
    components: [
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.PRIMARY,
            label: '',
            custom_id: `prompt:${PromptType.LIST}:${PromptAction.PREVIOUS}`,
            emoji: { id: '902219517969727488' },
            disabled: prompt.page <= 1
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.SECONDARY,
            label: `${t('common.page')} ${formatNumber(prompt.page, lang)}/${formatNumber(prompt.pages.length, lang)}`,
            custom_id: 'none',
            disabled: true
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.DESTRUCTIVE,
            label: '',
            custom_id: `prompt:${PromptType.LIST}:${PromptAction.STOP}`,
            emoji: { id: '887142796560060426' }
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.PRIMARY,
            label: '',
            custom_id: `prompt:${PromptType.LIST}:${PromptAction.NEXT}`,
            emoji: { id: '902219517965525042' },
            disabled: prompt.page >= prompt.pages.length
          }
        ]
      }
    ]
  });
}

export async function createQueryPrompt(
  options: Omit<QueryPrompt, 'page' | 'type'>,
  messageID: string,
  t: TFunction,
  lang?: string
): Promise<EditMessageOptions> {
  const prompt: QueryPrompt = {
    ...options,
    type: PromptType.QUERY,
    page: 1
  };

  await client.set(`prompt:${messageID}`, JSON.stringify(prompt), 'EX', 10 * 60);

  const max = Math.ceil(prompt.display.length / 25);
  const offset = (prompt.page - 1) * 25;
  return {
    content: prompt.content || t('interactions.prompt_select_item'),
    ...(prompt.title || prompt.footer || prompt.color
      ? {
          embeds: [
            {
              title: prompt.title,
              color: prompt.color,
              ...(prompt.footer ? { footer: { text: prompt.footer } } : {})
            }
          ]
        }
      : {}),
    components: [
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.SELECT,
            ...(prompt.placeholder ? { placeholder: prompt.placeholder } : {}),
            options: prompt.display.map((opt, i) => ({ ...opt, value: String(i) })).slice(offset, prompt.page * 25),
            custom_id: `prompt:${PromptType.QUERY}:${PromptAction.SELECT}`,
            min_values: 1,
            max_values: 1
          }
        ]
      },
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.PRIMARY,
            label: '',
            custom_id: `prompt:${PromptType.QUERY}:${PromptAction.PREVIOUS}`,
            emoji: { id: '902219517969727488' },
            disabled: prompt.page <= 1
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.SECONDARY,
            label: `${t('common.page')} ${formatNumber(prompt.page, lang)}/${formatNumber(max, lang)}`,
            custom_id: 'none',
            disabled: true
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.DESTRUCTIVE,
            label: '',
            custom_id: `prompt:${PromptType.QUERY}:${PromptAction.STOP}`,
            emoji: { id: '887142796560060426' }
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.PRIMARY,
            label: '',
            custom_id: `prompt:${PromptType.QUERY}:${PromptAction.NEXT}`,
            emoji: { id: '902219517965525042' },
            disabled: prompt.page >= max
          }
        ]
      }
    ]
  };
}

async function handleQueryPrompt(
  ctx: ComponentContext,
  prompt: QueryPrompt,
  action: PromptAction,
  t: TFunction,
  lang?: string
) {
  const max = Math.ceil(prompt.display.length / 25);

  // Filter out actions that shouldn't be possible
  if ((prompt.page <= 1 && action === PromptAction.PREVIOUS) || (prompt.page >= max && action === PromptAction.NEXT))
    return ctx.acknowledge();

  // Handle action
  switch (action) {
    case PromptAction.PREVIOUS:
      prompt.page--;
      break;
    case PromptAction.NEXT:
      prompt.page++;
      break;
    case PromptAction.STOP:
      await deleteInteraction(ctx, t);
      await client.del(`prompt:${ctx.message.id}`);
      if (prompt.action) await client.del(`action:${prompt.action}`);
      return;
    case PromptAction.SELECT:
      await client.del(`prompt:${ctx.message.id}`);
      return handoffAction(ctx, prompt.action, prompt.values[parseInt(ctx.values[0], 10)], t);
  }

  // Set cache
  await client.set(`prompt:${ctx.message.id}`, JSON.stringify(prompt), 'EX', 10 * 60);
  if (prompt.action) await client.expire(`action:${prompt.action}`, 10 * 60);

  // Display page
  const offset = (prompt.page - 1) * 25;
  await ctx.editParent({
    content: prompt.content || '',
    ...(prompt.title || prompt.footer || prompt.color
      ? {
          embeds: [
            {
              title: prompt.title,
              color: prompt.color,
              ...(prompt.footer ? { footer: { text: prompt.footer } } : {})
            }
          ]
        }
      : {}),
    components: [
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.SELECT,
            ...(prompt.placeholder ? { placeholder: prompt.placeholder } : {}),
            options: prompt.display.map((opt, i) => ({ ...opt, value: String(i) })).slice(offset, prompt.page * 25),
            custom_id: `prompt:${PromptType.QUERY}:${PromptAction.SELECT}`,
            min_values: 1,
            max_values: 1
          }
        ]
      },
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.PRIMARY,
            label: '',
            custom_id: `prompt:${PromptType.QUERY}:${PromptAction.PREVIOUS}`,
            emoji: { id: '902219517969727488' },
            disabled: prompt.page <= 1
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.SECONDARY,
            label: `${t('common.page')} ${formatNumber(prompt.page, lang)}/${formatNumber(max, lang)}`,
            custom_id: 'none',
            disabled: true
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.DESTRUCTIVE,
            label: '',
            custom_id: `prompt:${PromptType.QUERY}:${PromptAction.STOP}`,
            emoji: { id: '887142796560060426' }
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.PRIMARY,
            label: '',
            custom_id: `prompt:${PromptType.QUERY}:${PromptAction.NEXT}`,
            emoji: { id: '902219517965525042' },
            disabled: prompt.page >= max
          }
        ]
      }
    ]
  });
}

export async function createSelectPrompt(
  options: Omit<SelectPrompt, 'page' | 'type' | 'selected'>,
  messageID: string,
  t: TFunction,
  selected: number[] = [],
  lang?: string
): Promise<EditMessageOptions> {
  const prompt: SelectPrompt = {
    ...options,
    type: PromptType.SELECT,
    page: 1,
    selected: []
  };

  // Place selected values
  selected = selected.filter((v) => v != -1);
  const max = Math.ceil(prompt.display.length / 25);
  prompt.selected = ' '
    .repeat(max)
    .split('')
    .map(() => []);
  for (const i of selected) {
    const pageIndex = Math.floor(i / 25);
    prompt.selected[pageIndex].push(i);
  }

  await client.set(`prompt:${messageID}`, JSON.stringify(prompt), 'EX', 10 * 60);

  const offset = (prompt.page - 1) * 25;
  const displayLen = Math.min(25, prompt.display.length - offset);
  return {
    content: prompt.content || '',
    embeds: [
      {
        title: prompt.title,
        description: t('interactions.items_selected', { count: selected.length || 0 }),
        ...(prompt.footer ? { footer: { text: prompt.footer } } : {})
      }
    ],
    components: [
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.SELECT,
            ...(prompt.placeholder ? { placeholder: prompt.placeholder } : {}),
            options: prompt.display
              .map((opt, i) => ({ ...opt, value: String(i), default: prompt.selected[prompt.page - 1].includes(i) }))
              .slice(offset, prompt.page * 25),
            custom_id: `prompt:${PromptType.SELECT}:${PromptAction.SELECT}`,
            min_values: 0,
            max_values: displayLen
          }
        ]
      },
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.PRIMARY,
            label: '',
            custom_id: `prompt:${PromptType.SELECT}:${PromptAction.PREVIOUS}`,
            emoji: { id: '902219517969727488' },
            disabled: prompt.page <= 1
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.SECONDARY,
            label: `${t('common.page')} ${formatNumber(prompt.page, lang)}/${formatNumber(max, lang)}`,
            custom_id: 'none',
            disabled: true
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.DESTRUCTIVE,
            label: '',
            custom_id: `prompt:${PromptType.SELECT}:${PromptAction.STOP}`,
            emoji: { id: '887142796560060426' }
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.SUCCESS,
            label: t('common.done'),
            custom_id: `prompt:${PromptType.SELECT}:${PromptAction.DONE}`
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.PRIMARY,
            label: '',
            custom_id: `prompt:${PromptType.SELECT}:${PromptAction.NEXT}`,
            emoji: { id: '902219517965525042' },
            disabled: prompt.page >= max
          }
        ]
      }
    ]
  };
}

async function handleSelectPrompt(
  ctx: ComponentContext,
  prompt: SelectPrompt,
  action: PromptAction,
  t: TFunction,
  lang?: string
) {
  const max = Math.ceil(prompt.display.length / 25);

  // Filter out actions that shouldn't be possible
  if ((prompt.page <= 1 && action === PromptAction.PREVIOUS) || (prompt.page >= max && action === PromptAction.NEXT))
    return ctx.acknowledge();

  // Handle action
  switch (action) {
    case PromptAction.PREVIOUS:
      prompt.page--;
      break;
    case PromptAction.NEXT:
      prompt.page++;
      break;
    case PromptAction.STOP:
      await deleteInteraction(ctx, t);
      await client.del(`prompt:${ctx.message.id}`);
      if (prompt.action) await client.del(`action:${prompt.action}`);
      return;
    case PromptAction.SELECT:
      prompt.selected[prompt.page - 1] = [...new Set(ctx.values.map((v) => parseInt(v, 10)))];
      break;
    case PromptAction.DONE:
      await client.del(`prompt:${ctx.message.id}`);
      return handoffAction(
        ctx,
        prompt.action,
        prompt.selected.reduce((a, b) => a.concat(b), []).map((i) => prompt.values[i]),
        t
      );
  }

  // Set cache
  await client.set(`prompt:${ctx.message.id}`, JSON.stringify(prompt), 'EX', 10 * 60);
  if (prompt.action) await client.expire(`action:${prompt.action}`, 10 * 60);

  // Display page
  const offset = (prompt.page - 1) * 25;
  const displayLen = Math.min(25, prompt.display.length - offset);
  const selected = prompt.selected.reduce((p, n) => p + n.length, 0);
  await ctx.editParent({
    content: prompt.content || '',
    embeds: [
      {
        title: prompt.title,
        description: t('interactions.items_selected', { count: selected }),
        ...(prompt.footer ? { footer: { text: prompt.footer } } : {})
      }
    ],
    components: [
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.SELECT,
            ...(prompt.placeholder ? { placeholder: prompt.placeholder } : {}),
            options: prompt.display
              .map((opt, i) => ({ ...opt, value: String(i), default: prompt.selected[prompt.page - 1].includes(i) }))
              .slice(offset, prompt.page * 25),
            custom_id: `prompt:${PromptType.SELECT}:${PromptAction.SELECT}`,
            min_values: 0,
            max_values: displayLen
          }
        ]
      },
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.PRIMARY,
            label: '',
            custom_id: `prompt:${PromptType.SELECT}:${PromptAction.PREVIOUS}`,
            emoji: { id: '902219517969727488' },
            disabled: prompt.page <= 1
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.SECONDARY,
            label: `${t('common.page')} ${formatNumber(prompt.page, lang)}/${formatNumber(max, lang)}`,
            custom_id: 'none',
            disabled: true
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.DESTRUCTIVE,
            label: '',
            custom_id: `prompt:${PromptType.SELECT}:${PromptAction.STOP}`,
            emoji: { id: '887142796560060426' }
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.SUCCESS,
            label: '',
            custom_id: `prompt:${PromptType.SELECT}:${PromptAction.DONE}`,
            emoji: { id: '922944199450578995' }
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.PRIMARY,
            label: '',
            custom_id: `prompt:${PromptType.SELECT}:${PromptAction.NEXT}`,
            emoji: { id: '902219517965525042' },
            disabled: prompt.page >= max
          }
        ]
      }
    ]
  });
}

export async function createAttachmentPrompt(
  options: Omit<AttachmentPrompt, 'page' | 'type'>,
  messageID: string,
  t: TFunction,
  lang?: string
): Promise<EditMessageOptions> {
  const prompt: AttachmentPrompt = {
    ...options,
    type: PromptType.ATTACHMENT,
    page: 1
  };

  if (prompt.attachments.length > 1) await client.set(`prompt:${messageID}`, JSON.stringify(prompt), 'EX', 10 * 60);

  const attachment = prompt.attachments[prompt.page - 1];
  const isFile = attachment.bytes !== null;

  return {
    content: prompt.content || '',
    embeds: [
      {
        title: attachment.name || t('common.attachment'),
        url: attachment.url,
        ...(isFile ? { image: { url: attachment.url } } : { description: attachment.url }),
        ...(attachment.edgeColor
          ? { color: LABEL_COLORS[attachment.edgeColor] || toColorInt(attachment.edgeColor) }
          : {})
      }
    ],
    components: [
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.PRIMARY,
            label: '',
            custom_id: `prompt:${PromptType.ATTACHMENT}:${PromptAction.PREVIOUS}`,
            emoji: { id: '902219517969727488' },
            disabled: prompt.page <= 1
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.SECONDARY,
            label: oneLine`
              ${t('common.attachment')}
              ${formatNumber(prompt.page, lang)}/${formatNumber(prompt.attachments.length, lang)}`,
            custom_id: 'none',
            disabled: true
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.DESTRUCTIVE,
            label: '',
            custom_id: `prompt:${PromptType.ATTACHMENT}:${PromptAction.STOP}`,
            emoji: { id: '887142796560060426' }
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.PRIMARY,
            label: '',
            custom_id: `prompt:${PromptType.ATTACHMENT}:${PromptAction.NEXT}`,
            emoji: { id: '902219517965525042' },
            disabled: prompt.page >= prompt.attachments.length
          }
        ]
      }
    ]
  };
}

async function handleAttachmentPrompt(
  ctx: ComponentContext,
  prompt: AttachmentPrompt,
  action: PromptAction,
  t: TFunction,
  lang?: string
) {
  // Filter out actions that shouldn't be possible
  if (
    (prompt.page <= 1 && action === PromptAction.PREVIOUS) ||
    (prompt.page >= prompt.attachments.length && action === PromptAction.NEXT)
  )
    return ctx.acknowledge();

  // Handle action
  switch (action) {
    case PromptAction.PREVIOUS:
      prompt.page--;
      break;
    case PromptAction.NEXT:
      prompt.page++;
      break;
    case PromptAction.STOP:
      await deleteInteraction(ctx, t);
      await client.del(`prompt:${ctx.message.id}`);
      if (prompt.action) await client.del(`action:${prompt.action}`);
      return;
  }

  // Set cache
  await client.set(`prompt:${ctx.message.id}`, JSON.stringify(prompt), 'EX', 10 * 60);
  if (prompt.action) await client.expire(`action:${prompt.action}`, 10 * 60);

  const attachment = prompt.attachments[prompt.page - 1];
  const isFile = attachment.bytes === null;

  // Display page
  await ctx.editParent({
    content: prompt.content || '',
    embeds: [
      {
        title: attachment.name || t('common.attachment'),
        url: attachment.url,
        description: isFile ? attachment.url : undefined,
        color: attachment.edgeColor ? LABEL_COLORS[attachment.edgeColor] || toColorInt(attachment.edgeColor) : undefined
      }
    ],
    components: [
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.PRIMARY,
            label: '',
            custom_id: `prompt:${PromptType.ATTACHMENT}:${PromptAction.PREVIOUS}`,
            emoji: { id: '902219517969727488' },
            disabled: prompt.page <= 1
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.SECONDARY,
            label: oneLine`
              ${t('common.attachment')}
              ${formatNumber(prompt.page, lang)}/${formatNumber(prompt.attachments.length, lang)}`,
            custom_id: 'none',
            disabled: true
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.DESTRUCTIVE,
            label: '',
            custom_id: `prompt:${PromptType.ATTACHMENT}:${PromptAction.STOP}`,
            emoji: { id: '887142796560060426' }
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.PRIMARY,
            label: '',
            custom_id: `prompt:${PromptType.ATTACHMENT}:${PromptAction.NEXT}`,
            emoji: { id: '902219517965525042' },
            disabled: prompt.page >= prompt.attachments.length
          }
        ]
      }
    ]
  });
}

export async function createFiltersPrompt(
  options: Omit<FiltersPrompt, 'page' | 'type'>,
  messageID: string,
  t: TFunction
): Promise<EditMessageOptions> {
  const prompt: FiltersPrompt = {
    ...options,
    type: PromptType.FILTERS,
    page: 1
  };

  await client.set(`prompt:${messageID}`, JSON.stringify(prompt), 'EX', 10 * 60);

  const pageGroup = Object.keys(filterGroups)[prompt.page - 1];
  return {
    content: prompt.content || '',
    embeds: [
      {
        title: prompt.title,
        description: t('interactions.items_selected', { count: prompt.selected.length }),
        ...(prompt.footer ? { footer: { text: prompt.footer } } : {})
      }
    ],
    components: [
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.SELECT,
            placeholder: t('webhook.view_group_placeholder'),
            options: Object.keys(filterGroups).map((group, i) => ({
              label: t(`group.${group}`, { ns: 'webhook' }),
              value: String(i + 1),
              default: pageGroup === group,
              emoji: { id: '624184549001396225' }
            })),
            custom_id: `prompt:${PromptType.FILTERS}:${PromptAction.SET_PAGE}`,
            min_values: 1,
            max_values: 1
          }
        ]
      },
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.SELECT,
            placeholder: t('webhook.filters_placeholder'),
            options: filterGroups[pageGroup].map((filter) => ({
              label: t(`filters.${filter}`, { ns: 'webhook' }),
              value: filter,
              default: prompt.selected.includes(filter)
            })),
            custom_id: `prompt:${PromptType.FILTERS}:${PromptAction.SELECT}`,
            min_values: 0,
            max_values: filterGroups[pageGroup].length
          }
        ]
      },
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.SECONDARY,
            label: t('common.cancel'),
            custom_id: `prompt:${PromptType.FILTERS}:${PromptAction.STOP}`
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.SUCCESS,
            label: t('common.done'),
            custom_id: `prompt:${PromptType.FILTERS}:${PromptAction.DONE}`
          }
        ]
      }
    ]
  };
}

async function handleFiltersPrompt(ctx: ComponentContext, prompt: FiltersPrompt, action: PromptAction, t: TFunction) {
  // Handle action
  switch (action) {
    case PromptAction.SET_PAGE: {
      const newPage = parseInt(ctx.values[0], 10);
      if (newPage !== prompt.page && Object.keys(filterGroups)[newPage - 1]) prompt.page = newPage;
      else return ctx.acknowledge();
      break;
    }
    case PromptAction.STOP: {
      await deleteInteraction(ctx, t);
      await client.del(`prompt:${ctx.message.id}`);
      if (prompt.action) await client.del(`action:${prompt.action}`);
      return;
    }
    case PromptAction.SELECT: {
      const pageGroup = Object.keys(filterGroups)[prompt.page - 1];
      prompt.selected = prompt.selected
        .filter((filter) => !filterGroups[pageGroup].includes(filter))
        .concat([...new Set(ctx.values)]);
      break;
    }
    case PromptAction.DONE: {
      await client.del(`prompt:${ctx.message.id}`);
      return handoffAction(ctx, prompt.action, prompt.selected, t);
    }
  }

  // Set cache
  await client.set(`prompt:${ctx.message.id}`, JSON.stringify(prompt), 'EX', 10 * 60);
  if (prompt.action) await client.expire(`action:${prompt.action}`, 10 * 60);

  // Display page
  const pageGroup = Object.keys(filterGroups)[prompt.page - 1];
  await ctx.editParent({
    content: prompt.content || '',
    embeds: [
      {
        title: prompt.title,
        description: t('interactions.items_selected', { count: prompt.selected.length }),
        ...(prompt.footer ? { footer: { text: prompt.footer } } : {})
      }
    ],
    components: [
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.SELECT,
            placeholder: t('webhook.view_group_placeholder'),
            options: Object.keys(filterGroups).map((group, i) => ({
              label: t(`group.${group}`, { ns: 'webhook' }),
              value: String(i + 1),
              default: pageGroup === group,
              emoji: { id: '624184549001396225' }
            })),
            custom_id: `prompt:${PromptType.FILTERS}:${PromptAction.SET_PAGE}`,
            min_values: 1,
            max_values: 1
          }
        ]
      },
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.SELECT,
            placeholder: t('webhook.filters_placeholder'),
            options: filterGroups[pageGroup].map((filter) => ({
              label: t(`filters.${filter}`, { ns: 'webhook' }),
              value: filter,
              default: prompt.selected.includes(filter)
            })),
            custom_id: `prompt:${PromptType.FILTERS}:${PromptAction.SELECT}`,
            min_values: 0,
            max_values: filterGroups[pageGroup].length
          }
        ]
      },
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.SECONDARY,
            label: t('common.cancel'),
            custom_id: `prompt:${PromptType.FILTERS}:${PromptAction.STOP}`
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.SUCCESS,
            label: t('common.done'),
            custom_id: `prompt:${PromptType.FILTERS}:${PromptAction.DONE}`
          }
        ]
      }
    ]
  });
}
