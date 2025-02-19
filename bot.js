require('dotenv').config();
const { Telegraf, Scenes, session } = require('telegraf');
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    dialect: 'mysql'
});

const User = sequelize.define('User', {
    fullName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: false
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    isAdmin: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const stage = new Scenes.Stage();

const browseScene = new Scenes.BaseScene('browse');
browseScene.enter((ctx) => ctx.reply('You can browse the following commands: \n1. /myprofile \n2. /help'));
browseScene.command('myprofile', async (ctx) => {
    const user = await User.findOne({ where: { id: ctx.from.id } });
    if (user) {
        ctx.reply(`Your Profile:\nName: ${user.fullName}\nEmail: ${user.email}\nPhone: ${user.phone}\nUsername: ${user.username}`);
    } else {
        ctx.reply('You are not registered yet.');
    }
});
browseScene.command('help', (ctx) => {
    ctx.reply('Available commands: \n/start \n/browse \n/admin');
});

stage.register(browseScene);
bot.use(session());
bot.use(stage.middleware());

bot.start((ctx) => {
    ctx.reply('Welcome! Please register by sending your full name, email, phone number, and username (format: name,email,phone,username).');
});

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const message = ctx.message.text;

    let user = await User.findOne({ where: { id: userId } });

    if (!user) {
        const [fullName, email, phone, username] = message.split(',');
        try {
            user = await User.create({ fullName, email, phone, username });
            ctx.reply('Registration successful! You can now browse.');
        } catch (error) {
            ctx.reply('There was an error during registration. Please try again.');
        }
    } else {
        ctx.reply('You are already registered.');
    }
});

bot.command('admin', async (ctx) => {
    const user = await User.findOne({ where: { id: ctx.from.id } });

    if (user && user.isAdmin) {
        ctx.reply('Admin commands: /viewusers, /promote, /demote');
    } else {
        ctx.reply('You are not authorized to access admin commands.');
    }
});

bot.command('viewusers', async (ctx) => {
    const user = await User.findOne({ where: { id: ctx.from.id } });
    
    if (user && user.isAdmin) {
        const users = await User.findAll();
        const userList = users.map(u => `${u.username} - ${u.fullName}`).join('\n');
        ctx.reply(`Registered users:\n${userList}`);
    } else {
        ctx.reply('You are not authorized to access this command.');
    }
});

bot.command('promote', async (ctx) => {
    const user = await User.findOne({ where: { id: ctx.from.id } });

    if (user && user.isAdmin) {
        const usernameToPromote = ctx.message.text.split(' ')[1];
        if (!usernameToPromote) {
            ctx.reply('Please specify a username to promote.');
            return;
        }

        const userToPromote = await User.findOne({ where: { username: usernameToPromote } });
        if (userToPromote) {
            userToPromote.isAdmin = true;
            await userToPromote.save();
            ctx.reply(`${usernameToPromote} has been promoted to admin.`);
        } else {
            ctx.reply('User not found.');
        }
    } else {
        ctx.reply('You are not authorized to access this command.');
    }
});

bot.command('demote', async (ctx) => {
    const user = await User.findOne({ where: { id: ctx.from.id } });

    if (user && user.isAdmin) {
        const usernameToDemote = ctx.message.text.split(' ')[1];
        if (!usernameToDemote) {
            ctx.reply('Please specify a username to demote.');
            return;
        }

        const userToDemote = await User.findOne({ where: { username: usernameToDemote } });
        if (userToDemote) {
            userToDemote.isAdmin = false;
            await userToDemote.save();
            ctx.reply(`${usernameToDemote} has been demoted from admin.`);
        } else {
            ctx.reply('User not found.');
        }
    } else {
        ctx.reply('You are not authorized to access this command.');
    }
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));