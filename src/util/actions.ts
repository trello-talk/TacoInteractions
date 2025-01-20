import { nanoid } from 'nanoid';
import path from 'path';
import { ComponentContext, ModalInteractionContext } from 'slash-create';

import { logger } from '../logger';
import { iterateFolder } from '.';
import { client } from './redis';
import { DiscordWebhook, TrelloBoard } from './types';

export enum ActionType {
  DEBUG = -1,
  USER_CLEAR_DATA = 0,
  USER_CLEAR_AUTH = 1,
  USER_SWITCH = 2,
  DELETE_LABEL = 3,
  DELETE_CARD = 4,
  DELETE_WEBHOOK = 5,
  SET_CARD_LABELS = 6,
  SET_CARD_MEMBERS = 7,
  CREATE_WEBHOOK = 8,
  SET_WEBHOOK_FILTERS = 9,
  SET_WEBHOOK_CARDS = 10,
  SET_WEBHOOK_LISTS = 11,
  REPAIR_AFTER_CHANNEL = 12,
  REPAIR_AFTER_WEBHOOK = 13,
  CREATE_CARD = 14
}

export type Action = RegularAction | BooleanAction | InputAction | CardCreateAction | WebhookCreateAction | WebhookEditAction | RepairWebhookAction;

export interface RegularAction {
  type: ActionType;
  user: string;
  extra: string;
}

export interface BooleanAction extends RegularAction {
  value: boolean;
}

export interface InputAction extends RegularAction {
  input: string;
}

export interface CardCreateAction extends RegularAction {
  title: string;
  description?: string;
}

export interface WebhookCreateAction extends RegularAction {
  type: ActionType.CREATE_WEBHOOK;
  board: TrelloBoard;
  channelID: string;
  threadID?: string;
  name?: string;
  webhooks: DiscordWebhook[];
}

export interface WebhookEditAction extends RegularAction {
  type: ActionType.SET_WEBHOOK_FILTERS | ActionType.SET_WEBHOOK_CARDS | ActionType.SET_WEBHOOK_LISTS;
  webhookID: number;
}

export interface RepairWebhookAction extends RegularAction {
  type: ActionType.REPAIR_AFTER_CHANNEL | ActionType.REPAIR_AFTER_WEBHOOK;
  webhookID: number;
  webhookName: string;
  channelID: string;
  channelType: number;
  webhooks: DiscordWebhook[];
}
export interface ActionFunction<T = Action> {
  type: ActionType;
  requiresData?: boolean;
  onAction(ctx: ComponentContext | ModalInteractionContext, action: T, data?: any): void | Promise<void>;
}

export const actions = new Map<ActionType, ActionFunction>();

export const load = () => iterateFolder(path.resolve(__dirname, '../actions'), loadAction);

export function loadAction(filePath: string) {
  logger.debug('Loading action', filePath);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const file = require(filePath);
  if (file.action) actions.set(file.action.type, file.action);
}

export async function createAction(type: ActionType, user: string, opts?: any) {
  const id = nanoid();
  await client.set(`action:${id}`, JSON.stringify({ type, user, ...opts }), 'EX', 10 * 60);
  return id;
}
