import { AxiosResponse } from 'axios';
import { User } from '@prisma/client';
import { AutocompleteContext, CommandContext, SlashCommand } from 'slash-create';
import {
  getBoardTextLabel,
  getCardTextLabel,
  getLabelTextLabel,
  getListTextLabel,
  isElevated,
  noAuthResponse,
  sortBoards,
  sortLists
} from './util';
import { getBoard, getMember, TrelloAPIError } from './util/api';
import { prisma } from './util/prisma';
import { TrelloBoard, TrelloCard, TrelloLabel, TrelloList } from './util/types';
import fuzzy from 'fuzzy';
import { createT } from './util/locale';

interface AutocompleteItemOptions<T = any> {
  userData?: User;
  query?: string;
  filter?(value: T, index: number, array: T[]): boolean;
}

export default abstract class Command extends SlashCommand {
  async autocompleteBoards(ctx: AutocompleteContext, opts: AutocompleteItemOptions<TrelloBoard> = {}) {
    const query = opts.query || ctx.options.board;
    if (opts.userData === undefined) {
      opts.userData = await prisma.user.findUnique({
        where: { userID: ctx.user.id }
      });
    }
    const userData = opts.userData;

    if (!userData || !userData.trelloToken) return [];

    try {
      const member = await getMember(userData.trelloToken, userData.trelloID);
      const boards = sortBoards(member.boards.filter(opts.filter || (() => true)));

      if (!query) return boards.map((b) => ({ name: getBoardTextLabel(b), value: b.id })).slice(0, 25);

      const result = fuzzy.filter(query, boards, {
        extract: (board) => board.name
      });
      return result.map((res) => ({ name: getBoardTextLabel(res.original), value: res.original.id })).slice(0, 25);
    } catch (e) {
      this.onAutocompleteError(e, ctx);
      return [];
    }
  }

  async autocompleteLists(ctx: AutocompleteContext, opts: AutocompleteItemOptions<TrelloList> = {}) {
    const query = opts.query || ctx.options.list;
    if (opts.userData === undefined) {
      opts.userData = await prisma.user.findUnique({
        where: { userID: ctx.user.id }
      });
    }
    const userData = opts.userData;

    if (!userData || !userData.trelloToken || !userData.currentBoard) return [];

    try {
      const [board, subs] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID, true);
      const lists = sortLists(board.lists.filter(opts.filter || (() => true)));

      if (!query) return lists.map((l) => ({ name: getListTextLabel(l, subs.lists[l.id]), value: l.id })).slice(0, 25);

      const result = fuzzy.filter(query, lists, {
        extract: (list) => list.name
      });
      return result
        .map((res) => ({ name: getListTextLabel(res.original, subs.lists[res.original.id]), value: res.original.id }))
        .slice(0, 25);
    } catch (e) {
      this.onAutocompleteError(e, ctx);
      return [];
    }
  }

  async autocompleteCards(ctx: AutocompleteContext, opts: AutocompleteItemOptions<TrelloCard> = {}) {
    const query = opts.query || ctx.options.card;
    if (opts.userData === undefined) {
      opts.userData = await prisma.user.findUnique({
        where: { userID: ctx.user.id }
      });
    }
    const userData = opts.userData;

    if (!userData || !userData.trelloToken || !userData.currentBoard) return [];

    try {
      const [board, subs] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID, true);
      // TODO sort cards
      const cards = board.cards.filter(opts.filter || (() => true));

      if (!query)
        return cards
          .map((c) => ({ name: getCardTextLabel(c, board.lists, subs.cards[c.id]), value: c.id }))
          .slice(0, 25);

      const result = fuzzy.filter(query, cards, {
        extract: (card) => card.name
      });
      return result
        .map((res) => ({
          name: getCardTextLabel(res.original, board.lists, subs.lists[res.original.id]),
          value: res.original.id
        }))
        .slice(0, 25);
    } catch (e) {
      this.onAutocompleteError(e, ctx);
      return [];
    }
  }

  async autocompleteLabels(ctx: AutocompleteContext, opts: AutocompleteItemOptions<TrelloLabel> = {}) {
    const query = opts.query || ctx.options.label;
    if (opts.userData === undefined) {
      opts.userData = await prisma.user.findUnique({
        where: { userID: ctx.user.id }
      });
    }
    const userData = opts.userData;
    const t = createT(userData?.locale);

    if (!userData || !userData.trelloToken || !userData.currentBoard) return [];

    try {
      const [board] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID);
      const labels = board.labels.filter(opts.filter || (() => true)).sort((a, b) => a.name.localeCompare(b.name));

      if (!query) return labels.map((l) => ({ name: getLabelTextLabel(l, t), value: l.id })).slice(0, 25);

      const result = fuzzy.filter(query, labels, {
        extract: (label) => label.name || '[unnamed]'
      });
      return result.map((res) => ({ name: getLabelTextLabel(res.original, t), value: res.original.id })).slice(0, 25);
    } catch (e) {
      this.onAutocompleteError(e, ctx);
      return [];
    }
  }

  async onAutocompleteError(err: Error, ctx: AutocompleteContext) {
    if ('response' in err) {
      const response = (err as any).response as AxiosResponse;
      if (response.status === 401 && response.data === 'invalid token')
        return await prisma.user.update({
          where: { userID: ctx.user.id },
          data: { trelloID: null, trelloToken: null }
        });
    }
  }

  async onError(err: Error, ctx: CommandContext) {
    if ('response' in err) {
      const response = (err as any).response as AxiosResponse;
      if (response.status === 401 && response.data === 'invalid token') {
        const userData = await prisma.user.update({
          where: { userID: ctx.user.id },
          data: { trelloID: null, trelloToken: null }
        });
        const t = createT(userData?.locale);
        return ctx.send(t('auth.expired'), { components: noAuthResponse(t).components });
      }
    }

    if (isElevated(ctx.user.id)) {
      console.log((err as any).toJSON());
      console.log((err as any).request);
      console.log((err as any).response);
      return ctx.send({
        content: '```js\n' + err.stack + '```',
        ephemeral: true
      });
    }

    // ? should i even localize this
    if (err instanceof TrelloAPIError) return ctx.send("An error occurred with Trello's API!\n" + err.toString());
    else return ctx.send('An error occurred!\n' + err.toString());
  }
}
