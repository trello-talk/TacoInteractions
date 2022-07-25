import { ButtonStyle, CommandContext, ComponentType, SlashCommand, SlashCreator } from 'slash-create';

import { getData } from '../../util';

export default class AuthCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'auth',
      description: 'Sends a link to authenticate to Trello.',
      deferEphemeral: true
    });
  }

  async run(ctx: CommandContext) {
    const { t } = await getData(ctx);
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
