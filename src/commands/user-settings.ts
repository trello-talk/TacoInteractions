import { AutocompleteContext, CommandContext, CommandOptionType, SlashCreator } from 'slash-create';

import SlashCommand from '../command';
import { getData } from '../util';
import { createT, langs } from '../util/locale';
import { prisma } from '../util/prisma';

export default class UserSettingsCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'user-settings',
      description: 'Edit user settings.',
      deferEphemeral: true,
      options: [
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'locale',
          description: 'Set your preferred locale.',
          options: [
            {
              type: CommandOptionType.STRING,
              name: 'set',
              description: 'The locale to set to.',
              autocomplete: true
            }
          ]
        }
      ]
    });
  }

  async autocomplete(ctx: AutocompleteContext) {
    if (ctx.subcommands[0] === 'locale') return this.autocompleteLocales(ctx, ctx.options.locale.set);
  }

  async run(ctx: CommandContext) {
    const { userData, t } = await getData(ctx);

    switch (ctx.subcommands[0]) {
      case 'locale': {
        const setLocale = ctx.options.locale?.set;
        if (setLocale) {
          if (!langs.some((lang) => lang.code === setLocale))
            return {
              content: t('user_settings.invalid_locale'),
              ephemeral: true
            };

          await prisma.user.upsert({
            where: { userID: ctx.user.id },
            update: { locale: setLocale },
            create: { userID: ctx.user.id, locale: setLocale }
          });
          const nt = createT(setLocale);
          return {
            content: nt('user_settings.set_locale', { name: `:flag_${nt('_.emoji')}: ${nt('_.name')}` }),
            ephemeral: true
          };
        }

        const lng = userData?.locale || 'en';
        const lang = langs.find((lang) => lang.code === lng);
        return {
          content: t('user_settings.locale', {
            name: lang ? `:${lang.emoji}: ${lang.name}` : lng
          }),
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
