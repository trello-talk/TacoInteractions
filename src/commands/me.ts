import { SlashCreator, CommandContext } from 'slash-create';
import SlashCommand from '../command';
import { noAuthResponse, truncate } from '../util';
import { getMember } from '../util/api';
import { prisma } from '../util/prisma';

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

    // TODO add more stuff to prompt
    return {
      ephemeral: true,
      embeds: [
        {
          author: {
            name: member.fullName
              ? `${truncate(member.fullName, 253 - member.username.length)} (${member.username})`
              : member.username,
            icon_url: member.avatarUrl ? member.avatarUrl + '/170.png' : null,
            url: member.url
          },
          description: member.bio ? truncate(member.bio, 4096) : '',
        }
      ]
    };
  }
}
