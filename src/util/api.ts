import { client } from './redis';
import Trello from './trello';
import { AxiosResponse } from 'axios';
import { TrelloBoard, TrelloBoardStar, TrelloMember } from './types';

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

  await recacheKey(key, JSON.stringify(member));
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

  await recacheKey(key, JSON.stringify(member));
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

  await recacheKey(key, JSON.stringify(member));
  return true;
}
