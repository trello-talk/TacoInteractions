import { TFunction } from 'i18next';
import { ButtonStyle, ComponentContext, ComponentType, EditMessageOptions } from 'slash-create';
import { deleteInteraction } from '.';
import { Action, actions } from './actions';
import { createAndGetUserT, formatNumber } from './locale';
import { client } from './redis';

export enum PromptType {
  LIST,
  QUERY,
  SELECT
}

export enum PromptAction {
  PREVIOUS,
  NEXT,
  STOP,
  SELECT,
  DONE
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

/** Uses select menus, 25 items per page */
export interface QueryPrompt extends PromptBase {
  type: PromptType.QUERY;
  /** The display options, also determining max pages */
  display: PartialSelectMenuOption[];
  /** The values paired with the index of the display array */
  values: any[];
  /** The placeholder string to use in select menu */
  placeholder?: string;
}

/** Uses select menus, 25 items per page */
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

export type Prompt = ListPrompt | QueryPrompt | SelectPrompt;

export async function handlePrompt(ctx: ComponentContext) {
  const [t, data] = await createAndGetUserT(ctx.user.id);

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
      return handleListPrompt(ctx, prompt as ListPrompt, action, t, data?.locale);
    case PromptType.QUERY:
      return handleQueryPrompt(ctx, prompt as QueryPrompt, action, t, data?.locale);
    case PromptType.SELECT:
      return handleSelectPrompt(ctx, prompt as SelectPrompt, action, t, data?.locale);
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
    embeds: [
      {
        title: prompt.title,
        ...(prompt.footer ? { footer: { text: prompt.footer } } : {})
      }
    ],
    components: [
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.SELECT,
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
  selected?: number[],
  lang?: string
): Promise<EditMessageOptions> {
  const prompt: SelectPrompt = {
    ...options,
    type: PromptType.SELECT,
    page: 1,
    selected: []
  };

  // Place selected values
  const max = Math.ceil(prompt.display.length / 25);
  prompt.selected = new Array(max).fill([]);
  for (const i of selected) {
    const pageIndex = Math.floor(i / 25);
    prompt.selected[pageIndex].push(i);
  }

  await client.set(`prompt:${messageID}`, JSON.stringify(prompt), 'EX', 10 * 60);

  const offset = (prompt.page - 1) * 25;
  return {
    content: prompt.content || '',
    embeds: [
      {
        title: prompt.title,
        description: `${selected} item(s) selected`,
        ...(prompt.footer ? { footer: { text: prompt.footer } } : {})
      }
    ],
    components: [
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.SELECT,
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
            label: 'Save',
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
      prompt.selected[prompt.page - 1] = [...new Set(prompt.values.map((v) => parseInt(v, 10)))];
      break;
    case PromptAction.DONE:
      await deleteInteraction(ctx, t);
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
            options: prompt.display
              .map((opt, i) => ({ ...opt, value: String(i), default: prompt.selected[prompt.page - 1].includes(i) }))
              .slice(offset, prompt.page * 25),
            custom_id: `prompt:${PromptType.SELECT}:${PromptAction.SELECT}`,
            min_values: 0,
            max_values: 25
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
  });
}
