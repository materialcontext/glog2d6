// Define custom Document classes
CONFIG.Actor.documentClass = GLOG2D6Actor;
CONFIG.Item.documentClass = GLOG2D6Item;

Hooks.once('init', async function() {});

Hooks.once("ready", async function() {
    // register sheets
    await foundry.applications.handlebars.loadTemplates([]);

    // Register partials
    Handlebars.registerPartial('', await foundry.applications.handlebars.getTemplate(''));

});

Hooks.on('renderSidebarTab', (app, html) => {});
Hooks.on("chatMessage", (log, msg) => {});
Hooks.on("renderChatMessageHTML", (message, html) => {});
