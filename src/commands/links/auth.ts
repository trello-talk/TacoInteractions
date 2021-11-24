import { SlashCommand, SlashCreator, ComponentType, ButtonStyle } from 'slash-create';

export default class AuthCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'auth',
      description: 'Sends a link to authenticate to Trello.',
      deferEphemeral: true
    });
  }

  async run() {
    return {
      content: 'You can authenticate with Trello using the button below:',
      ephemeral: true,
      components: [
        {
          type: ComponentType.ACTION_ROW,
          components: [
            {
              type: ComponentType.BUTTON,
              style: ButtonStyle.LINK,
              label: 'Authenticate with Trello',
              url: process.env.AUTH_LINK
            }
          ]
        }
      ]
    };
  }
}
