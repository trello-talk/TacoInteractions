import 'dotenv/config';

(async () => {
  if (!process.env.DISCORD_APP_ID || !process.env.DISCORD_BOT_TOKEN) {
    console.error('No token and/or app ID provided.');
    process.exit(1);
  }

  const ROLE_METADATA_URL = `https://discord.com/api/v10/applications/${process.env.DISCORD_APP_ID}/role-connections/metadata`;

  const response = await fetch(
    ROLE_METADATA_URL,
    { headers: { 'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}` } }
  );

  if (response.status !== 200) {
    console.error('Failed to fetch role metadata', await response.text());
    process.exit(1);
  }

  const json = await response.json();
  if (json.length !== 0) {
    console.log('Role metadata already applied.')
  } else {
    const putResponse = await fetch(
      ROLE_METADATA_URL,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([
          {
            key: "connected",
            type: 7,
            name: "Connected",
            description: "The user has connected a Trello account"
          }
        ])
      }
    );

    if (putResponse.status === 200) {
      console.log('Updated role metadata.')
    } else  {
      console.error('Failed to update role metadata', await response.text());
      process.exit(1);
    }
  }
})();
