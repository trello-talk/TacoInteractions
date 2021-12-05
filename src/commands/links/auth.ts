import { SlashCommand, SlashCreator, ComponentType, ButtonStyle, CommandContext } from 'slash-create';
import { createUserT } from '../../util/locale';

export default class AuthCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'auth',
      description: 'Sends a link to authenticate to Trello.',
      deferEphemeral: true
    });
  }

  async run(ctx: CommandContext) {
    const t = await createUserT(ctx.user.id);
    return {
      content: t('auth.content'),
      ephemeral: true,
      components: [
        {
          type: ComponentType.ACTION_ROW,
          components: [
            {
              type: ComponentType.BUTTON,
              style: ButtonStyle.LINK,
              label: t('auth.button'),
              url: process.env.AUTH_LINK
            }
          ]
        }
      ]
    };
  }
}
