import { SlashCreator, CommandContext, CommandOptionType, AutocompleteContext } from 'slash-create';
import SlashCommand from '../command';
import { prisma } from '../util/prisma';
import { createT, langs } from '../util/locale';
import i18next from 'i18next';
import { oneLine } from 'common-tags';
import { getData } from '../util';

export default class ServerSettingsCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'server-settings',
      description: 'Edit server settings.',
      options: [
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'locale',
          description: "Set the server's preferred locale.",
          options: [
            {
              type: CommandOptionType.STRING,
              name: 'set',
              description: 'The locale to set to.',
              autocomplete: true
            }
          ]
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'role',
          description: "Set the server's Trello management role.",
          options: [
            {
              type: CommandOptionType.ROLE,
              name: 'set',
              description: 'The role to use as a Trello management role.'
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
    const { userData, serverData, t } = await getData(ctx);
    if (!ctx.guildID) return { content: t('interactions.no_server'), ephemeral: true };
    if (!ctx.member!.permissions.has('MANAGE_GUILD'))
      return { content: t('interactions.no_admin_perms'), ephemeral: true };

    switch (ctx.subcommands[0]) {
      case 'locale': {
        const setLocale = ctx.options.locale?.set;
        if (setLocale) {
          if (!langs.includes(setLocale)) return t('server_settings.invalid_locale');

          await prisma.server.upsert({
            where: { serverID: ctx.guildID },
            update: { locale: setLocale },
            create: { serverID: ctx.guildID, locale: setLocale }
          });
          const nt = createT(userData?.locale || setLocale);
          return nt('server_settings.set_locale', { name: `:flag_${nt('_.emoji')}: ${nt('_.name')}` });
        }

        const lng = serverData?.locale;
        return !lng
          ? t('server_settings.no_locale_set')
          : t('server_settings.locale', {
              name: langs.includes(lng)
                ? oneLine`
                :flag_${i18next.getResource(lng, 'commands', '_.emoji')}:
                ${i18next.getResource(lng, 'commands', '_.name')}`
                : lng
            });
      }
      case 'role': {
        const setRole = ctx.options.role?.set;
        if (setRole) {
          await prisma.server.upsert({
            where: { serverID: ctx.guildID },
            update: { trelloRole: setRole },
            create: { serverID: ctx.guildID, trelloRole: setRole }
          });

          return t('server_settings.set_role', { role: ctx.roles.get(setRole).name });
        }

        const role = serverData?.trelloRole;
        return !role
          ? t('server_settings.no_role_set')
          : t('server_settings.role', {
              role: `<@&${role}>`
            });
      }
    }

    return {
      content: t('interactions.bad_subcommand'),
      ephemeral: true
    };
  }
}
