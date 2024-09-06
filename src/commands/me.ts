import { CommandContext, MessageEmbedOptions, SlashCreator } from 'slash-create';

import SlashCommand from '../command';
import { defaultContexts, getData, noAuthResponse, truncate } from '../util';
import { getMember } from '../util/api';

export default class MeCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'me',
      description: 'Get your own Trello user information.',
      deferEphemeral: true,
      ...defaultContexts
    });
  }

  async run(ctx: CommandContext) {
    console.log(ctx.authorizingIntegrationOwners)
    const { userData, t } = await getData(ctx);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);

    const member = await getMember(userData.trelloToken, userData.trelloID);

    const embed: MessageEmbedOptions = {
      author: {
        name: member.fullName ? `${truncate(member.fullName, 253 - member.username.length)} (${member.username})` : member.username,
        icon_url: member.avatarUrl ? member.avatarUrl + '/170.png' : null,
        url: member.url
      },
      description: member.bio ? truncate(member.bio, 4096) : '',
      footer: {
        text: t('me.footer', { boards: member.boards.length, orgs: member.idOrganizations.length })
      }
    };

    return {
      ephemeral: true,
      embeds: [embed]
    };
  }
}
