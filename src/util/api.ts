import { client } from './redis';
import Trello from './trello';
import { AxiosResponse } from 'axios';
import { TrelloBoard, TrelloBoardStar, TrelloCard, TrelloMember } from './types';

export interface TrelloBoardSubscriptions {
  cards: Record<string, boolean>;
  lists: Record<string, boolean>;
}

export class TrelloAPIError extends Error {
  status: number;

  constructor(response: AxiosResponse) {
    super('Trello API Error.');
    this.status = response.status;
    this.message = response.data;
  }

  toString() {
    return `TrelloAPIError [${this.status}] ${this.message}`;
  }
}

async function recacheKey(key: string, data: any, defaultTtl = 60 * 60) {
  const ttl = await client.ttl(key);
  await client.set(key, JSON.stringify(data), 'EX', ttl || defaultTtl);
}

export async function getMember(token: string, id: string): Promise<TrelloMember> {
  const key = `trello.member:${id}`;
  const cached = await client.get(key);
  if (cached) return JSON.parse(cached);

  const trello = new Trello(token);
  const response = await trello.getMember(id);
  if (response.status >= 400) throw new TrelloAPIError(response);

  await client.set(key, JSON.stringify(response.data), 'EX', 3 * 60 * 60);
  return response.data;
}

export async function updateBoardInMember(
  id: string,
  boardId: string,
  options: Partial<TrelloBoard>
): Promise<boolean> {
  const key = `trello.member:${id}`;
  const keyWhitelist = ['subscribed', 'starred', 'name', 'shortLink', 'shortUrl', 'closed'];
  const cached = await client.get(key);
  if (!cached) return false;

  for (const key in options) {
    if (!keyWhitelist.includes(key)) delete options[key];
  }

  const member: TrelloMember = JSON.parse(cached);
  member.boards.forEach((board) => {
    if (board.id === boardId) Object.assign(board, options);
  });

  await recacheKey(key, member);
  return true;
}

export async function starBoard(token: string, id: string, boardID: string): Promise<boolean> {
  const member = await getMember(token, id);
  const boardStar = member.boardStars.find((star) => star.idBoard === boardID);
  if (boardStar) return false;

  const trello = new Trello(token);
  const response = await trello.starBoard(id, boardID);
  if (response.status >= 400) throw new TrelloAPIError(response);

  const key = `trello.member:${id}`;
  const newBoardStar: TrelloBoardStar = response.data;
  member.boardStars.push(newBoardStar);

  await recacheKey(key, member);
  return true;
}

export async function unstarBoard(token: string, id: string, boardID: string): Promise<boolean> {
  const member = await getMember(token, id);
  const boardStar = member.boardStars.find((star) => star.idBoard === boardID);
  if (!boardStar) return false;

  const trello = new Trello(token);
  const response = await trello.unstarBoard(id, boardStar.id);
  if (response.status >= 400) throw new TrelloAPIError(response);

  const key = `trello.member:${id}`;
  member.boardStars = member.boardStars.filter((star) => star.idBoard !== boardID);

  await recacheKey(key, member);
  return true;
}

export async function getBoard(token: string, id: string, memberId: string, requireSubs = false): Promise<[TrelloBoard, TrelloBoardSubscriptions]> {
  const key = `trello.board:${id}`;
  const subsKey = `trello.board.sub:${id}:${memberId}`;
  const cached = await client.get(key);
  const cachedSubs = await client.get(subsKey);
  if (cached) {
    if (cachedSubs) return [JSON.parse(cached), JSON.parse(cachedSubs)];
    if (!requireSubs) return [JSON.parse(cached), null];
  };

  const trello = new Trello(token);
  const response = await trello.getBoard(id);
  if (response.status >= 400) throw new TrelloAPIError(response);

  // Seperate user-tied props from board
  const board: TrelloBoard = response.data;
  const subscribedLists: Record<string, boolean> = {};
  const subscribedCards: Record<string, boolean> = {};

  for (const list of board.lists!) {
    subscribedLists[list.id] = list.subscribed;
    delete list.subscribed;
  }

  for (const card of board.cards!) {
    subscribedCards[card.id] = card.subscribed;
    delete card.subscribed;
  }

  const subscriptions: TrelloBoardSubscriptions = {
    lists: subscribedLists,
    cards: subscribedCards,
  };

  await client.set(key, JSON.stringify(response.data), 'EX', 3 * 60 * 60);
  await client.set(subsKey, JSON.stringify(subscriptions), 'EX', 3 * 60 * 60);
  return [response.data, subscriptions];
}

export async function uncacheBoard(id: string): Promise<number> {
  return await client.del(`trello.board:${id}`);
}

export async function updateBoardSub(
  memberId: string,
  boardId: string,
  itemId: string,
  type: 'list' | 'card',
  value: boolean
): Promise<boolean> {
  const key = `trello.board.sub:${boardId}:${memberId}`;
  const cached = await client.get(key);
  if (!cached) return false;

  const subs: TrelloBoardSubscriptions = JSON.parse(cached);
  if (type === 'list') subs.lists[itemId] = value;
  else if (type === 'card') subs.cards[itemId] = value;

  await recacheKey(key, subs);
  return true;
}

export async function getCard(token: string, id: string): Promise<TrelloCard> {
  const key = `trello.card:${id}`;
  const cached = await client.get(key);
  if (cached) return JSON.parse(cached);

  const trello = new Trello(token);
  const response = await trello.getCard(id);
  if (response.status >= 400) throw new TrelloAPIError(response);

  await client.set(key, JSON.stringify(response.data), 'EX', 30 * 60);
  return response.data;
}
