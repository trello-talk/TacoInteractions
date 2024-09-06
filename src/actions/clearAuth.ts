import { ComponentContext } from 'slash-create';

import { getData } from '../util';
import { ActionFunction, ActionType } from '../util/actions';
import { prisma } from '../util/prisma';
import { VERSION } from '../util/constants';

export const action: ActionFunction = {
  type: ActionType.USER_CLEAR_AUTH,
  async onAction(ctx: ComponentContext, action) {
    const { userData, t, trello } = await getData(ctx);
    if (!userData || !userData.trelloToken) return void ctx.editParent({ content: t('clearauth.no_auth'), components: [] });

    await trello.invalidate().catch(() => {});
    await prisma.user.update({
      where: { userID: action.user },
      data: { trelloID: null, trelloToken: null }
    });
    if (userData.trelloID)
      await prisma.webhook.updateMany({
        where: { memberID: userData.trelloID },
        data: { active: false, memberID: null }
      });
    if (userData.discordToken)
      await fetch(`https://discord.com/api/users/@me/applications/${process.env.DISCORD_APP_ID}/role-connection`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${userData.discordToken}`,
          'User-Agent': `Taco (https://github.com/trello-talk/TacoInteractions, v${VERSION})`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          metadata: { connected: false }
        })
      });

    return void ctx.editParent({ content: t('clearauth.done'), components: [] });
  }
};
