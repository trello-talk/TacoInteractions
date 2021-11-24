import { client } from './redis';
import Trello from './trello';
import { AxiosResponse } from 'axios';
import { TrelloBoard, TrelloMember } from './types';

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
  const keyWhitelist = ['subscribed', 'starred', 'pinned', 'name', 'shortLink', 'shortUrl', 'closed'];
  const cached = await client.get(key);
  if (!cached) return false;

  for (const key in options) {
    if (!keyWhitelist.includes(key)) delete options[key];
  }

  const ttl = await client.ttl(key);
  const member: TrelloMember = JSON.parse(cached);

  member.boards.forEach((board) => {
    if (board.id === boardId) Object.assign(board, options);
  });

  await client.set(key, JSON.stringify(member), 'EX', ttl || 60 * 60);
  return true;
}
