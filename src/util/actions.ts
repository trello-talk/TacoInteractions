import path from 'path';
import { ComponentContext } from 'slash-create';
import { iterateFolder } from '.';
import { logger } from '../logger';
import { client } from './redis';
import { nanoid } from 'nanoid'

export enum ActionType {
  DEBUG = -1,

  USER_CLEAR_DATA = 0,
  USER_CLEAR_AUTH = 1,
  USER_SWITCH = 2, // @deprecated

  BOARD_VIEW = 100,
  BOARD_WATCH = 101, // @deprecated
  BOARD_ARCHIVE = 102,
  BOARD_STAR = 110, // @deprecated

  CARD_VIEW = 200, // @deprecated
  CARD_WATCH = 201,
  CARD_ARCHIVE = 202,
  CARD_DELETE = 203,
  CARD_CREATE = 204,
  CARD_COMMENT = 210,

  LIST_VIEW = 300, // @deprecated
  LIST_WATCH = 301,
  LIST_ARCHIVE = 302,

  LABEL_VIEW = 400, // @deprecated
  // 401
  // 402
  LABEL_DELETE = 403
  // LABEL_CREATE = 404, // not nessesary
}

export type Action = RegularAction | BooleanAction | InputAction | CardCreateAction;

export interface RegularAction {
  type: ActionType;
  user: string;
}

export interface BooleanAction extends RegularAction {
  type:
    | ActionType.BOARD_WATCH
    | ActionType.BOARD_STAR
    | ActionType.BOARD_ARCHIVE
    | ActionType.CARD_WATCH
    | ActionType.CARD_ARCHIVE
    | ActionType.LIST_WATCH
    | ActionType.LIST_ARCHIVE;
  value: boolean;
}

export interface InputAction extends RegularAction {
  type: ActionType.CARD_COMMENT;
  input: string;
}

export interface CardCreateAction extends RegularAction {
  type: ActionType.CARD_CREATE;
  title: string;
  description?: string;
}

export interface ActionFunction {
  type: ActionType;
  requiresData?: boolean;
  onAction(ctx: ComponentContext, action: Action, data?: any): void | Promise<void>;
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
