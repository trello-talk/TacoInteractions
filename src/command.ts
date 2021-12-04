import { AxiosResponse } from "axios";
import { AutocompleteContext, CommandContext, SlashCommand } from "slash-create";
import { getBoardTextLabel, getListTextLabel, isElevated, noAuthResponse, sortBoards, sortLists } from "./util";
import { getBoard, getMember, TrelloAPIError } from "./util/api";
import { prisma } from "./util/prisma";
import { TrelloBoard, TrelloList } from "./util/types";
import fuzzy from 'fuzzy';

interface AutocompleteItemOptions<T = any> {
  query?: string;
  filter?(value: T, index: number, array: T[]): boolean;
}

export default abstract class Command extends SlashCommand {
  async autocompleteBoards(ctx: AutocompleteContext, opts?: AutocompleteItemOptions<TrelloBoard>) {
    const query = opts?.query || ctx.options.board;
    const userData = await prisma.user.findUnique({
      where: { userID: ctx.user.id }
    });

    if (!userData || !userData.trelloToken) return [];

    try {
      const member = await getMember(userData.trelloToken, userData.trelloID);
      const boards = sortBoards(member.boards.filter(opts?.filter || (() => true)));

      if (!query) return boards
        .map((b) => ({ name: getBoardTextLabel(b), value: b.id }))
        .slice(0, 25);

      const result = fuzzy.filter(query, boards, {
        extract: (board) => board.name
      });
      return result
        .map((res) => ({ name: getBoardTextLabel(res.original), value: res.original.id }))
        .slice(0, 25);
    } catch (e) {
      this.onAutocompleteError(e, ctx)
      return [];
    }
  }

  async autocompleteLists(ctx: AutocompleteContext, opts?: AutocompleteItemOptions<TrelloList>) {
    const query = opts?.query || ctx.options.list;
    const userData = await prisma.user.findUnique({
      where: { userID: ctx.user.id }
    });

    if (!userData || !userData.trelloToken || !userData.currentBoard) return [];

    try {
      const [board, subs] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID, true);
      const lists = sortLists(board.lists.filter(opts?.filter || (() => true)));

      if (!query) return lists
        .map((l) => ({ name: getListTextLabel(l, subs.lists[l.id]), value: l.id }))
        .slice(0, 25);

      const result = fuzzy.filter(query, lists, {
        extract: (list) => list.name
      });
      return result
        .map((res) => ({ name: getListTextLabel(res.original, subs.lists[res.original.id]), value: res.original.id }))
        .slice(0, 25);
    } catch (e) {
      this.onAutocompleteError(e, ctx)
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
        await prisma.user.update({
          where: { userID: ctx.user.id },
          data: { trelloID: null, trelloToken: null }
        });
        return ctx.send('Your authentication token has expired! Please re-authenticate to continue.', { components: noAuthResponse.components })
      }
    }

    if (isElevated(ctx.user.id)) {
      console.log((err as any).toJSON());
      console.log((err as any).request);
      console.log((err as any).response);
      return ctx.send({
        content: '\`\`\`js\n' + err.stack + '\`\`\`',
        ephemeral: true
      });
    }

    if (err instanceof TrelloAPIError)
      return ctx.send("An error occurred with Trello's API!\n" + err.toString());
    else return ctx.send('An error occurred!\n' + err.toString());
  }
}
