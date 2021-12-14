import path from 'path';
import { ComponentContext } from 'slash-create';
import { iterateFolder } from '.';
import { logger } from '../logger';
import { client } from './redis';
import { nanoid } from 'nanoid';

export enum ActionType {
  DEBUG = -1,

  USER_CLEAR_DATA = 0,
  USER_CLEAR_AUTH = 1,
  USER_SWITCH = 2, // @deprecated

  DELETE_LABEL = 10,
  DELETE_CARD = 11,

  SET_CARD_LABELS = 20,
  SET_CARD_MEMBERS = 21
}

export type Action = RegularAction | BooleanAction | InputAction | CardCreateAction;

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

export interface ActionFunction<T = Action> {
  type: ActionType;
  requiresData?: boolean;
  onAction(ctx: ComponentContext, action: T, data?: any): void | Promise<void>;
}

export const actions = new Map<ActionType, ActionFunction>();

export const load = () => iterateFolder(path.resolve(__dirname, '../actions'), loadAction);

export function loadAction(filePath: string) {
  logger.debug('Loading action', filePath);
  const file = require(filePath);
  if (file.action) actions.set(file.action.type, file.action);
}

export async function createAction(type: ActionType, user: string, opts?: any) {
  const id = nanoid();
  await client.set(`action:${id}`, JSON.stringify({ type, user, ...opts }), 'EX', 10 * 60);
  return id;
}
