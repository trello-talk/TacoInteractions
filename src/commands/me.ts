import { SlashCreator, CommandContext, MessageEmbedOptions } from 'slash-create';
import SlashCommand from '../command';
import { noAuthResponse, truncate } from '../util';
import { getMember } from '../util/api';
import { prisma } from '../util/prisma';
import { createT } from '../util/locale';

export default class MeCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'me',
      description: 'Get your own Trello user information.',
      deferEphemeral: true
    });
  }

  async run(ctx: CommandContext) {
    const userData = await prisma.user.findUnique({
      where: { userID: ctx.user.id }
    });

    if (!userData || !userData.trelloToken) return noAuthResponse;

    const member = await getMember(userData.trelloToken, userData.trelloID);
    const t = createT(userData.locale);

    const embed: MessageEmbedOptions = {
      author: {
        name: member.fullName
          ? `${truncate(member.fullName, 253 - member.username.length)} (${member.username})`
          : member.username,
        icon_url: member.avatarUrl ? member.avatarUrl + '/170.png' : null,
        url: member.url
      },
      description: member.bio ? truncate(member.bio, 4096) : '',
      footer: {
        text: t('me.footer', { boards: member.boards.length, orgs: member.idOrganizations.length })
      }
    }

    return {
      ephemeral: true,
      embeds: [embed]
    };
  }
}
