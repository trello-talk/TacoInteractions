import {
  SlashCommand,
  SlashCreator,
  ComponentType,
  ButtonStyle,
  CommandContext,
  CommandOptionType
} from 'slash-create';
import { getData } from '../util';
import { REPOSITORY } from '../util/constants';

export default class BotCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'bot',
      description: 'Bot-related information.',
      deferEphemeral: true,
      options: [
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'info',
          description: 'Get general information about the bot.'
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'donate',
          description: 'Get information on how to support development.'
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'github',
          description: 'Get the link to the GitHub repository.'
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'invite',
          description: 'Get the link to add Taco to your server.'
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'support',
          description: 'Get linked to the support server.'
        }
      ]
    });
  }

  async run(ctx: CommandContext) {
    const { t } = await getData(ctx);

    switch (ctx.subcommands[0]) {
      case 'info': {
        return {
          content: '<:tacoHappy:721291245887946783> ' + t('bot.info_content'),
          ephemeral: true,
          components: [
            {
              type: ComponentType.ACTION_ROW,
              components: [
                {
                  type: ComponentType.BUTTON,
                  style: ButtonStyle.LINK,
                  label: 'tacobot.app',
                  url: 'https://tacobot.app',
                  emoji: { id: '721291245887946783' }
                }
              ]
            }
          ]
        };
      }
      case 'donate': {
        return {
          content: t('bot.donate_content'),
          ephemeral: true,
          components: [
            {
              type: ComponentType.ACTION_ROW,
              components: [
                {
                  type: ComponentType.BUTTON,
                  style: ButtonStyle.LINK,
                  label: t('bot.donate_button'),
                  url: process.env.DONATE_LINK,
                  emoji: { id: '921015136569925662' }
                }
              ]
            }
          ]
        };
      }
      case 'github': {
        return {
          content: t('bot.github_content'),
          ephemeral: true,
          components: [
            {
              type: ComponentType.ACTION_ROW,
              components: [
                {
                  type: ComponentType.BUTTON,
                  style: ButtonStyle.LINK,
                  label: t('bot.github_button'),
                  url: REPOSITORY,
                  emoji: { id: '770770773497348146' }
                }
              ]
            }
          ]
        };
      }
      case 'invite': {
        return {
          content: t('bot.invite_content'),
          ephemeral: true,
          components: [
            {
              type: ComponentType.ACTION_ROW,
              components: [
                {
                  type: ComponentType.BUTTON,
                  style: ButtonStyle.LINK,
                  label: t('bot.invite_button'),
                  url: `https://discord.com/oauth2/authorize?client_id=${
                    process.env.BOT_INVITE_ID || process.env.DISCORD_APP_ID
                  }&permissions=536931392&scope=bot%20applications.commands`
                }
              ]
            }
          ]
        };
      }
      case 'support': {
        return {
          content: t('bot.support_content', { invite: process.env.SUPPORT_INVITE }),
          ephemeral: true
        };
      }
    }
    return {
      content: t('interactions.bad_subcommand'),
      ephemeral: true
    };
  }
}
