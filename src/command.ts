import { AxiosResponse } from "axios";
import { AutocompleteContext, CommandContext, SlashCommand } from "slash-create";
import { isElevated, noAuthResponse } from "./util";
import { TrelloAPIError } from "./util/api";
import { prisma } from "./util/prisma";

export default abstract class Command extends SlashCommand {
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
