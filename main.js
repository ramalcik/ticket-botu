const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, 
    ChannelType, PermissionFlagsBits 
} = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const fs = require('fs');
const config = require('./config.json');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`${client.user.tag} giriş yapıldı.`);

    client.user.setPresence({
        status: 'dnd',
        activities: [{ name: 'Destek Taleplerini Yönetiyor', type: 3 }]
    });
    
    const voiceChannel = client.channels.cache.get(config.botseskanal); 
    if (voiceChannel) {
        joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: false 
        });
        console.log("Bot ses kanalına katıldı!");
    } else {
        console.log("Ses kanalı bulunamadı.");
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_menu') {
        const selectedValue = interaction.values[0];

        if (selectedValue === 'sifirla') {
            const resetMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_menu')
                .setPlaceholder('Bir seçenek seçin')
                .addOptions([
                    {
                        label: 'Destek / Bug',
                        description: 'Destek veya bug bildirimi',
                        value: 'destek_bug',
                        emoji: { id: '1184908090794061917'}
                    },
                    {
                        label: 'Donate Satın Alım',
                        description: 'Donate satın alım işlemleri',
                        value: 'donate',
                        emoji: { id: '1338886645142782103'}
    
                    },
                    {
                        label: 'Diğer Kategoriler',
                        description: 'Diğer kategoriler ile ilgili talepler',
                        value: 'diger',
                        emoji: { id: '1208377867088691254'}
    
                    },
                    {
                        label: 'Oyun İçi Sorunlar',
                        description: 'Oyun içi yaşadığınız sorunlar',
                        value: 'oyun_ici',
                        emoji: { id: '1338886969584910336'}
    
                    },
                    {
                        label: 'Sıfırla',
                        description: 'Seçiminizi sıfırlayın',
                        value: 'sifirla',
                        emoji: { id: '1338887843375878280'}
    
                    }
                ]);
            await interaction.update({ 
                components: [new ActionRowBuilder().addComponents(resetMenu)] 
            });
            return;
        }

        let kategoriEk = '';
        switch (selectedValue) {
            case 'destek_bug':
                kategoriEk = 'destek-bug';
                break;
            case 'donate':
                kategoriEk = 'donate-satin-alim';
                break;
            case 'diger':
                kategoriEk = 'diger-kategoriler';
                break;
            case 'oyun_ici':
                kategoriEk = 'oyun-ici-sorunlar';
                break;
            default:
                kategoriEk = 'ticket';
        }

        const ticketChannel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}-${kategoriEk}`,
            type: ChannelType.GuildText,
            parent: config.ticketCategory,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });

        const embed = new EmbedBuilder()
            .setTitle("Ticket Açıldı")
            .setDescription("Destek ekibi en kısa sürede sizinle ilgilenecektir.")
            .setColor("#00ff00");

        const closeButton = new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Ticketi Kapat')
            .setStyle(ButtonStyle.Danger);

        await ticketChannel.send({ 
            embeds: [embed], 
            components: [new ActionRowBuilder().addComponents(closeButton)]
        });

        const ticketData = {
            user: interaction.user.username,
            channelId: ticketChannel.id,
            createdAt: new Date().toISOString(),
            category: selectedValue
        };

        const ticketFolder = './ticket';
        if (!fs.existsSync(ticketFolder)) {
            fs.mkdirSync(ticketFolder);
        }
        fs.writeFileSync(`${ticketFolder}/${ticketChannel.id}.json`, JSON.stringify(ticketData, null, 2));

        await interaction.reply({ content: `Ticketiniz oluşturuldu: ${ticketChannel}`, ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await interaction.reply({ content: "Ticket 5 saniye içinde kapanacak.", ephemeral: true });

        setTimeout(async () => {
            const messages = await interaction.channel.messages.fetch({ limit: 100 });
            let logText = `**Ticket Log - ${interaction.channel.name}**\n\n`;

            messages.reverse().forEach(msg => {
                logText += `[${msg.createdAt}] ${msg.author.username}: ${msg.content}\n`;
            });

            const logChannel = interaction.guild.channels.cache.get(config.ticketLogChannel);
            if (logChannel) {
                logChannel.send(`Ticket Kapatıldı: ${interaction.channel.name}`);
                logChannel.send(`\`\`\`${logText}\`\`\``);
            }

            await interaction.channel.delete();
        }, 5000);
    }
});

client.on('messageCreate', async message => {
    if (message.content === `${config.prefix}ticket`) {
        if (!config.owners.includes(message.author.id)) {
            return message.reply("Bu komutu kullanma yetkiniz yok.");
        }
        const embed = new EmbedBuilder()
            .setDescription(`[Destek Sistemi](https://discord.gg/bRUuJcV5tM)

**Destek Sistemi Hakkında:**
Aşağıdaki seçeneklerden uygun olanı seçerek hemen bir ticket oluşturabilirsiniz.

**Sunucu Bilgisi:**
Sunucumuzun kurallarını okumayı unutmayın.`)
            .setImage('https://cdn.discordapp.com/attachments/1338566852288446485/1338882174258118779/SDOsDQa.png?ex=67acb2b1&is=67ab6131&hm=c5329331a5cd611a928be16d6467ed8bdc1c5c1bc7a8ef842b05b4601a7f81e6&'); // Buraya kendi resim linkinizi ekleyin.

        const menu = new StringSelectMenuBuilder()
            .setCustomId('ticket_menu')
            .setPlaceholder('Bir seçenek seçin')
            .addOptions([
                {
                    label: 'Destek / Bug',
                    description: 'Destek veya bug bildirimi',
                    value: 'destek_bug',
                    emoji: { id: '1184908090794061917'}
                },
                {
                    label: 'Donate Satın Alım',
                    description: 'Donate satın alım işlemleri',
                    value: 'donate',
                    emoji: { id: '1338886645142782103'}

                },
                {
                    label: 'Diğer Kategoriler',
                    description: 'Diğer kategoriler ile ilgili talepler',
                    value: 'diger',
                    emoji: { id: '1208377867088691254'}

                },
                {
                    label: 'Oyun İçi Sorunlar',
                    description: 'Oyun içi yaşadığınız sorunlar',
                    value: 'oyun_ici',
                    emoji: { id: '1338886969584910336'}

                },
                {
                    label: 'Sıfırla',
                    description: 'Seçiminizi sıfırlayın',
                    value: 'sifirla',
                    emoji: { id: '1338887843375878280'}

                }
            ]);

        await message.channel.send({ 
            embeds: [embed], 
            components: [new ActionRowBuilder().addComponents(menu)] 
        });
    }
});

client.login(config.token);
